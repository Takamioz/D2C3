import {UtilList2} from "./UtilList2.js";

class BaseCompendiumListTool extends Application {
	static _listSortLabel (a, b) { return SortUtil.ascSortLower(a.name, b.name); }

	_mapEntitiesToRows () {
		return game.packs.contents
			.map((it, ix) => {
				return {
					name: it.metadata.label,
					id: `${it.metadata.package}.${it.metadata.name}`,
					documentName: it.metadata.type,
					package: it.metadata.package,
					system: it.metadata.system,
					ix,
				};
			})
			.sort(BaseCompendiumListTool._listSortLabel);
	}

	_handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(li => this._pageFilter.toDisplay(f, this._rows[li.ix]));
	}

	_activateListeners_initBtnReset ($html) {
		this._$btnReset = $html.find(`[name="btn-reset"]`).click(() => {
			$html.find(`.search`).val("");
			if (this._list) this._list.reset();
		});
	}

	// Expose these methods to be overridden by child classes
	_activateListeners_listAbsorbGetData (li) { return UtilList2.absorbFnGetData(li); }
	_activateListeners_doBindSelectAll ($cbAll) { ListUiUtil.bindSelectAllCheckbox($cbAll, this._list); }

	_activateListeners_pInitListAndFilters ($html) {
		this._$iptSearch = $html.find(`.search`);

		// Init list library
		this._list = new List({
			$iptSearch: this._$iptSearch,
			$wrpList: $html.find(`.veapp__list`),
			fnSort: BaseCompendiumListTool._listSortLabel,
		});
		SortUtil.initBtnSortHandlers($html.find(`[data-name="wrp-btns-sort"]`), this._list);
		this._activateListeners_doBindSelectAll($html.find(`[name="cb-select-all"]`));

		return this._pageFilter.pInitFilterBox({
			$iptSearch: this._$iptSearch,
			$btnReset: this._$btnReset,
			$btnOpen: $html.find(`[name=btn-filter]`),
			$btnToggleSummaryHidden: $html.find(`[name=btn-toggle-summary]`),
			$wrpMiniPills: $html.find(`.fltr__mini-view`),
			namespace: `tool-compendium`,
		}).then(() => {
			this._rows.forEach(it => this._pageFilter.addToFilters(it));

			this._list.doAbsorbItems(
				this._rows,
				{
					fnGetName: it => it.name,
					fnGetValues: it => ({
						id: it.id,
						path: it.path,
						documentName: it.documentName,
						package: it.package,
						system: it.system,
					}),
					fnGetData: this._activateListeners_listAbsorbGetData.bind(this),
					fnBindListeners: it => UtilList2.absorbFnBindListeners(this._list, it),
				},
			);

			this._list.init();

			this._pageFilter.trimState();
			this._pageFilter.filterBox.render();

			this._pageFilter.filterBox.on(
				FilterBox.EVNT_VALCHANGE,
				this._handleFilterChange.bind(this),
			);

			this._handleFilterChange();
		});
	}

	_getSelectedIds () {
		return this._list.items
			.filter(it => $(it.ele).find(`input`).prop("checked"))
			.map(it => ({name: it.name, id: it.values.id}));
	}
}

export {BaseCompendiumListTool};
