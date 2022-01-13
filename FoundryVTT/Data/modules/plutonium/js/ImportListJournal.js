import {ImportList} from "./ImportList.js";
import {LGT} from "./Util.js";

class ImportListJournal extends ImportList {
	constructor (applicationOpts, externalData, subclassOpts, featureImporterOpts) {
		super(applicationOpts, externalData, subclassOpts);

		this._titleLog = featureImporterOpts.titleLog;
	}

	/**
	 * @param entity
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 */
	async _pImportEntry (entity, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing ${this._titleLog} "${entity.name}" (from "${Parser.sourceJsonToAbv(entity.source)}")`);

		if (this._actor) throw new Error(`Cannot import journal content to actor!`);

		return this._pImportEntry_pImportToDirectoryGeneric(entity, importOpts);
	}
}

export {ImportListJournal};
