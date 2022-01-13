import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {ChooseImporter} from "./ChooseImporter.js";
import {LGT} from "./Util.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilEvents} from "./UtilEvents.js";
import {UtilPatchActorDrop} from "./UtilPatch.js";
import {UtilGameSettings} from "./UtilGameSettings.js";
import {PopoutSheet} from "./PopoutSheet.js";

class Patcher_TextEditor {
	static init () {
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"TextEditor.enrichHTML",
			function (fnEnrichHtml, ...args) {
				if (!Config.get("journalEntries", "isEnableJournalEmbeds") && !Config.get("text", "isEnableContentLinks")) return fnEnrichHtml(...args);
				return Patcher_TextEditor.enrichHTML(fnEnrichHtml, ...args);
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"JournalSheet.prototype._disableFields",
			function (fnDisableFields, ...args) {
				const res = fnDisableFields(...args);
				if (!Config.get("journalEntries", "isEnableJournalEmbeds")) return res;
				Patcher_TextEditor.JournalEmbed._doEnableToggleButtons(...args);
				return res;
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);

		UtilEvents.registerDocumentHandler({
			eventType: "click",
			selector: `.jemb__btn-toggle`,
			fnEvent: Patcher_TextEditor.JournalEmbed.handleToggleClick.bind(Patcher_TextEditor.JournalEmbed),
		});

		UtilEvents.registerDocumentHandler({
			eventType: "click",
			selector: `.jlnk__entity-link`,
			fnEvent: Patcher_TextEditor.ContentLoader.handleClick.bind(Patcher_TextEditor.JournalEmbed),
		});

		Patcher_TextEditor.ContentDragDrop.init();
	}

	/** Based on the original method. */
	static enrichHTML (originalEnrichHtml, content, opts, depth = 0) {
		opts = opts || {};

		if (opts.secrets === undefined) opts.secrets = false;
		if (opts.documents === undefined) opts.documents = true;
		if (opts.links === undefined) opts.links = true;
		if (opts.rolls === undefined) opts.rolls = true;

		// Call the original method--"content" is now enriched HTML
		content = originalEnrichHtml(content, opts);

		// If we are not to replace dynamic entity links, return the base content
		if (!opts.documents) return content;

		// Don't load compendiums--we don't match `EmbedCompendium`
		content = content
			.replace(/@Embed(JournalEntry)\[([^\]]+)](?:{([^}]+)})?/g, (...m) => Patcher_TextEditor.JournalEmbed.getHtml(opts, depth, ...m))
			.replace(/@(Actor)Embedded(Item)\[([^\]]+)]\[([^\]]+)](?:{([^}]+)})?/g, (...m) => Patcher_TextEditor.EmbeddedDocument.getHtml(opts, depth, ...m))
			.replace(/@Folder\[([^\]]+)](?:{([^}]+)})?/g, (...m) => Patcher_TextEditor.Folder.getHtml(opts, depth, ...m))
			.replace(/@([a-zA-Z]+)\[([^\]]+)](?:{([^}]+)})?/g, (...m) => Patcher_TextEditor.ContentLoader.getHtml(opts, depth, ...m))
		;

		return content;
	}
}

Patcher_TextEditor.Enricher = class {
	static _getEntityPermissions (entity) {
		if (game.user.isGM) return CONST.ENTITY_PERMISSIONS.OWNER;
		return Math.max(entity.data.permission[game.user.id], entity.data.permission["default"]);
	}

	static _getEntity (collection, entityNameOrId) {
		// Match either on ID or by name
		let entity = null;
		if (/^[a-zA-Z0-9]{16}$/.test(entityNameOrId)) entity = collection.get(entityNameOrId);
		if (!entity) entity = (collection.contents || collection.entries).find(e => e.data.name === entityNameOrId);
		return entity;
	}
};

