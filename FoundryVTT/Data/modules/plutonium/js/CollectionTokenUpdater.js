import {SharedConsts} from "../shared/SharedConsts.js";
import {Util} from "./Util.js";
import {AppFilterBasic} from "./FilterApplications.js";
import {BaseCollectionTool} from "./BaseCollectionTool.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilActors} from "./UtilActors.js";
import {UtilDocuments} from "./UtilDocuments.js";

class CollectionTokenUpdater extends BaseCollectionTool {
	constructor () {
		super(
			{
				title: "Bulk Prototype Token Editor",
				template: `${SharedConsts.MODULE_LOCATION}/template/CollectionTokenUpdater.hbs`,
				width: 960,
				height: Util.getMaxWindowHeight(),
				resizable: true,
			},
			"actor",
		);

		// region Local fields
		this._pageFilter = new AppFilterBasic();

		this._list = null;
		this._$btnReset = null;
	}

	activateListeners ($html) {
		super.activateListeners($html);

		this._activateListeners_initBtnRun($html);
		this._activateListeners_initBtnEditTemplate($html);
		this._activateListeners_initBtnReset($html);
		this._activateListeners_pInitListAndFilters($html);
	}

	_activateListeners_initBtnRun ($html) {
		$html.find(`[name="btn-run"]`)
			.click(async () => {
				if (!this._list) return;

				const selIds = this._getSelectedIds();

				if (!selIds.length) return ui.notifications.warn(`Please select something to update!`);

				const template = await CollectionTokenUpdater.Template.pGetState();
				if (template.IS_DEFAULT) {
					const isAcceptDefaults = await InputUiUtil.pGetUserBoolean({
						title: "Updated Not Configured",
						htmlDescription: "You have not yet configured the updater. Are you sure you wish to proceed?",
						textNo: "Cancel",
						textYes: "Continue",
					});
					if (!isAcceptDefaults) return;
				}

				this.close();
				ui.sidebar.activateTab(this._sidebarTab);

				// Do this sequentially to avoid deadlock
				const tasks = selIds.map(({id, name}) => new Util.Task(name, () => this._pUpdateToken(id, template)));
				await UtilApplications.pRunTasks(
					tasks,
					{
						titleInitial: "Updating...",
						titleComplete: "Update Complete",
						fnGetRowRunningText: (taskName) => `Updating ${taskName}...`,
						fnGetRowSuccessText: (taskName) => `Updated ${taskName}.`,
						fnGetRowErrorText: (taskName) => `Failed to update ${taskName}! ${VeCt.STR_SEE_CONSOLE}`,
					},
				);

				game[this._gameProp].render();
			});
	}

	_activateListeners_initBtnEditTemplate ($html) {
		$html.find(`[name="btn-set-template"]`)
			.click(() => {
				const templateApp = new CollectionTokenUpdater.Template();
				templateApp.render(true);
			});
	}

	getData () {
		this._rows = this._rows = this._mapEntitiesToRows();

		return {
			...super.getData(),
			titleSearch: `${this._collectionName}s`,
			rows: this._rows,
		};
	}

	async _pUpdateToken (actorId, template) {
		const actor = CONFIG.Actor.collection.instance.get(actorId);
		if (!actor) return;

		const update = {};
		const updateActor = {};

		const isUpdates = [
			this._pUpdateToken_populateLinkUpdate(actor, template, update, updateActor),
			this._pUpdateToken_populateNameUpdate(actor, template, update, updateActor),
			this._pUpdateToken_populateDispositionUpdate(actor, template, update, updateActor),
			this._pUpdateToken_populateImageUpdate(actor, template, update, updateActor),
			this._pUpdateToken_populateResourcesUpdate(actor, template, update, updateActor),
			this._pUpdateToken_populateVisionUpdate(actor, template, update, updateActor),
		];

		if (!isUpdates.some(Boolean)) return;

		await UtilDocuments.pUpdateDocument(actor, {...updateActor, token: update});
	}

	_pUpdateToken_populateLinkUpdate (actor, template, update) {
		if (!template.isLinkActive) return false;

		update.actorLink = template.isLinkActorData;

		return true;
	}

