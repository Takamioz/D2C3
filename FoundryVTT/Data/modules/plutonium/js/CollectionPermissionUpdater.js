import {SharedConsts} from "../shared/SharedConsts.js";
import {Util} from "./Util.js";
import {BaseCollectionTool} from "./BaseCollectionTool.js";
import {UtilApplications} from "./UtilApplications.js";
import {AppFilterBasic} from "./FilterApplications.js";

// TODO this performs poorly for lots of entities, see ISSUE(4)
class CollectionPermissionUpdater extends BaseCollectionTool {
	constructor (collectionName) {
		super(
			{
				title: "Bulk Permission Editor",
				template: `${SharedConsts.MODULE_LOCATION}/template/CollectionPermissionUpdater.hbs`,
				width: 960,
				height: Util.getMaxWindowHeight(),
				resizable: true,
			},
			collectionName,
		);

		// region Local fields
		this._pageFilter = new AppFilterBasic();

		this._list = null;
		this._$cbAll = null;
		this._$rowMass = null;
		this._$cbEach = null;
		this._$btnRun = null;
		this._$iptSearch = null;
		this._$btnReset = null;

		// data caching
		this._players = null;
		this._entities = null;
		// endregion
	}

	activateListeners ($html) {
		super.activateListeners($html);

		const SEL_DESELECTED_VALUE = "-2";

		// Pull out the elements to avoid running `.find()` across the whole window
		const eleScroller = $html[0].children[2];
		const elesToScroll = $(eleScroller).find(".permu__cell-ent-name").map((i, e) => e).get();
		eleScroller.addEventListener("scroll", () => {
			const scrollPos = eleScroller.scrollLeft;
			elesToScroll.forEach(it => it.style.left = `${scrollPos}px`);
		});

		const eleRowMass = eleScroller.children[1];
		this._$rowMass = $(eleRowMass);

		// region "All Players" God controls
		const $selAll = this._$rowMass.find(`select[name="permu__sel-all-players-all-entities"]`)
			.change(() => {
				const toVal = $selAll.val();

				this._list.visibleItems.forEach(li => {
					if (!li.data.cbAllPlayers.checked) return;
					li.data.selAllPlayers.value = toVal;
					li.data.selAllPlayers.setAttribute("data-permu-value", toVal);
				});

				$selAll.val(SEL_DESELECTED_VALUE);
			});

		this._$cbAll = this._$rowMass.find(`input[name="permu__cb-all-players-all-entities"]`)
			.change(() => {
				const toVal = this._$cbAll.prop("checked");

				this._setMassAllPlayerCheckboxValues(toVal);

				this._list.visibleItems.forEach(li => {
					li.data.cbAllPlayers.checked = toVal;
				});
			});
		// endregion

		// region God controls
		const $selEach = this._$rowMass.find(`select[name="permu__sel-each-player-all-entities"]`)
			.change(() => {
				const toVal = $selEach.val();
				const len = this._list.items[0] ? this._list.items[0].data.cbsPlayers.length : 0;

				for (let i = 0; i < len; ++i) {
					this._list.visibleItems.forEach(li => {
						if (!li.data.cbsPlayers[i].checked) return;
						li.data.selsPlayers[i].value = toVal;
						li.data.selsPlayers[i].setAttribute("data-permu-value", toVal);
					});
				}

				$selEach.val(SEL_DESELECTED_VALUE);
			});

		this._$cbEach = this._$rowMass.find(`input[name="permu__cb-each-player-all-entities"]`)
			.change(() => {
				const toVal = this._$cbEach.prop("checked");

				this._setMassCheckboxValues(toVal);

				this._list.visibleItems.forEach(li => {
					li.data.cbEachPlayer.checked = toVal;
					li.data.cbsPlayers.forEach(cb => cb.checked = toVal);
				});
			});
		// endregion

		// region Top (player) row
		this._$rowMass.on(`change`, `select[data-permu-type="sel-player-all-entities"]`, (evt) => {
			const $sel = $(evt.target);

			const toVal = $sel.val();

			const playerId = $sel.attr("data-permu-player-id");
			const ixPlayers = this._players.findIndex(it => it.id === playerId);

			this._list.visibleItems.forEach(li => {
				if (!li.data.cbsPlayers[ixPlayers].checked) return;
				li.data.selsPlayers[ixPlayers].value = toVal;
				li.data.selsPlayers[ixPlayers].setAttribute("data-permu-value", toVal);
			});

			$sel.val(SEL_DESELECTED_VALUE);
		});

		this._$rowMass.on(`click`, `label[data-permu-type="lbl-player-all-entities"]`, (evt) => {
			if (evt.target.tagName === "SELECT") return;

			const $row = $(evt.target).closest(`.permu__cell-player`);
			const $cb = $row.find(`input`);

			const toVal = $cb.prop("checked");

			const playerId = $cb.attr("data-permu-player-id");
			const ixPlayers = this._players.findIndex(it => it.id === playerId);

			this._list.visibleItems.forEach(li => {
				li.data.cbsPlayers[ixPlayers].checked = toVal;
			});
		});
		// endregion

		// region "All Players"
		$html.on(`change`, `select[data-permu-type="sel-entity-all-players"]`, (evt) => {
			const $sel = $(evt.target);
			$sel.attr("data-permu-value", $sel.val());
		});

		$html.on(`click`, `label[data-permu-type="lbl-entity-all-players"]`, (evt) => {
			if (evt.target.tagName === "SELECT") return;

			const $row = $(evt.target).closest(`.permu__row-ent`);

			const entityId = $row.attr("data-permu-entity-id");

			const li = this._list.items.find(it => it.values.id === entityId);

			ListUiUtil.handleSelectClick(
				this._list,
				li,
				evt,
				{
					fnGetCb: li => li.data.cbAllPlayers,
					isNoHighlightSelection: true,
					fnOnSelectionChange: (item, toVal) => {
						item.data.cbAllPlayers.checked = toVal;
					},
				},
			);
		});
		// endregion

		// region Entity rows
		$html.on(`change`, `select[data-permu-type="sel-entity-each-player"]`, (evt) => {
			const $sel = $(evt.target);

			const toVal = $sel.val();

			const $row = $sel.closest(`.permu__row-ent`);
			const entityId = $row.attr("data-permu-entity-id");

			const li = this._list.items.find(it => it.values.id === entityId);

			const len = li.data.cbsPlayers.length;
			for (let i = 0; i < len; ++i) {
				if (!li.data.cbsPlayers[i].checked) continue;
				li.data.selsPlayers[i].value = toVal;
				li.data.selsPlayers[i].setAttribute("data-permu-value", toVal);
			}

			$sel.val(SEL_DESELECTED_VALUE);
		});

		$html.on(`click`, `label[data-permu-type="lbl-entity-each-player"]`, (evt) => {
			if (evt.target.tagName === "SELECT") return;

			const $row = $(evt.target).closest(`.permu__row-ent`);

			const entityId = $row.attr("data-permu-entity-id");

			const li = this._list.items.find(it => it.values.id === entityId);

			ListUiUtil.handleSelectClick(
				this._list,
				li,
				evt,
				{
					fnGetCb: li => li.data.cbEachPlayer,
					isNoHighlightSelection: true,
					fnOnSelectionChange: (item, toVal) => {
						item.data.cbsPlayers.forEach(cb => cb.checked = toVal);
					},
				},
			);
		});
		// endregion

		// region Single select
		$html.on(`change`, `select[data-permu-type="sel-entity"]`, (evt) => {
			const $sel = $(evt.target);
			$sel.attr("data-permu-value", $sel.val());
		});
		// endregion

		// region Single checkbox
		$html.on(`click`, `label[data-permu-type="lbl-entity-player"]`, (evt) => {
			if (evt.target.tagName === "SELECT") return;

			const $row = $(evt.target).closest(`.permu__row-ent`);
			const $cb = $(evt.target).closest(`.permu__cell-player`).find(`input[data-permu-player-id]`);

			const entityId = $row.attr("data-permu-entity-id");
			const playerId = $cb.attr("data-permu-player-id");

			const ixPlayer = this._players.findIndex(it => it.id === playerId);

			const li = this._list.items.find(it => it.values.id === entityId);

			ListUiUtil.handleSelectClick(
				this._list,
				li,
				evt,
				{
					fnGetCb: li => li.data.cbsPlayers[ixPlayer],
					isNoHighlightSelection: true,
					fnOnSelectionChange: (item, toVal) => {
						item.data.cbsPlayers[ixPlayer].checked = toVal;
					},
				},
			);
		});
		// endregion

		this._$btnRun = $html.find(`[name="btn-save"]`).click(async () => this._pHandleBtnClick_run());
		this._$iptSearch = $html.find(`.search`);
		this._$btnReset = $html.find(`[name="btn-reset"]`).click(() => this._pHandleBtnClick_reset());

		// Init list library
		this._list = new List({
			$iptSearch: $html.find(`.search`),
			$wrpList: $html.find(`.veapp__list`),
			fnSort: CollectionPermissionUpdater._sortEntities,
		});

		this._pageFilter.pInitFilterBox({
			$iptSearch: this._$iptSearch,
			$btnReset: this._$btnReset,
			$btnOpen: $html.find(`[name=btn-filter]`),
			$btnToggleSummaryHidden: $html.find(`[name=btn-toggle-summary]`),
			$wrpMiniPills: $html.find(`.fltr__mini-view`),
			namespace: `tool-permissions_${this._collectionName}`,
		}).then(() => {
			this._entities.forEach(it => this._pageFilter.addToFilters(it));

			this._list.doAbsorbItems(
				this._entities,
				{
					fnGetName: it => it.name,
					fnGetValues: it => ({
						id: it.id,
						path: it.path,
					}),
					fnGetData: CollectionPermissionUpdater._absorbFnGetData,
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

	async _pHandleBtnClick_run () {
		if (!this._list) return;

		const toSaves = [];

		this._entities.forEach(ent => {
			const row = this._list.items.find(it => it.values.id === ent.id);

			let allPlayerUpdate = null;
			const metasPlayerUpdates = [];

			const originalAllValue = `${ent.allPlayerPermissions}`;
			if (row.data.selAllPlayers.value !== originalAllValue) allPlayerUpdate = row.data.selAllPlayers.value;

			row.data.selsPlayers.forEach((eleSel, i) => {
				const playerId = this._players[i].id;
				const originalVal = `${ent.playerPermissions[playerId]}`;

				if (eleSel.value !== originalVal) metasPlayerUpdates.push({value: eleSel.value, playerId});
			});

			if (allPlayerUpdate != null || metasPlayerUpdates.length) toSaves.push({entityMeta: ent, metasPlayerUpdates, allPlayerUpdate});
		});

		if (!toSaves) return ui.notifications.warn(`Please make some changes first!`);

		this._$btnRun.attr("disabled", true).text("Saving...");

		const tasks = toSaves.map(toSave => new Util.Task(`${toSave.entityMeta.path}${toSave.entityMeta.name}`, () => this._pUpdateItemPermissions(toSave)));

		await UtilApplications.pRunTasks(
			tasks,
			{
				titleInitial: "Updating...",
				titleComplete: "Update Complete",
				fnGetRowRunningText: (taskName) => `Updating ${taskName}...`,
				fnGetRowSuccessText: (taskName) => `Updated ${taskName}.`,
				fnGetRowErrorText: (taskName) => `Failed to update ${taskName}! ${VeCt.STR_SEE_CONSOLE}`,
			},
		);

		this._$btnRun.attr("disabled", false).text("Saved!");
		setTimeout(() => this._$btnRun.text("Save"), VeCt.DUR_INLINE_NOTIFY);
	}

	async _pUpdateItemPermissions (toSave) {
		const entity = this._collection.get(toSave.entityMeta.id);

		// This is asymmetrical with the below (uses `.data.permission` instead of `.permission`)
		//   `.permission` appears to instead be overridden with a property accessor for *current player's*
		//   permission for the entity.
		const nxtPermissions = {...entity.data.permission};

		if (toSave.allPlayerUpdate != null) {
			nxtPermissions.default = Number(toSave.allPlayerUpdate);
		}

		(toSave.metasPlayerUpdates || []).forEach(meta => {
			const {playerId, value} = meta;
			// "-1" is effectively "delete this permission," since Foundry screeches if we _actually_ pass -1.
			// The same strategy is used in `PermissionControl._updateObject`.
			if (!~value) return delete nxtPermissions[playerId];
			nxtPermissions[playerId] = Number(value);
		});

		if (!CollectionUtil.deepEquals(entity.data.permission, nxtPermissions)) {
			// For some unknown reason, this _only_ seems to work with `recursive: false, noHook: true` applied (or maybe
			//   some subset thereof; didn't test. `diff` along isn't enough, however.)
			await entity.update({permission: nxtPermissions}, {diff: false, recursive: false, noHook: true});
		}

		// Update our state (`this._entities` aka the state returned by `getData()`) in a separate post-step, to better handle errors
		if (toSave.allPlayerUpdate != null) {
			toSave.entityMeta.allPlayerPermissions = `${toSave.allPlayerUpdate}`;
		}

		(toSave.metasPlayerUpdates || []).forEach(meta => {
			const {playerId, value} = meta;
			toSave.entityMeta.playerPermissions[playerId] = `${value}`;
		});
	}

	async _pHandleBtnClick_reset () {
		this._$iptSearch.val("");

		this._$cbAll.prop("checked", false);
		this._setMassAllPlayerCheckboxValues(false);

		this._$cbEach.prop("checked", false);
		this._setMassCheckboxValues(false);

		this._entities.forEach(ent => {
			const row = this._list.items.find(it => it.values.id === ent.id);

			row.data.cbEachPlayer.checked = false;
			row.data.cbsPlayers.forEach(cb => cb.checked = false);

			row.data.selsPlayers.forEach((sel, i) => {
				const playerId = this._players[i].id;
				const toVal = `${ent.playerPermissions[playerId]}`;
				sel.value = toVal;
				sel.setAttribute("data-permu-value", toVal);
			});
		});
	}

	_setMassAllPlayerCheckboxValues (toVal) {
		// For some reason this doesn't work as a jQuery `.each`
		this._list.visibleItems.forEach(li => li.data.cbAllPlayers.checked = toVal);
	}

	_setMassCheckboxValues (toVal) {
		// For some reason this doesn't work as a jQuery `.each`
		this._$rowMass.find(`input[data-permu-player-id]`).get().forEach(cb => cb.checked = toVal);
	}

	_handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(li => this._pageFilter.toDisplay(f, this._entities[li.ix]));
	}

	static _absorbFnGetData (li) {
		const eleCellControlsAllPlayers = li.ele.children[2];
		const eleCellControlsEachPlayer = li.ele.children[3];
		const eleCellsControlPlayer = [...li.ele.children].slice(4);

		return ({
			cbAllPlayers: eleCellControlsAllPlayers.children[0],
			selAllPlayers: eleCellControlsAllPlayers.children[1],

			cbEachPlayer: eleCellControlsEachPlayer.children[0],
			selEachPlayer: eleCellControlsEachPlayer.children[1],

			cbsPlayers: eleCellsControlPlayer.map(ele => ele.children[0]),
			selsPlayers: eleCellsControlPlayer.map(ele => ele.children[1]),
		});
	}

	static _sortEntities (a, b) {
		const aPath = a.values ? a.values.path : a.path;
		const bPath = b.values ? b.values.path : b.path;
		if (aPath && !bPath) return -1;
		if (!aPath && bPath) return 1;
		return SortUtil.ascSortLower(aPath, bPath) || SortUtil.ascSortLower(a.name, b.name);
	}

	/**
	 * Used by template engine.
	 */
	getData () {
		// Cache these for later lookups
		this._players = game.users.contents.map(it => ({
			id: it.id,
			name: it.name,
		}));

		this._entities = this._collection.contents.map((it, ix) => {
			const path = UtilApplications.getFolderPath(it, {isAddTrailingSlash: true});
			const permObject = (it.data || {}).permission || {};

			const permissionLevelAll = permObject.default != null ? permObject.default : 0;

			return {
				id: it.id,
				name: it.name,
				allPlayerPermissions: permissionLevelAll,
				playerPermissions: this._players.map(player => player.id).mergeMap(id => {
					const permissionLevel = permObject[id] != null ? permObject[id] : -1;
					return {[id]: permissionLevel};
				}),
				type: MiscUtil.get(it, "data", "type") || "unknown",
				folderId: it.folder ? it.folder.id : null,
				path: path || "",
				ix,
			};
		});

		this._entities.sort(CollectionPermissionUpdater._sortEntities);

		return {
			...super.getData(),
			titleSearch: `${this._collectionName}s`,
			players: this._players,
			entities: this._entities,
			permissionsAll: Util.Fvtt.getPermissionsEnum(),
			permissions: Util.Fvtt.getPermissionsEnum({isIncludeDefault: true}),
		};
	}

	close (...args) {
		this._pageFilter.teardown();
		return super.close(...args);
	}
}

export {CollectionPermissionUpdater};