Patcher_TextEditor.JournalEmbed = class extends Patcher_TextEditor.Enricher {
	static getHtml (enrichOpts, depth, fullText, entityType, entityNameOrId, displayText) {
		const config = CONFIG[entityType];
		const collection = config.collection.instance;
		const entity = this._getEntity(collection, entityNameOrId);

		if (!entity) return `<a class="entity-link broken"><i class="fas fa-unlink"></i> ${displayText || entityNameOrId}</a>`;
		if (this._getEntityPermissions(entity) < CONST.ENTITY_PERMISSIONS.OBSERVER) return `<a class="entity-link broken"><i class="fas fa-unlink"></i> ${displayText || entityNameOrId} <i>(you do not have sufficient permissions to view this journal entry)</i></a>`;

		// Get the standard Foundry link
		const htmlJournalLink = TextEditor._createContentLink(fullText, entityType, entityNameOrId, displayText).outerHTML;

		const isAutoExpand = Config.get("journalEntries", "isAutoExpandJournalEmbeds");
		if (entity.sheet._sheetMode === "image") {
			const img = entity.data.img;
			return `<div class="w-100 ve-flex-col">
				<div class="ve-flex-v-center mb-1 jemb__wrp-lnk">${htmlJournalLink}${this._getBtnHtmlToggle(isAutoExpand)}</div>
				<div class="ve-flex-vh-center jemb__wrp-content ${isAutoExpand ? "" : "ve-hidden"}"><a target="_blank w-100" href="${img}"><img src="${img}" class="jemb__img"></a></div>
			</div>`;
		} else {
			// Avoid infinite loops
			const isTooDeep = depth === Patcher_TextEditor.JournalEmbed._MAX_RECURSION_DEPTH;
			const subContent = isTooDeep ? entity.data.content : TextEditor.enrichHTML(entity.data.content, enrichOpts, depth + 1);
			return `<div class="w-100 ve-flex-col">
				<div class="ve-flex-v-center mb-1 jemb__wrp-lnk">${htmlJournalLink}${this._getBtnHtmlToggle(isAutoExpand)}</div>
				${isTooDeep ? `<div class="mb-1 bold veapp__msg-error">Warning: too many recursive embeds! Have you made an infinite loop?</div>` : ""}
				<div class="w-100 jemb__wrp-content ${isAutoExpand ? "" : "ve-hidden"}">${subContent}</div>
			</div>`;
		}
	}

	static handleToggleClick (event) {
		const $btn = $(event.currentTarget);
		const isExpanded = $btn.attr("data-plut-is-expanded") === "1";

		if (event.shiftKey) {
			event.preventDefault();

			const $editor = $btn.closest(`.editor`);
			$editor.find(`button[data-plut-is-expanded]`).each((i, e) => this._handleExpandCollapse($(e), isExpanded));
			return;
		}

		this._handleExpandCollapse($btn, isExpanded);
	}

	static _handleExpandCollapse ($btn, isExpanded) {
		const $wrp = $btn.parent().next();
		$wrp.toggleClass("ve-hidden", isExpanded);
		$btn
			.attr("data-plut-is-expanded", isExpanded ? "0" : "1")
			.html(isExpanded ? `<i class="fa fa-caret-square-left"></i>` : `<i class="fa fa-caret-square-down"></i>`)
			.title(`${isExpanded ? `Expand` : `Collapse`} Journal Entry (SHIFT for All Entries)`);
	}

	static _getBtnHtmlToggle (isAutoExpand) {
		return `<button class="btn btn-xxs btn-5et btn-default ve-flex-vh-center mx-1 jemb__btn-toggle" data-plut-is-expanded="${isAutoExpand ? 1 : 0}" title="${isAutoExpand ? "Collapse" : "Expand"} Journal Entry (SHIFT for All Entries)" type="button">${isAutoExpand ? `<i class="fa fa-caret-square-down"></i>` : `<i class="fa fa-caret-square-left"></i>`}</button>`;
	}

	/** Based on `FormApplication._disableFields` */
	static _doEnableToggleButtons (form) {
		for (let el of form.getElementsByTagName("BUTTON")) {
			if (el.classList.contains("jemb__btn-toggle")) el.removeAttribute("disabled");
		}
	}
};
Patcher_TextEditor.JournalEmbed._MAX_RECURSION_DEPTH = 69; // Arbitrary number of steps

