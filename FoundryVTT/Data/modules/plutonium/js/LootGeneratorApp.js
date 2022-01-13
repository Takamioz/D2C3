import {SharedConsts} from "../shared/SharedConsts.js";
import {LGT, Util} from "./Util.js";
import {UtilActors} from "./UtilActors.js";
import {UtilPatchActorDrop} from "./UtilPatch.js";
import {UtilEvents} from "./UtilEvents.js";
import {UtilCanvas} from "./UtilCanvas.js";
import {FolderPathBuilder} from "./FolderPathBuilder.js";
import {ChooseImporter} from "./ChooseImporter.js";
import {UtilFolders} from "./UtilFolders.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {Vetools} from "./Vetools.js";

const _IMG = `icons/containers/chest/chest-worn-oak-tan.webp`;

class LootGenUiFvtt extends LootGenUi {
	static _er (...args) {
		return Vetools.withUnpatchedDiceRendering(() => Renderer.get().setFirstSection(true).render(...args));
	}
}

class LootGeneratorApp extends Application {
	// region External
	static preInit () {
		this._preInit_registerKeybinds();
	}

	static _preInit_registerKeybinds () {
		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"LootGeneratorApp__open",
			{
				name: "Open Loot Generator",
				editable: [],
				onDown: () => {
					const app = new this();
					app.render(true);
					return true;
				},
				restricted: true,
			},
		);
	}

	static init () {
		UtilPatchActorDrop.registerDrop(LootGeneratorApp._pHandleActorDrop);
		document.getElementById("board").addEventListener("drop", this._pHandleBoardDrop.bind(this));
	}
	// endregion

	constructor () {
		super(
			{
				title: "Loot Generator",
				template: `${SharedConsts.MODULE_LOCATION}/template/LootGeneratorApp.hbs`,
				width: 960,
				height: Util.getMaxWindowHeight(),
				resizable: true,
			},
		);

		this._lootGenUi = null;
	}

	activateListeners ($html) {
		super.activateListeners($html);

		this._pRender($html).then(null);
	}

	async _pRender ($html) {
		this._lootGenUi = new LootGenUiFvtt({
			spells: await this._pLoadSpells(),
			items: await this._pLoadItems(),
			ClsLootGenOutput: LootGenOutputFvtt,
		});

		const $stgLhs = $html.find(`[data-name="wrp-lhs"]`);
		const $stgRhs = $html.find(`[data-name="wrp-rhs"]`);

		await this._lootGenUi.pInit();
		this._lootGenUi.render({$stgLhs, $stgRhs});
	}

	async _pLoadSpells () {
		const [stockSpells, brew] = await Promise.all([
			DataUtil.spell.pLoadAll(),
			BrewUtil.pAddBrewData(),
		]);
		return stockSpells.concat(brew?.spell || []);
	}

	async _pLoadItems () {
		const stockItems = await Renderer.item.pBuildList();
		const homebrew = await BrewUtil.pAddBrewData();
		const brewItems = await Renderer.item.pGetItemsFromHomebrew(homebrew);
		return stockItems.concat(brewItems);
	}

	static async pImportLoot ({loot, actor = null, isLogToChat = false, isNotify = false, folderId, pack}) {
		if (pack && actor) throw new Error(`Only one of "pack" or "actor" may be specified!`);

		try {
			await this._pImportLoot({loot, actor, isLogToChat, folderId, pack});
			if (isNotify) ui.notifications.info(`Imported loot${actor ? ` to actor "${actor.name}"` : ""}!`);
		} catch (e) {
			ui.notifications.error(`Failed to import loot${actor ? ` to actor "${actor.name}"` : ""}. ${VeCt.STR_SEE_CONSOLE}`);
			setTimeout(() => { throw e; });
		}
	}

	static async _pImportLoot ({loot, actor, isLogToChat, folderId, pack}) {
		const cacheImporter = {}; // Re-use the same importer(s) for multiple item/spells

		const baseOpts = {};
		if (loot.isTemp) baseOpts.isTemp = true;

		if (loot.currency) {
			if (actor) await UtilActors.pAddCurrencyToActor({currency: loot.currency, actor});
			else {
				const itemImporter = await this._pImportLoot_pGetCacheImporter({cacheImporter, page: UrlUtil.PG_ITEMS, actor, pack});
				const importOpts = {...baseOpts, folderId};
				await itemImporter.pImportCurrency(loot.currency, importOpts);
			}
		}

		const importSummaries = [];
		for (const {page, entity, options} of loot.entityInfos || []) {
			const importer = await this._pImportLoot_pGetCacheImporter({cacheImporter, page, actor, pack});
			const importOpts = {...baseOpts, ...(options || {}), folderId};
			importSummaries.push({importSummary: await importer.pImportEntry(entity, importOpts), count: options?.quantity});
		}

		const {errorMessage, htmlSummary} = this._getSummaryHtml({loot, importSummaries});

		if (errorMessage) {
			console.error(...LGT, errorMessage);
			ui.notifications.error(`Error occurred during item linking! ${VeCt.STR_SEE_CONSOLE}`);
		}

		if (isLogToChat) await this._pDoLogToChat({loot, htmlSummary, actor});
	}

	static async _pImportLoot_pGetCacheImporter ({cacheImporter, page, actor, pack}) {
		if (!cacheImporter[page]) {
			cacheImporter[page] = ChooseImporter.getImporter(page, actor);
			if (pack) cacheImporter[page].pack = pack;
			await cacheImporter[page].pInit();
		}

		return cacheImporter[page];
	}

	static _getSummaryHtml ({loot, importSummaries}) {
		let errorMessage = "";
		const lisImportedDatas = importSummaries
			.map(({importSummary, count}) => {
				count = count ?? 1;

				return (importSummary.imported || [])
					.map(importedDocument => {
						const ptCount = count === 1 ? "" : `${count}× `;

						// Imported to an actor sheet; link the embedded item
						if (importedDocument.embeddedDocument && importedDocument.actor) {
							return `<li class="py-1">${ptCount}@ActorEmbeddedItem[${importedDocument.actor.id}][${importedDocument.embeddedDocument.id}]</li>`;
						}

						// Imported to a directory/compendium; link the item
						if (importedDocument.document) {
							if (importedDocument.pack) {
								return `<li class="py-1">${ptCount}@Compendium[${importedDocument.pack.metadata.package}.${importedDocument.pack.metadata.name}.${importedDocument.document.id}]</li>`;
							}
							return `<li class="py-1">${ptCount}@Item[${importedDocument.document.id}]</li>`;
						}

						errorMessage = `Unhandled imported document type--${Object.entries(importedDocument).map(([k, v]) => `${k}=${!!v}`).join(", ")}`;
					});
			})
			.flat();

		const htmlSummary = `<ul>
			${loot.currency ? `<li class="py-1">Currency: ${Parser.getDisplayCurrency(loot.currency)}</li>` : ""}
			${lisImportedDatas.join("")}
		</ul>`;

		return {errorMessage, htmlSummary};
	}

	static async _pDoLogToChat ({loot, htmlSummary, actor}) {
		await ChatMessage.create({
			content: `<div>
					${actor ? `<p><i>Added to the inventory of:</i> @Actor[${actor.id}]</p>` : ""}
					${htmlSummary}
				</div>`,
			user: game.userId,
			type: 4,
			speaker: {
				alias: "Loot Generator",
			},
			whisper: game.users.contents.filter(it => it.isGM || it === game.user).map(it => it.id),
		});
	}

	static async _pHandleActorDrop (fn, ...args) {
		const evt = args[0];

		// Handle drag-drop of custom events
		const data = UtilEvents.getDropJson(evt);
		if (data?.type === "ve-Loot") {
			await LootGeneratorApp.pImportLoot({loot: data.data, actor: this.actor});
			return;
		}

		// Handle drag-drop of generic journal entries to the sheet
		if (data?.type === "JournalEntry") {
			const journalEntry = game.journal.get(data.id);
			if (journalEntry?.data?.flags?.[SharedConsts.MODULE_NAME_FAKE]?.type === LootGenOutputFvtt.FLAG_TYPE__LOOT) {
				await LootGeneratorApp.pImportLoot({
					loot: journalEntry.data.flags[SharedConsts.MODULE_NAME_FAKE].loot,
					actor: this.actor,
				});
				return;
			}
		}

		return fn(...args);
	}

	static _pHandleBoardDrop (evt) {
		const data = UtilEvents.getDropJson(evt);

		if (data?.type !== "ve-Loot") return;

		const canvasPos = UtilCanvas.getPosCanvasSpace(evt, "NotesLayer");
		const canvasPosSnapped = canvas.grid.getSnappedPosition(canvasPos.x, canvasPos.y);

		LootGenOutputFvtt.pImportToJournal({loot: data.data})
			.then(async journalDocument => {
				await canvas.scene.createEmbeddedDocuments(
					"Note",
					[
						{
							entryId: journalDocument.id,
							icon: _IMG,
							iconSize: canvas.grid.size,
							text: "",
							x: canvasPosSnapped.x - (canvas.grid.size / 2),
							y: canvasPosSnapped.y - (canvas.grid.size / 2),
						},
					],
				);
			});

		// prevent propagation/event bubbling
		return false;
	}
}

