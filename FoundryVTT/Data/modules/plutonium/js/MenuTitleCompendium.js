import {MenuTitle} from "./MenuTitle.js";
import {MenuToolInfo} from "./UtilMenu.js";

class MenuTitleCompendium extends MenuTitle {}
MenuTitleCompendium._HOOK_NAME = "renderCompendium";
MenuTitleCompendium._EVT_NAMESPACE = "plutonium-compendium-title-menu";

class MenuTitleCompendiumCleaner {
	static async pHandleButtonClick (evt, app, $html, data) {
		const isSure = await InputUiUtil.pGetUserBoolean({
			title: `Are You Sure?${app.locked ? ` <b>This compendium is locked.</b>` : ""}`,
		});
		if (!isSure) return;

		const content = await data.collection.getDocuments();
		data.collection.documentClass.deleteDocuments(content.map(it => it.id), {pack: data.collection.collection});
	}
}

// Each `Class` should have a static `pHandleButtonClick` method
MenuTitleCompendium._TOOL_LIST = [
	new MenuToolInfo({
		name: "Delete All",
		Class: MenuTitleCompendiumCleaner,
		iconClass: "fa-trash-alt",
	}),
];

export {MenuTitleCompendium};
