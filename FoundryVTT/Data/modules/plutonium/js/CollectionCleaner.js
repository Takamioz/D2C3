import {SharedConsts} from "../shared/SharedConsts.js";
import {Util} from "./Util.js";
import {BaseCollectionTool} from "./BaseCollectionTool.js";
import {AppFilterBasic} from "./FilterApplications.js";

class CollectionCleaner extends BaseCollectionTool {
	constructor (collectionName) {
		super(
			{
				title: "Directory Cleaner",
				template: `${SharedConsts.MODULE_LOCATION}/template/CollectionCleaner.hbs`,
				height: Util.getMaxWindowHeight(),
				width: 640,
				resizable: true,
			},
			collectionName,
		);

		// Local fields
		this._pageFilter = new AppFilterBasic();

		this._list = null;
		this._$btnReset = null;
	}

	activateListeners ($html) {
		super.activateListeners($html);

		this._activateListeners_initBtnRun($html);
		this._activateListeners_initBtnPrune($html);
		this._activateListeners_initBtnReset($html);
		this._activateListeners_pInitListAndFilters($html);
	}

	_activateListeners_initBtnRun ($html) {
		const $cbPruneAuto = $html.find(`[name="cb-prune-auto"]`);
		$html.find(`[name="btn-run"]`).click(() => this._pDoDelete($cbPruneAuto));
	}

	/**
	 * Used by template engine.
	 */
	getData () {
		this._rows = this._rows = this._mapEntitiesToRows();

		return {
			...super.getData(),
			titleSearch: `${this._collectionName}s`,
			rows: this._rows,
			isPrunable: this._folderType != null,
		};
	}

	close (...args) {
		this._pageFilter.teardown();
		return super.close(...args);
	}
}

export {CollectionCleaner};
