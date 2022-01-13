import {SharedConsts} from "../shared/SharedConsts.js";
import {Util, LGT} from "./Util.js";
import {Config} from "./Config.js";
import {UtilCanvas} from "./UtilCanvas.js";
import {ArtBrowser} from "../art-js/ArtBrowser.js";
import {UtilApplications} from "./UtilApplications.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilEvents} from "./UtilEvents.js";
import {UtilHooks} from "./UtilHooks.js";
import {UtilImage} from "./UtilImage.js";

class ArtBrowserFvtt extends ArtBrowser {
	constructor ($parent, {app}) {
		super($parent);

		this._parent = app;
	}

	async _pGetDownloadModes () {
		const out = [
			this._textDownloadMode,
			this._jsonDownloadMode,
		];

		if (await Config.P_GET_BACKEND_VERSION) {
			out.unshift({
				name: "Foundry Assets",
				isMultipleFilesOnly: true,
				pDownloadAsMultipleFiles: (json, ix, len) => this._parent._activateListeners_pHandleDownloadAssets(json, ix, len),
			});
		}

		return out;
	}

	async _p$getBtnsItemThumbnail (meta) {
		const $out = await super._p$getBtnsItemThumbnail(meta);

		if (!await Config.P_GET_BACKEND_VERSION) return $out;

		const $btnDownloadSingle = $(`<div class="artr__item__menu_item" title="Download Image"><span class="fas fa-fw fa-download"></span></div>`)
			.click(async (evt) => {
				evt.stopPropagation();
				evt.preventDefault();

				await this._parent.doDownloadSingleImage_(meta);
			});

		return [...$out, $btnDownloadSingle];
	}
}

class ArtBrowserApp extends Application {
	// region external
	static preInit () {
		Hooks.on("getSceneControlButtons", (buttonMetas) => {
			if (!game.user.isGM) return;
			this._preInit_addMainButton(buttonMetas);
			this._preInit_addTileButton(buttonMetas);
			this._preInit_addTokenButton(buttonMetas);
			this._preInit_addNotesButton(buttonMetas);
		});
		this._preInit_registerKeybinds();
	}

