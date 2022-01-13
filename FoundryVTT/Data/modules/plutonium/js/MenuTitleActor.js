import {MenuTitle} from "./MenuTitle.js";
import {ChooseImporter} from "./ChooseImporter.js";
import {ActorItemCleaner} from "./ActorItemCleaner.js";
import {ActorSpellPreparedToggler} from "./ActorSpellPreparedToggler.js";
import {ActorPolymorpher} from "./ActorPolymorpher.js";
import {Config} from "./Config.js";
import {Charactermancer_StartingEquipment} from "./UtilCharactermancerEquipment.js";
import {ShowSheet} from "./ShowSheet.js";
import {UtilUi} from "./UtilUi.js";
import {MenuToolInfo} from "./UtilMenu.js";

class MenuTitleActor extends MenuTitle {}
MenuTitleActor._HOOK_NAME = "renderActorSheet";
MenuTitleActor._EVT_NAMESPACE = "plutonium-actor-title-menu";

// Each `Class` should have a static `pHandleButtonClick` method
MenuTitleActor._TOOL_LIST = [
	new MenuToolInfo({
		name: "Plutonium Import",
		streamerName: "Import",
		Class: ChooseImporter,
		getIcon: () => UtilUi.getModuleFaIcon(),
		getMinRole: () => Config.get("import", "minimumRole"),
		isRequireOwner: true,
	}),
	new MenuToolInfo({
		name: "Equipment Shop",
		Class: Charactermancer_StartingEquipment,
		iconClass: "fa-shopping-cart",
		getMinRole: () => Config.get("equipmentShop", "minimumRole"),
		isRequireOwner: true,
	}),
	new MenuToolInfo({
		name: "Polymorpher",
		Class: ActorPolymorpher,
		iconClass: "fa-paw",
		getMinRole: () => Config.get("tools", "minimumRolePolymorph"),
		isRequireOwner: true,
	}),
	new MenuToolInfo({
		name: "Item Cleaner",
		Class: ActorItemCleaner,
		iconClass: "fa-trash-alt",
		getMinRole: () => Config.get("tools", "minimumRoleActorTools"),
		isRequireOwner: true,
	}),
	new MenuToolInfo({
		name: "Prepared Spell Mass-Toggler",
		Class: ActorSpellPreparedToggler,
		iconClass: "fa-check-square",
		getMinRole: () => Config.get("tools", "minimumRoleActorTools"),
		isRequireOwner: true,
	}),
	new MenuToolInfo({
		name: "Set as Rivet Target",
		pFnOnClick: (evt, app) => {
			Config.setRivetTargetActor(app.actor);
		},
		iconClass: "fa-hammer",
		isRequireOwner: true,
	}),
	new MenuToolInfo({
		name: "Show Players",
		Class: ShowSheet,
		iconClass: "fa-eye",
		isRequireOwner: true,
	}),
];

export {MenuTitleActor};
