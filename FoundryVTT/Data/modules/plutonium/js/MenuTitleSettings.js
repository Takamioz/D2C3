import {MenuTitle} from "./MenuTitle.js";

class MenuTitleSettings extends MenuTitle {}
MenuTitleSettings._HOOK_NAME = "renderSettings";
MenuTitleSettings._EVT_NAMESPACE = "plutonium-settings-title-menu";
MenuTitleSettings._TOOL_LIST = [];

export {MenuTitleSettings};
