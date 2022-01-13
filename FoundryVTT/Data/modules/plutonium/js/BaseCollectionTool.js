import {UtilList2} from "./UtilList2.js";
import {UtilApplications} from "./UtilApplications.js";
import {Util} from "./Util.js";

class BaseCollectionTool extends Application {
	static _sortNamePathRows (a, b) {
		if (a.path == null && b.path == null) return SortUtil.ascSortLower(a.name, b.name);
		if (a.path != null && b.path == null) return -1;
		if (a.path == null && b.path != null) return 1;
		return SortUtil.ascSortLower(a.path, b.path) || SortUtil.ascSortLower(a.name, b.name);
	}

	static _listSortNamePathRows (a, b, o) { // This ignores the options object--potentially expand in future
		const nxtA = {name: a.name, path: a.values.path};
		const nxtB = {name: b.name, path: b.values.path};
		return BaseCollectionTool._sortNamePathRows(nxtA, nxtB);
	}

	constructor (applicationOpts, collectionName) {
		super(applicationOpts);

		this._collectionName = collectionName;
		this._documentClass = null;
		this._collection = null;
		this._sidebarTab = null;
		this._gameProp = null;
		this._folderType = null;
		this._nameSingle = null;
		this._namePlural = null;
		switch (collectionName) {
			case "scene": {
				this._documentClass = Scene;
				this._collection = CONFIG.Scene.collection.instance;
				this._sidebarTab = "scenes";
				this._gameProp = "scenes";
				this._folderType = "Scene";
				this._nameSingle = "scene";
				this._namePlural = "scenes";
				break;
			}
			case "actor": {
				this._documentClass = Actor;
				this._collection = CONFIG.Actor.collection.instance;
				this._sidebarTab = "actors";
				this._gameProp = "actors";
				this._folderType = "Actor";
				this._nameSingle = "actor";
				this._namePlural = "actors";
				break;
			}
			case "item": {
				this._documentClass = Item;
				this._collection = CONFIG.Item.collection.instance;
				this._sidebarTab = "items";
				this._gameProp = "items";
				this._folderType = "Item";
				this._nameSingle = "item";
				this._namePlural = "items";
				break;
			}
			case "journal": {
				this._documentClass = JournalEntry;
				this._collection = CONFIG.JournalEntry.collection.instance;
				this._sidebarTab = "journal";
				this._gameProp = "journal";
				this._folderType = "JournalEntry";
				this._nameSingle = "journal entry";
				this._namePlural = "journal entries";
				break;
			}
			case "rolltable": {
				this._documentClass = RollTable;
				this._collection = CONFIG.RollTable.collection.instance;
				this._sidebarTab = "tables";
				this._gameProp = "tables";
				this._folderType = "RollTable";
				this._nameSingle = "table";
				this._namePlural = "tables";
				break;
			}
			case "macro": {
				this._documentClass = Macro;
				this._collection = CONFIG.Macro.collection.instance;
				this._sidebarTab = null;
				this._gameProp = "macros";
				this._folderType = null;
				this._nameSingle = "macro";
				this._namePlural = "macros";
				break;
			}
			case "cards": {
				this._documentClass = Cards;
				this._collection = CONFIG.Cards.collection.instance;
				this._sidebarTab = "cards";
				this._gameProp = "cards";
				this._folderType = "Cards";
				this._nameSingle = "card stack";
				this._namePlural = "card stacks";
				break;
			}
			default: throw new Error(`Unknown collection "${collectionName}"`);
		}
	}