class LootGenOutputFvtt extends LootGenOutput {
	constructor (...args) {
		super(...args);
		this._datetimeGenerated = new Date();
	}

	_$getEleTitleSplit () {
		const $btnImportToJournal = $(`<button title="Import to Journal" class="btn btn-xs btn-default"><i class="fas fa-fw fa-book-open"></i></button>`)
			.click(() => this._pImportToJournal());

		const $btnImportToFolder = $(`<button title="Import to Items Folder" class="btn btn-xs btn-default"><i class="fas fa-fw fa-folder"></i></button>`)
			.click(() => this._pImportToFolder());

		const $btnImportToCompendium = $(`<button title="Import to Compendium" class="btn btn-xs btn-default"><i class="fas fa-fw fa-atlas"></i></button>`)
			.click(() => this._pImportToCompendium());

		return $$`<div class="ve-flex-v-center btn-group">
			${$btnImportToFolder}
			${$btnImportToJournal}
			${$btnImportToCompendium}
		</div>`;
	}

	static async pImportToJournal ({loot}) {
		const lisLinks = [];
		for (const {page, entity, options} of loot.entityInfos || []) {
			const tagName = page === UrlUtil.PG_ITEMS ? "item" : "spell";
			const count = options?.quantity ?? 1;
			const ptCount = count === 1 ? "" : `${count}× `;
			lisLinks.push(`<li class="py-1">${ptCount}@${tagName}[${entity.name}|${entity.source}]{${entity.name}}</li>`);
		}

		const htmlSummary = `<ul>
			${loot.currency ? `<li class="py-1">Currency: ${Parser.getDisplayCurrency(loot.currency)}</li>` : ""}
			${lisLinks.join("")}
		</ul>`;

		const journalData = {
			name: `Loot (${Renderer.stripTags(loot.name)})`,
			permission: {default: 0},
			entryTime: Date.now(),
			content: htmlSummary,
			img: _IMG,
			flags: {
				[SharedConsts.MODULE_NAME_FAKE]: {
					type: LootGenOutputFvtt.FLAG_TYPE__LOOT,
					loot,
				},
			},
		};

		ui.sidebar.activateTab("journal");
		const docJournal = await CONFIG.JournalEntry.documentClass.create(journalData, {renderSheet: false, temporary: false});
		ui.notifications.info(`Imported loot to journal entry "${docJournal.name}"`);
	}

