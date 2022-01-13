import {SharedConsts} from "../shared/SharedConsts.js";
import {Consts} from "./Consts.js";
import {Config} from "./Config.js";
import {Patcher_Token} from "./PatcherToken.js";
import {Patcher_TextEditor} from "./PatcherTextEditor.js";
import {Patcher_ChatMessage} from "./PatcherChatMessage.js";
import {Patcher_SettingsConfig} from "./PatcherSettingsConfig.js";
import {Patcher_CanvasAnimation} from "./PatcherCanvasAnimation.js";
import {Patcher_Jquery} from "./PatcherJquery.js";
import {Patcher_GameKeyboard} from "./PatcherGameKeyboard.js";
import {Patcher_ActiveEffectConfig} from "./PatcherActiveEffectConfig.js";
import {Patcher_Actor} from "./PatcherActor.js";
import {Patcher_Drawing} from "./PatcherDrawing.js";
import {JournalSheet_Plutonium} from "./PatcherJournalSheet.js";
import {LGT, Util} from "./Util.js";
import {Patcher_Item} from "./PatcherItem.js";
import {Patcher_ModuleManagement} from "./PatcherModuleManagement.js";
import {Patcher_Application} from "./PatcherApplication.js";
import {UtilHooks} from "./UtilHooks.js";
import {Patcher_RollData} from "./PatcherRollData.js";
import {Patcher_KeybindingsConfig} from "./PatcherKeybindingsConfig.js";

class Patcher {
	static preInit () {
		Patcher_GameKeyboard.preInit();
	}

	static init () {
		Hooks.on("applyActiveEffect", Patcher_Actor.handleHookApplyActiveEffect.bind(Patcher_Actor));

		this._doPatchNavContextMenuOptions();
		this._doPatchActorContextMenuOptions();
		this._doPatchJournalContextMenuOptions();
		Patcher_Application.init();
		Patcher_Token.init();
		Patcher_TextEditor.init();
		Patcher_ChatMessage.init();
		Patcher_SettingsConfig.init();
		Patcher_CanvasAnimation.init();
		Patcher_Jquery.init();
		Patcher_GameKeyboard.init();
		Patcher_ActiveEffectConfig.init();
		Patcher_Actor.init();
		Patcher_Item.init();
		Patcher_RollData.init();
		Patcher_ModuleManagement.init();
		Patcher_KeybindingsConfig.init();

		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, (diff) => this._handleConfigUpdate(diff));
		this._handleConfigUpdate({isInit: true});

		// region Apply custom active effects
		this._doInitActorData();

