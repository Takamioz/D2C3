import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilApplications} from "./UtilApplications.js";
import {ImportListCreature} from "./ImportListCreature.js";
import {NamedTokenCreator} from "./NamedTokenCreator.js";
import {UtilHooks} from "./UtilHooks.js";
import {UtilActors} from "./UtilActors.js";
import {ChooseImporter} from "./ChooseImporter.js";
import {ImportListSpell} from "./ImportListSpell.js";

class Api {
	static init () {
		const api = {
			importer: {
				pOpen: ChooseImporter.api_pOpen.bind(ChooseImporter),
				creature: {
					pImportEntry: ImportListCreature.api_pImportEntry.bind(ImportListCreature),
				},
				spell: {
					pImportEntry: ImportListSpell.api_pImportEntry.bind(ImportListSpell),
				},
			},
			token: {
				pCreateToken: NamedTokenCreator.pCreateToken.bind(NamedTokenCreator),
			},
			util: {
				apps: {
					doAutoResize: UtilApplications.autoResizeApplication.bind(UtilApplications),
					$getAppElement: UtilApplications.$getAppElement.bind(UtilApplications),
					pAwaitAppClose: UtilApplications.pAwaitAppClose.bind(UtilApplications),
				},
				actors: {
					isImporterTempActor: UtilActors.isImporterTempActor.bind(UtilActors),
				},
			},
			hooks: {
				on: UtilHooks.on.bind(UtilHooks),
				off: UtilHooks.off.bind(UtilHooks),
			},
		};

		game.modules.get(SharedConsts.MODULE_NAME).api = api;

		const cpy = MiscUtil.copy(game.modules.get(SharedConsts.MODULE_NAME));
		cpy.id = SharedConsts.MODULE_NAME_FAKE;
		cpy.api = api;
		game.modules.set(SharedConsts.MODULE_NAME_FAKE, cpy);
	}
}

export {Api};
