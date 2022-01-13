import {Menu} from "./Menu.js";
import {CollectionCleaner} from "./CollectionCleaner.js";
import {CollectionFolderizer} from "./CollectionFolderizer.js";
import {CollectionPermissionUpdater} from "./CollectionPermissionUpdater.js";
import {CollectionTokenUpdater} from "./CollectionTokenUpdater.js";
import {CollectionDeduplicator} from "./CollectionDeduplicator.js";
import {ImportSpecialPackages} from "./ImportSpecialPackages.js";
import {CompendiumListVisibilityToggler} from "./CompendiumListVisibilityToggler.js";
import {LootGeneratorApp} from "./LootGeneratorApp.js";
import {MenuToolInfo} from "./UtilMenu.js";

class MenuCollectionTools extends Menu {
	// region External
	static $getDirButton (hookName) {
		return $(`<button class="ml-0 mr-1 w-initial" title="Open tools list"><span class="fas fa-fw fa-toolbox"></span></button>`)
			.click(evt => {
				const menu = new MenuCollectionTools();
				return menu._pHandleButtonClick(evt, hookName);
			});
	}
	// endregion

	constructor () {
		super({
			eventNamespace: MenuCollectionTools._EVT_NAMESPACE,
			toolsList: MenuCollectionTools._TOOL_LIST,
			direction: "down",
		});
	}

	_pHandleButtonClick (evt, hookName) {
		evt.preventDefault();
		evt.stopPropagation();

		let type;
		switch (hookName) {
			case "renderSceneDirectory": type = "scene"; break;
			case "renderActorDirectory": type = "actor"; break;
			case "renderItemDirectory": type = "item"; break;
			case "renderJournalDirectory": type = "journal"; break;
			case "renderRollTableDirectory": type = "rolltable"; break;
			case "renderMacroDirectory": type = "macro"; break;
			case "renderCompendiumDirectory": type = "compendium"; break;
			case "renderCardsDirectory": type = "cards"; break;
			default: throw new Error(`Unhandled hook type "${hookName}"`);
		}

		return this._pOpenMenu(evt, type);
	}
}
MenuCollectionTools._EVT_NAMESPACE = "plutonium-collection-tools-menu";
MenuCollectionTools._TOOL_LIST = [
	new MenuToolInfo({
		name: "Directory Cleaner",
		Class: CollectionCleaner,
		iconClass: "fa-trash-alt",
		fnCheckRequirements: type => type !== "compendium",
	}),
	new MenuToolInfo({
		name: "Directory Deduplicator",
		Class: CollectionDeduplicator,
		iconClass: "fa-object-group",
		fnCheckRequirements: type => type !== "compendium",
	}),
	new MenuToolInfo({
		name: "Bulk Directory Mover",
		Class: CollectionFolderizer,
		iconClass: "fa-sitemap",
		fnCheckRequirements: type => !["compendium"].includes(type),
	}),
	new MenuToolInfo({
		name: "Bulk Permission Editor",
		Class: CollectionPermissionUpdater,
		iconClass: "fa-id-card",
		fnCheckRequirements: type => !["scene", "compendium"].includes(type),
	}),
	new MenuToolInfo({
		name: "Bulk Prototype Token Editor",
		Class: CollectionTokenUpdater,
		iconClass: "fa-user-circle",
		fnCheckRequirements: type => type === "actor",
	}),
	new MenuToolInfo({
		name: "Visibility Toggler",
		Class: CompendiumListVisibilityToggler,
		iconClass: "fa-eye",
		fnCheckRequirements: type => type === "compendium",
	}),
	null,
	new MenuToolInfo({
		name: "Loot Generator",
		Class: LootGeneratorApp,
		iconClass: "fa-search-dollar",
		fnCheckRequirements: type => ["item", "journal", "compendium"].includes(type),
	}),
	null,
	new MenuToolInfo({
		name: "Package Importer",
		Class: ImportSpecialPackages,
		iconClass: "fa-cube",
		fnCheckRequirements: type => type !== "compendium",
	}),
];

export {MenuCollectionTools};