		// region Specific hooks
		Hooks.on("canvasReady", () => {
			Patcher_Drawing.handleConfigUpdate();
		});
		// endregion
	}

	static _handleConfigUpdate ({isInit = false, ...diff} = {}) {
		this._handleConfigUpdate_folderMaxDepth({isInit});
		Patcher_Token.handleConfigUpdate({isInit, ...diff});
		Patcher_Drawing.handleConfigUpdate({isInit});
		Patcher_ChatMessage.handleConfigUpdate({isInit});
		JournalSheet_Plutonium.handleConfigUpdate({isInit});

		// Re-render the navbar to ensure our `getSceneNavigationContext` hook fires
		if (ui.nav?.element) ui.nav.render();
	}

	static _doInitActorData () {
		if (!Config.get("actor", "isUseExtendedActiveEffectsParser")) return;

		(CONFIG.Actor.collection.instance.contents || []).forEach(ent => {
			try {
				ent.prepareData();
			} catch (e) {
				const msg = `Failed to apply custom active effect parsing to actor "${ent.id}"!`;
				ui.notifications.error(`${msg} ${VeCt.STR_SEE_CONSOLE}`);
				console.error(...LGT, msg);
				console.error(e);
			}
		});
	}

	static _doPatchNavContextMenuOptions () {
		Hooks.on("getSceneNavigationContext", ($html, options) => {
			if (!Config.get("ui", "isAddDeleteToSceneNavOptions")) return;

			const ixConfigure = options.findIndex(it => it.name === "SCENES.Configure");
			const toAdd = {
				name: "SIDEBAR.Delete",
				icon: `<i class="fas fa-fw fa-trash"></i>`,
				condition: $li => {
					const scene = game.scenes.get($li.data("sceneId"));
					return game.user.isGM && !scene.data.active;
				},
				callback: $li => {
					const document = CONFIG.Scene.collection.instance.get($li.data("sceneId"));
					if (!document) return;
					const {top, left} = $li[0].getBoundingClientRect();
					return document.deleteDialog({
						top: Math.min(top + 70, window.innerHeight - 350),
						left: Math.min(left, window.innerWidth - 720),
					});
				},
			};

			if (~ixConfigure) options.splice(ixConfigure + 1, 0, toAdd);
			else options.push(toAdd);

			return options;
		});
	}

	static _doPatchActorContextMenuOptions () {
		Hooks.on("getActorDirectoryEntryContext", ($html, options) => {
			options.push({
				name: "Set as Rivet Target",
				icon: `<i class="fas fa-fw fa-hammer"></i>`,
				condition: li => {
					const entity = ActorDirectory.collection.get(li.data(Util.Versions.getCoreVersion().isVersionNinePlus ? "documentId" : "entityId"));
					return entity.isOwner;
				},
				callback: li => {
					const entity = ActorDirectory.collection.get(li.data(Util.Versions.getCoreVersion().isVersionNinePlus ? "documentId" : "entityId"));
					const actor = game.actors.get(entity.id);
					Config.setRivetTargetActor(actor);
				},
			});

			return options;
		});
	}

	static _doPatchJournalContextMenuOptions () {
		Hooks.on("getJournalDirectoryEntryContext", ($html, options) => {
			const ixConfigPerms = options.findIndex(it => it.name === "PERMISSION.Configure");
			if (!~ixConfigPerms) return options;

			options.splice(
				ixConfigPerms + 1,
				0,
				{
					name: "Set URL",
					icon: `<i class="fas fa-fw fa-link"></i>`,
					condition: li => {
						if (!Config.get("journalEntries", "isEnableUrlEmbeds")) return false;

						const entity = JournalDirectory.collection.get(li.data(Util.Versions.getCoreVersion().isVersionNinePlus ? "documentId" : "entityId"));
						return entity.isOwner;
					},
					callback: async li => {
						const entity = JournalDirectory.collection.get(li.data(Util.Versions.getCoreVersion().isVersionNinePlus ? "documentId" : "entityId"));
						const existing = await entity.getFlag(SharedConsts.MODULE_NAME, Consts.FLAG_IFRAME_URL);

						let url = await InputUiUtil.pGetUserString({
							title: "Enter iframe or URL",
							default: existing || "",
						});

						if (url == null) return;

						// Close any open windows
						Object.values(entity.apps)
							.forEach(app => {
								app.forceClose ? app.forceClose() : app.close();
							});

						if (!url) {
							await entity.setFlag(SharedConsts.MODULE_NAME, Consts.FLAG_IFRAME_URL, "");
						} else {
							url = url.trim();

							if (url.startsWith("<iframe")) url = $(url).attr("src");

							if (!url) {
								ui.notifications.warn(`URL/iframe "${url}" was not valid!`);
								await entity.setFlag(SharedConsts.MODULE_NAME, Consts.FLAG_IFRAME_URL, "");
							}

							await entity.setFlag(SharedConsts.MODULE_NAME, Consts.FLAG_IFRAME_URL, url);
						}
					},
				},
			);

			return options;
		});
	}

	static _handleConfigUpdate_folderMaxDepth ({isInit = false} = {}) {
		try {
			return this._handleConfigUpdate_folderMaxDepth_();
		} catch (e) {
			if (!isInit) throw e;
			Config.handleFailedInitConfigApplication("ui", "isEnableIncreasedFolderDepth", e);
		}
	}

	static _handleConfigUpdate_folderMaxDepth_ () {
		if (Patcher._CONST_ORIGINAL == null) Patcher._CONST_ORIGINAL = window.CONST;

		if (Config.get("ui", "isEnableIncreasedFolderDepth")) {
			if (CONST.FOLDER_MAX_DEPTH >= Patcher._FOLDER_MAX_DEPTH) return;

			// FIXME(Future) this is super-rough. Alternatives may include:
			//   - libWrapper patch the methods which use `CONST.FOLDER_MAX_DEPTH`
			//     - can break when Foundry updates
			//  - `.toString() -> find-replace ref -> overwrite` the methods which use `CONST.FOLDER_MAX_DEPTH`
			//     - doesn't play well with libWrapper
			//     - chance of missing newly-added future methods
			//  - Disable the feature
			//  - Beg Atropos to increase the max depth, since 3 is a _bit_ restrictive
			window.CONST = MiscUtil.copy(Patcher._CONST_ORIGINAL);

			CONST.FOLDER_MAX_DEPTH__ORIGINAL = CONST.FOLDER_MAX_DEPTH;
			CONST.FOLDER_MAX_DEPTH = Patcher._FOLDER_MAX_DEPTH;
		} else {
			window.CONST = Patcher._CONST_ORIGINAL;
		}
	}
}
Patcher._CONST_ORIGINAL = null;
Patcher._FOLDER_MAX_DEPTH = 9;

export {Patcher};
