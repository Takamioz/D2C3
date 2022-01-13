import {SharedConsts} from "../shared/SharedConsts.js";
import {LGT, Util} from "./Util.js";
import {AppFilter} from "./FilterApplications.js";
import {DataConverterSpell} from "./DataConverterSpell.js";
import {UtilDocuments} from "./UtilDocuments.js";

class ActorSpellPreparedToggler extends Application {
	// region External
	static pHandleButtonClick (evt, app, $html, data) {
		const instance = new ActorSpellPreparedToggler(app.actor);
		instance.render(true);
	}
	// endregion

	constructor (actor) {
		super({
			title: "Spell Prepared Toggler",
			template: `${SharedConsts.MODULE_LOCATION}/template/ActorSpellPreparedToggler.hbs`,
			width: 480,
			height: Util.getMaxWindowHeight(),
			resizable: true,
		});

		this._actor = actor;
		this._actorItems = this._actor.items
			// Filter out cantrips and spells not in "prepared" mode
			.filter(it => it.type === "spell" && it.data.data.level !== 0 && it.data.data.preparation && it.data.data.preparation.mode === "prepared");

		// Local fields
		this._pageFilter = new ActorSpellPreparedToggler.AppFilter();

		this._$iptName = null;
		this._activeSaveId = null;
		this._compSaves = null;
		this._$wrpSaveRows = null;
		this._renderableCollectionRules = null;

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

		this._activateListeners_initIptListName($html);
		this._activateListeners_initBtnListNew($html);
		this._activateListeners_initBtnListSave($html);
		this._activateListeners_initBtnListLoad($html);
		this._activateListeners_initBtnRun($html);
		this._activateListeners_initBtnReset($html);
		this._activateListeners_pInitListAndFilters($html)
			.then(() => this._pDoLoadInitialState());
	}

	_activateListeners_initIptListName ($html) {
		this._$iptName = $html.find(`[name="ipt-list-name"]`);
	}

	_activateListeners_initBtnListNew ($html) {
		$html.find(`[name="btn-list-new"]`)
			.click(async () => {
				this._activeSaveId = null;
				this._$iptName.val("");
			});
	}

	_getActiveSave ({activeSaveId = null} = {}) {
		activeSaveId = activeSaveId || this._activeSaveId;
		return this._compSaves.spellLists.find(it => it.id === activeSaveId);
	}

	_activateListeners_initBtnListSave ($html) {
		$html.find(`[name="btn-list-save"]`)
			.click(async () => {
				try {
					let activeSave = this._getActiveSave();
					if (!activeSave) {
						activeSave = {
							id: CryptUtil.uid(),
							entity: {
								name: "",
								spells: [],
							},
						};
						this._compSaves.spellLists.push(activeSave);
					}

					this._activeSaveId = activeSave.id;

					activeSave.entity.name = this._$iptName.val().trim() || "(Unnamed List)";
					this._$iptName.val(activeSave.entity.name);

					activeSave.entity.spells = this._list.items
						.map(li => {
							// Sanity check
							const spellItem = this._actor.items.get(li.data.spellItemId);
							if (!spellItem) return;

							return {
								id: li.data.spellItemId,
								isPrepared: li.data.getNextState(),
							};
						})
						.filter(Boolean);

					// region Set actor flag
					const existingActorFlags = this._actor.flags?.[SharedConsts.MODULE_NAME_FAKE];
					const nxtFlags = {...existingActorFlags || {}};
					MiscUtil.set(nxtFlags, this.constructor.name, "saveId", this._activeSaveId);
					await UtilDocuments.pUpdateDocument(this._actor, {flags: {[SharedConsts.MODULE_NAME_FAKE]: nxtFlags}});
					// endregion

					this._compSaves.triggerSpellListsCollectionUpdate();

					ui.notifications.info(`Saved as "${activeSave.entity.name}"!`);
				} catch (e) {
					ui.notifications.error(`Failed to save list! ${VeCt.STR_SEE_CONSOLE}`);
					console.error(...LGT, e);
				}
			});
	}

	_activateListeners_initBtnListLoad ($html) {
		$html.find(`[name="btn-list-load"]`)
			.click(async () => {
				try {
					const {$modalInner, doClose} = UiUtil.getShowModal({
						title: `Load Prepared Spell List`,
						isHeaderBorder: true,
						cbClose: (save) => {
							this._$wrpSaveRows.detach();
							if (!save) return;
							this._doLoadSave(save);
							ui.notifications.info(`Loaded list "${this._getActiveSave().entity.name}"!`);
						},
					});

					if (!this._compSaves.spellLists.length) $modalInner.append(`<div class="italic ve-muted py-1">No saved spell lists found.</div>`);

					this._$wrpSaveRows = this._$wrpSaveRows || $(`<div class="ve-flex-col w-100 h-100"></div>`);
					this._$wrpSaveRows.appendTo($modalInner);

					if (!this._renderableCollectionRules) {
						this._renderableCollectionRules = new ActorSpellPreparedToggler.RenderableCollectionSpellLists(
							this._compSaves,
							this._$wrpSaveRows,
						);
						const hk = () => {
							this._renderableCollectionRules.render();

							StorageUtil.pSet(
								this._getStorageKeyAllLists(),
								this._compSaves.spellLists,
							);
						};
						this._compSaves.addHookSpellLists(hk);
						hk();
					}
					this._renderableCollectionRules.cbClose = doClose;
				} catch (e) {
					ui.notifications.error(`Failed to load list! ${VeCt.STR_SEE_CONSOLE}`);
					console.error(...LGT, e);
				}
			});
	}