	_pUpdateToken_populateNameUpdate (actor, template, update) {
		if (!template.isNameActive) return false;

		let anyChanges = false;

		const getFirstName = () => actor.name.split(" ")[0].trim().replace(/,;$/, "").trim();
		const getLastName = () => actor.name.split(" ").last().trim();

		const getQuotedNamePart = () => {
			const re = template.isNameParseDoubleQuotes && template.isNameParseSingleQuotes
				? `["']([^"']*?)["']`
				: template.isNameParseDoubleQuotes
					? `"([^"]*?)"`
					: template.isNameParseSingleQuotes
						? `'([^']*?)'`
						: "^$";

			const m = new RegExp(re).exec(actor.name);
			if (!m) return null;
			return m[1].trim();
		};

		if (template.nameMode != null) {
			anyChanges = true;

			switch (template.nameMode) {
				case "Full Name": update.name = actor.name; break;
				case "First Name": update.name = getFirstName(); break;
				case "Last Name": update.name = getLastName(); break;
				case "Quoted Part or Full Name": {
					const quotedPart = getQuotedNamePart();
					update.name = quotedPart || actor.name;
					break;
				}
				case "Quoted Part or First Name": {
					const quotedPart = getQuotedNamePart();
					update.name = quotedPart || getFirstName();
					break;
				}
				case "Quoted Part or Last Name": {
					const quotedPart = getQuotedNamePart();
					update.name = quotedPart || getLastName();
					break;
				}
				case "Regex": {
					const m = new RegExp(template.nameRegexFormula, template.isNameRegexIgnoreCase ? "i" : "").exec(actor.name);
					if (m) update.name = m[1];
					break;
				}
			}
		}

		if (template.namePermissions != null) {
			anyChanges = true;

			update.displayName = Number(template.namePermissions);
		}

		return anyChanges;
	}

	_pUpdateToken_populateDispositionUpdate (actor, template, update) {
		if (!template.isDispositionActive) return false;

		if (template.disposition != null) {
			update.disposition = template.disposition;
			return true;
		}

		return false;
	}

	_pUpdateToken_populateImageUpdate (actor, template, update, updateActor) {
		if (!template.isImageActive) return false;

		let anyChanges = false;

		if (template.imageSyncMode === 0) {
			update.img = actor.img;
			anyChanges = true;
		} else if (template.imageSyncMode === 1) {
			updateActor.img = actor.data.token.img;
			anyChanges = true;
		}

		if (template.scale != null) {
			update.scale = template.scale;
			anyChanges = true;
		}

		return anyChanges;
	}

	_pUpdateToken_populateResourcesUpdate (actor, template, update) {
		if (!template.isResourcesActive) return false;

		let anyChanges = false;

		if (template.barPermissions != null) {
			anyChanges = true;
			update.displayBars = Number(template.barPermissions);
		}

		if (actor.data.type === "character") {
			if (template.barAttributeCharacter1 != null) {
				anyChanges = true;
				update.bar1 = {attribute: template.barAttributeCharacter1 === "(None)" ? null : template.barAttributeCharacter1};
			}

			if (template.barAttributeCharacter2 != null) {
				anyChanges = true;
				update.bar2 = {attribute: template.barAttributeCharacter2 === "(None)" ? null : template.barAttributeCharacter2};
			}
		}

		if (actor.data.type === "npc") {
			if (template.barAttributeNpc1 != null) {
				anyChanges = true;
				update.bar1 = {attribute: template.barAttributeNpc1 === "(None)" ? null : template.barAttributeNpc1};
			}

			if (template.barAttributeNpc2 != null) {
				anyChanges = true;
				update.bar2 = {attribute: template.barAttributeNpc2 === "(None)" ? null : template.barAttributeNpc2};
			}
		}

		return anyChanges;
	}