	async _pImportToJournal () {
		const loot = await this._pGetFoundryForm();
		await this.constructor.pImportToJournal({loot});
	}

	async _pImportToFolder () {
		const folderPathStrings = await new Promise(resolve => {
			const {$modalInner, doClose} = UiUtil.getShowModal({
				title: `Import Loot to Items Folder`,
				isHeaderBorder: true,
				cbClose: (val) => {
					resolve(val);
				},
			});

			const $wrpEditFolderPath = $$`<div class="w-100 ve-flex-col"></div>`;
			const pathBuilder = new FolderPathBuilder({
				defaultFolderPathSpec: [
					"Loot",
					this._type,
					`(Unnamed ${DatetimeUtil.getDatetimeStr({date: this._datetimeGenerated, isPlainText: true})})`,
				],
				fnOnRowKeydown: evt => {
					if (evt.key !== "Enter") return;
					$btnOk.click();
				},
			});
			pathBuilder.render($wrpEditFolderPath);

			const $btnOk = $(`<button class="btn btn-primary mr-2">OK</button>`)
				.click(() => doClose(pathBuilder.getFolderPathStrings()));

			const $btnCancel = $(`<button class="btn btn-default">Cancel</button>`)
				.click(() => doClose(null));

			$$($modalInner)`<div class="ve-flex-col w-100 h-100 pt-2">
				${$wrpEditFolderPath}

				<div class="ve-flex-v-center ve-flex-h-right no-shrink pb-1 pt-1 px-1 mt-auto mr-3">${$btnOk}${$btnCancel}</div>
			</div>`;
		});
		if (!folderPathStrings) return;

		const folderId = await UtilFolders.pCreateFoldersGetId({
			folderType: "Item",
			folderNames: folderPathStrings,
		});

		const loot = await this._pGetFoundryForm();
		ui.sidebar.activateTab("items");
		await LootGeneratorApp.pImportLoot({loot, folderId});
		ui.notifications.info(folderPathStrings.length ? `Imported loot to items folder "${folderPathStrings}".` : `Imported loot to items directory.`);
	}

