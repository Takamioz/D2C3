import {MenuTitle} from "./MenuTitle.js";

class MenuTitleMacroDirectory extends MenuTitle {}
MenuTitleMacroDirectory._HOOK_NAME = "renderMacroDirectory";
MenuTitleMacroDirectory._EVT_NAMESPACE = "plutonium-macro-directory-title-menu";
MenuTitleMacroDirectory._TOOL_LIST = [];

export {MenuTitleMacroDirectory};