	_pUpdateToken_populateVisionUpdate (actor, template, update) {
		if (!template.isVisionActive) return false;

		let anyChanges = false;

		if (template.isHasVision != null) {
			if (actor.data.token.vision !== template.isHasVision) {
				update.vision = template.isHasVision;

				anyChanges = true;
			}
		}

		if (template.visionDim != null) {
			if (actor.data.token.dimSight !== template.visionDim) {
				update.dimSight = template.visionDim;

				anyChanges = true;
			}
		}

		if (template.visionBright != null) {
			if (actor.data.token.brightSight !== template.visionBright) {
				update.brightSight = template.visionBright;

				anyChanges = true;
			}
		}

		if (template.visionAngle != null) {
			if (actor.data.token.sightAngle !== template.visionAngle) {
				update.sightAngle = template.visionAngle;

				anyChanges = true;
			}
		}

		if (template.lightDim != null) {
			if (actor.data.token.dimLight !== template.lightDim) {
				update.dimLight = template.lightDim;

				anyChanges = true;
			}
		}

		if (template.lightBright != null) {
			if (actor.data.token.brightLight !== template.lightBright) {
				update.brightLight = template.lightBright;

				anyChanges = true;
			}
		}

		if (template.lightAngle != null) {
			if (actor.data.token.lightAngle !== template.lightAngle) {
				update.lightAngle = template.lightAngle;

				anyChanges = true;
			}
		}

		if (template.lightOpacity != null) {
			if (actor.data.token.lightAlpha !== template.lightOpacity) {
				update.lightAlpha = template.lightOpacity;

				anyChanges = true;
			}
		}

		return anyChanges;
	}

	close (...args) {
		this._pageFilter.teardown();
		return super.close(...args);
	}
}