	async _pImportToCompendium () {
		let selPack = null;

		if (!UtilCompendium.getAvailablePacks({folderType: "Item"}).length) {
			const isCreate = await InputUiUtil.pGetUserBoolean({
				title: `Create Compendium`,
				htmlDescription: `No unlocked "Item"-type compendiums currently exist. Would you like to create one?`,
				textYes: "Yes",
				textNo: "No",
			});
			if (!isCreate) return;

			selPack = await UtilCompendium.pGetUserCreatePack({folderType: "Item"});
			if (!selPack) return;
		}

		if (!selPack) {
			await new Promise(resolve => {
				const {$modalInner, doClose} = UiUtil.getShowModal({
					title: `Import Loot to Items Compendium`,
					isHeaderBorder: true,
					cbClose: (val) => {
						resolve(val);
					},
				});

				const setSelPack = () => selPack = UtilCompendium.getPackByCollection({collection: $selCompendium.val()});

				const $selCompendium = UtilCompendium.$getSelCompendium({folderType: "Item"})
					.change(() => setSelPack());
				setSelPack();

				const $btnOk = $(`<button class="btn btn-primary mr-2">OK</button>`)
					.click(() => doClose(true));

				const $btnCancel = $(`<button class="btn btn-default">Cancel</button>`)
					.click(() => doClose(null));

				$$($modalInner)`<div class="ve-flex-col w-100 h-100 pt-2">
					${$selCompendium}
					<div class="ve-flex-v-center ve-flex-h-right no-shrink pb-1 pt-1 px-1 mt-auto mr-3">${$btnOk}${$btnCancel}</div>
				</div>`;
			});
		}

		if (!selPack) return;

		const loot = await this._pGetFoundryForm();
		ui.sidebar.activateTab("compendium");
		await LootGeneratorApp.pImportLoot({loot, pack: selPack});
		ui.notifications.info(`Imported loot to compendium "${selPack.metadata.label}"`);
	}
}
LootGenOutputFvtt._STO_K_FOLDER_PATH_SPEC = "LootGenOutputFvtt.folderKeyPathSpec";
LootGenOutputFvtt.FLAG_TYPE__LOOT = "loot";

export {LootGeneratorApp};
