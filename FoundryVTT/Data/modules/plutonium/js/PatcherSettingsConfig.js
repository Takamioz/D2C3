import {Config} from "./Config.js";
import {UtilPatcher} from "./UtilPatch.js";
import {SharedConsts} from "../shared/SharedConsts.js";

class Patcher_SettingsConfig {
	static init () {
		Hooks.on("renderSettingsConfig", (app, $html) => {
			if (!Config.get("ui", "isStreamerMode")) return;

			const elesHeaders = $html.find(`.module-header`).get();
			for (const eleHeader of elesHeaders) {
				const node = UtilPatcher.findPlutoniumTextNodes(eleHeader, {isSingle: true});
				if (!node) continue;

				node.data = SharedConsts.MODULE_TITLE_FAKE;
				break;
			}
		});
	}
}

export {Patcher_SettingsConfig};
