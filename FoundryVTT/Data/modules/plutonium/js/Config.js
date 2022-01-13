import {SharedConsts} from "../shared/SharedConsts.js";
import {Util, LGT} from "./Util.js";
import {UtilApplications} from "./UtilApplications.js";
import {Changelog} from "./Changelog.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilCompat} from "./UtilCompat.js";
import {UtilGameSettings} from "./UtilGameSettings.js";
import {UtilHooks} from "./UtilHooks.js";
import {UtilKeybinding} from "./UtilKeybinding.js";

class ModuleSettingsStub extends FormApplication {
	static get defaultOptions () {
		return foundry.utils.mergeObject(super.defaultOptions, {
			title: `Opening...`,
			template: `${SharedConsts.MODULE_LOCATION}/template/_GenericForm.hbs`,
			width: 100,
			height: 100,
		});
	}

	/** Defer to the main config app */
	async render (...args) {
		const out = await super.render(...args);
		setTimeout(async () => {
			Config.pHandleButtonClick();
			await this.close();
		}, 30);
		return out;
	}

	_onSubmit () { /* No-op */ }
	_updateObject () { /* No-op */ }
}

class Config extends Application {
	static _IS_INIT = false;

	static get backendEndpoint () { return ROUTE_PREFIX ? `/${ROUTE_PREFIX}/api/plutonium` : "/api/plutonium"; }
	static get isInit () { return this._IS_INIT; }

	static preInit () {
		this._preInit_registerKeybinds();
	}