Patcher_TextEditor.EmbeddedDocument = class extends Patcher_TextEditor.Enricher {
	static getHtml (enrichOpts, depth, fullText, parentEntityType, childEntityType, parentEntityNameOrId, childEntityNameOrId, displayText) {
		const config = CONFIG[parentEntityType];
		const collection = config.collection.instance;
		const parentEntity = this._getEntity(collection, parentEntityNameOrId);

		if (!parentEntity) return `<a class="entity-link broken"><i class="fas fa-unlink"></i> ${displayText || `${parentEntityNameOrId}.${childEntityNameOrId}`}</a>`;
		if (this._getEntityPermissions(parentEntity) < CONST.ENTITY_PERMISSIONS.OBSERVER) return `<a class="entity-link broken"><i class="fas fa-unlink"></i> ${displayText || parentEntityNameOrId} <i>(you do not have sufficient permissions to view this ${parentEntityType.toLowerCase()})</i></a>`;

		const configChild = CONFIG[childEntityType];
		const childEntity = this._getEntity(parentEntity.items, childEntityNameOrId);
		if (!childEntity) return `<a class="entity-link broken"><i class="fas fa-unlink"></i> ${displayText || `${parentEntityNameOrId}.${childEntityNameOrId}`}</a>`;

		return `<a class="jlnk__entity-link" data-plut-owned-link="true" data-parent-entity="${parentEntityType}" data-child-entity="Item" data-parent-id="${parentEntity.id}" data-child-id="${childEntity.id}"><i class="${config.sidebarIcon}"></i> <i class="${configChild.sidebarIcon}"></i> ${childEntity.name}</a>`;
	}
};

Patcher_TextEditor.Folder = class extends Patcher_TextEditor.Enricher {
	static getHtml (enrichOpts, depth, fullText, folderNameOrId, displayText) {
		const folder = this._getEntity(CONFIG.Folder.collection.instance, folderNameOrId);

		if (!folder) return `<a class="entity-link broken"><i class="fas fa-unlink"></i> ${displayText || folderNameOrId}</a>`;
		if (this._getEntityPermissions(folder) < CONST.ENTITY_PERMISSIONS.OBSERVER) return `<a class="entity-link broken"><i class="fas fa-unlink"></i> ${displayText || folderNameOrId} <i>(you do not have sufficient permissions to view this folder)</i></a>`;

		return `<a class="jlnk__entity-link" data-plut-folder-link="true" data-entity="Folder" data-entity-id="${folder.id}"><i class="fas fa-folder fa-fw"></i> ${folder.name}</a>`;
	}
};