CollectionTokenUpdater.Template = class extends Application {
	constructor () {
		super({
			title: `Prototype Token Updater Configuration`,
			template: `${SharedConsts.MODULE_LOCATION}/template/CollectionTokenUpdaterTemplate.hbs`,
			width: 600,
			height: Util.getMaxWindowHeight(900),
			resizable: true,
		});
	}

	activateListeners ($html) {
		$html.empty();
		this._activateListeners_pDoLoadAndRender($html);
	}

	static async pGetState () {
		const saved = await StorageUtil.pGet(CollectionTokenUpdater.Template._STORAGE_KEY);
		return saved || CollectionTokenUpdater.Template._DEFAULTS;
	}

	async _activateListeners_pDoLoadAndRender ($html) {
		const prevValues = await StorageUtil.pGet(CollectionTokenUpdater.Template._STORAGE_KEY);

		const _comp = BaseComponent.fromObject(prevValues || CollectionTokenUpdater.Template._DEFAULTS);
		const comp = _comp.getPod();
		const pSaveState = () => {
			const out = _comp.toObject();
			delete out.IS_DEFAULT;
			StorageUtil.pSet(CollectionTokenUpdater.Template._STORAGE_KEY, out);
		};
		const saveStateDebounced = MiscUtil.debounce(pSaveState, 100);
		_comp._addHookAll("state", saveStateDebounced);

		// region name
		const $cbSectName = ComponentUiUtil.$getCbBool(_comp, "isNameActive");

		const $cbParseNameDoubleQuotes = ComponentUiUtil.$getCbBool(_comp, "isNameParseDoubleQuotes");
		const $cbParseNameSingleQuotes = ComponentUiUtil.$getCbBool(_comp, "isNameParseSingleQuotes");

		const $stageNameQuotes = $$`<div class="ve-flex-v-center toku__row">
			<label class="ve-flex-v-center mr-2 ml-auto"><div class="mr-1">Accept Double Quotes</div>${$cbParseNameDoubleQuotes}</label>
			<label class="ve-flex-v-center"><div class="mr-1">Accept Single Quotes</div>${$cbParseNameSingleQuotes}</label>
		</div>`;

		const $iptRegex = ComponentUiUtil.$getIptStr(_comp, "nameRegexFormula", {html: `<input class="code" type="text">`});
		const $cbIgnoreCase = ComponentUiUtil.$getCbBool(_comp, "isNameRegexIgnoreCase");

		const $stageNameRegex = $$`<div class="ve-flex-col w=100">
			<label class="ve-flex-v-center ve-flex-h-right toku__row">
				<div class="mr-2 help" title="The first capture group will be used, if the expression matches">Expression</div>${$iptRegex}
			</label>

			<label class="ve-flex-v-center ve-flex-h-right toku__row">
				<div class="mr-1">Ignore Case</div>${$cbIgnoreCase}
			</label>
		</div>`;

		const NAME_UPDATE_MODES = [
			new CollectionTokenUpdater.Template.NameUpdateMode("Full Name", $stageNameQuotes, $stageNameRegex),
			new CollectionTokenUpdater.Template.NameUpdateMode("First Name", $stageNameQuotes, $stageNameRegex),
			new CollectionTokenUpdater.Template.NameUpdateMode("Last Name", $stageNameQuotes, $stageNameRegex),
			new CollectionTokenUpdater.Template.NameUpdateMode("Quoted Part or Full Name", $stageNameQuotes, $stageNameRegex),
			new CollectionTokenUpdater.Template.NameUpdateMode("Quoted Part or First Name", $stageNameQuotes, $stageNameRegex),
			new CollectionTokenUpdater.Template.NameUpdateMode("Quoted Part or Last Name", $stageNameQuotes, $stageNameRegex),
			new CollectionTokenUpdater.Template.NameUpdateMode("Regex", $stageNameQuotes, $stageNameRegex),
		];
		const $selNameMode = ComponentUiUtil.$getSelEnum(_comp, "nameMode", {values: NAME_UPDATE_MODES.map(it => it.name), isAllowNull: true, displayNullAs: "(No update)"});
		const hkNameMode = () => {
			const found = NAME_UPDATE_MODES.find(it => comp.get("nameMode") === it.name);
			if (found) found.activate();
			else {
				$stageNameQuotes.hideVe();
				$stageNameRegex.hideVe();
			}
		};
		_comp._addHookBase("nameMode", hkNameMode);
		hkNameMode();

		const INVERTED_TOKEN_DISPLAY_MODES = {};
		Object.entries(CONST.TOKEN_DISPLAY_MODES)
			.sort(([, valueA], [, valueB]) => SortUtil.ascSort(valueA, valueB))
			.forEach(([name, value]) => INVERTED_TOKEN_DISPLAY_MODES[value] = game.i18n.localize(`TOKEN.DISPLAY_${name}`));
		const $selNamePermissions = ComponentUiUtil.$getSelEnum(_comp, "namePermissions", {values: Object.keys(INVERTED_TOKEN_DISPLAY_MODES), fnDisplay: it => INVERTED_TOKEN_DISPLAY_MODES[it], isAllowNull: true, displayNullAs: "(No update)"});
		// endregion

		// region Link
		const $cbSectLink = ComponentUiUtil.$getCbBool(_comp, "isLinkActive");

		const $cbLinkActorData = ComponentUiUtil.$getCbBool(_comp, "isLinkActorData");
		// endregion

		// region Disposition
		const $cbSectDisposition = ComponentUiUtil.$getCbBool(_comp, "isDispositionActive");

		const TOKEN_DISPOSITIONS = ["Hostile", "Neutral", "Friendly"];
		const $selDisposition = ComponentUiUtil.$getSelEnum(_comp, "disposition", {values: [-1, 0, 1], fnDisplay: it => TOKEN_DISPOSITIONS[it + 1], isAllowNull: true, displayNullAs: "(No update)"});
		// endregion

		// region Image
		const $cbSectImage = ComponentUiUtil.$getCbBool(_comp, "isImageActive");

		const USE_IMAGE_MODE = ["Use Sheet Image", "Set Sheet to Use Token Image (Update Actor from Token)"];
		const $selImageSyncMode = ComponentUiUtil.$getSelEnum(_comp, "imageSyncMode", {values: [0, 1], isAllowNull: true, fnDisplay: it => USE_IMAGE_MODE[it], displayNullAs: "(No update)"});

		const $sliderScale = ComponentUiUtil.$getSliderNumber(_comp, "scale", {min: 0.2, max: 3, step: 0.1});

		const $iptScale = ComponentUiUtil.$getIptNumber(
			_comp,
			"scale",
			null,
			{
				$ele: $(`<input class="range-value ml-2 form-control form-control--minimal">`),
				isAllowNull: true,
				fallbackOnNaN: null,
				min: 0.2,
				max: 3,
			},
		);

		const hkScale = () => $iptScale.title(_comp._state.scale == null ? `(No update)` : `Set scale to ${_comp._state.scale}`);
		_comp._addHookBase("scale", hkScale);
		hkScale();

		const $btnResetScale = $(`<button class="btn btn-5et btn-xs ml-2" title="Reset to &quot;Do not update&quot;"><span class="glyphicon glyphicon-refresh"></span></button>`).click(() => _comp._state.scale = null);
		// endregion

		// region Resources
		const $cbSectResources = ComponentUiUtil.$getCbBool(_comp, "isResourcesActive");

		const $selBarPermissions = ComponentUiUtil.$getSelEnum(_comp, "barPermissions", {values: Object.keys(INVERTED_TOKEN_DISPLAY_MODES), fnDisplay: it => INVERTED_TOKEN_DISPLAY_MODES[it], isAllowNull: true, displayNullAs: "(No update)"});

		const CHAR_TOKEN_ATTRIBUTES_OBJ = CollectionTokenUpdater.Template._getAllAvailableActorBarAttributes("character");
		const CHAR_TOKEN_ATTRIBUTES = ["(None)", ...Object.values(CHAR_TOKEN_ATTRIBUTES_OBJ).flat()];

		const NPC_TOKEN_ATTRIBUTES_OBJ = CollectionTokenUpdater.Template._getAllAvailableActorBarAttributes("npc");
		const NPC_TOKEN_ATTRIBUTES = ["(None)", ...Object.values(NPC_TOKEN_ATTRIBUTES_OBJ).flat()];

		const $selBarAttributeCharacter1 = ComponentUiUtil.$getSelEnum(_comp, "barAttributeCharacter1", {values: CHAR_TOKEN_ATTRIBUTES, isAllowNull: true, displayNullAs: "(No update)"});
		const $selBarAttributeCharacter2 = ComponentUiUtil.$getSelEnum(_comp, "barAttributeCharacter2", {values: CHAR_TOKEN_ATTRIBUTES, isAllowNull: true, displayNullAs: "(No update)"});

		const $selBarAttributeNpc1 = ComponentUiUtil.$getSelEnum(_comp, "barAttributeNpc1", {values: NPC_TOKEN_ATTRIBUTES, isAllowNull: true, displayNullAs: "(No update)"});
		const $selBarAttributeNpc2 = ComponentUiUtil.$getSelEnum(_comp, "barAttributeNpc2", {values: NPC_TOKEN_ATTRIBUTES, isAllowNull: true, displayNullAs: "(No update)"});
		// endregion

		// region Vision
		const $cbSectVision = ComponentUiUtil.$getCbBool(_comp, "isVisionActive");

		const $cbHasVision = ComponentUiUtil.$getCbBool(_comp, "isHasVision");
		const $iptDimVision = ComponentUiUtil.$getIptInt(_comp, "visionDim", null, {min: 0, isAllowNull: true, html: `<input class="code text-right" type="text" placeholder="(No update)">`});
		const $iptBrightVision = ComponentUiUtil.$getIptInt(_comp, "visionBright", null, {min: 0, isAllowNull: true, html: `<input class="code text-right" type="text" placeholder="(No update)">`});
		const $iptVisionAngle = ComponentUiUtil.$getIptInt(_comp, "visionAngle", null, {min: 0, max: 360, isAllowNull: true, html: `<input class="code text-right" type="text" placeholder="(No update)">`});
		const $iptDimLight = ComponentUiUtil.$getIptInt(_comp, "lightDim", null, {min: 0, isAllowNull: true, html: `<input class="code text-right" type="text" placeholder="(No update)">`});
		const $iptBrightLight = ComponentUiUtil.$getIptInt(_comp, "lightBright", null, {min: 0, isAllowNull: true, html: `<input class="code text-right" type="text" placeholder="(No update)">`});
		const $iptLightAngle = ComponentUiUtil.$getIptInt(_comp, "lightAngle", null, {min: 0, max: 360, isAllowNull: true, html: `<input class="code text-right" type="text" placeholder="(No update)">`});
		const $iptLightOpacity = ComponentUiUtil.$getIptNumber(_comp, "lightOpacity", null, {min: 0, max: 1, isAllowNull: true, html: `<input class="code text-right" type="text" placeholder="(No update)">`});
		// endregion

		// region Save
		const $btnSave = $(`<button class="btn-5et w-100">Save</button>`)
			.click(async () => {
				try {
					await pSaveState();
					ui.notifications.info(`Saved!`);
				} catch (e) {
					ui.notifications.error(`Failed to save! ${VeCt.STR_SEE_CONSOLE}`);
					throw e;
				}
				this.close();
			});
		// endregion

		$html.addClass(`toku__form`);
		$$($html)`
		<label class="split-v-center mb-1" title="Update Token Name">
			<div class="toku__sect-head">Name</div>
			${$cbSectName.addClass("toku__cb-head")}
		</label>
		<div class="ve-flex-col w-100">
			<label class="my-1 split-v-center toku__row"><div>Update Mode</div>${$selNameMode}</label>
			${$stageNameQuotes}
			${$stageNameRegex}
			<label class="my-1 split-v-center toku__row"><div>Display Name</div>${$selNamePermissions}</label>
		</div>

		<hr class="hr-1">

		<label class="split-v-center mb-1" title="Update Token Link">
			<div class="toku__sect-head">Link</div>
			${$cbSectLink.addClass("toku__cb-head")}
		</label>
		<div class="ve-flex-col w-100">
			<label class="my-1 split-v-center toku__row"><div>Link Actor Data</div>${$cbLinkActorData}</label>
		</div>

		<hr class="hr-1">

		<label class="split-v-center mb-1" title="Update Token Disposition">
			<div class="toku__sect-head">Disposition</div>
			${$cbSectDisposition.addClass("toku__cb-head")}
		</label>
		<div class="ve-flex-col w-100">
			<label class="my-1 split-v-center toku__row"><div>Token Disposition</div>${$selDisposition}</label>
		</div>

		<hr class="hr-1">

		<label class="split-v-center mb-1" title="Update Token Image">
			<div class="toku__sect-head">Image</div>
			${$cbSectImage.addClass("toku__cb-head")}
		</label>
		<div class="ve-flex-col w-100">
			<label class="my-1 split-v-center toku__row"><div>Image</div>${$selImageSyncMode}</label>
			<label class="my-1 split-v-center toku__row">
				<div>Scale</div>
				<div class="ve-flex-v-center max-w-200p w-100">${$sliderScale}${$iptScale}${$btnResetScale}</div>
			</label>
		</div>

		<hr class="hr-1">

		<label class="split-v-center mb-1" title="Update Token Resources">
			<div class="toku__sect-head">Resources</div>
			${$cbSectResources.addClass("toku__cb-head")}
		</label>
		<div class="ve-flex-col w-100">
			<label class="my-1 split-v-center toku__row"><div>Display Bars</div>${$selBarPermissions}</label>
			<label class="my-1 split-v-center toku__row"><div>Bar 1 Attribute (Characters)</div>${$selBarAttributeCharacter1}</label>
			<label class="my-1 split-v-center toku__row"><div>Bar 2 Attribute (Characters)</div>${$selBarAttributeCharacter2}</label>
			<label class="my-1 split-v-center toku__row"><div>Bar 1 Attribute (NPCs)</div>${$selBarAttributeNpc1}</label>
			<label class="my-1 split-v-center toku__row"><div>Bar 2 Attribute (NPCs)</div>${$selBarAttributeNpc2}</label>
		</div>

		<hr class="hr-1">

		<label class="split-v-center mb-1" title="Update Token Vision">
			<div class="toku__sect-head">Vision</div>
			${$cbSectVision.addClass("toku__cb-head")}
		</label>
		<div class="ve-flex-col w-100">
			<label class="my-1 split-v-center toku__row"><div>Has Vision</div>${$cbHasVision}</label>
			<label class="my-1 split-v-center toku__row"><div>Dim Vision <span class="ve-muted ve-small">(Distance)</span></div>${$iptDimVision}</label>
			<label class="my-1 split-v-center toku__row"><div>Bright Vision <span class="ve-muted ve-small">(Distance)</span></div>${$iptBrightVision}</label>
			<label class="my-1 split-v-center toku__row"><div>Sight Angle <span class="ve-muted ve-small">(Degrees)</span></div>${$iptVisionAngle}</label>
			<label class="my-1 split-v-center toku__row"><div>Emit Dim <span class="ve-muted ve-small">(Distance)</span></div>${$iptDimLight}</label>
			<label class="my-1 split-v-center toku__row"><div>Emit Bright <span class="ve-muted ve-small">(Distance)</span></div>${$iptBrightLight}</label>
			<label class="my-1 split-v-center toku__row"><div>Emission Angle <span class="ve-muted ve-small">(Degrees)</span></div>${$iptLightAngle}</label>
			<label class="my-1 split-v-center toku__row"><div>Light Opacity <span class="ve-muted ve-small">(0-1)</span></div>${$iptLightOpacity}</label>
		</div>

		<div class="mt-auto">
			${$btnSave}
		</div>
		`;
	}

	/**
	 * An alternative to e.g.:
	 * - `UtilActors.getActorBarAttributes({data: {data: game.system.model.Actor.character}});`
	 * - `UtilActors.getActorBarAttributes({data: {data: game.system.model.Actor.npc}});`
	 * which ensures every possible bar attribute in the game is collected. This gets around the problem of e.g.
	 *`attributes.ac.base` being undefined in the default character model, and therefore not being pickable as a bar.
	 * @param actorType
	 */
	static _getAllAvailableActorBarAttributes (actorType) {
		const actors = CONFIG.Actor.collection.instance.contents.filter(it => it.data.type === actorType);
		// Add a fake actor to the set with the base model. Ensures we always catch the defaults in an empty game.
		actors.push({data: {data: game.system.model.Actor[actorType]}});

		const out = {};
		const seenSets = {};
		const keys = [
			game.i18n.localize("TOKEN.BarAttributes"),
			game.i18n.localize("TOKEN.BarValues"),
		];

		actors.forEach(actor => {
			const barAttributes = UtilActors.getActorBarAttributes(actor);

			keys.forEach(k => {
				(barAttributes[k] || []).forEach(atr => {
					const seenSet = (seenSets[k] = seenSets[k] || new Set());
					if (seenSet.has(atr)) return;
					seenSet.add(atr);
					(out[k] = out[k] || []).push(atr);
				});
			});
		});

		keys.forEach(k => {
			(out[k] || []).sort((a, b) => a.localeCompare(b));
		});

		return out;
	}
};
CollectionTokenUpdater.Template._STORAGE_KEY = `collection_token_updater`;
CollectionTokenUpdater.Template._DEFAULTS = {
	IS_DEFAULT: true, // special key that gets deleted when the user has saved the form

	isCharacterActive: false,
	isNameActive: true,
	isDispositionActive: true,
	isImageActive: true,
	isResourcesActive: true,
	isVisionActive: true,
	isNameParseDoubleQuotes: true,
	isNameParseSingleQuotes: true,
};

CollectionTokenUpdater.Template.NameUpdateMode = class {
	constructor (name, $stageNameQuotes, $stageNameRegex) {
		this.name = name;
		this._$stageNameQuotes = $stageNameQuotes;
		this._$stageNameRegex = $stageNameRegex;
	}

	activate () {
		switch (this.name) {
			case "Full Name":
			case "First Name":
			case "Last Name":
				this._$stageNameQuotes.hideVe(); this._$stageNameRegex.hideVe(); break;
			case "Quoted Part or Full Name":
			case "Quoted Part or First Name":
			case "Quoted Part or Last Name":
				this._$stageNameQuotes.showVe(); this._$stageNameRegex.hideVe(); break;
			case "Regex":
				this._$stageNameQuotes.hideVe(); this._$stageNameRegex.showVe(); break;
		}
	}
};

export {CollectionTokenUpdater};
