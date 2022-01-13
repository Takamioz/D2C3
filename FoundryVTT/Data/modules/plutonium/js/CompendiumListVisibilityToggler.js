import {SharedConsts} from "../shared/SharedConsts.js";
import {Util} from "./Util.js";
import {AppFilterCompendiumList} from "./FilterApplications.js";
import {BaseCompendiumListTool} from "./BaseCompendiumListTool.js";
import {UtilApplications} from "./UtilApplications.js";

class CompendiumListVisibilityToggler extends BaseCompendiumListTool {
	constructor (collectionName) {
		super(
			{
				title: "Compendium Visibility Toggler",
				template: `${SharedConsts.MODULE_LOCATION}/template/CompendiumListVisibilityToggler.hbs`,
				height: Util.getMaxWindowHeight(),
				width: 640,
				resizable: true,
			},
			collectionName,
		);

		// Local fields
		this._pageFilter = new AppFilterCompendiumList();

		this._list = null;
		this._$btnReset = null;
		this._$selVisibility = null;
	}

	activateListeners ($html) {
		super.activateListeners($html);

		this._activateListeners_initBtnRun($html);
		this._activateListeners_initBtnReset($html);
		this._activateListeners_pInitListAndFilters($html);
	}

	_activateListeners_initBtnRun ($html) {
		$html.find(`[name="btn-run"]`).click(() => this._pDoToggle($html));
		this._$selVisibility = $html.find(`[name="sel-visibility"]`);
	}

	async _pDoToggle () {
		if (!this._list) return;

		const isVisible = CompendiumListVisibilityToggler._VISIBILITY_STATES[Number(this._$selVisibility.val())];

		const selIdMetas = this._getSelectedIds();
		if (!selIdMetas.length) return ui.notifications.warn(`Please select some compendiums!`);

		this.close();
		if (this._sidebarTab) ui.sidebar.activateTab("compendium");

		const task = new Util.Task(selIdMetas.length, async () => {
			for (const selIdMeta of selIdMetas) {
				const pack = game.packs.get(selIdMeta.id);
				if (pack) await pack.configure({private: !isVisible});
			}
		});
		await UtilApplications.pRunTasks(
			[task],
			{
				titleInitial: "Setting visibility...",
				titleComplete: "Visibilities Set.",
				fnGetRowRunningText: (entityCount) => `Setting visibility on ${entityCount} ${entityCount === 1 ? "compendium" : "compendiums"}...`,
				fnGetRowSuccessText: (entityCount) => `Set visibility on ${entityCount} ${entityCount === 1 ? "compendium" : "compendiums"}.`,
				fnGetRowErrorText: (entityCount) => `Failed to set compendium visibilities! ${VeCt.STR_SEE_CONSOLE}`,
			},
		);
	}

	getData () {
		this._rows = this._rows = this._mapEntitiesToRows();
		return {
			...super.getData(),
			rows: this._rows,
		};
	}

	close (...args) {
		this._pageFilter.teardown();
		return super.close(...args);
	}
}
CompendiumListVisibilityToggler._VISIBILITY_STATES = [
	true,
	false,
];

export {CompendiumListVisibilityToggler};
