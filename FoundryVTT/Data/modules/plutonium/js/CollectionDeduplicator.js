import {SharedConsts} from "../shared/SharedConsts.js";
import {Util} from "./Util.js";
import {BaseCollectionTool} from "./BaseCollectionTool.js";
import {AppFilterBasic} from "./FilterApplications.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";

class CollectionDeduplicator extends BaseCollectionTool {
	constructor (collectionName) {
		super(
			{
				title: "Directory Deduplicator",
				template: `${SharedConsts.MODULE_LOCATION}/template/CollectionDeduplicator.hbs`,
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

	_activateListeners_listAbsorbGetData (li, di) {
		return {
			...UtilList2.absorbFnGetData(li),
			isPrime: !!di.isPrime,
		};
	}

	_activateListeners_doBindSelectAll ($cbAll) {
		$cbAll.change(() => {
			const isAllChecked = $cbAll.prop("checked");
			this._list.visibleItems.forEach(it => {
				const isChecked = isAllChecked ? !it.data.isPrime : false;
				it.data.cbSel.checked = isChecked;

				if (isChecked) it.ele.classList.add("list-multi-selected");
				else it.ele.classList.remove("list-multi-selected");
			});
		});
	}

	/**
	 * Used by template engine.
	 */
	getData () {
		const rows = this._mapEntitiesToRows();

		const isIgnoreType = Config.get("tools", "isDeduplicateIgnoreType");
		const getUid = row => {
			const name = (row.name || "").trim().toLowerCase();
			return isIgnoreType ? name : `${name}__${row.type}`;
		};

		const uidToRows = {};
		rows.forEach(row => {
			const uid = getUid(row);
			(uidToRows[uid] = uidToRows[uid] || []).push(row);
		});

		this._rows = Object.values(uidToRows)
			.filter(it => it.length > 1)
			.map(dupeArr => {
				// Mark one of the duplicates as "prime," which we will avoid selecting in select-all later
				dupeArr.forEach((it, i) => it.isPrime = i === 0);
				return dupeArr;
			})
			.flat();

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

export {CollectionDeduplicator};
