import {Config} from "./Config.js";
import {SharedConsts} from "../shared/SharedConsts.js";

class Patcher_KeybindingsConfig {
	static init () {
		Hooks.on("renderKeybindingsConfig", (app, $html) => {
			if (!Config.get("ui", "isStreamerMode")) return;

			// Replace name in sidebar
			$html.find(`.filter[data-category="plutonium"]`).html(SharedConsts.MODULE_TITLE_FAKE);

			// Replace name in main window
			$html.find(`.category[data-category-id="plutonium"] h3.category-title`).html(SharedConsts.MODULE_TITLE_FAKE);
		});
	}
}

export {Patcher_KeybindingsConfig};
