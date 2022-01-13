import {MenuTitle} from "./MenuTitle.js";

class MenuTitleCombatTracker extends MenuTitle {}
MenuTitleCombatTracker._HOOK_NAME = "renderCombatTracker";
MenuTitleCombatTracker._EVT_NAMESPACE = "plutonium-combat-tracker-title-menu";
MenuTitleCombatTracker._TOOL_LIST = [];

export {MenuTitleCombatTracker};