	_activateListeners_initBtnRun ($html) {
		$html.find(`[name="btn-run"]`).click(async () => {
			for (const it of this._list.items) {
				await it.data.pCommitState();
			}
		});
	}

	_activateListeners_initBtnReset ($html) {
		this._$btnReset = $html.find(`[name="btn-reset"]`).click(() => {
			$html.find(`.search`).val("");
			if (!this._list) return;

			this._list.reset();
			this._list.items.forEach(it => it.data.resetNextState());
		});
	}

	_activateListeners_pInitListAndFilters ($html) {
		this._$iptSearch = $html.find(`.search`);

		// Init list library
		this._list = new List({
			$iptSearch: this._$iptSearch,
			$wrpList: $html.find(`.veapp__list`),
			isUseJquery: true,
			fnSort: PageFilterSpells.sortSpells,
		});
		SortUtil.initBtnSortHandlers($html.find(`[data-name="wrp-btns-sort"]`), this._list);

		const $cbAll = $html.find(`[name="cb-select-all"]`).change(() => {
			const isChecked = $cbAll.prop("checked");
			this._list.visibleItems.forEach(it => it.data.setNextState(isChecked));
		});

		return this._pageFilter.pInitFilterBox({
			$iptSearch: this._$iptSearch,
			$btnReset: this._$btnReset,
			$btnOpen: $html.find(`[name=btn-filter]`),
			$btnToggleSummaryHidden: $html.find(`[name=btn-toggle-summary]`),
			$wrpMiniPills: $html.find(`.fltr__mini-view`),
			namespace: `tool-actor-spell-prepared-toggler`,
		}).then(() => {
			this._rows.forEach(it => this._pageFilter.addToFilters(it));

			this._list.doAbsorbItems(
				this._actorItems,
				{
					fnGetName: it => it.name,
					fnGetValues: it => ({
						level: MiscUtil.get(it, "data", "data", "level") || -1,
					}),
					fnGetData: (li, it) => {
						const $li = $(li.ele);
						return ({
							spellItemId: it.id,
							cbSel: $li.find(`input`)[0],
							$dispModified: $li.find(`.act-sp-prep__disp-modified`),
						});
					},
					fnBindListeners: (li, it) => {
						const nxtState = {
							prepared: it.data.data.preparation.prepared,
						};

						const handleNextState = () => {
							li.data.cbSel.checked = nxtState.prepared;
							li.data.$dispModified.toggleClass("ve-hidden", it.data.data.preparation.prepared === nxtState.prepared);
						};

						const setNextState = (val) => {
							nxtState.prepared = val;
							handleNextState();
						};

						const resetNextState = () => {
							nxtState.prepared = it.data.data.preparation.prepared;
							handleNextState();
						};

						const getNextState = () => nxtState.prepared;

						const pCommitState = async () => {
							await DataConverterSpell.pSetSpellItemIsPrepared(it, nxtState.prepared);
							handleNextState();
						};

						li.data.setNextState = setNextState;
						li.data.resetNextState = resetNextState;
						li.data.getNextState = getNextState;
						li.data.pCommitState = pCommitState;

						li.ele.addEventListener("click", evt => {
							ListUiUtil.handleSelectClick(
								this._list,
								li,
								evt,
								{
									isNoHighlightSelection: true,
									fnOnSelectionChange: (li, setTo) => li.data.setNextState(setTo),
								},
							);
						});
					},
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

	async _pDoLoadInitialState () {
		// region Prepare save list
		this._compSaves = new ActorSpellPreparedToggler.SavedSpellListComponent();

		const allSaves = await StorageUtil.pGet(this._getStorageKeyAllLists());
		if (!allSaves?.length) return;

		this._compSaves.spellLists = allSaves;
		// endregion

		// region Load current save
		const flags = this._actor.data.flags?.[SharedConsts.MODULE_NAME_FAKE];
		if (!flags?.[this.constructor.name]?.saveId) return;

		const save = allSaves.find(it => it.id === flags[this.constructor.name].saveId);
		if (!save) return;

		this._doLoadSave(save);
		// endregion
	}

	_doLoadSave (save) {
		if (!save?.entity.spells?.length) return;

		this._activeSaveId = save.id;
		this._$iptName.val(save.entity.name);

		save.entity.spells.forEach(({id, isPrepared}) => {
			const li = this._list.items.find(li => li.data.spellItemId === id);
			if (li) li.data.setNextState(isPrepared);
		});
	}

	_getStorageKeyAllLists () { return `${this.constructor.name}.saves`; }

	getData () {
		this._rows = this._actorItems.map((it, ix) => ({
			name: it.name,
			isPrepared: it.data.data.preparation.prepared,
			level: MiscUtil.get(it, "data", "data", "level") || -1,
			concentration: !!MiscUtil.get(it, "data", "data", "components", "concentration"),
			v: !!MiscUtil.get(it, "data", "data", "components", "vocal"),
			s: !!MiscUtil.get(it, "data", "data", "components", "somatic"),
			m: !!MiscUtil.get(it, "data", "data", "components", "material"),
			ritual: !!MiscUtil.get(it, "data", "data", "components", "ritual"),
			ix,
		}));

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

ActorSpellPreparedToggler.AppFilter = class extends AppFilter {
	constructor () {
		super();

		this._levelFilter = new Filter({
			header: "Level",
			items: [1, 2, 3, 4, 5, 6, 7, 8, 9],
			displayFn: lvl => ~lvl ? PageFilterSpells.getFltrSpellLevelStr(lvl) : "Unknown",
		});
		this._miscFilter = new Filter({
			header: "Components & Miscellaneous",
			items: ["Concentration", "Verbal", "Somatic", "Material", "Ritual"],
			itemSortFn: PageFilterSpells.sortMetaFilter,
		});
	}

	addToFilters (entity, isExcluded) {
		if (isExcluded) return;

		this._levelFilter.addItem(entity.level);
		entity._fMisc = [];
		if (entity.concentration) entity._fMisc.push("Concentration");
		if (entity.v) entity._fMisc.push("Verbal");
		if (entity.s) entity._fMisc.push("Somatic");
		if (entity.m) entity._fMisc.push("Material");
		if (entity.ritual) entity._fMisc.push("Ritual");
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._levelFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, ent) {
		return this._filterBox.toDisplay(
			values,
			ent.level,
			ent._fMisc,
		);
	}
};

ActorSpellPreparedToggler.SavedSpellListComponent = class extends BaseComponent {
	get spellLists () { return this._state[ActorSpellPreparedToggler.SavedSpellListComponent._PROP_SPELL_LISTS]; }
	set spellLists (val) { this._state[ActorSpellPreparedToggler.SavedSpellListComponent._PROP_SPELL_LISTS] = val; }

	addHookSpellLists (hk) { this._addHookBase(ActorSpellPreparedToggler.SavedSpellListComponent._PROP_SPELL_LISTS, hk); }

	triggerSpellListsCollectionUpdate () { this._triggerCollectionUpdate(ActorSpellPreparedToggler.SavedSpellListComponent._PROP_SPELL_LISTS); }

	_getDefaultState () {
		return {
			[ActorSpellPreparedToggler.SavedSpellListComponent._PROP_SPELL_LISTS]: [],
		};
	}
};
ActorSpellPreparedToggler.SavedSpellListComponent._PROP_SPELL_LISTS = "spellLists";

ActorSpellPreparedToggler.RenderableCollectionSpellLists = class extends RenderableCollectionBase {
	constructor (compSaves, $wrp) {
		super(compSaves, ActorSpellPreparedToggler.SavedSpellListComponent._PROP_SPELL_LISTS);
		this._$wrp = $wrp;
		this._cbClose = null;
	}

	set cbClose (fn) { this._cbClose = fn; }

	getNewRender (spellList) {
		const parentComp = this._comp;

		const comp = BaseComponent.fromObject(spellList.entity, "*");
		comp._addHookAll("state", () => {
			spellList.entity = comp.toObject("*");
			parentComp.triggerSpellListsCollectionUpdate();
		});

		const $btnLoad = $(`<button class="btn btn-xxs" title="Load"><span class="glyphicon glyphicon-ok"></span></button>`)
			.click(() => {
				this._cbClose(spellList);
			});

		const $btnDelete = $(`<button class="btn btn-xxs btn-danger" title="Delete"><span class="glyphicon glyphicon-trash"></span></button>`)
			.click(() => {
				parentComp.spellLists = parentComp.spellLists.filter(it => it !== spellList);
			});

		const $wrpRow = $$`<div class="ve-flex-v-center py-1 stripe-even toggsp__row">
			<div class="mr-2">${$btnLoad}</div>
			<div class="ve-flex-v-center w-100 mr-2">${comp._state.name}</div>
			<div class="">${$btnDelete}</div>
		</div>`.appendTo(this._$wrp);

		return {
			comp,
			$wrpRow,
			fnCleanup: () => {
				// (Unused)
			},
		};
	}

	doUpdateExistingRender (renderedMeta, spellList) {
		renderedMeta.comp._proxyAssignSimple("state", spellList.entity, true);
	}

	doDeleteExistingRender (renderedMeta) {
		renderedMeta.fnCleanup();
	}

	doReorderExistingComponent (renderedMeta, spellList) {
		const parent = this._comp;

		const ix = parent.spellLists.map(it => it.id).indexOf(spellList.id);
		const curIx = this._$wrp.find(`.toggsp__row`).index(renderedMeta.$wrpRow);

		const isMove = !this._$wrp.length || curIx !== ix;
		if (isMove) renderedMeta.$wrpRow.detach().appendTo(this._$wrp);
	}
};

export {ActorSpellPreparedToggler};
