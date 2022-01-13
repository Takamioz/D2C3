import {Config} from "./Config.js";

class Patcher_Drawing {
	static handleConfigUpdate ({isInit = false} = {}) {
		try {
			return this._handleConfigUpdate_();
		} catch (e) {
			if (!isInit) throw e;
			Config.handleFailedInitConfigApplication("ui", "isFixDrawingFreehandMinDistance", e);
		}
	}

	static _handleConfigUpdate_ () {
		// This occurs if there's no scene
		if (!MiscUtil.get(canvas, "mouseInteractionManager", "options")) return;

		if (Config.get("ui", "isFixDrawingFreehandMinDistance")) {
			if (Patcher_Drawing._CACHED_MOUSE_INTERACTION_MANAGER_OPTIONS == null) Patcher_Drawing._CACHED_MOUSE_INTERACTION_MANAGER_OPTIONS = canvas.mouseInteractionManager.options;
			canvas.mouseInteractionManager.options.dragResistance = 1;
		} else {
			if (Patcher_Drawing._CACHED_MOUSE_INTERACTION_MANAGER_OPTIONS != null) canvas.mouseInteractionManager.options = Patcher_Drawing._CACHED_MOUSE_INTERACTION_MANAGER_OPTIONS;
		}
	}
}
Patcher_Drawing._CACHED_MOUSE_INTERACTION_MANAGER_OPTIONS = null;

export {Patcher_Drawing};
