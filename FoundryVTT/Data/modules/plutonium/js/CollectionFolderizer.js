import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilApplications} from "./UtilApplications.js";
import {Util} from "./Util.js";
import {BaseCollectionTool} from "./BaseCollectionTool.js";
import {AppFilterBasic} from "./FilterApplications.js";

class CollectionFolderizer extends BaseCollectionTool {
	constructor (collectionName) {
		super(
			{
				title: "Bulk Directory Mover",
				template: `${SharedConsts.MODULE_LOCATION}/template/CollectionFolderizer.hbs`,
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
		this._activateListeners_initBtnReset($html);
		this._activateListeners_pInitListAndFilters($html);
	}

	_activateListeners_initBtnRun ($html) {
		$html.find(`[name="btn-run"]`).click(async () => {
			if (!this._list) return;

			const targetFolder = $html.find(`[name="sel-folder"]`).val();
			if (!targetFolder) return ui.notifications.warn("No target folder selected!");

			const selIds = this._getSelectedIds();

			if (!selIds.length) return ui.notifications.warn(`Please select something to folderize!`);

			this.close();
			ui.sidebar.activateTab(this._sidebarTab);

			// Do this sequentially to avoid deadlock
			const tasks = selIds.map(({id, name}) => new Util.Task(name, () => this._pMoveItem(id, targetFolder)));
			await UtilApplications.pRunTasks(
				tasks,
				{
					titleInitial: "Moving...",
					titleComplete: "Move Complete",
					fnGetRowRunningText: (taskName) => `Moving ${taskName}...`,
					fnGetRowSuccessText: (taskName) => `Moved ${taskName}.`,
					fnGetRowErrorText: (taskName) => `Failed to move ${taskName}! ${VeCt.STR_SEE_CONSOLE}`,
				},
			);

			game[this._gameProp].render();
		});
	}

	async _pMoveItem (id, targetFolder) {
		await this._collection.get(id).update({folder: targetFolder});
	}

	/**
	 * Used by template engine.
	 */
	getData () {
		this._rows = this._mapEntitiesToRows();

		return {
			...super.getData(),
			titleSearch: `${this._collectionName}s`,
			folders: UtilApplications.getFolderList(this._folderType)
				.map(it => ({id: it.id, name: `${it.depth > 1 ? ` ${"-".repeat(it.depth - 1)} ` : ""}${it.name}`})),
			rows: this._rows,
		};
	}

	close (...args) {
		this._pageFilter.teardown();
		return super.close(...args);
	}
}

export {CollectionFolderizer};
