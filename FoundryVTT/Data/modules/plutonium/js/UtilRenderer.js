import {Config} from "./Config.js";
import {UtilHooks} from "./UtilHooks.js";

class UtilRenderer {
	static init () {
		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, () => this._handleConfigUpdate());
		this._handleConfigUpdate();
	}

	static _handleConfigUpdate () {
		Renderer.get().setInternalLinksDisabled(Config.get("import", "isRendererLinksDisabled"));
	}
}

export {UtilRenderer};
