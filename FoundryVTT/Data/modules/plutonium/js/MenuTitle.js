import {Menu} from "./Menu.js";
import {Config} from "./Config.js";
import {UtilMigrate} from "./UtilMigrate.js";
import {UtilApplications} from "./UtilApplications.js";

class MenuTitle extends Menu {
	// region External
	static init () {
		if (!this._HOOK_NAME) throw new Error(`Missing hook name!`);
		if (!this._TOOL_LIST.length) return; // Ignore "placeholder" menus

		Hooks.on(this._HOOK_NAME, (app, $html, data) => {
			const availableTools = this._TOOL_LIST.filter(it => (it.isRequireOwner && UtilMigrate.isOwner(data)) || !it.isRequireOwner);

			const menu = new this(this._EVT_NAMESPACE, availableTools);
			menu._doAddButtonSheet(app, $html, data);
		});
	}
	// endregion

	constructor (eventNamespace, toolsList) {
		if (!eventNamespace) throw new Error(`Missing namespace argument!`);
		if (!toolsList) throw new Error(`Missing tools list argument!`);

		toolsList = toolsList.filter(it => it.getMinRole == null || game.user.role >= it.getMinRole());

		super({
			eventNamespace,
			toolsList,
			direction: "down",
		});
	}

	_doAddButtonSheet (app, $html, data) {
		const $sheetHeader = UtilApplications.$getAppElement(app).find(`.window-header`);
		$sheetHeader.find(`.tit-menu__btn-open--sheet`).remove();

		$(`<a class="tit-menu__btn-open--sheet text-center" title="${Config.get("ui", "isStreamerMode") ? "Other" : "Plutonium"} Options"><span class="fas fa-ellipsis-v"></span></a>`)
			// Prevent dragging when clicking on this button
			.mousedown(evt => evt.stopPropagation())
			.mouseup(evt => {
				evt.preventDefault();
				evt.stopPropagation();

				return this._pOpenMenu(evt, app, $html, data);
			})
			.insertBefore($sheetHeader.find(`.close`));
	}
}

export {MenuTitle};