Patcher_TextEditor.ContentLoader = class {
	static getHtml (enrichOpts, depth, fullText, tag, pipeParts, displayText) {
		if (Patcher_TextEditor.ContentLoader._STATIC_TAGS.has(tag)) return this._getHtml_staticTag(enrichOpts, depth, fullText, tag, pipeParts, displayText);

		const Importer = ChooseImporter.getImporterClassMeta(tag)?.Class;

		const name = (Renderer.splitTagByPipe(pipeParts)[0] || "");

		if (!Importer) return `<a class="entity-link broken" title="Unknown Tag &quot;${tag.qq()}&quot;"><i class="fas fa-unlink"></i> ${StrUtil.qq(displayText || name)}</a>`;

		const config = CONFIG[Importer.FOLDER_TYPE];

		// (Should never occur)
		if (!config) return `<a class="entity-link broken" title="No CONFIG found for type &quot;${Importer.FOLDER_TYPE}&quot;\u2014this is a bug!"><i class="fas fa-unlink"></i> ${StrUtil.qq(displayText || name)}</a>`;

		const {displayText: displayTextPipe, page, source, hash, preloadId, hashPreEncoded, hashHover, hashPreEncodedHover, subhashes, subhashesHover} = Renderer.utils.getTagMeta(`@${tag}`, pipeParts);

		return `<a class="jlnk__entity-link" draggable="true" ${Config.get("text", "isEnableHoverForLinkTags") ? `data-plut-hover="${true}"` : `title="SHIFT-Click to Import"`} data-plut-hover-page="${page.qq()}" data-plut-hover-source="${source.qq()}" data-plut-hover-hash="${hash.qq()}" data-plut-hover-tag="${tag}" ${preloadId ? `data-plut-hover-preload-id="${preloadId.qq()}"` : ""} ${hashPreEncoded ? `data-plut-hover-hash-pre-encoded="${hashPreEncoded}"` : ""} ${hashHover ? `data-plut-hover-hash-hover="${hashHover.qq()}"` : ""} ${hashPreEncodedHover ? `data-plut-hover-hash-pre-encoded-hover="${hashPreEncodedHover}"` : ""} ${subhashes?.length ? `data-plut-hover-subhashes="${JSON.stringify(subhashes).qq()}"` : ""} ${subhashesHover?.length ? `data-plut-hover-subhashes-hover="${JSON.stringify(subhashesHover).qq()}"` : ""} data-plut-rich-link="${true}" data-plut-rich-link-entity-type="${Importer.FOLDER_TYPE}" data-plut-rich-link-original-text="${fullText.slice(1).qq()}"><i class="fas ${config.sidebarIcon}"></i> ${StrUtil.qq(displayTextPipe || displayText || name)}</a>`;
	}

	static _getHtml_staticTag (enrichOpts, depth, fullText, tag, pipeParts, displayText) {
		const expander = tag === "skill" ? Parser.skillToExplanation : tag === "sense" ? Parser.senseToExplanation : null;

		const [name, displayTextTag] = Renderer.splitTagByPipe(pipeParts);
		const entries = expander ? expander(name) : null;
		if (!expander || entries === name || CollectionUtil.deepEquals(entries, expander(""))) return `<a class="entity-link broken" title="Unknown ${tag}"><i class="fas fa-unlink"></i> ${StrUtil.qq(displayTextTag || displayText || name)}</a>`;

		return `<a class="jlnk__entity-link" draggable="true" ${Config.get("text", "isEnableHoverForLinkTags") ? `data-plut-hover="${true}"` : ``} data-plut-hover-preload-uid="${CryptUtil.uid()}" data-plut-hover-tag="${tag}" data-plut-hover-pipe-parts="${pipeParts.qq()}" data-plut-rich-link-original-text="${fullText.slice(1).qq()}"><i class="fas fa-info-circle"></i> ${StrUtil.qq(displayTextTag || displayText || name)}</a>`;
	}

	static handleClick (evt) {
		evt.stopPropagation();
		evt.preventDefault();

		// The "@" is stripped to avoid issues when recursively rendering embedded text, so add it back here
		const originalText = `@${evt.currentTarget.dataset.plutRichLinkOriginalText}`;

		const tag = evt.currentTarget.dataset.plutHoverTag;
		const page = evt.currentTarget.dataset.plutHoverPage;
		const source = evt.currentTarget.dataset.plutHoverSource;
		let hash = evt.currentTarget.dataset.plutHoverHash;
		const preloadId = evt.currentTarget.dataset.plutHoverPreloadId;
		const hashPreEncoded = !!evt.currentTarget.dataset.plutHoverHashPreEncoded;
		const subhashesHover = evt.currentTarget.dataset.plutHoverSubhashesHover;

		if (!page || !source || !hash) return;
		const importer = ChooseImporter.getImporter(tag) || ChooseImporter.getImporter(page);

		if (!hashPreEncoded) hash = UrlUtil.encodeForHash(hash);

		if (subhashesHover) {
			const parsed = JSON.parse(subhashesHover);
			hash += Renderer.utils.getLinkSubhashString(parsed);
		}

		const isPermanent = !!evt.shiftKey
			&& (
				(game.user.can("ACTOR_CREATE") && importer.gameProp === "actors")
				|| (game.user.can("ITEM_CREATE") && importer.gameProp === "items")
				|| (game.user.can("JOURNAL_CREATE") && importer.gameProp === "journal")
				|| (game.user.can("ROLL_TABLE_CREATE") && importer.gameProp === "tables")
			);
		const isPopout = evt.view !== window && Config.get("ui", "isEnableSubPopouts");

		Renderer.hover.pCacheAndGet(page, source, hash)
			.then(ent => {
				const msgErrorBase = `Could not load content for tag "${originalText}"!`;

				if (!ent) {
					const msgError = `${msgErrorBase} Could not find matching entity.`;
					console.error(...LGT, msgError);
					return ui.notifications.error(msgError);
				}

				importer.pImportEntry(ent, {isTemp: !isPermanent, defaultPermission: CONST.ENTITY_PERMISSIONS.OWNER})
					.then(async importSummary => {
						if (isPermanent) UtilApplications.doShowImportedNotification(importSummary);

						const renderMetas = await Promise.all(
							(importSummary.imported || [])
								.map(it => it.document)
								.filter(Boolean)
								.map(doc => UtilApplications.pForceRenderApp(doc.sheet ? doc.sheet : doc)),
						);

						if (!isPopout) return;
						renderMetas.filter(Boolean).forEach(({app, data}) => PopoutSheet.doPopout(app, data));
					})
					.catch(err => {
						console.error(...LGT, err);
						ui.notifications.error(`${msgErrorBase} ${VeCt.STR_SEE_CONSOLE}`);
					});
			});
	}
};
Patcher_TextEditor.ContentLoader._STATIC_TAGS = new Set(["skill", "sense"]);

