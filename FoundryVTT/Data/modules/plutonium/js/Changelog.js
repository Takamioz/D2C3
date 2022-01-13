import {SharedConsts} from "../shared/SharedConsts.js";
import {Vetools} from "./Vetools.js";

class Changelog extends Application {
	constructor () {
		super({
			width: 600,
			height: 800,
			title: "Changelog",
			template: `${SharedConsts.MODULE_LOCATION}/template/Changelog.hbs`,
			resizable: true,
		});
	}

	activateListeners ($html) {
		super.activateListeners($html);
		Vetools.pGetChangelog()
			.then(changelog => {
				const $wrp = $html.empty();
				UtilsChangelog.renderChangelog(changelog, $wrp);
			});
	}

	static open () {
		const changelog = new Changelog();
		changelog.render(true);
	}
}

export {Changelog};
