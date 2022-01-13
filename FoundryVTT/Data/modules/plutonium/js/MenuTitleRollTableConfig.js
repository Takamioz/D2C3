import {MenuTitle} from "./MenuTitle.js";
import {ChooseImporter} from "./ChooseImporter.js";
import {Config} from "./Config.js";
import {TableResultCleaner} from "./TableResultCleaner.js";
import {UtilUi} from "./UtilUi.js";
import {MenuToolInfo} from "./UtilMenu.js";

class MenuTitleRollTableConfig extends MenuTitle {}
MenuTitleRollTableConfig._HOOK_NAME = "renderRollTableConfig";
MenuTitleRollTableConfig._EVT_NAMESPACE = "plutonium-roll-table-config-title-menu";
MenuTitleRollTableConfig._TOOL_LIST = [
	new MenuToolInfo({
		name: "Plutonium Import",
		streamerName: "Import",
		Class: ChooseImporter,
		getIcon: () => UtilUi.getModuleFaIcon(),
		getMinRole: () => Config.get("import", "minimumRole"),
		isRequireOwner: true,
	}),
	new MenuToolInfo({
		name: "Row Cleaner",
		Class: TableResultCleaner,
		iconClass: "fa-trash-alt",
		getMinRole: () => Config.get("tools", "minimumRoleTableTools"),
		isRequireOwner: true,
	}),
];

export {MenuTitleRollTableConfig};