/** Drag-and-drop for @tag links. */
Patcher_TextEditor.ContentDragDrop = class {
	static init () {
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"ActorSheet.prototype._onDragStart",
			function (fn, ...args) {
				const evt = args[0];
				if (evt.target.dataset.plutRichLink) return;
				return fn(...args);
			},
			UtilLibWrapper.LIBWRAPPER_MODE_MIXED,
		);

		if (!UtilGameSettings.getSafe("core", "noCanvas")) {
			libWrapper.register(
				SharedConsts.MODULE_NAME,
				"canvas.tokens._onDropActorData",
				async function (fn, ...args) {
					return Patcher_TextEditor.ContentDragDrop._pHandleCanvasDrop({fn, args});
				},
				UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
			);

			libWrapper.register(
				SharedConsts.MODULE_NAME,
				"canvas.notes._onDropData",
				async function (fn, ...args) {
					return Patcher_TextEditor.ContentDragDrop._pHandleCanvasDrop({fn, args});
				},
				UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
			);
		}

		// region Unfortunately, libWrapper is of no use here
		UtilPatchActorDrop.registerDropActor(Patcher_TextEditor.ContentDragDrop._pHandleActorDrop);
		UtilPatchActorDrop.registerDropItem(Patcher_TextEditor.ContentDragDrop._pHandleActorDrop);
		// endregion

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"TextEditor._onDropEditorData",
			async function (fn, ...args) {
				return Patcher_TextEditor.ContentDragDrop._pHandleEditorDrop({fn, args});
			},
			UtilLibWrapper.LIBWRAPPER_MODE_MIXED,
		);
	}

	static async _pHandleCanvasDrop ({fn, args}) {
		const [, data] = args;
		return this._pMutDropDataId({fn, args, data});
	}

	static async _pHandleActorDrop (fn, ...args) {
		const [, data] = args;
		return Patcher_TextEditor.ContentDragDrop._pMutDropDataId({fn, args, data, isTemp: true});
	}

	static async _pHandleEditorDrop ({fn, args}) {
		const [evt, editor] = args;
		evt.preventDefault();

		const data = Patcher_TextEditor.ContentDragDrop._getEvtData(evt);
		if (!data) return;

		if (data?.subType !== UtilEvents.EVT_DATA_SUBTYPE__HOVER) return fn(...args);

		editor.insertContent(data.originalText);
	}

	/**
	 * Fake a compendium entity by creating a compendium, adding one entity to it, using it, then deleting the
	 * compendium.
	 */
	static async _pMutDropDataId ({fn, args, data, isTemp = false}) {
		if (data?.subType !== UtilEvents.EVT_DATA_SUBTYPE__HOVER) return fn(...args);

		const importer = ChooseImporter.getImporter(data.page);
		if (!importer) return;

		const ent = await Renderer.hover.pCacheAndGet(data.page, data.source, data.hash, {isCopy: true});
		if (!ent) return;

		const packName = `${SharedConsts.MODULE_NAME_FAKE}-temp-${importer.constructor.FOLDER_TYPE.toLowerCase()}`;
		const packKey = `world.${packName}`;
		if (isTemp) {
			let pack = game.packs.get(packKey);
			if (!pack) {
				pack = await CompendiumCollection.createCompendium({
					entity: importer.constructor.FOLDER_TYPE,
					label: `Temp ${importer.constructor.FOLDER_TYPE}`,
					name: packName,
					package: "world",
				});
			}
			importer.pack = pack;
			data.pack = packKey;
		}

		const importResult = await importer.pImportEntry(ent);
		const imported = importResult.imported[0]?.document;
		data.id = imported.id;

		try {
			return (await fn(...args));
		} finally {
			if (isTemp) {
				const pack = game.packs.get(packKey);
				pack.delete();
			}
		}
	}

	static _getEvtData (evt) {
		try {
			return JSON.parse(evt.dataTransfer.getData("text/plain"));
		} catch (e) {
			return null;
		}
	}
};

export {Patcher_TextEditor};
