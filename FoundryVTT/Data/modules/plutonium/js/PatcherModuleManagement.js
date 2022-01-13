import {Config} from "./Config.js";
import {UtilPatcher} from "./UtilPatch.js";
import {SharedConsts} from "../shared/SharedConsts.js";

class Patcher_ModuleManagement {
	static init () {
		Hooks.on("renderModuleManagement", (app, $html) => {
			if (!Config.get("ui", "isStreamerMode")) return;

			// The initial render has the full window; thereafter, we get only the form
			const eleContent = $html.find(`.window-content`)[0] || $html[0];
			if (!eleContent) return;

			const toReplace = UtilPatcher.findPlutoniumTextNodes(eleContent);
			toReplace.forEach(node => node.data = SharedConsts.MODULE_TITLE_FAKE);
		});
	}
}

export {Patcher_ModuleManagement};
