import {MenuTitle} from "./MenuTitle.js";
import {ShowSheet} from "./ShowSheet.js";
import {MenuToolInfo} from "./UtilMenu.js";

class MenuTitleItem extends MenuTitle {}
MenuTitleItem._HOOK_NAME = "renderItemSheet";
MenuTitleItem._EVT_NAMESPACE = "plutonium-item-title-menu";
MenuTitleItem._TOOL_LIST = [
	new MenuToolInfo({
		name: "Show Players",
		Class: ShowSheet,
		iconClass: "fa-eye",
		isRequireOwner: true,
	}),
];

export {MenuTitleItem};