	static _preInit_registerKeybinds () {
		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"ArtBrowserApp__open",
			{
				name: "Open Art Browser",
				editable: [],
				onDown: () => {
					this._pOpen();
					return true;
				},
				restricted: true,
			},
		);
	}

	static _pOpen () {
		if (ArtBrowserApp._INSTANCE) {
			ArtBrowserApp._INSTANCE.render(true);
			ArtBrowserApp._INSTANCE.maximize();
			UtilApplications.bringToFront(ArtBrowserApp._INSTANCE);
			return;
		}

		ArtBrowserApp._INSTANCE = new ArtBrowserApp();
		ArtBrowserApp._INSTANCE.render(true);
	}

	static _preInit_addMainButton (buttonMetas) {
		const existingOuter = buttonMetas.find(it => it.name === ArtBrowserApp._ART_SCENE_CONTROLS_NAME);
		if (existingOuter) return;

		// Create a fake layer button, with no tools
		buttonMetas.push({
			name: ArtBrowserApp._ART_SCENE_CONTROLS_NAME,
			title: "Art Browser",
			icon: "fas fa-fw fa-palette",
			// We have to have a dummy tool to ensure our menu item gets rendered
			tools: [
				{
					name: ArtBrowserApp._ART_SCENE_CONTROLS_NAME,
					title: "Art Browser",
					icon: "fas fa-fw fa-palette",
					onClick: () => ui.notifications.info(`Hi! You shouldn't be able to click this, something has gone wrong.`),
					button: true,
				},
			],
			visible: Config.isInit && Config.get("artBrowser", "buttonDisplay")[ConfigConsts.C_ART_IMAGE_MODE_SCENE],
			activeTool: "open",
		});
	}

	static _preInit_getInnerToolMeta (modeId) {
		return {
			name: ArtBrowserApp._ART_SCENE_CONTROLS_NAME,
			title: "Art Browser",
			icon: "fas fa-fw fa-palette",
			onClick: () => {
				Config.set("artBrowser", "importImagesAs", modeId);
				ArtBrowserApp._pOpen();
			},
			visible: Config.isInit && Config.get("artBrowser", "buttonDisplay")[modeId],
			button: true,
		};
	}

	static _preInit_addTileButton (buttonMetas) {
		this._preInit_addSubmenuButton(buttonMetas, "tiles", ConfigConsts.C_ART_IMAGE_MODE_TILE);
	}

	static _preInit_addTokenButton (buttonMetas) {
		this._preInit_addSubmenuButton(buttonMetas, "token", ConfigConsts.C_ART_IMAGE_MODE_TOKEN);
	}

	static _preInit_addNotesButton (buttonMetas) {
		this._preInit_addSubmenuButton(buttonMetas, "notes", ConfigConsts.C_ART_IMAGE_MODE_NOTE);
	}

	static _preInit_addSubmenuButton (buttonMetas, mode, modeId) {
		const buttonMeta = buttonMetas.find(it => it.name === mode);
		const isExists = buttonMeta.tools.some(it => it.name === ArtBrowserApp._ART_SCENE_CONTROLS_NAME);
		if (isExists) return;
		buttonMeta.tools.push(this._preInit_getInnerToolMeta(modeId));
	}

	static async _pDownloadPack (json) {
		await fetch(
			Config.backendEndpoint,
			{
				method: "post",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "artBrowserDownloadPack",
					json,
					directoryPath: Config.get("artBrowser", "artDirectoryPath"),
				}),
			},
		);
	}

	static init () {
		// Subvert clicks on our fake layer button
		const cachedOnClickLayer = ui.controls._onClickLayer.bind(ui.controls);
		ui.controls._onClickLayer = function (event) {
			if (event.currentTarget.dataset.control === ArtBrowserApp._ART_SCENE_CONTROLS_NAME) {
				ArtBrowserApp._pOpen();
				return;
			}
			cachedOnClickLayer(event);
		};

		// Prevent Foundry's anti-drag-drop mechanism from working
		$(document.body).on("dragstart", ".artr__item__lnk-fullsize", evt => {
			evt.stopPropagation();
		});

		document.getElementById("board").addEventListener("drop", this._handleCustomDrop.bind(this));

		game.socket.on("progress", data => {
			if (data.type !== "plutoniumDownloadPackImage") return;
			if (!ArtBrowserApp._INSTANCE) return;
			if (!ArtBrowserApp._INSTANCE._isDownloadingPack) return;

			SceneNavigation._onLoadProgress(data.text, data.pct);
		});

		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, (diff) => this._handleConfigUpdate(diff));
		this._handleConfigUpdate({isInit: true});
	}
	// endregion

	constructor () {
		super({
			title: ArtBrowserApp._BASE_TITLE,
			template: `${SharedConsts.MODULE_LOCATION}/template/ArtBrowserApp.hbs`,
			height: Util.getMaxWindowHeight(),
			width: Math.max(780, Util.getMaxWindowWidth() / 2),
			resizable: true,
		});
		this._isDownloadingPack = false;
		this._$btnCycleImportMode = null;
		this.__bound__handleInstanceConfigUpdate = null;
	}

	static _handleConfigUpdate ({isInit = false, current, previous} = {}) {
		if (!this._handleConfigUpdate_isRefreshControls({isInit, current, previous})) return;
		if (ui.controls) ui.controls.initialize(); // Refresh controls
	}

	static _handleConfigUpdate_isRefreshControls ({isInit = false, current, previous} = {}) {
		if (isInit) return true;
		if (!current || !previous) return false;
		const path = ["artBrowser", "buttonDisplay"];
		return !CollectionUtil.deepEquals(MiscUtil.get(current, ...path), MiscUtil.get(previous, ...path));
	}

	_handleInstanceConfigUpdate () {
		this._handleInstanceConfigUpdate_cycleImportModeButton();
	}

	_handleInstanceConfigUpdate_cycleImportModeButton () {
		const dropMode = Config.get("artBrowser", "importImagesAs") ?? 0;
		switch (dropMode) {
			case ConfigConsts.C_ART_IMAGE_MODE_TOKEN:
				this._$btnCycleImportMode.html(`<span class="fas fa-fw fa-user"></span>`).title("Drag-Drop Images as Tokens");
				UtilApplications.setApplicationTitle(this, `${ArtBrowserApp._BASE_TITLE} - Tokens`);
				break;
			case ConfigConsts.C_ART_IMAGE_MODE_TILE:
				this._$btnCycleImportMode.html(`<span class="fas fa-fw fa-cubes"></span>`).title("Drag-Drop Images as Tiles");
				UtilApplications.setApplicationTitle(this, `${ArtBrowserApp._BASE_TITLE} - Tiles`);
				break;
			case ConfigConsts.C_ART_IMAGE_MODE_NOTE:
				this._$btnCycleImportMode.html(`<span class="fas fa-fw fa-bookmark"></span>`).title("Drag-Drop Images as Notes");
				UtilApplications.setApplicationTitle(this, `${ArtBrowserApp._BASE_TITLE} - Notes`);
				break;
			case ConfigConsts.C_ART_IMAGE_MODE_SCENE:
				this._$btnCycleImportMode.html(`<span class="fas fa-fw fa-map"></span>`).title("Drag-Drop Images as Scenes");
				UtilApplications.setApplicationTitle(this, `${ArtBrowserApp._BASE_TITLE} - Scenes`);
				break;
			default: throw new Error(`Unhandled drop mode "${dropMode}"`);
		}
	}

	getData () {
		return {
			owner: true, // Required for title menu to work
			entity: {
				name: "Art Browser", // Displayed in popout menu title
			},
		};
	}

	activateListeners ($html) {
		this.__bound__handleInstanceConfigUpdate = this._handleInstanceConfigUpdate.bind(this);
		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, this.__bound__handleInstanceConfigUpdate);

		$html.closest(`.window-content`)
			.addClass("p-0")
			.addClass("artb__window-outer");

		const artBrowser = new ArtBrowserFvtt($html, {app: this});

		artBrowser.pInit()
			.then(() => {
				// Add an additional button to quickly access the Plutonium config
				const $wrpSearch = $html.find(`.artr__search`);

				const $btnCancelPackDownload = $(`<button class="artr__btn-lg artr__btn-lg--search-controls mr-1" title="Cancel running downloads"><span class="fas fa-fw fa-stop"></span></button>`)
					.click(() => ArtBrowserApp._doCancelPackDownload());

				this._$btnCycleImportMode = $(`<button class="artr__btn-lg artr__btn-lg--search-controls mr-1"><span class="fas fa-fw fa-spinner"></span></button>`)
					.click(() => {
						const prevMode = Config.get("artBrowser", "importImagesAs") || 0;
						const nxtMode = prevMode === ConfigConsts.C_ART_IMAGE_MODE_SCENE
							? ConfigConsts.C_ART_IMAGE_MODE_TOKEN
							: prevMode + 1;
						Config.set("artBrowser", "importImagesAs", nxtMode);
					});

				const $btnOpenConfig = $(`<button class="artr__btn-lg artr__btn-lg--search-controls" title="Open ${Config.get("ui", "isStreamerMode") ? "" : "Plutonium "}Config window"><span class="fas fa-fw fa-cogs"></span></button>`)
					.click(evt => Config.pHandleButtonClick(evt, "artBrowser"));

				$$`<div class="ve-flex-v-center h-100">
					<div class="artr__search__divider mx-2"></div>
					<div class="ve-flex-v-center">${$btnCancelPackDownload}</div>
					<div class="ve-flex-v-center">${this._$btnCycleImportMode}</div>
					<div class="ve-flex-v-center">${$btnOpenConfig}</div>
				</div>`.appendTo($wrpSearch);

				this.__bound__handleInstanceConfigUpdate();
			});
	}

	static async _doCancelPackDownload () {
		await fetch(
			Config.backendEndpoint,
			{
				method: "post",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "artBrowserCancelDownloadPack",
				}),
			},
		);
	}

	async _activateListeners_pHandleDownloadAssets (json, ix, len) {
		try {
			ArtBrowserApp._INSTANCE._isDownloadingPack = true;
			await ArtBrowserApp._pDownloadPack(json);
		} catch (e) {
			ArtBrowserApp._INSTANCE._isDownloadingPack = false;
		}

		if (ix + 1 === len) {
			ArtBrowserApp._INSTANCE._isDownloadingPack = false;
			ui.notifications.info(`Download complete! Images will be available in your "User Data" directory.`);
		}
	}

	async doDownloadSingleImage_ (meta) {
		try {
			await this.constructor._pLoadImageViaBackend(meta.uri);
			ui.notifications.info(`Image downloaded to your Art Directory ("${Config.get("artBrowser", "artDirectoryPath")}")`);
		} catch (e) {
			ui.notifications.error(`Failed to download image! ${VeCt.STR_SEE_CONSOLE}`);
		}
	}

	static _handleCustomDrop (evt) {
		const data = UtilEvents.getDropJson(evt);

		if (data?.type !== "ve-Art") return;

		this._pDoLoadAndPlaceImage(evt, data)
			.catch(err => {
				ui.notifications.error(`Failed to load image! ${VeCt.STR_SEE_CONSOLE}`);
				setTimeout(() => { throw err; });
			});

		// prevent propagation/event bubbling
		return false;
	}

	static async _pDoLoadAndPlaceImage (evt, data) {
		// 0 = Tile; 1 = Token; 2 = Scene
		const dropMode = Config.get("artBrowser", "importImagesAs") ?? 0;

		const imageMeta = await this._pDoLoadAndPlaceImage_pGetImageMeta({url: data.uri});
		if (!imageMeta) return;
		const {url, image} = imageMeta;

		const getPrettyName = () => {
			let prettyName = url.split("/").last();
			try {
				prettyName = decodeURIComponent(prettyName);
				prettyName = prettyName.split(".")[0];
				prettyName = prettyName
					.replace(/_/g, " ")
					.replace(/\s+/g, " ")
					.replace(/\d+\s*[xX*]\s*\d+/g, "")
				;
			} catch (ignored) {
				// Do nothing
			}
			return prettyName;
		};

		const width = image.naturalWidth;
		const height = image.naturalHeight;
		const scale = Config.get("artBrowser", "scale");

		switch (dropMode) {
			case ConfigConsts.C_ART_IMAGE_MODE_TOKEN: {
				const canvasPos = UtilCanvas.getPosCanvasSpace(evt, "TokenLayer");
				const tokenSize = Config.get("artBrowser", "tokenSize") || 1;

				TokenDocument.create(
					{
						name: "-",
						x: canvasPos.x,
						y: canvasPos.y,
						img: encodeURL(url),
						width: tokenSize,
						height: tokenSize,
						scale: 1,
					},
					{
						parent: canvas.scene,
					},
				);

				break;
			}

			case ConfigConsts.C_ART_IMAGE_MODE_TILE: {
				const canvasPos = UtilCanvas.getPosCanvasSpace(evt, "BackgroundLayer");

				await canvas.scene.createEmbeddedDocuments(
					"Tile",
					[
						{
							img: encodeURL(url),
							width: Math.round(width * scale),
							height: Math.round(height * scale),
							hidden: false,
							scale,
							x: canvasPos.x,
							y: canvasPos.y,
							overhead: canvas.foreground?._active ?? false,
						},
					],
				);

				break;
			}

			case ConfigConsts.C_ART_IMAGE_MODE_NOTE: {
				const canvasPos = UtilCanvas.getPosCanvasSpace(evt, "NotesLayer");

				const journalEntry = await JournalEntry.create({
					name: getPrettyName(),
					img: encodeURL(url),
				});

				await canvas.scene.createEmbeddedDocuments(
					"Note",
					[
						{
							entryId: journalEntry.id,
							icon: "icons/svg/book.svg",
							iconSize: 40,
							text: "",
							x: canvasPos.x,
							y: canvasPos.y,
						},
					],
				);

				break;
			}

			case ConfigConsts.C_ART_IMAGE_MODE_SCENE: {
				const isActivate = Config.get("artBrowser", "isSwitchToCreatedScene");

				// Based on `SceneDirectory._onCreate`
				const createData = {
					name: getPrettyName(),
					active: isActivate,
					navigation: Config.get("artBrowser", "isSceneAddToNavigation"),
					img: encodeURL(url),
					width: Math.round(width * scale),
					height: Math.round(height * scale),

					padding: Config.get("artBrowser", "scenePadding"),
					backgroundColor: Config.get("artBrowser", "sceneBackgroundColor"),
					tokenVision: Config.get("artBrowser", "isSceneTokenVision"),
					fogExploration: Config.get("artBrowser", "isSceneFogExploration"),

					gridDistance: Config.getMetricNumber({configGroup: "artBrowser", originalValue: 5, originalUnit: "ft", configKey: "isSceneGridMetric"}),
					gridUnits: Config.getMetricUnit({configGroup: "artBrowser", originalUnit: "ft", configKey: "isSceneGridMetric"}),
				};
				const scene = await Scene.create(createData, {renderSheet: Config.get("artBrowser", "isDisplaySheetCreatedScene")});

				if (isActivate) canvas.draw();

				break;
			}
		}
	}

	static async _pDoLoadAndPlaceImage_pGetImageMeta ({url}) {
		switch (Config.get("artBrowser", "imageSaveMode")) {
			case ConfigConsts.C_ART_IMAGE_SAVE_MODE__DEFAULT: {
				if (await this._pPingImage(url)) {
					const image = await UtilImage.pLoadImage(url);
					return {image, url};
				}

				return this._pDoLoadAndPlaceImage_pDoLoadViaBackend({url});
			}

			case ConfigConsts.C_ART_IMAGE_SAVE_MODE__ALWAYS: {
				return this._pDoLoadAndPlaceImage_pDoLoadViaBackend({url});
			}

			case ConfigConsts.C_ART_IMAGE_SAVE_MODE__NEVER: {
				if (await this._pPingImage(url)) {
					const image = await UtilImage.pLoadImage(url);
					return {image, url};
				}

				return null;
			}
		}
	}

	static async _pDoLoadAndPlaceImage_pDoLoadViaBackend ({url}) {
		if (await Config.P_GET_BACKEND_VERSION) {
			if (Config.get("artBrowser", "imageSaveMode") !== ConfigConsts.C_ART_IMAGE_SAVE_MODE__ALWAYS) console.warn(...LGT, `Could not directly load image from ${url}\u2014falling back on alternate loader (backend mod).`);

			try {
				const out = await this._pLoadImageViaBackend(url);
				void out;
				return out;
			} catch (e) {
				console.error(...LGT, "Failed to load image!", e);
				ui.notifications.error(`Failed to load image! ${VeCt.STR_SEE_CONSOLE}`);
				return;
			}
		}

		new Dialog({
			title: "Art Browser\u2014Backend Mod Required",
			content: `<div>
					<p>The image you dropped could not be loaded, likely due to CORS blocking. CORS blocking is a browser security feature which prevents potentially harmful content from being loaded from other websites.</p>
					<p>Unfortunately, this security feature also blocks images. In order to work around this, you can install the ${Config.get("ui", "isStreamerMode") ? SharedConsts.MODULE_TITLE_FAKE : SharedConsts.MODULE_TITLE} backend mod. See the &quot;How to Modify the Backend&quot; section on the <a href="https://wiki.5e.tools/index.php/FoundryTool_Install" target="_blank" rel="noopener noreferrer">wiki</a> for more information.</p>
					<p><b>Note that this is not possible on managed Foundry hosting services, such as The Forge.</b></p>
				</div>`,
			buttons: {
				one: {
					icon: `<i class="fas fa-fw fa-times"></i>`,
					label: "Close",
				},
			},
		}).render(true);
	}

	static async _pPingImage (uri) {
		let url;
		try {
			url = new URL(uri);
		} catch (ignored) {
			// Do nothing
		}

		// Immediately return a failure for any previously-failed hosts
		if (url && ArtBrowserApp._BLOCKED_HOSTS[url.host]) return false;

		try {
			const result = await fetch(uri);
			await result.blob();
			return true;
		} catch (e) {
			if (url) ArtBrowserApp._BLOCKED_HOSTS[url.host] = true;
			return false;
		}
	}

	static async _pCopyImageToLocalViaBackend (url) {
		const fetched = await fetch(
			Config.backendEndpoint,
			{
				method: "post",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "artBrowserCopyToLocal",
					url: url,
					directoryPath: Config.get("artBrowser", "artDirectoryPath"),
				}),
			},
		);
		const json = await fetched.json();
		return json.path;
	}

	static async _pLoadImageViaBackend (uri) {
		const url = await this._pCopyImageToLocalViaBackend(uri);
		const image = await UtilImage.pLoadImage(url);
		return {url, image};
	}

	async close (...args) {
		await super.close(...args);
		UtilHooks.off(UtilHooks.HK_CONFIG_UPDATE, this.__bound__handleInstanceConfigUpdate);
		ArtBrowserApp._INSTANCE = null;
	}
}
ArtBrowserApp._BLOCKED_HOSTS = {};
ArtBrowserApp._INSTANCE = null;
ArtBrowserApp._ID_HIDE_TOKEN_BUTTON = "plutonium__art__hide-token-button";
ArtBrowserApp._ID_HIDE_TILE_BUTTON = "plutonium__art__hide-tile-button";
ArtBrowserApp._ID_HIDE_NOTES_BUTTON = "plutonium__art__hide-notes-button";
ArtBrowserApp._ID_HIDE_MAIN_BUTTON = "plutonium__art__hide-main-button";
ArtBrowserApp._ART_SCENE_CONTROLS_NAME = "ve-art__btn-scene";
ArtBrowserApp._BASE_TITLE = "Art Browser";

export {ArtBrowserApp};