	_mapEntitiesToRows () {
		return this._collection.contents
			.map((it, ix) => {
				const path = UtilApplications.getFolderPath(it, {isAddTrailingSlash: true});
				return {
					path,
					name: it.name,
					displayName: `${path || ""}${it.name}`,
					id: it.id,
					type: MiscUtil.get(it, "data", "type") || "unknown",
					ix,
				};
			})
			.sort(BaseCollectionTool._sortNamePathRows);
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
			fnSort: BaseCollectionTool._listSortNamePathRows,
		});
		SortUtil.initBtnSortHandlers($html.find(`[data-name="wrp-btns-sort"]`), this._list);
		this._activateListeners_doBindSelectAll($html.find(`[name="cb-select-all"]`));

		return this._pageFilter.pInitFilterBox({
			$iptSearch: this._$iptSearch,
			$btnReset: this._$btnReset,
			$btnOpen: $html.find(`[name=btn-filter]`),
			$btnToggleSummaryHidden: $html.find(`[name=btn-toggle-summary]`),
			$wrpMiniPills: $html.find(`.fltr__mini-view`),
			namespace: `tool-${this._collectionName}`,
		}).then(() => {
			this._rows.forEach(it => this._pageFilter.addToFilters(it));

			this._list.doAbsorbItems(
				this._rows,
				{
					fnGetName: it => it.name,
					fnGetValues: it => ({
						id: it.id,
						path: it.path,
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

	_activateListeners_initBtnPrune ($html) {
		$html.find(`[name="btn-prune"]`).click(async () => {
			const doDelete = await UtilApplications.pGetConfirmation({
				title: `Delete Folders`,
				content: `<h3>Are you sure?</h3><p>Any empty folders will be permanently deleted.</p>`,
				confirmText: "Delete",
				faIcon: "fa-trash",
			});
			if (!doDelete) return;

			await this._pDoPruneFolders();
		});
	}

	async _pDoDelete ($cbPruneAuto) {
		if (!this._list) return;

		let selIds = this._getSelectedIds();

		if (!selIds.length) return ui.notifications.warn(`Please select something to delete!`);

		const collectionTitle = this._collectionName.uppercaseFirst();
		const pluralStr = selIds.length !== 1 ? "s" : "";
		const doDelete = await UtilApplications.pGetConfirmation({
			title: `Delete ${collectionTitle}${pluralStr}`,
			content: `<h3>Are you sure?</h3><p>${selIds.length} ${collectionTitle}${pluralStr} and ${pluralStr ? "their" : "its"} data will be permanently deleted.</p>`,
			confirmText: "Delete",
			faIcon: "fa-trash",
		});
		if (!doDelete) return;

		this.close();
		if (this._sidebarTab) ui.sidebar.activateTab(this._sidebarTab);

		// If folder pruning is enabled, check if there any folders that we can delete (thus deleting their contents)
		//   This is much faster than deleting individual records
		if ($cbPruneAuto.prop("checked")) {
			const delIds = await this._pDoPruneFolders(selIds.map(({id}) => id));
			selIds = selIds.filter(({id}) => !delIds.has(id));
		}

		const task = new Util.Task(selIds.length, () => this._documentClass.deleteDocuments(selIds.map(({id}) => id)));
		await UtilApplications.pRunTasks(
			[task],
			{
				titleInitial: "Deleting...",
				titleComplete: "Delete Complete",
				fnGetRowRunningText: (entityCount) => `Deleting ${entityCount} ${entityCount === 1 ? this._nameSingle : this._namePlural}...`,
				fnGetRowSuccessText: (entityCount) => `Deleted ${entityCount} ${entityCount === 1 ? this._nameSingle : this._namePlural}.`,
				fnGetRowErrorText: (entityCount) => `Failed to delete ${entityCount} ${entityCount === 1 ? this._nameSingle : this._namePlural}! ${VeCt.STR_SEE_CONSOLE}`,
			},
		);

		if ($cbPruneAuto.prop("checked")) await this._pDoPruneFolders();

		game[this._gameProp].render();
	}

	/**
	 * @param [toDeleteEntityIds] Optional list of IDs for entities that are to be deleted.
	 */
	async _pDoPruneFolders (toDeleteEntityIds) {
		const getFolders = () => CONFIG.Folder.collection.instance.contents.filter(it => it.data.type === this._folderType);

		const setSelectedIds = toDeleteEntityIds ? new Set(toDeleteEntityIds) : null;
		const setDeleted = new Set();

		let cntPruned = 0;
		let cntFoldersPrev = null;
		let cntFolders = getFolders().length;
		do {
			let dirsToDelete;
			if (setSelectedIds) {
				dirsToDelete = getFolders().filter(it => {
					if (!it.children || !it.children.length) {
						if (!it.content.length) return true;

						// If all the directory's contents are to be deleted, delete the directory instead
						const selContentIds = it.content.map(c => c.id).filter(id => setSelectedIds.has(id));
						if (selContentIds.length === it.content.length) {
							selContentIds.forEach(id => setDeleted.add(id));
							return true;
						}
					}
					return false;
				});
			} else {
				dirsToDelete = getFolders().filter(it => !it.content.length && (!it.children || !it.children.length));
			}

			for (const dir of dirsToDelete) {
				await dir.delete({deleteSubfolders: true, deleteContents: true});
				cntPruned++;
			}

			cntFoldersPrev = cntFolders;
			cntFolders = getFolders().length;
		} while (cntFolders !== cntFoldersPrev);

		if (cntPruned) ui.notifications.info(`Deleted ${cntPruned} folder${cntPruned === 1 ? "" : "s"}.`);

		return setDeleted;
	}
}

export {BaseCollectionTool};
