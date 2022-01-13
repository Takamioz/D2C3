import {SharedConsts} from "../shared/SharedConsts.js";
import {Util} from "./Util.js";
import {AppFilterBasic} from "./FilterApplications.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilList2} from "./UtilList2.js";

class DocumentEmbeddedDocumentCleaner extends Application {
	// region External
	static pHandleButtonClick (evt, app, $html, data) {
		const instance = new this(app.document);
		instance.render(true);
	}
	// endregion

	constructor ({title, doc, embedType, embedProp, displayName, displayNamePlural, namespace}) {
		super(
			{
				title,
				template: `${SharedConsts.MODULE_LOCATION}/template/DocumentEmbeddedDocumentCleaner.hbs`,
				width: 640,
				height: Util.getMaxWindowHeight(),
				resizable: true,
			},
		);

		this._doc = doc;
		this._embedType = embedType;
		this._embedProp = embedProp;
		this._displayName = displayName;
		this._displayNamePlural = displayNamePlural;
		this._namespace = namespace;

		// Local fields
		this._pageFilter = new AppFilterBasic();

		this._list = null;
		this._$btnReset = null;
		this._$iptSearch = null;
	}

	_handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(li => this._pageFilter.toDisplay(f, this._rows[li.ix]));
	}

	activateListeners ($html) {
		super.activateListeners($html);

		this._activateListeners_initBtnRun($html);
		this._activateListeners_initBtnReset($html);
		this._activateListeners_pInitListAndFilters($html);
	}

	_activateListeners_initBtnRun ($html) {
		$html.find(`[name="btn-run"]`).click(async () => {
			if (!this._list) return;

			const selIds = this._list.items
				.filter(it => $(it.ele).find(`input`).prop("checked"))
				.map(it => ({name: it.name, id: it.data.id}));

			const displayName = selIds.length === 1 ? this._displayName : this._displayNamePlural;
			const doDelete = await UtilApplications.pGetConfirmation({
				title: `Delete ${displayName}`.toTitleCase(),
				content: `<h3>Are you sure?</h3><p>${selIds.length} ${displayName} and ${selIds.length === 1 ? "its" : "their"} data will be permanently deleted.</p>`,
				confirmText: "Delete",
				faIcon: "fa-trash",
			});
			if (!doDelete) return;

			this.close();

			await this._doc.deleteEmbeddedDocuments(this._embedType, selIds.map(it => it.id));
			ui.notifications.info(`Deleted ${selIds.length} ${displayName}`);
		});
	}

	_activateListeners_initBtnReset ($html) {
		this._$btnReset = $html.find(`[name="btn-reset"]`).click(() => {
			$html.find(`.search`).val("");
			if (this._list) this._list.reset();
		});
	}

	_activateListeners_pInitListAndFilters ($html) {
		this._$iptSearch = $html.find(`.search`);

		// Init list library
		this._list = new List({
			$iptSearch: this._$iptSearch,
			$wrpList: $html.find(`.veapp__list`),
			fnSort: this.constructor._sortEntities,
		});
		SortUtil.initBtnSortHandlers($html.find(`[data-name="wrp-btns-sort"]`), this._list);
		ListUiUtil.bindSelectAllCheckbox($html.find(`[name="cb-select-all"]`), this._list);

		return this._pageFilter.pInitFilterBox({
			$iptSearch: this._$iptSearch,
			$btnReset: this._$btnReset,
			$btnOpen: $html.find(`[name=btn-filter]`),
			$btnToggleSummaryHidden: $html.find(`[name=btn-toggle-summary]`),
			$wrpMiniPills: $html.find(`.fltr__mini-view`),
			namespace: this._namespace,
		}).then(() => {
			this._rows.forEach(it => this._pageFilter.addToFilters(it));

			this._list.doAbsorbItems(
				this._rows,
				{
					fnGetName: it => it.name,
					fnGetData: (li, di) => ({...di, ...UtilList2.absorbFnGetData(li)}),
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

	static _sortEntities (a, b, opts) { return SortUtil.listSort(a, b, opts); }

	/**
	 * Used by template engine.
	 */
	getData () {
		this._rows = this._doc[this._embedProp].map((it, ix) => this._getData_getRow(it, ix));

		return {
			...super.getData(),
			rows: this._rows,
		};
	}

	_getData_getRow (doc, ix) {
		return {
			name: this._getData_getEmbeddedDocName(doc),
			id: doc.id,
			type: this._getData_getEmbeddedDocType(doc),
			ix,
		};
	}

	_getData_getEmbeddedDocName (doc) { throw new Error(`Unimplemented!`); }
	_getData_getEmbeddedDocType (doc) { throw new Error(`Unimplemented!`); }

	close (...args) {
		this._pageFilter.teardown();
		return super.close(...args);
	}
}

export {DocumentEmbeddedDocumentCleaner};
