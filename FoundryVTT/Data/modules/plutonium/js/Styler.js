import {Config} from "./Config.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilCompat} from "./UtilCompat.js";
import {UtilHooks} from "./UtilHooks.js";

class Styler {
	static init () {
		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, () => this._handleConfigUpdate());
		this._handleConfigUpdate();

		Hooks.on("canvasReady", () => this._handleNameTabFromScene());
		Hooks.on("updateScene", () => this._handleNameTabFromScene());
		// Note: `deleteScene` fires before the canvas unloads the scene, so, allow a small delay
		Hooks.on("deleteScene", () => setTimeout(() => this._handleNameTabFromScene(), 500));
	}

	static _handleConfigUpdate () {
		this._handleConfigUpdate_compactDirectories();
		this._handleConfigUpdate_compactDirectoryButtons();
		this._handleConfigUpdate_hidePlutoniumDirectoryButtons();
		this._handleConfigUpdate_showPopoutButton();
		this._handleConfigUpdate_compactSheetControls();
		this._handleConfigUpdate_compactChat();
		this._handleConfigUpdate_sheetLevelUpButton();
		this._handleConfigUpdate_wrapDirectories();
		this._handleConfigUpdate_compatibilityPermissionViewer();
		this._handleConfigUpdate_compatibilityTwilightUi();
		this._handleConfigUpdate_compatibilityTidy5eSheet();
		this._handleBackendCheck();
		this._handleRivetCheck();
		this._handleNameTabFromScene();
	}

	/**
	 * @param opts Options object.
	 * @param [opts.configGroup]
	 * @param [opts.configGroupKey]
	 * @param [opts.condition]
	 * @param opts.idStyle
	 * @param [opts.css]
	 * @param [opts.file]
	 */
	static _handleConfigUpdate_handleGenericCssMod (opts) {
		if (!opts.css && !opts.file) throw new Error(`One of "css" or "file" must be specified!`);
		if (!(opts.configGroup && opts.configGroupKey) && !opts.condition) throw new Error(`One of "configGroup/Key" or "condition" must be specified!`);

		const $style = $(`#${opts.idStyle}`);

		const isActive = opts.condition && (opts.configGroup && opts.configGroupKey)
			? opts.condition(Config.get(opts.configGroup, opts.configGroupKey))
			: opts.condition
				? opts.condition()
				: Config.get(opts.configGroup, opts.configGroupKey);
		if (!isActive) return $style.remove();

		if ($style.length) return;

		if (opts.css) {
			$(`<style id="${opts.idStyle}">
				${opts.css}
			</style>`).appendTo(document.body);
		} else {
			$(`<link id="${opts.idStyle}" href="${SharedConsts.MODULE_LOCATION}/${opts.file}" rel="stylesheet" type="text/css" media="all">`).appendTo(document.head);
		}
	}

	static _handleConfigUpdate_compactDirectories () {
		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactScenes",
			idStyle: Styler._ID_COMPACT_SCENES,
			file: `css/optional-compact-scenes.css`,
		});

		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactActors",
			idStyle: Styler._ID_COMPACT_ACTORS,
			file: `css/optional-compact-actors.css`,
		});

		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactItems",
			idStyle: Styler._ID_COMPACT_ITEMS,
			file: `css/optional-compact-items.css`,
		});

		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactJournal",
			idStyle: Styler._ID_COMPACT_JOURNAL,
			file: `css/optional-compact-journal.css`,
		});

		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactTables",
			idStyle: Styler._ID_COMPACT_TABLES,
			file: `css/optional-compact-tables.css`,
		});

		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactCards",
			idStyle: Styler._ID_COMPACT_CARDS,
			file: `css/optional-compact-cards.css`,
		});

		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactMacros",
			idStyle: Styler._ID_COMPACT_MACROS,
			file: `css/optional-compact-macros.css`,
		});
	}

	static _handleConfigUpdate_compactDirectoryButtons () {
		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactDirectoryButtons",
			idStyle: Styler._ID_COMPACT_DIRECTORY_BUTTONS,
			file: `css/optional-compact-directory-buttons.css`,
		});
	}

	static _handleConfigUpdate_hidePlutoniumDirectoryButtons () {
		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isHidePlutoniumDirectoryButtons",
			idStyle: Styler._ID_HIDE_PLUT_DIRECTORY_BUTTONS,
			file: `css/optional-hide-plut-directory-buttons.css`,
		});
	}

	static _handleConfigUpdate_showPopoutButton () {
		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isShowPopout",
			idStyle: Styler._ID_SHEET_POPOUT,
			file: `css/optional-sheet-popout.css`,
		});
	}

	static _handleConfigUpdate_compactSheetControls () {
		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactWindowBar",
			idStyle: Styler._ID_SHEET_COMPACT_CONTROLS,
			file: `css/optional-sheet-compact-controls.css`,
		});
	}

	static _handleConfigUpdate_compactChat () {
		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isCompactChat",
			idStyle: Styler._ID_COMPACT_CHAT,
			file: `css/optional-compact-chat.css`,
		});
	}

	static _handleConfigUpdate_sheetLevelUpButton () {
		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "importClass",
			configGroupKey: "isAddLevelUpButton",
			idStyle: Styler._ID_SHEET_LEVEL_UP_BUTTON,
			file: `css/optional-sheet-level-up-button.css`,
		});
	}

	static _handleConfigUpdate_wrapDirectories () {
		this._handleConfigUpdate_handleGenericCssMod({
			configGroup: "ui",
			configGroupKey: "isEnableFolderNameWrap",
			idStyle: Styler._ID_WRAP_FOLDER_NAMES,
			file: `css/optional-wrap-folder-names.css`,
		});
	}

	static _handleConfigUpdate_compatibilityPermissionViewer () {
		this._handleConfigUpdate_handleGenericCssMod({
			condition: () => {
				if (
					!UtilCompat.isPermissionViewerActive()
					|| (UtilCompat.isPermissionViewerActive() && UtilCompat.isSmolFoundryActive())
				) return false;

				const _UI_CONFIG_KEYS_COMPACT_DIRECTORY = [
					"isCompactScenes",
					"isCompactActors",
					"isCompactItems",
					"isCompactJournal",
					"isCompactTables",
					"isCompactCards",
					"isCompactMacros",
				];
				return _UI_CONFIG_KEYS_COMPACT_DIRECTORY.some(it => Config.get("ui", it));
			},
			idStyle: Styler._ID_COMPATIBILITY_PERMISSION_VIEWER,
			file: `css/optional-compatibility-permission-viewer.css`,
		});
	}

	static _handleConfigUpdate_compatibilityTwilightUi () {
		this._handleConfigUpdate_handleGenericCssMod({
			condition: () => UtilCompat.isTwilightUiActive(),
			idStyle: Styler._ID_COMPATIBILITY_TWILIGHT_UI,
			file: `css/optional-compatibility-twilight-ui.css`,
		});
	}

	static _handleConfigUpdate_compatibilityTidy5eSheet () {
		this._handleConfigUpdate_handleGenericCssMod({
			condition: () => UtilCompat.isTidy5eSheetActive(),
			idStyle: Styler._ID_COMPATIBILITY_TIDY5E_SHEET,
			file: `css/optional-compatibility-tidy5e-sheet.css`,
		});
	}

	static _handleBackendCheck () {
		Config.P_GET_BACKEND_VERSION
			.then(async activeVersion => {
				if (!activeVersion) return;

				await Styler._LOCK_GLITCH.pLock();
				try {
					const $styleLogoGlitch = $(`#${Styler._ID_LOGO_GLITCH}`);
					const $dispVersion = $(`#${Styler._ID_BACKEND_VERSION}`);

					const $imgLogo = $(`#logo`);

					if (!Config.get("ui", "isDisplayBackendStatus") || Config.get("ui", "isStreamerMode")) {
						$imgLogo.title("");
						$styleLogoGlitch.remove();
						$dispVersion.remove();
						return;
					}

					if (!$styleLogoGlitch.length) {
						$imgLogo.title(`++++ Plutonium server v${activeVersion}: [online] ++++`);
						$(`<style id="${Styler._ID_LOGO_GLITCH}">
							#logo {
								filter: hue-rotate(100deg) saturate(1.5);
							}
						</style>`).appendTo(document.body);
					}

					if (!$dispVersion.length) {
						$(`<div class="plutsrv__disp-version text-center" id="${Styler._ID_BACKEND_VERSION}">${activeVersion}</div>`).appendTo(document.body);
					}
				} finally {
					Styler._LOCK_GLITCH.unlock();
				}
			});
	}

	static _handleRivetCheck () {
		if (!ExtensionUtil.ACTIVE) return;

		const $dispVersion = $(`#${Styler._ID_DISP_RIVET_DETECTED}`);

		if (!Config.get("rivet", "isDisplayStatus") || Config.get("ui", "isStreamerMode")) {
			$dispVersion.remove();
			return;
		}

		if (!$dispVersion.length) {
			$(`<div class="rivet__disp-active ve-flex-vh-center" id="${Styler._ID_DISP_RIVET_DETECTED}"><span class="glyphicon glyphicon-send"></span></div>`).appendTo(document.body);
		}
	}

	static _handleNameTabFromScene () {
		if (Styler._TAB_TITLE_DEFAULT == null) Styler._TAB_TITLE_DEFAULT = document.title;

		if (!Config.get("ui", "isNameTabFromScene")) {
			document.title = Styler._TAB_TITLE_DEFAULT;
			return;
		}

		const canvasData = MiscUtil.get(canvas, "scene", "data");
		const nameSuffix = Config.get("ui", "tabNameSuffix");
		const nameSuffixPart = nameSuffix && nameSuffix.trim() ? nameSuffix : "Foundry Virtual Tabletop";
		if (canvasData) {
			const sceneName = canvasData.navName || canvas.scene?.name;
			document.title = `${sceneName} • ${nameSuffixPart}`;
		} else {
			document.title = nameSuffixPart;
		}
	}
}
Styler._ID_COMPACT_ACTORS = "plutonium__compact-actors";
Styler._ID_COMPACT_ITEMS = "plutonium__compact-items";
Styler._ID_COMPACT_JOURNAL = "plutonium__compact-journal";
Styler._ID_COMPACT_TABLES = "plutonium__compact-tables";
Styler._ID_COMPACT_CARDS = "plutonium__compact-cards";
Styler._ID_COMPACT_SCENES = "plutonium__compact-scenes";
Styler._ID_COMPACT_MACROS = "plutonium__compact-macros";
Styler._ID_COMPACT_CHAT = "plutonium__compact-chat";
Styler._ID_COMPACT_DIRECTORY_BUTTONS = "plutonium__compact-directory-buttons";
Styler._ID_HIDE_PLUT_DIRECTORY_BUTTONS = "plutonium__hide-plutonium-directory-buttons";
Styler._ID_HIDE_DIRECTORY_IMPORT_BUTTONS = "plutonium__hide-directory-import-buttons";
Styler._ID_SHEET_POPOUT = "plutonium__sheet-popout";
Styler._ID_SHEET_COMPACT_CONTROLS = "plutonium__sheet-compact-controls";
Styler._ID_SHEET_COMPACT_POPOUT = "plutonium__sheet-compact-popout";
Styler._LOCK_GLITCH = new VeLock();
Styler._ID_LOGO_GLITCH = "plutonium__logo-glitch";
Styler._ID_BACKEND_VERSION = "plutonium__backend-version";
Styler._ID_SHEET_LEVEL_UP_BUTTON = "plutonium__sheet-level-up-button";
Styler._ID_WRAP_FOLDER_NAMES = "plutonium__wrap-folder-names";
Styler._ID_DISP_RIVET_DETECTED = "plutonium__disp-rivet-detected";
Styler._ID_COMPATIBILITY_PERMISSION_VIEWER = "plutonium__compatibility-permission-viewer";
Styler._ID_COMPATIBILITY_TWILIGHT_UI = "plutonium__compatibility-twilight-ui";
Styler._ID_COMPATIBILITY_TIDY5E_SHEET = "plutonium__compatibility-tidy5e-sheet";

Styler._TAB_TITLE_DEFAULT = null;

export {Styler};
