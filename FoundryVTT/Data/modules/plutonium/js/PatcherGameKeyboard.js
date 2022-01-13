import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {Menu} from "./Menu.js";
import {UtilApplications} from "./UtilApplications.js";
import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";

class Patcher_GameKeyboard {
	static preInit () {
		this._init_registerKeybindEsc();
	}

	static init () {
		Hooks.on(`${SharedConsts.MODULE_NAME_FAKE}.configUpdate`, () => this._pHandleConfigUpdate());
		this._pHandleConfigUpdate();

		this._init_patchEscapeMethods();
	}

	static _init_patchEscapeMethods () {
		// region Store incoming keypresses so we can test against them later
		// Note: we cannot use e.g. `game.keyboard.downKeys`, as the raw events are filtered before reaching this set.
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"game.keyboard._handleKeyboardEvent",
			function (fn, ...args) {
				const val = fn(...args);
				Patcher_GameKeyboard._LAST_KEYBOARD_EVENT_INFO = {event: args[0], isUp: args[1]};
				return val;
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);
		// endregion

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"game.keyboard.hasFocus",
			function (fn, ...args) {
				const val = fn(...args);
				if (!Config.get("ui", "isFixEscapeKey")) return val;
				if (Patcher_GameKeyboard._LAST_KEYBOARD_EVENT_INFO?.event?.key !== "Escape") return val;
				// Fake that we're not focussing an input, so that our custom handler can run
				return false;
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);
	}

	static async _pHandleConfigUpdate () {
		try {
			await Patcher_GameKeyboard._LOCK_EDIT_KEYBINDS.pLock();
			await this._pHandleConfigUpdate_();
		} finally {
			Patcher_GameKeyboard._LOCK_EDIT_KEYBINDS.unlock();
		}
	}

	static async _pHandleConfigUpdate_ () {
		// This force-binds the key depending on our Config--we do this as we need to patch other parts of the key
		//   handling to fully enable our alternate Escape handler, unfortunately.
		game.keybindings.set(SharedConsts.MODULE_NAME, Patcher_GameKeyboard._ACTION_DISMISS);
		if (!Config.get("ui", "isFixEscapeKey")) return;
		game.keybindings.set(SharedConsts.MODULE_NAME, Patcher_GameKeyboard._ACTION_DISMISS, [{key: "Escape"}]);
	}

	static _init_registerKeybindEsc () {
		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			Patcher_GameKeyboard._ACTION_DISMISS,
			{
				name: "KEYBINDINGS.Dismiss",
				hint: `An improved version of Foundry's built-in binding. Bind the "Escape" key to (in this order): de-select active input fields; de-select selected canvas elements; close context menus; close individual windows in most-recently-active-first order; toggle the main menu.`,
				onDown: (context) => {
					const {event} = context;

					if (UiUtil._MODAL_STACK && UiUtil._MODAL_STACK.length) return true;

					/* eslint-disable */
					// Plutonium: If the game menu is open, close it
					if (ui.menu.element && ui.menu.element?.[0]?.style?.display === "") {
						ui.menu.toggle();
						return true;
					}

					// Plutonium: Make ESC de-focus input fields
					if (document.hasFocus() && Patcher_GameKeyboard._ELEMENTS_WITH_FOCUS.has(event.target.nodeName)) {
						event.target.blur();
						return true;
					}

					// Save fog of war if there are pending changes
					if (canvas.ready) canvas.sight.saveFog();

					// Case 1 - dismiss an open context menu
					if (ui.context && ui.context.menu.length) ui.context.close();

					// Plutonium: dismiss an open context menu
					else if (Menu.closeAllMenus()) return true;

					// Case 2 - release controlled objects (if not in a preview)
					else if (canvas.ready && Object.keys(canvas.activeLayer._controlled).length) {
						event.preventDefault();
						if (!canvas.activeLayer.preview?.children.length) canvas.activeLayer.releaseAll();
					}

					// Case 3 - close open UI windows
					else if (Object.values(ui.windows).filter(app => (app.isEscapeable == null || app.isEscapeable === true) && !app._plut_popoutWindow).length) {
						// Close the topmost app
						UtilApplications.getOpenAppsSortedByZindex()
							.filter(app => (app.isEscapeable == null || app.isEscapeable === true) && !app._plut_popoutWindow)
							.last()
							.close();
					}

					// Case 4 - toggle the main menu
					else ui.menu.toggle();
					/* eslint-enable */

					return true;
				},
				restricted: false,
				precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
			},
		);
	}
}
Patcher_GameKeyboard._ACTION_DISMISS = "KEYBINDINGS.Dismiss";
Patcher_GameKeyboard._ELEMENTS_WITH_FOCUS = new Set(["INPUT", "TEXTAREA"]);
Patcher_GameKeyboard._LOCK_EDIT_KEYBINDS = new VeLock();
Patcher_GameKeyboard._LAST_KEYBOARD_EVENT_INFO = null;

export {Patcher_GameKeyboard};