	static _preInit_registerKeybinds () {
		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"Config__open",
			{
				name: "Open Config",
				editable: [],
				onDown: () => {
					this._pOpen();
					return true;
				},
			},
		);

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"Config__setRivetTargetForCharacter",
			{
				name: "Set Player Character as Rivet Target",
				editable: [],
				onDown: () => {
					const actor = UtilKeybinding.getPlayerActor({minRole: Config.get("import", "minimumRole")});
					if (!actor) return true;
					Config.setRivetTargetActor(actor);
					return true;
				},
			},
		);

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"Config__setRivetTargetForCurrentSheet",
			{
				name: "Set Current Sheet as Rivet Target",
				editable: [],
				onDown: () => {
					const meta = UtilKeybinding.getCurrentImportableSheetDocumentMeta({isRequireActor: true, isRequireOwnership: true, minRole: Config.get("import", "minimumRole")});
					if (!meta?.actor) return true;
					Config.setRivetTargetActor(meta.actor);
					return true;
				},
			},
		);

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"Config__setRivetTargetForCurrentToken",
			{
				name: "Set Current Token as Rivet Target",
				editable: [],
				onDown: () => {
					const actor = UtilKeybinding.getCurrentSelectedTokenActor({isRequireOwnership: true, minRole: Config.get("import", "minimumRole")});
					if (!actor) return true;
					Config.setRivetTargetActor(actor);
					return true;
				},
			},
		);

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"Config__clearRivetTarget",
			{
				name: "Clear Rivet Target",
				editable: [],
				onDown: () => {
					Config.setRivetTargetActor(null);
					return true;
				},
			},
		);

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"Config__openBugReportForm",
			{
				name: "Report Bug",
				editable: [],
				onDown: () => {
					Config._doShowBugReportForm();
					return true;
				},
			},
		);
	}

	static async pInit () {
		await this._pInit_pRegisterSettings();

		let loadedConfig = await UtilGameSettings.getSafe(SharedConsts.MODULE_NAME, Config._SETTINGS_KEY);

		if (loadedConfig == null || !Object.keys(loadedConfig).length) Config._CONFIG = Config._getDefaultGmConfig();
		else {
			Config._CONFIG = loadedConfig;
			const anyMods = this._populateMissingConfigValues(Config._CONFIG, {isPlayer: false});
			if (anyMods) Config._saveConfigDebounced();
		}

		// region Socket handling
		game.socket.on(this._SOCKET_ID, data => {
			switch (data.type) {
				case "config.update": {
					const receivedConfig = data.config;

					const old = MiscUtil.copy(Config._CONFIG);

					Object.assign(Config._CONFIG, receivedConfig);

					if (!game.user.isGM && this._INSTANCE) this._INSTANCE._handleGmConfigUpdate(receivedConfig);

					UtilHooks.callAll(
						UtilHooks.HK_CONFIG_UPDATE,
						{
							previous: old,
							current: MiscUtil.copy(Config._CONFIG),
						},
					);

					break;
				}
			}
		});
		// endregion

		// region Player override
		if (!game.user.isGM) {
			const loadedConfigPlayer = await StorageUtil.pGet(Config._CLIENT_SETTINGS_KEY);
			if (loadedConfigPlayer == null) Config._CONFIG_PLAYER = Config._getDefaultPlayerConfig();
			else {
				Config._CONFIG_PLAYER = loadedConfigPlayer;
				const anyMods = this._populateMissingConfigValues(Config._CONFIG_PLAYER, {isPlayer: true});
				if (anyMods) Config._saveConfigDebounced();
			}
		}
		// endregion

		// region Module compatibility overrides
		this._pInit_initCompatibilityTempOverrides();
		// endregion

		// region Backend check
		if (!Config.get("misc", "isSkipBackendCheck")) {
			fetch(
				Config.backendEndpoint,
				{
					method: "post",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						type: "getVersion",
					}),
				},
			)
				.then(resp => resp.json())
				.then(json => {
					Config._GET_BACKEND_VERSION_RESOLVE(json.version);
					console.log(...LGT, `Compatible Plutonium backend (v${json.version}) detected.`);
					UtilHooks.callAll(UtilHooks.HK_CONFIG_UPDATE);
				})
				.catch(() => {
					Config._GET_BACKEND_VERSION_RESOLVE(false);
					console.warn(...LGT, `Plutonium backend not detected. Some features may be unavailable. If you have not attempted to install the backend mod (see: the module README), please ignore the above 404. Alternatively, you can disable the backend check in the config.`);
					UtilHooks.callAll(UtilHooks.HK_CONFIG_UPDATE);
				});
		} else {
			Config._GET_BACKEND_VERSION_RESOLVE(false);
			console.log(...LGT, `Plutonium backend detected was skipped. Some features may be unavailable.`);
		}
		// endregion

		// Add a fake config button to the module settings tab
		game.settings.registerMenu(SharedConsts.MODULE_NAME, "stub", {
			label: "Open Config Editor",
			icon: "fas fa-fw fa-cogs",
			type: ModuleSettingsStub,
		});
		// endregion

		this._IS_INIT = true;
	}

	static _pInit_initCompatibilityTempOverrides () {
		Config._DEFAULT_CONFIG__SORTED_FLAT
			.forEach(([groupKey, allGroupSettings]) => {
				Object.entries(allGroupSettings)
					.forEach(([key, meta]) => {
						if (!meta.compatibilityModeValues) return;

						// This is a `.find` so we only apply the first compatibility value, regardless of how many
						//   incompatible modules are loaded.
						Object.entries(meta.compatibilityModeValues)
							.find(([moduleId, compatibilityValue]) => {
								if (!UtilCompat.isModuleActive(moduleId)) return false;

								Config.setTemp(groupKey, key, compatibilityValue);
								console.warn(...LGT, `${game.modules.get(moduleId).data.title} detected! Setting compatibility config: ${groupKey}.${key} = ${compatibilityValue != null ? JSON.stringify(compatibilityValue) : compatibilityValue}. If you encounter unexpected issues, consider disabling either module.`);
							});
					});
			});
	}

	static async _pInit_pRegisterSettings () {
		await game.settings.register(
			SharedConsts.MODULE_NAME,
			Config._SETTINGS_KEY,
			{
				name: "Plutonium Config",
				hint: "Plutonium Config",
				default: {},
				type: Object,
				scope: "world",
				onChange: data => {
					// No-op; the change will be received/handled as a socket message
				},
			},
		);
	}

	/**
	 * @param CONFIG
	 * @param [opts]
	 * @param [opts.isPlayer]
	 */
	static _populateMissingConfigValues (CONFIG, opts) {
		opts = opts || {};
		const isPlayer = !!opts.isPlayer;

		let anyMods = false;

		// Update the loaded config with any extra defaults it does not track
		Object.entries(this._getDefaultConfig({isPlayer}))
			.forEach(([groupKey, groupVals]) => {
				// Add any missing groups
				if (!CONFIG[groupKey]) {
					CONFIG[groupKey] = groupVals;
					anyMods = true;
				} else {
					// Add any missing properties to existing groups
					Object.entries(groupVals).forEach(([k, v]) => {
						if (CONFIG[groupKey][k] === undefined) {
							CONFIG[groupKey][k] = v;
							anyMods = true;
						}
					});
				}
			});

		return anyMods;
	}

	/**
	 * @param [opts]
	 * @param [opts.isGameSettingsButton]
	 */
	static $getDirButton (opts) {
		opts = opts || {};

		const text = `Configure ${Config.get("ui", "isStreamerMode") ? "SRD Module" : "Plutonium"}`;

		return $(`<button class="mx-0 ${opts.isGameSettingsButton ? `cfg__btn-open-alt` : "w-initial"}" ${opts.isGameSettingsButton ? `` : `title="${text}"`}><span class="fas fa-fw fa-cogs"></span>${opts.isGameSettingsButton ? ` ${text}` : ``}</button>`)
			.click(evt => this.pHandleButtonClick(evt));
	}

	static pHandleButtonClick (evt, initialVisibleGroup) {
		if (evt) evt.preventDefault();

		return this._pOpen({initialVisibleGroup});
	}

	static _pOpen ({initialVisibleGroup = null} = {}) {
		if (Config._INSTANCE) {
			Config._INSTANCE.render(true);
			Config._INSTANCE.maximize();
			UtilApplications.bringToFront(Config._INSTANCE);
			if (initialVisibleGroup) Config._INSTANCE._setVisibleGroup(initialVisibleGroup);
			return;
		}

		Config._INSTANCE = new Config({initialVisibleGroup});
		Config._INSTANCE.render(true);
	}

	static _getDefaultGmConfig () { return this._getDefaultConfig({isPlayer: false}); }
	static _getDefaultPlayerConfig () { return this._getDefaultConfig({isPlayer: true}); }

	/**
	 * @param [opts]
	 * @param [opts.isPlayer]
	 */
	static _getDefaultConfig (opts) {
		opts = opts || {};
		const isPlayer = opts.isPlayer;

		const defaultTemplate = MiscUtil.copy(Config._DEFAULT_CONFIG__SORTED);
		const out = {};

		defaultTemplate
			.forEach(([groupKey, groupVals]) => {
				const group = (out[groupKey] = {});

				const assignDefaults = settings => Object.entries(settings).forEach(([k, meta]) => {
					if (isPlayer) {
						// Default all player versions to "null", which will pass them through to the underlying GM config
						if (meta.isPlayerEditable) group[k] = null;
					} else group[k] = meta.default;
				});

				if (groupVals.settings) assignDefaults(groupVals.settings);
				if (groupVals.settingsHacks) assignDefaults(groupVals.settingsHacks);
				if (groupVals.settingsAdvanced) assignDefaults(groupVals.settingsAdvanced);
			});

		return out;
	}

	static _isPlayerEditable (group, key) {
		const meta = this._is_getKeyMeta(group, key);
		return !!meta?.isPlayerEditable;
	}

	static _isNullable (group, key) {
		const meta = this._is_getKeyMeta(group, key);
		return !!meta?.isNullable;
	}

	static _is_getKeyMeta (groupKey, key) {
		return Config._DEFAULT_CONFIG__SORTED_FLAT
			.find(([groupKey_]) => groupKey_ === groupKey)[1][key];
	}

	static set (group, key, val) {
		if (!this._isCanSetConfig(group, key)) return;

		const prevVal = Config.get(group, key);

		const TARGET = game.user.isGM ? Config._CONFIG : Config._CONFIG_PLAYER;
		(TARGET[group] = TARGET[group] || {})[key] = val;
		Config._saveConfigDebounced();

		this._fireConfigUpdateHook(group, key, prevVal, val);
	}

	static setTemp (group, key, val) {
		if (!this._isCanSetConfig(group, key)) return;

		const prevVal = Config.get(group, key);

		(Config._CONFIG_TEMP[group] = Config._CONFIG_TEMP[group] || {})[key] = val;

		this._fireConfigUpdateHook(group, key, prevVal, val);
	}

	static setRivetTargetActor (actor) {
		if (!actor) {
			ui.notifications.info(`Cleared Rivet import target. Rivet will now import to an appropriate directory.`);
			Config.set("rivet", "targetActorId", null);
			return;
		}

		// For synthetic actors, use the full "scene -> token" UUID
		const actorId = actor.isToken ? actor.uuid : actor.id;

		Config.set("rivet", "targetActorId", actorId);
		ui.notifications.info(`Set Rivet import target. Rivet will now import to Actor "${actor.name}" (${actorId}). This can be changed in the Config.`);
	}

	static _fireConfigUpdateHook (group, key, oldVal, newVal) {
		UtilHooks.callAll(
			UtilHooks.HK_CONFIG_UPDATE,
			{
				previous: {
					[group]: {
						[key]: oldVal,
					},
				},
				current: {
					[group]: {
						[key]: newVal,
					},
				},
			},
		);
	}

	static _isCanSetConfig (group, key) { return game.user.isGM || this._isPlayerEditable(group, key); }

	static async _pSaveConfig () {
		if (game.user.isGM) {
			await game.settings.set(SharedConsts.MODULE_NAME, Config._SETTINGS_KEY, MiscUtil.copy(Config._CONFIG));

			// If the GM changes the config, notify other connected instances
			//   Directly send a copy of our config, as opposed to allowing it to save to world settings. This wastes
			//   more bandwidth, but *should* be more reliable as it does not have to rely on timing-based hacks
			const data = {
				type: "config.update",
				config: MiscUtil.copy(this._CONFIG),
			};

			game.socket.emit(Config._SOCKET_ID, data);
		} else {
			await StorageUtil.pSet(Config._CLIENT_SETTINGS_KEY, MiscUtil.copy(Config._CONFIG_PLAYER));
		}
	}

	static get (group, key) {
		// Avoid fancy "is nullable" checking here, as temp values should be up-to-date with the current schema
		if (Config._CONFIG_TEMP[group]?.[key] !== undefined) return Config._CONFIG_TEMP[group][key];

		if (!game.user.isGM && this._isPlayerEditable(group, key)) {
			const playerValue = (Config._CONFIG_PLAYER[group] || {})[key];

			if ((this._isNullable(group, key) && playerValue === null) || playerValue != null) return this._get_getValidValue(group, key, playerValue);
		}

		const out = (Config._CONFIG[group] || {})[key];
		return this._get_getValidValue(group, key, out);
	}

	static _get_getValidValue (groupKey, key, value) {
		const meta = Config._DEFAULT_CONFIG__SORTED_FLAT
			.find(([groupKey_]) => groupKey_ === groupKey)[1][key];

		if (meta.type !== "enum") return value;

		if (meta.isNullable && value == null) return value;

		// If the value isn't one we allow, return a default value
		const enumValues = this._getEnumValues(meta);
		if (value == null || !enumValues.some(it => (it.value ?? it) === value)) return meta.default ?? (enumValues[0].value ?? enumValues[0]);
		return value;
	}

	static _getDisplayLabels (group, key) {
		const displayGroup = ConfigConsts.DEFAULT_CONFIG_[group]?.name;
		const displayKey = ConfigConsts.DEFAULT_CONFIG_[group]?.settings?.[key]?.name
			|| ConfigConsts.DEFAULT_CONFIG_[group]?.settingsAdvanced?.[key]?.name
			|| ConfigConsts.DEFAULT_CONFIG_[group]?.settingsHacks?.[key]?.name;
		return {displayGroup, displayKey};
	}

	static handleFailedInitConfigApplication (group, key, error) {
		const {displayGroup, displayKey} = Config._getDisplayLabels(group, key);
		ui.notifications.error(`Failed to apply Config "${displayKey}" -> "${displayGroup}" during initial load! ${VeCt.STR_SEE_CONSOLE}`);
		console.error(...LGT, error);
	}

	/**
	 *
	 * @param [opts]
	 * @param [opts.initialVisibleGroup]
	 */
	constructor (opts) {
		opts = opts || {};

		super({
			width: 720,
			height: Util.getMaxWindowHeight(),
			title: "Config Editor",
			template: `${SharedConsts.MODULE_LOCATION}/template/Config.hbs`,
			resizable: true,
		});

		this._ixActiveTab = null;
		this._tabMetas = null;
		this._fnsHandleUpdate = {};

		if (opts.initialVisibleGroup) {
			const ix = Config._DEFAULT_CONFIG__SORTED.findIndex(([groupKey]) => groupKey === opts.initialVisibleGroup);
			if (!~ix) throw new Error(`Could not find config group "${opts.initialVisibleGroup}"`);
			this._ixActiveTab = ix;
		}

		this._DRAFT_GM = null;
		this._DRAFT_PLAYER = null;

		Config._INSTANCE = this;
	}

	static get _DEFAULT_CONFIG__SORTED () {
		if (Config._CACHE_DEFAULT_CONFIG_SORTED) return Config._CACHE_DEFAULT_CONFIG_SORTED;
		return Config._CACHE_DEFAULT_CONFIG_SORTED = Object.entries(ConfigConsts.DEFAULT_CONFIG_)
			.sort(([, vA], [, vB]) => SortUtil.ascSortLower(vA.name, vB.name));
	}

	static get _DEFAULT_CONFIG__SORTED_FLAT () {
		if (Config._CACHE_DEFAULT_CONFIG_SORTED_FLAT) return Config._CACHE_DEFAULT_CONFIG_SORTED_FLAT;
		const out = [];
		this._DEFAULT_CONFIG__SORTED
			.forEach(([groupKey, group]) => {
				const flatGroup = {};
				Config._KEYS_SETTINGS_METAS.forEach(keySettings => {
					Object.entries(group[keySettings] || {})
						.forEach(([key, meta]) => {
							flatGroup[key] = meta;
						});
				});
				out.push([groupKey, flatGroup]);
			});
		Config._CACHE_DEFAULT_CONFIG_SORTED_FLAT = out;
		return out;
	}

	_addFnHandleUpdate (group, key, fn) {
		const target = MiscUtil.getOrSet(this._fnsHandleUpdate, group, key, []);
		target.push(fn);
	}

	_callFnsHandleUpdate (group, key) {
		const fns = MiscUtil.get(this._fnsHandleUpdate, group, key);
		(fns || []).forEach(fn => fn());
	}

	_setVisibleGroup (visibleGroup) {
		const ix = Config._DEFAULT_CONFIG__SORTED.findIndex(([groupKey]) => groupKey === visibleGroup);
		if (!~ix) throw new Error(`Could not find config group "${visibleGroup}"`);
		this._setActiveTab(ix);
	}

	_$getBtnSave ({isClose, textSaving, textSaved, text, textFailed}) {
		let tmtBtnSaveNotification = null;
		const $btnSave = $(`<button class="btn btn-5et btn-default min-w-100p">${text}</button>`)
			.click(async () => {
				if ($btnSave.prop("disabled")) return;

				clearTimeout(tmtBtnSaveNotification);

				try {
					$btnSave.prop("disabled", true).text(textSaving);

					const TARGET = game.user.isGM ? Config._CONFIG : Config._CONFIG_PLAYER;
					const DRAFT = game.user.isGM ? this._DRAFT_GM : this._DRAFT_PLAYER;

					const old = MiscUtil.copy(TARGET);

					Object.assign(TARGET, MiscUtil.copy(DRAFT));

					await Config._pSaveConfig();

					UtilHooks.callAll(
						UtilHooks.HK_CONFIG_UPDATE,
						{
							previous: old,
							current: MiscUtil.copy(TARGET),
						},
					);

					$btnSave.text(textSaved).prop("disabled", false);
					tmtBtnSaveNotification = setTimeout(() => $btnSave.text(text), VeCt.DUR_INLINE_NOTIFY);
				} catch (e) {
					$btnSave.text(textFailed);
					tmtBtnSaveNotification = setTimeout(() => $btnSave.text(text).prop("disabled", false), VeCt.DUR_INLINE_NOTIFY * 2);
				}

				if (isClose) await this.close();
			});

		return $btnSave;
	}

	activateListeners ($html) {
		super.activateListeners($html);
		$html.empty();

		(async () => {
			if (this._ixActiveTab == null) this._ixActiveTab = await StorageUtil.pGet(Config._SETTINGS_KEY_LAST_ACTIVE_TAB);
			if (this._ixActiveTab == null) this._ixActiveTab = 0;

			this._DRAFT_GM = MiscUtil.copy(Config._CONFIG);
			this._DRAFT_PLAYER = MiscUtil.copy(Config._CONFIG_PLAYER);

			const isHideUnavailable = Config.get("ui", "isHideGmOnlyConfig");

			this._tabMetas = Config._DEFAULT_CONFIG__SORTED
				.map(([groupKey, groupVals], i) => this._activateListeners_getTabMeta({
					groupKey,
					groupVals,
					ixTab: i,
					isHideUnavailable,
				}));

			const $btnApply = this._$getBtnSave({
				textSaving: "Applying...",
				textSaved: "Applied!",
				textFailed: "Failed to apply",
				text: "Apply",
			});

			const $btnSave = this._$getBtnSave({
				isClose: true,
				textSaving: "Saving...",
				textSaved: "Saved!",
				textFailed: "Failed to save",
				text: "OK",
			});

			const $btnCancel = $(`<button class="btn btn-5et btn-default min-w-100p">Cancel</button>`)
				.click(() => this.close());

			const $iptSearch = $(`<input type="search" placeholder="Find setting..." class="input-xs form-control">`);
			UiUtil.bindTypingEnd({
				$ipt: $iptSearch,
				fnKeyup: () => {
					const searchVal = $iptSearch.val().toLowerCase().trim();
					this._tabMetas.forEach(it => it ? it.cbSearch(searchVal) : null);
				},
			});

			const $btnChangelog = $(`<button class="btn btn-5et btn-xs ml-1">Changelog</button>`)
				.click(() => Changelog.open());

			const $btnReportBug = $(`<button class="btn btn-5et btn-xs ml-1"><i class="fas fa-bug"></i> Report a Bug</button>`)
				.click(() => Config._doShowBugReportForm());

			const $btnPatreon = $(`<a class="btn btn-5et btn-xs ml-1" href="https://www.patreon.com/Giddy5e" rel="noopener noreferrer"><i class="fab fa-patreon"></i> Become a Patron</a>`);

			$$`<div class="ve-flex-col w-100 h-100">
				<div class="w-100 p-1 no-shrink cfg__wrp-search ve-flex-v-center">
					${$iptSearch}
					${this._activateListeners_$getWrpImportExport()}
					${$btnChangelog}
					${$btnReportBug}
					${$btnPatreon}
				</div>

				<div class="ve-flex w-100 h-100 min-h-0">
					<div class="ve-flex-col h-100 overflow-y-auto no-shrink cfg__wrp-tab-headers pb-1">
						${this._tabMetas.map(it => it ? it.$tabHeader : null)}
					</div>

					<div class="w-100 h-100 overflow-y-auto p-2">
						${this._tabMetas.map(it => it ? it.$tabBody : null)}
					</div>
				</div>

				<div class="w-100 p-1 no-shrink cfg__wrp-save">
					<div class="ve-flex-h-right">
						${$btnSave.addClass("mr-2")}
						${$btnCancel.addClass("mr-2")}
						${$btnApply.addClass("mr-4")}
					</div>
				</div>
			</div>`.appendTo($html);
		})();
	}

	static _doShowBugReportForm () {
		new class TempApplication extends Application {
			constructor () {
				super({
					title: "Report a Bug",
					template: `${SharedConsts.MODULE_LOCATION}/template/_Generic.hbs`,
					width: 800,
					height: 600,
					resizable: true,
				});
			}

			activateListeners ($html) {
				const $btnCopy = $(`<button name="btn-copy" class="btn btn-5et btn-xs">Copy to Clipboard</button>`)
					.click(async () => {
						await MiscUtil.pCopyTextToClipboard($iptReport.val());
						JqueryUtil.showCopiedEffect($btnCopy);
					});

				const $iptReport = $(`<textarea name="ipt-report mb-3" class="w-100 h-100"></textarea>`);

				Config.P_GET_BACKEND_VERSION.then(ver => {
					$iptReport
						.val(`**Support Request**

**Issue Description**: PLEASE FILL, e.g. "When I import a goblin, my game crashes"
**Environment/OS**: PLEASE FILL, e.g. "Self hosted on Windows"/"The Forge"/etc.
**Browser Extensions**: FILL IF RELEVANT, e.g. "Beyond20"

**Reproduction Steps**: PLEASE FILL, e.g. "1) Create a new actor compendium; 2) Import a goblin to that compendium"

**Console Log**: PLEASE FILL [${VeCt.STR_SEE_CONSOLE}]

---

**Browser**: ${navigator.userAgent}
**Backend installed**: ${ver}
**Foundry & DND system Version**: Foundry ${game.version}, ${game.data.system.id} ${game.data.system.data.version}
**Modules Installed**:
${[...game.modules].filter(([, data]) => data.active).map(([, data]) => `${data.id}==${data.data?.version}`).sort(SortUtil.ascSortLower).join("\n")}
`);
				});

				$$`<p>Please copy and fill out the following form, and post the result in our <a href="https://discord.gg/nGvRCDs" target="_blank" rel="noopener noreferrer">Discord</a> (<span class="code">#plutonium-or-rivet-issues</span> channel):</p>
					<div class="ve-flex-h-right mb-2">${$btnCopy}</div>
					${$iptReport}`.appendTo($html);
			}
		}().render(true);
	}

	_activateListeners_$getWrpImportExport () {
		if (!game.user.isGM) return null;

		const $btnExport = $(`<button class="btn btn-5et btn-xs"><i class="fas fa-file-export fa-fw"></i> Export Config</button>`)
			.click(() => {
				DataUtil.userDownload(
					`${SharedConsts.MODULE_NAME}-config`,
					{
						config: MiscUtil.copy(this.constructor._CONFIG),
					},
					{
						propVersion: "moduleVersion",
						fileType: "config",
						valVersion: game.modules.get(SharedConsts.MODULE_NAME).data.version,
					},
				);
			});

		const $btnImport = $(`<button class="btn btn-5et btn-xs"><i class="fas fa-file-import fa-fw"></i> Import Config</button>`)
			.click(async () => {
				const {jsons, errors} = await DataUtil.pUserUpload({
					expectedFileType: "config",
					propVersion: "moduleVersion",
				});

				DataUtil.doHandleFileLoadErrorsGeneric(errors);

				if (!jsons?.length) return;

				const config = jsons[0]?.config;
				if (!config) return ui.notifications.warn(`Could not find exported config in file!`);

				this.constructor._populateMissingConfigValues(config, {isPlayer: false});

				const old = MiscUtil.copy(Config._CONFIG);

				this._handleGmConfigUpdate(config);

				await Config._pSaveConfig();

				UtilHooks.callAll(
					UtilHooks.HK_CONFIG_UPDATE,
					{
						previous: old,
						current: MiscUtil.copy(Config._CONFIG),
					},
				);

				ui.notifications.info(`Config applied!`);
			});

		return $$`<div class="btn-group ml-1 ve-flex-vh-center">
			${$btnExport}
			${$btnImport}
		</div>`;
	}

	_activateListeners_getTabMeta ({groupKey, groupVals, ixTab, isHideUnavailable}) {
		const $dispResultCount = $(`<div class="cfg__disp-row-count-tab-header ve-hidden ve-flex-vh-center"></div>`);

		const $tabHeader = $$`<div class="relative cfg__btn-tab-header px-2 py-1 ml-1 mt-1 ${ixTab === this._ixActiveTab ? "cfg__btn-tab-header--active" : ""}">
				${groupVals.name.escapeQuotes()}
				${$dispResultCount}
			</div>`
			.click(() => this._setActiveTab(ixTab));

		const fnsReset = [];

		const $btnResetTab = $(`<button class="btn btn-xs ml-auto" title="Reset Settings for This Tab"><i class="fa fa-undo-alt"></i></button>`)
			.click(() => fnsReset.forEach(it => it()));

		const getRowMeta = settings => {
			return Object.entries(settings)
				.map(([k, meta]) => {
					if (meta.default === undefined) throw new Error(`No "default" config value exists for "${groupKey}.${k}"! This is a bug!`);

					const isPlayerEditable = Config._isPlayerEditable(groupKey, k);
					const isDisabledPlayer = !isPlayerEditable && !game.user.isGM;
					const incompatibleModuleNames = Config._getIncompatibleModuleIds(groupKey, k);
					const isDisabledCompatibility = incompatibleModuleNames.length > 0;
					const isDisabled = isDisabledPlayer || isDisabledCompatibility;

					if (isHideUnavailable && isDisabledPlayer) return;

					const DRAFT = game.user.isGM ? this._DRAFT_GM : this._DRAFT_PLAYER;

					const current = Config.get(groupKey, k);

					const $btnResetRow = $(`<button class="btn btn-xxs ml-1 cfg__btn-reset-row" title="Reset"><i class="fa fa-undo-alt"></i></button>`)
						.click(evt => {
							evt.stopPropagation();
							evt.preventDefault();
							fnReset();
						});
					const cbIsDefault = () => $btnResetRow.toggleClass("ve-muted", CollectionUtil.deepEquals(DRAFT[groupKey][k], meta.default));
					cbIsDefault();

					let $ele,
						fnDisable, // Allow the "disable this setting" function to be overridden
						fnReset;
					let isLabel = true;
					switch (meta.type) {
						case "boolean": {
							$ele = $(`<input type="checkbox">`)
								.change(() => {
									if (isDisabled) return;

									DRAFT[groupKey][k] = $ele.prop("checked");
									doUpdate(DRAFT[groupKey][k]);
								});

							const doUpdate = (val) => {
								$ele.prop("checked", val);
								cbIsDefault();
							};

							doUpdate(current);

							fnReset = () => $ele.prop("checked", meta.default).change();
							this._addFnHandleUpdate(groupKey, k, () => doUpdate(Config.get(groupKey, k)));

							break;
						}

						case "enum": {
							const values = this.constructor._getEnumValues(meta);

							$ele = $(`<select class="w-100"></select>`)
								.change(() => {
									if (isDisabled) return;

									const ixSel = Number($ele.val());
									if (~ixSel) {
										DRAFT[groupKey][k] = values[ixSel].value !== undefined ? values[ixSel].value : values[ixSel];
									} else {
										if (meta.isNullable) DRAFT[groupKey][k] = null;
										else DRAFT[groupKey][k] = values[0].value !== undefined ? values[0].value : values[0];
									}
									// Ensure the select displays whatever we chose to set as our update
									doUpdate(DRAFT[groupKey][k]);
								});

							if (meta.isNullable) $ele.append(`<option value="-1">(None)</option>`);
							values.forEach((it, i) => $(`<option/>`, {value: i, text: it.name ?? it.value ?? it}).title(it.help).appendTo($ele));

							const doUpdate = (val) => {
								if (meta.isNullable && val == null) $ele.val("-1");
								else if (val != null) {
									const ixCurrent = values.findIndex(it => (it.value !== undefined ? it.value : it) === val);
									if (~ixCurrent) $ele.val(`${ixCurrent}`);
									else $ele.val("0");
								}
								cbIsDefault();
							};

							doUpdate(current);

							fnReset = () => {
								const ixDefault = values.findIndex(it => (it.value == null ? it : it.value) === meta.default);
								$ele.val(`${ixDefault}`).change();
							};
							this._addFnHandleUpdate(groupKey, k, () => doUpdate(Config.get(groupKey, k)));

							break;
						}

						case "string":
						case "url":
						case "color": {
							const iptType = meta.type === "color" ? "color" : "text";

							$ele = $(`<input type="${iptType}" class="w-100">`)
								.placeholder(meta.placeholder)
								.change(() => {
									if (isDisabled) return;

									const val = $ele.val().trim();
									if (!val && !meta.isNullable) {
										DRAFT[groupKey][k] = meta.default;
										$ele.val(meta.default);
									} else {
										DRAFT[groupKey][k] = (meta.isNullable && !val) ? null : val;
									}

									doUpdate(DRAFT[groupKey][k]);
								});

							const doUpdate = (val) => {
								$ele.val(val);
								cbIsDefault();
							};

							doUpdate(current);

							fnReset = () => $ele.val(meta.default).change();
							this._addFnHandleUpdate(groupKey, k, () => doUpdate(Config.get(groupKey, k)));

							break;
						}

						case "percentage":
						case "number": { // Note that this is _not_ "integer"
							const cur = (current == null || isNaN(current)) ? meta.default : Number(current);

							$ele = $(`<input type="text" class="w-100">`)
								.placeholder(meta.placeholder)
								.change(() => {
									if (isDisabled) return;

									const rawVal = $ele.val().trim();

									if (!rawVal && meta.isNullable) {
										DRAFT[groupKey][k] = null;
										$ele.val(null);

										return void cbIsDefault();
									}

									const defaultVal = meta.isNullable ? null : meta.default;
									const opts = {fallbackOnNaN: defaultVal};
									if (meta.min) opts.min = meta.min;
									if (meta.max) opts.max = meta.max;

									const num = UiUtil.strToNumber(rawVal, defaultVal, opts);
									DRAFT[groupKey][k] = num;
									$ele.val(num);

									doUpdate(DRAFT[groupKey][k]);
								});

							const doUpdate = (val) => {
								$ele.val(val);
								cbIsDefault();
							};

							doUpdate(cur);

							fnReset = () => $ele.val(meta.default).change();
							this._addFnHandleUpdate(groupKey, k, () => doUpdate(Config.get(groupKey, k)));

							break;
						}

						case "multipleChoice": {
							isLabel = false;

							const $labels = [];
							const $cbs = [];

							fnDisable = () => {
								$labels.forEach($lbl => $lbl.title(this.constructor._getIsDisabledMessage({isDisabledPlayer, isDisabledCompatibility, incompatibleModuleNames})));
								$cbs.forEach($cb => $cb.prop("disabled", true));
							};

							const handleUpdate = () => {
								DRAFT[groupKey][k] = $cbs.mergeMap(($cb, i) => ({[i]: $cb.prop("checked")}));
								cbIsDefault();
							};

							const $rows = meta.choices.map((it, i) => {
								const $cb = $(`<input type="checkbox">`)
									.prop("checked", !!current[i])
									.change(() => {
										if (isDisabled) return;
										handleUpdate();
									});
								$cbs.push($cb);

								this._addFnHandleUpdate(groupKey, k, () => {
									$ele.prop("checked", !!Config.get(groupKey, k)[i]);
									cbIsDefault();
								});

								const $lbl = $$`<label class="split-v-center m-0 stripe-even py-1">
									<div class="ve-small">${it.escapeQuotes()}</div>
									${$cb}
								</label>`;
								$labels.push($lbl);
								return $lbl;
							});

							fnReset = () => {
								$cbs.forEach(($cb, i) => {
									$cb.prop("checked", !!meta.default[i]);
								});
								handleUpdate();
							};

							$ele = $$`<div class="ve-flex-col w-100">${$rows}</div>`;

							break;
						}

						case "arrayStringShort": {
							isLabel = false;

							const cur = current instanceof Array ? MiscUtil.copy(current) : [];

							const comp = BaseComponent.fromObject({values: cur}, "values");
							$ele = ComponentUiUtil.$getPickString(comp, "values", {isCaseInsensitive: !meta.isCaseSensitive});
							comp._addHookBase("values", () => {
								DRAFT[groupKey][k] = comp._state.values;
								cbIsDefault();
							});

							fnReset = () => comp._state.values = [...meta.default];
							this._addFnHandleUpdate(groupKey, k, () => {
								comp._state.values = [...Config.get(groupKey, k) || []];
								cbIsDefault();
							});

							break;
						}

						// TODO(future) expand as required
						default: throw new Error(`Unhandled type "${meta.type}"`);
					}

					if (isDisabled) {
						if (fnDisable) fnDisable();
						else $ele.prop("disabled", true).title(this.constructor._getIsDisabledMessage({isDisabledPlayer, isDisabledCompatibility, incompatibleModuleNames}));
					}

					fnsReset.push(fnReset);

					const isWideInput = meta.type === "url";

					const $row = $$`<${isLabel ? "label" : "div"} class="split-v-center py-1 cfg__row" title="${meta.help.escapeQuotes()}">
						<div class="ve-flex-v-center cfg__disp-name ${isWideInput ? `cfg__disp-name--narrow` : ""}">
							<div>${meta.name}</div>
							${isPlayerEditable && game.user.isGM ? ` <span class="cfg__disp-player-editable ml-1" title="Player Editable">†</span>` : ""}${meta.isReloadRequired ? ` <span class="cfg__disp-requires-refresh ml-1" title="Requires Refresh">‡</span>` : ""}
						</div>
						<div class="ve-flex-v-center ve-flex-h-right w-100 cfg__wrp-input ${isWideInput ? `cfg__wrp-input--wide` : ""}">
							${$ele}
							${$btnResetRow}
						</div>
					</${isLabel ? "label" : "div"}>`;

					const searchKey = [meta.help, meta.name].filter(Boolean).join(" -- ").toLowerCase().trim();
					const cbSearch = (searchTerm) => {
						const isNoMatch = searchTerm && !searchKey.includes(searchTerm);
						const isHidden = meta.unlockCode && meta.unlockCode !== searchTerm;

						$row.toggleClass("cfg__row--no-match", !!isNoMatch);
						if (meta.unlockCode && !isHidden) $row.removeClass("cfg__row--no-match");
						$row.toggleVe(!isHidden);

						return isNoMatch || isHidden;
					};
					cbSearch("");

					return {
						$row,
						cbSearch,
					};
				})
				.filter(Boolean);
		};

		let metasSettings = groupVals.settings ? getRowMeta(groupVals.settings) : null;
		if (metasSettings && !metasSettings.length) metasSettings = null;
		let metasSettingsHacks = groupVals.settingsHacks ? getRowMeta(groupVals.settingsHacks) : null;
		if (metasSettingsHacks && !metasSettingsHacks.length) metasSettingsHacks = null;
		let metasSettingsAdvanced = groupVals.settingsAdvanced ? getRowMeta(groupVals.settingsAdvanced) : null;
		if (metasSettingsAdvanced && !metasSettingsAdvanced.length) metasSettingsAdvanced = null;

		if (!metasSettings && !metasSettingsHacks && !metasSettingsAdvanced) return null;

		const $tabBody = $$`<div class="ve-flex-col h-100 w-100 ${ixTab === this._ixActiveTab ? "" : "ve-hidden"}">
		<div class="ve-flex-v-center">
			${$btnResetTab}
		</div>
		<hr class="w-100 my-1">

		${metasSettings ? $$`<div class="w-100 ve-flex-col">${metasSettings.map(it => it.$row)}</div>` : null}

		${metasSettingsHacks ? `${metasSettings ? `<hr class="cfg__hr-tab-section">` : ""}<div class="cfg__head-tab-section my-1 help" title="These settings may be incompatible with other modules, or even Foundry itself. If something doesn't work, turn these off first.">Experimental Settings</div>` : ""}
		${metasSettingsHacks ? $$`<div class="w-100 ve-flex-col">${metasSettingsHacks.map(it => it.$row)}</div>` : null}

		${metasSettingsAdvanced ? `${metasSettings || metasSettingsHacks ? `<hr class="cfg__hr-tab-section">` : ""}<div class="cfg__head-tab-section my-1">Advanced Settings</div>` : ""}
		${metasSettingsAdvanced ? $$`<div class="w-100 ve-flex-col">${metasSettingsAdvanced.map(it => it.$row)}</div>` : null}
		</div>`;

		const totalRows = [
			metasSettings || [],
			metasSettingsHacks || [],
			metasSettingsAdvanced || [],
		].map(it => it.length).sum();

		const cbSearch = (searchTerm) => {
			const cntHiddenRows = (metasSettings || []).map(it => Number(it.cbSearch(searchTerm) || 0)).sum()
				+ (metasSettingsHacks || []).map(it => Number(it.cbSearch(searchTerm) || 0)).sum()
				+ (metasSettingsAdvanced || []).map(it => Number(it.cbSearch(searchTerm) || 0)).sum();

			if (totalRows) {
				const cntVisibleRows = totalRows - cntHiddenRows;
				$tabHeader.toggleClass("cfg__btn-tab-header--muted", cntVisibleRows === 0);
				$dispResultCount
					.text(cntVisibleRows)
					.title(`${cntVisibleRows} result${cntVisibleRows === 1 ? "" : "s"}`)
					.toggleClass("cfg__disp-row-count-tab-header--has-results", !!cntVisibleRows)
					.toggleVe(searchTerm);
			}
		};

		return {$tabHeader, $tabBody, cbSearch};
	}

	_setActiveTab (ix) {
		this._tabMetas.map((it, i) => {
			if (!it) return;
			it.$tabHeader.toggleClass("cfg__btn-tab-header--active", ix === i);
			it.$tabBody.toggleClass("ve-hidden", ix !== i);
		});
		this._ixActiveTab = ix;
		StorageUtil.pSet(Config._SETTINGS_KEY_LAST_ACTIVE_TAB, ix).then(null);
	}

	/**
	 * NOTE: This is player-only.
	 * Update all the GM-specified config options, and reflect this in any editor windows we have open.
	 * @param receivedConfig
	 */
	_handleGmConfigUpdate (receivedConfig) {
		Object.assign(Config._CONFIG, receivedConfig);
		Object.assign(this._DRAFT_GM, MiscUtil.copy(Config._CONFIG));

		Object.entries(receivedConfig || {})
			.forEach(([group, meta]) => {
				Object.keys(meta || {})
					.forEach(key => this._callFnsHandleUpdate(group, key));
			});
	}

	async close (...args) {
		await super.close(...args);
		Config._INSTANCE = null;
	}

	static _getIncompatibleModuleIds (groupKey, key) {
		const groupSettings = Config._DEFAULT_CONFIG__SORTED_FLAT.find(([groupKey_]) => groupKey_ === groupKey)[1];
		if (!groupSettings[key]?.compatibilityModeValues) return [];
		return Object.keys(groupSettings[key].compatibilityModeValues).filter(moduleId => UtilCompat.isModuleActive(moduleId));
	}

	static _getIsDisabledMessage ({isDisabledPlayer, isDisabledCompatibility, incompatibleModuleNames}) {
		if (isDisabledPlayer) return `(This setting is controlled by the GM)`;
		if (isDisabledCompatibility) return `(This setting is disabled due to incompatibility with one or more other active modules: ${incompatibleModuleNames.map(it => `"${it}"`).join(", ")})`;
		return null;
	}

	static _getEnumValues (meta) {
		return typeof meta.values === "function" ? meta.values() : meta.values;
	}

	// region external
	static isUseMetric ({configGroup, configKey = "isMetric"}) { return Config.get("import", "isGlobalMetric") || Config.get(configGroup, configKey); }

	static getMetricNumber ({configGroup, originalValue, originalUnit, configKey = "isMetric"}) {
		if (!Config.isUseMetric({configGroup, configKey})) return originalValue;
		return Parser.metric.getMetricNumber({originalValue, originalUnit});
	}

	static getMetricUnit ({configGroup, originalUnit, configKey = "isMetric", isShortForm = true, isPlural = false}) {
		if (!Config.isUseMetric({configGroup, configKey})) {
			if (!isShortForm) return originalUnit;
			switch (originalUnit) {
				case UNT_FEET: return "ft";
				case UNT_MILES: return "mi";
				default: return originalUnit;
			}
		}
		return Parser.metric.getMetricUnit({originalUnit, isShortForm, isPlural});
	}

	static getSpellPointsResource ({isValueKey = false, isMaxKey = false} = {}) {
		return this._getSpellPsiPointsResource({configGroup: "importSpell", configKey: "spellPointsResource", configKeyCustom: "spellPointsResourceCustom", isValueKey, isMaxKey});
	}

	static getPsiPointsResource ({isValueKey = false, isMaxKey = false} = {}) {
		return this._getSpellPsiPointsResource({configGroup: "importPsionic", configKey: "psiPointsResource", configKeyCustom: "psiPointsResourceCustom", isValueKey, isMaxKey});
	}

	static _getSpellPsiPointsResource ({configGroup, configKey, configKeyCustom, isValueKey = false, isMaxKey = false} = {}) {
		if (Config.get(configGroup, configKey) === ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM) return ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM;

		if (isValueKey && isMaxKey) throw new Error(`Only one of "isValue" and "isMax" may be specified!`);
		const out = Config.get(configGroup, configKey) === ConfigConsts.C_SPELL_POINTS_RESOURCE__ATTRIBUTE_CUSTOM
			? Config.get(configGroup, configKeyCustom)
			: Config.get(configGroup, configKey);
		return isValueKey ? `${out}.value` : isMaxKey ? `${out}.max` : out;
	}
	// endregion
}
Config._INSTANCE = null;
Config.P_GET_BACKEND_VERSION = new Promise(resolve => Config._GET_BACKEND_VERSION_RESOLVE = resolve);
Config._SETTINGS_KEY = `config`;
Config._CLIENT_SETTINGS_KEY = `${SharedConsts.MODULE_NAME}.config`;
Config._SETTINGS_KEY_LAST_ACTIVE_TAB = `config.ixLastActiveTab`;
Config._SOCKET_ID = `module.${SharedConsts.MODULE_NAME}`;
Config._saveConfigDebounced = MiscUtil.throttle(Config._pSaveConfig, 100);
Config._CONFIG = {};
Config._CONFIG_PLAYER = {};
Config._CONFIG_TEMP = {}; // In-memory overrides
Config._KEYS_SETTINGS_METAS = ["settings", "settingsHacks", "settingsAdvanced"];

// region Caches
Config._CACHE_DEFAULT_CONFIG_SORTED = null;
Config._CACHE_DEFAULT_CONFIG_SORTED_FLAT = null;
// endregion

export {Config};
