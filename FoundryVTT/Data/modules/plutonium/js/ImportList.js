import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilApplications} from "./UtilApplications.js";
import {Util} from "./Util.js";
import {UtilList2} from "./UtilList2.js";
import {MixinFolderPathBuilder} from "./FolderPathBuilder.js";
import {Config} from "./Config.js";
import {Vetools} from "./Vetools.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {DataConverterTable} from "./DataConverterTable.js";
import {UtilFolders} from "./UtilFolders.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {UtilHooks} from "./UtilHooks.js";
import {UtilActors} from "./UtilActors.js";
import {UtilDocuments} from "./UtilDocuments.js";

/**
 * @mixes MixinFolderPathBuilder
 */
class ImportList extends MiscUtil.mix(Application).with(MixinFolderPathBuilder) {
	// region API
	static async api_pImportEntry (entry, {isTemp = false, packId = null} = {}) {
		if (game.user.role < Config.get("import", "minimumRole")) throw new Error(`You do not have sufficient permissions!`);

		const pack = packId ? game.packs.get(packId) : null;
		if (!pack && packId) throw new Error(`Could not find pack "${pack}"`);

		if (isTemp && packId) throw new Error(`Options "isTemp" and "packId" are mutually exclusive!`);

		entry = await entry;
		if (entry == null) throw new Error(`Entry cannot be null/undefined!`);

		const imp = new this();
		await imp.pInit();
		imp.pack = pack;
		return imp.pImportEntry(entry, {isTemp});
	}
	// endregion

	static get FOLDER_TYPE () { return "Item"; }

	/**
	 * @param opts.prop
	 * @param opts.importerName
	 */
	static _initCreateSheetItemHook (opts) {
		// Note that this breaks the case where a user manually calls `actor.createEmbeddedDocuments` with an array of
		//   Plutonium-flagged items--the pre-create hook gets passed only one of these items, and `return false`s
		//   the rest.
		// ...or at least, this _was_ the case in 0.7.x; post-0.8.x this may have changed.
		Hooks.on("preCreateItem", (item, itemData, options, itemId) => {
			if (item.parent?.documentName !== "Actor") return;

			const flags = itemData.flags?.[SharedConsts.MODULE_NAME_FAKE] || itemData.flags?.[SharedConsts.MODULE_NAME];
			if (!flags || flags?.propDroppable !== opts.prop) return;
			if (flags.isStandardDragDrop) return;

			const actor = item.parent;

			this._pGetUseImporterDragDrop()
				.then(async isUseImporter => {
					// Completely cancel the drag-drop if the user cancelled the dialogue
					if (isUseImporter == null) return;

					let ent;
					try {
						ent = await Renderer.hover.pCacheAndGet(flags.page, flags.source, flags.hash);
					} catch (e) {
						ui.notifications.error(`Failed to import "${ent?.name ?? flags.hash}"! ${VeCt.STR_SEE_CONSOLE}`);
						throw e;
					}

					if (!ent) {
						const msg = `Failed to import "${flags.hash}"!`;
						ui.notifications.error(`${msg} ${VeCt.STR_SEE_CONSOLE}`);
						throw new Error(`${msg} The original entity could not be found.`);
					}

					try {
						if (isUseImporter) {
							const imp = new this({actor});
							await imp.pInit();
							await imp.pImportEntry(ent, {filterValues: flags.filterValues});
							ui.notifications.info(`Imported "${ent.name}" via ${opts.importerName} Importer`);
							return;
						}

						itemData = MiscUtil.copy(itemData);
						MiscUtil.set(itemData.flags, SharedConsts.MODULE_NAME_FAKE, "isStandardDragDrop", true);
						await UtilActors.pAddActorItems(actor, [itemData]);
					} catch (e) {
						ui.notifications.error(`Failed to import "${ent.name}"! ${VeCt.STR_SEE_CONSOLE}`);
						throw e;
					}
				});

			return false;
		});
	}

	static async _pGetUseImporterDragDrop () {
		const dragDropMode = Config.get("import", "dragDropMode");
		if (dragDropMode === ConfigConsts.C_IMPORT_DRAG_DROP_MODE_NEVER) return false;

		if (dragDropMode === ConfigConsts.C_IMPORT_DRAG_DROP_MODE_PROMPT) {
			return InputUiUtil.pGetUserBoolean({
				title: `Import via ${Config.get("ui", "isStreamerMode") ? "SRD Importer" : SharedConsts.MODULE_TITLE}? Note that this will ignore any in-Foundry modifications made to the item.`,
				textYes: "Yes, use the importer",
				textNo: "No, use normal drag-drop",
			});
		}

		return true;
	}

	/**
	 * @param applicationOpts Application options. Accepts the same options as `Application`.
	 * @param [externalData] External data, passed in on creating the importer.
	 * @param [externalData.actor] Actor this importer belongs to.
	 * @param [externalData.table] RollableTable this importer belongs to.
	 * @param subclassOpts Options provided by subclasses to specify basic behaviour.
	 * @param [subclassOpts.props] JSON data properties for this entity (e.g. `["monster"]`).
	 * @param [subclassOpts.propsBrewAdditionalData] JSON data properties for additional data for this entity (e.g. `["foundryMonster"]`).
	 * @param [subclassOpts.dirsHomebrew] Homebrew directories for this entity (e.g. `["creature"]`)
	 * @param [subclassOpts.gameProp] Property on `game` object where the collection containing this FVTT entity type is stored.
	 * @param [subclassOpts.titleSearch] Used in prompt text in the search bar.
	 * @param [subclassOpts.sidebarTab] Sidebar tab to open when importer is made active, assuming we're not targeting an actor.
	 * @param [subclassOpts.defaultFolderPath] Default folder path under which content imported should be stored.
	 * @param [subclassOpts.fnListSort] Sort function for list items.
	 * @param [subclassOpts.listInitialSortBy] Initial "sort by" value for list items.
	 * @param [subclassOpts.pageFilter] Page filter instance for this importer.
	 * @param [subclassOpts.namespace] Namespace for this importer (will be prefixed as required (e.g. with "importer_") when used)
	 * @param [subclassOpts.isFolderOnly] If this importer may only target folder (and not compendiums)
	 * @param [subclassOpts.isActorRadio] If this importer is in "radio" mode when an actor is being imported.
	 * @param [subclassOpts.isNonCacheableInstance] If instances of this importer should never be cached.
	 * @param [subclassOpts.page] An associated 5etools page for this entity type.
	 * @param [subclassOpts.isPreviewable] If this importer list should have hoverable previews.
	 * @param [subclassOpts.titleButtonRun] Run button text.
	 * @param [subclassOpts.isDedupable] If a dedupe step should be run on importer content.
	 * @param [subclassOpts.fnLoadSideData] Function which loads side data.
	 * @param [subclassOpts.configGroup] The primary config group for this importer.
	 */
	constructor (applicationOpts, externalData, subclassOpts) {
		subclassOpts = subclassOpts || {};

		if (!subclassOpts.props && !subclassOpts.namespace) throw new Error(`One of "props" or "namespace" must be provided!`);

		const allApplicationOpts = {
			template: `${SharedConsts.MODULE_LOCATION}/template/ImportList.hbs`,
			width: 960,
			height: Util.getMaxWindowHeight(),
			resizable: true,
		};
		Object.assign(allApplicationOpts, applicationOpts || {});
		super(allApplicationOpts);

		// Fields for descendants to override
		this._props = subclassOpts.props;

		// region TODO link this with "props" to make a "propGroups" option
		this._propsBrewAdditionalData = subclassOpts.propsBrewAdditionalData;
		if (this._props && this._propsBrewAdditionalData && this._props.length !== this._propsBrewAdditionalData.length) throw new Error(`Mismatched number of properties! This is a bug!`);
		// endregion

		this._dirsHomebrew = subclassOpts.dirsHomebrew;

		this._titleSearch = subclassOpts.titleSearch || "entries";
		this._sidebarTab = subclassOpts.sidebarTab;
		this._gameProp = subclassOpts.gameProp;
		this._defaultFolderPath = subclassOpts.defaultFolderPath;
		this._fnListSort = subclassOpts.fnListSort;
		this._listInitialSortBy = subclassOpts.listInitialSortBy;
		this._pageFilter = subclassOpts.pageFilter;
		this._namespace = subclassOpts.namespace;
		this._isFolderOnly = !!subclassOpts.isFolderOnly;
		this._isNonCacheableInstance = subclassOpts.isNonCacheableInstance;
		this._page = subclassOpts.page;
		this._isPreviewable = subclassOpts.isPreviewable;
		this._titleButtonRun = subclassOpts.titleButtonRun || "Import";
		this._isDedupable = !!subclassOpts.isDedupable;
		this._fnLoadSideData = subclassOpts.fnLoadSideData;
		this._configGroup = subclassOpts.configGroup;

		// region Local fields
		// Fields that require synchronization
		this._actor = externalData?.actor;
		this._table = externalData?.table;
		this._isRadio = !!externalData?.actor && subclassOpts.isActorRadio;
		this._pack = null;
		this._packCache = null;
		this._packCacheFlat = null;

		this._isClosable = true;
		this._isHidden = false;

		this._isInit = false;
		this._content = null;
		this._list = null;
		this._uploadedFile = null; // This doesn't require syncing, as there is no cache/reload for from-file importers

		this._$bntFilter = null;
		this._$btnReset = null;
		this._$btnFeelingLucky = null;
		this._$btnToggleSummary = null;
		this._$iptSearch = null;
		this._$dispNumVisible = null;
		this._$cbAll = null;
		this._$btnTogglePreviewAll = null;
		this._$wrpRun = null;
		this._$btnRun = null;
		this._$btnsRunAdditional = {};
		this._$wrpBtnsSort = null;
		this._$wrpList = null;
		this._$wrpMiniPills = null;
		// endregion

		// Arbitrary data which is specific to each importer, and set each time it is opened
		this._userData = null;
	}

	get page () { return this._page; }
	set isClosable (val) { this._isClosable = val; }
	get namespace () { return this._namespace; }
	get props () { return this._props; }
	set pack (val) { this._pack = val; }
	get isFolderOnly () { return this._isFolderOnly; }
	get isNonCacheableInstance () { return !!this._isNonCacheableInstance; }
	get isDedupable () { return !!this._isDedupable; }
	set userData (val) { this._userData = val; }

	get gameProp () { return this._gameProp; }
	get actor () { return this._actor; }
	get table () { return this._table; }
	get configGroup () { return this._configGroup; }

	get isEscapeable () {
		if (this._isClosable) return true;
		else return !this._isHidden;
	}

	get _propGroups () { return this._props.map((prop, i) => ({prop, propBrewAdditionalData: this._propsBrewAdditionalData?.[i]})); }

	async pSetContent (val) { this._content = val; }

	async pSyncStateFrom (that) {
		this._actor = that._actor;
		this._table = that._table;
		this._pack = that._pack;
		await this.pSetFolderPathSpec(that._folderPathSpec);
	}

	close (...args) {
		if (this._isNonCacheableInstance) {
			if (this._pageFilter && this._pageFilter.filterBox) this._pageFilter.filterBox.teardown();
			return super.close(...args);
		}

		if (!this._isClosable) {
			this._isHidden = true;
			this.element.hideVe();
			return;
		}

		if (this._pageFilter && this._pageFilter.filterBox) this._pageFilter.filterBox.teardown();
		return super.close(...args);
	}

	async pPreRender () {}

	render (...args) {
		if (this._isHidden) {
			this.element.showVe();
			this._isHidden = false;
			this._pPostRenderOrShow();
			return;
		}

		return super.render(...args);
	}

	showAndRender (...args) {
		if (this._isHidden) {
			this.element.showVe();
			this._isHidden = false;
		}

		return this.render(...args);
	}

	activateSidebarTab ({sidebarTab = null} = {}) {
		sidebarTab = sidebarTab || this._sidebarTab;

		if (this._table) ui.sidebar.activateTab("tables");
		if (this._pack) ui.sidebar.activateTab("compendium");
		else if (!this._actor && !this._table && sidebarTab) ui.sidebar.activateTab(sidebarTab);
	}

	async pInit () {
		if (this._isInit) return;
		this._isInit = true;
		// Do initial load
		await this._pInit_folderPathSpec();
	}

	_getFullFolderPathSpecKey () { return `${ImportList._STO_K_FOLDER_PATH_SPEC}.${this._folderPathSpecKeyConstructorName}`; }
	get _folderPathSpecKeyConstructorName () { return this.constructor.name; }

	/**
	 * Used by template engine. This runs before `activateListeners` .
	 * Overwrite as required.
	 */
	getData () {
		return {
			isRadio: this._isRadio,
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			cols: [
				{
					name: "Name",
					width: 9,
					field: "name",
				},
				{
					name: "Source",
					width: 2,
					field: "source",
					titleProp: "sourceLong",
					displayProp: "sourceShort",
					classNameProp: "sourceClassName",
					styleProp: "sourceStyle",
					rowClassName: "text-center",
				},
			],
			rows: this._content.map((it, ix) => {
				if (this._pageFilter) this._pageFilter.constructor.mutateForFilters(it);

				return {
					name: it.name,
					source: it.source,
					sourceShort: Parser.sourceJsonToAbv(it.source),
					sourceLong: Parser.sourceJsonToFull(it.source),
					sourceClassName: Parser.sourceJsonToColor(it.source),
					sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),
					ix,
				};
			}),
		};
	}

	_activateListeners_doFindUiElements ($html) {
		const root = $html[0];

		const $wrpFilterControls = $(root.children[0]);
		this._$bntFilter = $wrpFilterControls.find(`[name="btn-filter"]`);
		this._$btnReset = $wrpFilterControls.find(`[name="btn-reset"]`);
		this._$btnFeelingLucky = $wrpFilterControls.find(`[name="btn-feeling-lucky"]`);
		this._$btnToggleSummary = $wrpFilterControls.find(`[name="btn-toggle-summary"]`);
		this._$iptSearch = $wrpFilterControls.find(`.search`);
		this._$dispNumVisible = $wrpFilterControls.find(`.lst__wrp-search-visible`);

		this._$wrpMiniPills = $(root.children[1]);

		const $wrpBtnsSort = $(root.children[2]);
		this._$cbAll = $wrpBtnsSort.find(`[name="cb-select-all"]`);
		this._$btnTogglePreviewAll = $wrpBtnsSort.find(`[name="btn-toggle-all-previews"]`);
		this._$wrpBtnsSort = $wrpBtnsSort;

		this._$wrpList = $(root.children[3]);

		this._$wrpRun = $(root.children[4]);
		this._$btnRun = this._$wrpRun.find(`[name="btn-run"]`);

		this._$wrpRun
			.find(`[name]`)
			.each((i, e) => {
				if (e.name === "btn-run") return;
				this._$btnsRunAdditional[e.name] = $(e);
			});
	}

	/**
	 * This runs after `getData`.
	 */
	activateListeners ($html) {
		super.activateListeners($html);

		this._activateListeners_doFindUiElements($html);

		this._activateListeners_initRunButton();
		this._activateListeners_initRunButtonsAdditional();

		this._$btnReset.click(() => {
			this._$iptSearch.val("");
			if (this._list) this._list.reset();
		});

		this._activateListeners_initFeelingLuckyButton();

		let pInitialising;
		if (this._pageFilter) {
			pInitialising = this._activateListeners_pInitFilteredList()
				.then(() => this._activateListeners_initPreviewHoversAndImportButtons());
		} else {
			this._activateListeners_initList();
		}

		this._list.on("updated", () => this._$dispNumVisible.html(`${this._list.visibleItems.length}/${this._list.items.length}`));
		ListUiUtil.bindSelectAllCheckbox(this._$cbAll, this._list);
		ListUiUtil.bindPreviewAllButton(this._$btnTogglePreviewAll, this._list);

		// Reset list to initial state
		if (this._$btnReset) this._$btnReset.click();

		if (pInitialising) pInitialising.then(() => this._pPostRenderOrShow());
		else this._pPostRenderOrShow();
	}

	_activateListeners_initFeelingLuckyButton () {
		this._$btnFeelingLucky.click(() => {
			if (!this._list || !this._list.visibleItems.length) return;

			ListUiUtil.setCheckboxes({isChecked: false, isIncludeHidden: true, list: this._list});

			const listItem = RollerUtil.rollOnArray(this._list.visibleItems);
			if (!listItem) return;

			ListUiUtil.setCheckbox(listItem, {toVal: true});

			listItem.ele.scrollIntoView({block: "center"});
		});
	}

	_activateListeners_initPreviewHoversAndImportButtons () {
		if (!this._isPreviewable) return;

		const items = this._list.items;
		const len = items.length;
		for (let i = 0; i < len; ++i) {
			const item = items[i];
			const eleControlsWrp = item.ele.firstElementChild.children[1];

			const btnShowHidePreview = eleControlsWrp.children[0];
			const btnImport = eleControlsWrp.children[1];

			this._activateListeners_initPreviewButton(item, btnShowHidePreview);
			this._activateListeners_initPreviewImportButton(item, btnImport);
		}
	}

	_activateListeners_initPreviewButton (item, btnShowHidePreview) {
		ListUiUtil.bindPreviewButton(this._page, this._content, item, btnShowHidePreview);
	}

	_activateListeners_initPreviewImportButton (item, btnImport) {
		btnImport.addEventListener("click", async evt => {
			evt.stopPropagation();
			evt.preventDefault();

			if (this._isRadio) this.close();

			const toImport = this._content[item.ix];
			try {
				await this._pHandleClickRunButton_pDoPreCachePack();
				let imported;
				try {
					imported = await this.pImportEntry(toImport);
				} finally {
					this._pHandleClickRunButton_doDumpPackCache();
				}
				if (!imported) return; // If the import was cancelled
				UtilApplications.doShowImportedNotification(imported);
			} catch (e) {
				setTimeout(() => { throw e; });
				UtilApplications.doShowImportedNotification({entity: toImport, status: UtilApplications.TASK_EXIT_FAILED});
			}
		});
	}

	// Overwrite as required
	_activateListeners_initRunButton () {
		this._$btnRun.click(() => this._pHandleClickRunButton());
	}

	_activateListeners_initRunButtonsAdditional () { /* Implement as required */ }

	_activateListeners_initRunButtonsAdditional_genericMods () {
		if (this._$btnsRunAdditional["btn-run-mods"]) this._$btnsRunAdditional["btn-run-mods"].click(() => this._pHandleClickRunButton({optsPostProcessing: {isUseMods: true}}));
	}

	async _pFnPostProcessEntries (entries) {
		return entries; // No-op; overwrite in subclasses
	}

	async _pHandleClickRunButton (
		{
			gameProp = null,
			sidebarTab = null,
			optsPostProcessing = {},
			optsImportEntry = {},
		} = {},
	) {
		gameProp = gameProp || this._gameProp;
		sidebarTab = sidebarTab || this._sidebarTab;

		if (!this._list) return;

		const selIds = this._list.items
			.filter(it => it.data.cbSel.checked)
			.map(it => it.ix);

		if (!selIds.length) return ui.notifications.warn(`Please select something to import!`);

		if (!this._pack && selIds.length > 100 && !Config.get("ui", "isDisableLargeImportWarning")) {
			const isContinue = await InputUiUtil.pGetUserBoolean({
				title: `Warning: Large Import`,
				htmlDescription: `You have selected ${selIds.length} ${selIds.length === 1 ? "entity" : "entities"} to import.<br>Importing a large number of entities may degrade game performance (consider importing to a compendium instead).<br>Do you wish to continue?`,
				textYesRemember: "Continue and Remember",
				textYes: "Continue",
				textNo: "Cancel",
				fnRemember: val => Config.set("ui", "isDisableLargeImportWarning", val),
			});
			if (isContinue == null || isContinue === false) return;
		}

		if (this._pack && !Config.get("ui", "isDisableLargeImportWarning") && (this._pack.index.size + selIds.length) > 500) {
			const isContinue = await InputUiUtil.pGetUserBoolean({
				title: `Warning: Large Compendium`,
				htmlDescription: `You have selected ${selIds.length} ${selIds.length === 1 ? "entity" : "entities"} to import${this._pack.index.size ? ` to a compendium with ${this._pack.index.size} existing document${this._pack.index.size !== 1 ? "s" : ""}` : ""}.<br>Importing a large number of documents to a single compendium may degrade game performance.<br>Do you wish to continue?`,
				textYesRemember: "Continue and Remember",
				textYes: "Continue",
				textNo: "Cancel",
				fnRemember: val => Config.set("ui", "isDisableLargeImportWarning", val),
			});
			if (isContinue == null || isContinue === false) return;
		}

		this.close();

		let entries = selIds.map(ix => this._content[ix]);
		entries = await this._pFnPostProcessEntries(entries, optsPostProcessing);
		if (entries == null) return;

		this.activateSidebarTab({sidebarTab});

		await this._pHandleClickRunButton_pDoPreCachePack({gameProp});

		const tasks = entries.map(entry => {
			return new Util.Task(
				`${entry._displayName || entry.name} (${Parser.sourceJsonToAbv(entry.source)})`,
				() => this.pImportEntry(entry, optsImportEntry),
			);
		});
		await UtilApplications.pRunTasks(tasks);

		if (!this._actor && !this._table && !this._pack) game[gameProp].render();

		this._pHandleClickRunButton_doDumpPackCache();

		this._$cbAll.prop("checked", false);
		this._list.items.forEach(item => {
			item.data.cbSel.checked = false;
			item.ele.classList.remove("list-multi-selected");
		});
	}

	// Overwrite as required
	_activateListeners_pInitFilteredList () {
		// Init list library
		this._list = new List({
			$iptSearch: this._$iptSearch,
			$wrpList: this._$wrpList,
			fnSort: this._fnListSort,
			sortByInitial: this._listInitialSortBy,
		});
		SortUtil.initBtnSortHandlers(this._$wrpBtnsSort, this._list);

		return this._pageFilter.pInitFilterBox({
			$iptSearch: this._$iptSearch,
			$btnReset: this._$btnReset,
			$btnOpen: this._$bntFilter,
			$btnToggleSummaryHidden: this._$btnToggleSummary,
			$wrpMiniPills: this._$wrpMiniPills,
			namespace: this._getFilterNamespace(),
		}).then(async () => {
			this._content.forEach(it => this._pageFilter.addToFilters(it));

			this._activateListeners_absorbListItems();
			this._list.init();

			this._pageFilter.trimState();
			this._pageFilter.filterBox.render();

			await this._pPostFilterRender();

			this._pageFilter.filterBox.on(
				FilterBox.EVNT_VALCHANGE,
				this._handleFilterChange.bind(this),
			);

			this._handleFilterChange();
		});
	}

	/** Implement as required. */
	async _pPostFilterRender () {}
	_pPostRenderOrShow () {}

	_activateListeners_initList () {
		// Init list library
		this._list = new List({
			$iptSearch: this._$iptSearch,
			$wrpList: this._$wrpList,
			fnSort: this._fnListSort,
		});
		SortUtil.initBtnSortHandlers(this._$wrpBtnsSort, this._list);

		this._activateListeners_absorbListItems();
		this._list.init();
	}

	// Overwrite as required
	_activateListeners_absorbListItems () {
		this._list.doAbsorbItems(
			this._content,
			{
				fnGetName: it => it.name,
				fnGetValues: it => ({
					source: it.source,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	_handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(li => this._pageFilter.toDisplay(f, this._content[li.ix]));
	}

	async pImportEntry (...args) {
		// N.b. this method should *not* contain any functionality beyond importing and calling the hook.
		const importSummary = await this._pImportEntry(...args);
		UtilHooks.callAll(UtilHooks.HK_IMPORT_COMPLETE, importSummary);
		return importSummary;
	}

	async _pImportEntry () { throw new Error(`Unimplemented!`); }

	async pGetSources () { throw new Error(`Unimplemented!`); }

	async _pImportEntry_getUserVersion (entity) {
		if (entity._foundryIsIgnoreVersions) return entity;

		const versions = DataUtil.proxy.getVersions(entity.__prop, entity);
		if (!versions.length) return entity;

		const ix = await InputUiUtil.pGetUserEnum({
			values: versions,
			placeholder: "Select Version...",
			title: `Select the Version to Import`,
			fnDisplay: it => {
				if (it == null) return `(Base version)`;
				return `${it.name}${entity.source !== it.source ? ` (${Parser.sourceJsonToAbv(it.source)})` : ""}`;
			},
			isAllowNull: true,
		});

		if (ix == null) {
			const cpy = MiscUtil.copy(entity);
			cpy._foundryIsIgnoreVersions = true;
			return cpy;
		}
		return versions[ix];
	}

	async _pGetSourcesHomebrew (nxtOpts = {}) {
		return [
			...(await Vetools.pGetLocalHomebrewSources(...this._dirsHomebrew)).map(({name, url, abbreviations}) => new UtilDataSource.DataSourceUrl(
				name,
				url,
				{
					...nxtOpts,
					filterTypes: [UtilDataSource.SOURCE_TYP_BREW, UtilDataSource.SOURCE_TYP_BREW_LOCAL],
					abbreviations,
				},
			)),
			...(await Vetools.pGetHomebrewSources(...this._dirsHomebrew)).map(({name, url, abbreviations}) => new UtilDataSource.DataSourceUrl(
				name,
				url,
				{
					...nxtOpts,
					filterTypes: [UtilDataSource.SOURCE_TYP_BREW],
					abbreviations,
				},
			)),
		];
	}

	getFolderPathMeta () {
		return {
			alpha: {
				label: "First Letter of Name",
				getter: it => it.name.slice(0, 1).toUpperCase(),
			},
			source: {
				label: "Source (Full)",
				getter: it => Parser.sourceJsonToFull(it.source),
			},
			sourceAbbreviation: {
				label: "Source (Abbreviation)",
				getter: it => Parser.sourceJsonToAbv(it.source),
			},
		};
	}

	/**
	 * @param entry
	 * @param [opts]
	 * @param [opts.sorting] Folder sorting type, either `"a"` (alphabetical) or `"m"` (manual). Defaults to alphabetical.
	 */
	async _pImportEntry_pGetFolderId (entry, opts) {
		opts = opts || {};
		return this._pGetCreateFoldersGetIdFromObject({folderType: this.constructor.FOLDER_TYPE, obj: entry, sorting: opts.sorting});
	}

	async _pImportEntry_pCreateTempDirectoryGetId () {
		// FIXME(Future) Non-GM users cannot ever create folders, so this is a no-op
		if (!Util.Fvtt.canUserCreateFolders()) return null;
		return UtilFolders.pCreateFoldersGetId({
			folderType: this.constructor.FOLDER_TYPE,
			folderNames: [Config.get("import", "tempFolderName")],
		});
	}

	getContent (data) {
		return Vetools.getContent(data, this._props);
	}

	_getFilterNamespace () { return `importer_${this._actor ? `actor` : `directory`}_${this._namespace || this._props.join("_")}`; }

	/**
	 * @param opts
	 * @param [opts.name]
	 * @param [opts.source]
	 * @param [opts.entity]
	 * @param [opts.flags] N.b.: only implemented for journal entries/tables. // TODO(Future) Implement for actors/items as required.
	 * @param [opts.gameProp] Game prop override
	 * @param [opts.importOpts]
	 * @param [opts.importOpts.isTemp]
	 * @param [opts.importOpts.isImportToTempDirectory]
	 */
	_getDuplicateMeta (opts) {
		opts = opts || {};

		const existing = this._getDuplicateMeta_getExisting(opts);

		const mode = Config.get("import", "deduplicationMode");
		return {
			mode,
			existing: existing,
			// Helper values
			isSkip: mode === ConfigConsts.C_IMPORT_DEDUPE_MODE_SKIP && existing != null,
			isOverwrite: mode === ConfigConsts.C_IMPORT_DEDUPE_MODE_OVERWRITE && existing != null,
		};
	}

	_getDuplicateMeta_getExisting (opts) {
		if (opts?.importOpts?.isTemp || opts?.importOpts?.isImportToTempDirectory) return null;

		const gameProp = opts.gameProp || this._gameProp;

		// Only check the pack if we're using an entity type the pack can store
		const pack = gameProp === this._gameProp ? this._pack : null;

		let existing = null;
		switch (gameProp) {
			// region Entities with sources in Foundry
			case "actors":
			case "items": {
				if (!((opts.name && opts.source) || opts.entity)) throw new Error(`Either "name" and "source", or "entity", must be provided!`);

				const cleanName = (opts.name || UtilDataConverter.getNameWithSourcePart(opts.entity)).toLowerCase().trim();
				const cleanSource = (opts.source || UtilDataConverter.getSourceWithPagePart(opts.entity)).toLowerCase().trim();

				switch (gameProp) {
					case "actors": {
						if (pack) {
							const key = this._getDuplicateMeta_getEntityKey({name: cleanName, source: cleanSource});
							existing = (this._packCache || {})[key];
						} else {
							existing = game[gameProp].find(it => this.constructor._getDuplicateMeta_getCleanName(it) === cleanName && (!Config.get("import", "isStrictMatching") || (MiscUtil.get(it, "data", "data", "details", "source") || "").toLowerCase().trim() === cleanSource));
						}
						break;
					}
					case "items": {
						if (pack) {
							const key = this._getDuplicateMeta_getEntityKey({name: cleanName, source: cleanSource});
							existing = (this._packCache || {})[key];
						} else {
							existing = game[gameProp].find(it => this.constructor._getDuplicateMeta_getCleanName(it) === cleanName && (!Config.get("import", "isStrictMatching") || (MiscUtil.get(it, "data", "data", "source") || "").toLowerCase().trim() === cleanSource));
						}
						break;
					}
				}

				break;
			}
			// endregion

			// region Entities without sources in Foundry
			case "journal":
			case "tables":
			case "scenes": {
				const cleanName = opts.name.toLowerCase().trim();

				if (pack) {
					existing = (this._packCacheFlat || []).find(it => this.constructor._getDuplicateMeta_getCleanName(it) === cleanName && this.constructor._getDuplicateMeta_isFlagMatch(opts.flags, it));
				} else {
					existing = game[gameProp].find(it => this.constructor._getDuplicateMeta_getCleanName(it) === cleanName && this.constructor._getDuplicateMeta_isFlagMatch(opts.flags, it));
				}
				break;
			}
			// endregion

			default: throw new Error(`Game property "${gameProp}" is not supported!`);
		}
		return existing;
	}

	static _getDuplicateMeta_getCleanName (it) {
		let out = (MiscUtil.get(it, "data", "name") || "").toLowerCase().trim();

		out = out
			.replace(/\[[^\]]+]/g, "") // Remove tags
			.trim();

		return out;
	}

	static _getDuplicateMeta_isFlagMatch (flags, entity) {
		if (!flags) return true;
		if (!entity) return false;

		if (!entity.data.flags) return false;
		for (const [moduleKey, flagGroup] of Object.entries(flags)) {
			if (entity.data.flags[moduleKey] == null) return false;
			for (const [k, v] of Object.entries(flagGroup)) {
				if (!CollectionUtil.deepEquals(v, entity.data.flags[moduleKey]?.[k])) return false;
			}
		}
		return true;
	}

	_getDuplicateMeta_getEntityKey (obj) {
		return Object.entries(obj)
			.sort(([aK], [bK]) => SortUtil.ascSortLower(aK, bK))
			.map(([k, v]) => `${k}=${`${v}`.trim()}`.toLowerCase())
			.join("::");
	}

	async _pHandleClickRunButton_pDoPreCachePack ({gameProp = null} = {}) {
		gameProp = gameProp || this._gameProp;

		if (!this._pack || Config.get("import", "deduplicationMode") === ConfigConsts.C_IMPORT_DEDUPE_MODE_NONE) return;

		this._packCache = {};
		this._packCacheFlat = [];
		const content = await UtilCompendium.pGetCompendiumData(this._pack, true);

		content.forEach(ent => {
			switch (gameProp) {
				case "actors": {
					const cleanName = (MiscUtil.get(ent, "data", "name") || "").toLowerCase().trim();
					const cleanSource = (MiscUtil.get(ent, "data", "data", "details", "source") || "").toLowerCase().trim();

					const key = this._getDuplicateMeta_getEntityKey({name: cleanName, source: cleanSource});
					this._packCache[key] = ent;

					break;
				}
				case "items": {
					const cleanName = (MiscUtil.get(ent, "data", "name") || "").toLowerCase().trim();
					const cleanSource = (MiscUtil.get(ent, "data", "data", "source") || "").toLowerCase().trim();

					const key = this._getDuplicateMeta_getEntityKey({name: cleanName, source: cleanSource});
					this._packCache[key] = ent;

					break;
				}
				case "journal":
				case "tables":
				case "scenes": {
					const cleanName = (MiscUtil.get(ent, "data", "name") || "").toLowerCase().trim();

					const key = this._getDuplicateMeta_getEntityKey({name: cleanName});
					this._packCache[key] = ent;

					break;
				}
				default: throw new Error(`Game property "${gameProp}" is not supported!`);
			}

			this._packCacheFlat.push(ent);
		});
	}

	_pHandleClickRunButton_doDumpPackCache () {
		this._packCache = null;
		this._packCacheFlat = null;
	}

	async _pImportEntry_pDoUpdateExistingPackEntity (duplicateMeta, itemData) {
		if (duplicateMeta.existing.effects?.length) await duplicateMeta.existing.deleteEmbeddedDocuments("ActiveEffect", duplicateMeta.existing.effects.map(it => it.id));
		if (this._gameProp === "tables" && duplicateMeta.existing.results?.size) await duplicateMeta.existing.deleteEmbeddedDocuments("TableResult", duplicateMeta.existing.results.map(it => it.id));

		await UtilDocuments.pUpdateDocument(duplicateMeta.existing, itemData);

		await this._pImportEntry_pAddToTargetTableIfRequired([duplicateMeta.existing], duplicateMeta);

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE_UPDATE_OVERWRITE,
			imported: [
				new ImportedDocument({
					isExisting: true,
					document: duplicateMeta.existing,
					pack: this._pack,
				}),
			],
		});
	}

	async _pImportEntry_pDoUpdateExistingDirectoryEntity (duplicateMeta, itemData) {
		if (this._gameProp === "tables" && duplicateMeta.existing.results?.size) await duplicateMeta.existing.deleteEmbeddedDocuments("TableResult", duplicateMeta.existing.results.map(it => it.id));

		await UtilDocuments.pUpdateDocument(duplicateMeta.existing, itemData);

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE_UPDATE_OVERWRITE,
			imported: [
				new ImportedDocument({
					isExisting: true,
					document: duplicateMeta.existing,
				}),
			],
		});
	}

	async _pImportEntry_pImportToDirectoryGeneric (toImport, importOpts, dataOpts = {}, {docData = null, isSkipDuplicateHandling = false} = {}) {
		docData = docData || await this._pImportEntry_pImportToDirectoryGeneric_pGetImportableData(
			toImport,
			{
				isAddDataFlags: true, // This is implicit for some data types, but explicit for others.
				filterValues: importOpts.filterValues,
				...dataOpts,
				isAddPermission: true,
				defaultPermission: importOpts.defaultPermission,
			},
			importOpts,
		);

		const duplicateMeta = isSkipDuplicateHandling
			? null
			: this._getDuplicateMeta({name: docData.name, source: MiscUtil.get(docData, "data", "source"), importOpts});
		if (duplicateMeta?.isSkip) {
			return new ImportSummary({
				status: UtilApplications.TASK_EXIT_SKIPPED_DUPLICATE,
				imported: [
					new ImportedDocument({
						isExisting: true,
						document: duplicateMeta.existing,
					}),
				],
			});
		}

		let Clazz;
		switch (this._gameProp) {
			case "items": Clazz = CONFIG.Item.documentClass; break;
			case "journal": Clazz = CONFIG.JournalEntry.documentClass; break;
			case "tables": Clazz = CONFIG.RollTable.documentClass; break;
			case "scenes": Clazz = CONFIG.Scene.documentClass; break;
		}

		if (importOpts.isTemp) {
			const imported = await Clazz.create(docData, {renderSheet: true, temporary: true});
			return new ImportSummary({
				status: UtilApplications.TASK_EXIT_COMPLETE,
				imported: [
					new ImportedDocument({
						document: imported,
					}),
				],
			});
		}

		if (this._pack) {
			if (duplicateMeta?.isOverwrite) return this._pImportEntry_pDoUpdateExistingPackEntity(duplicateMeta, docData);

			const instance = new Clazz(docData);
			const imported = await this._pack.importDocument(instance);

			await this._pImportEntry_pAddToTargetTableIfRequired([imported], duplicateMeta);

			return new ImportSummary({
				status: UtilApplications.TASK_EXIT_COMPLETE,
				imported: [
					new ImportedDocument({
						document: imported,
						pack: this._pack,
					}),
				],
			});
		}

		if (duplicateMeta?.isOverwrite) return this._pImportEntry_pDoUpdateExistingDirectoryEntity(duplicateMeta, docData);

		const folderId = importOpts.folderId !== undefined ? importOpts.folderId : await this._pImportEntry_pGetFolderId(toImport);
		if (folderId) docData.folder = folderId;

		const imported = await Clazz.create(docData, {renderSheet: false, temporary: false});

		await game[this._gameProp].set(imported.id, imported);

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					document: imported,
				}),
			],
		});
	}

	async _pImportEntry_pAddToTargetTableIfRequired (fvttEntities, duplicateMeta) {
		if (!this._table) return;

		// Avoid duplicating rows if we're generally in "skip" mode
		const isFilterRows = duplicateMeta?.mode === ConfigConsts.C_IMPORT_DEDUPE_MODE_SKIP
			// Avoid duplicating rows if the linked entity was overwritten (the row shouldn't change in this case)
			|| duplicateMeta?.isOverwrite;

		fvttEntities = isFilterRows
			? fvttEntities.filter(fvttEntity => !this._table.results.some(it => it.data.resultId === fvttEntity.id))
			: fvttEntities;
		if (!fvttEntities.length) return;

		const rangeLowHigh = DataConverterTable.getMaxTableRange(this._table) + 1;
		await UtilDocuments.pCreateEmbeddedDocuments(
			this._table,
			await fvttEntities.pSerialAwaitMap(fvttEntity => DataConverterTable.pGetTableResult({
				type: CONST.TABLE_RESULT_TYPES.COMPENDIUM,
				text: fvttEntity.name,
				resultId: fvttEntity.id,
				collection: this._pack.collection,
				rangeExact: rangeLowHigh,
				img: fvttEntity.img,
			})),
			{
				propData: "results",
				ClsEmbed: TableResult,
			},
		);
	}

	/**
	 * @param it
	 * @param getItemOpts
	 * @return {*}
	 */
	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) { throw new Error(`Unimplemented!`); }

	/** Implement as required. */
	async pGetChooseImporterUserDataForSources () {}
}
ImportList._STO_K_FOLDER_PATH_SPEC = "ImportList.folderKeyPathSpec";

// TODO refactor parts of this into the main ImportList class (allowing a resolution other than just importing) and use
//   this to handle the "quick import" in-list buttons
/**
 * @mixin
 */
const MixinUserChooseImporter = clsImportList => class extends clsImportList {
	constructor (externalData, applicationOptsOverride, subclassOptsOverride, chooseImporterOpts = {}) {
		super(externalData, applicationOptsOverride, subclassOptsOverride);
		this._isRadio = true;

		this._isResolveOnClose = true;
		this._fnResolve = null;
		this._fnReject = null;
		this.pResult = null;

		this._isForceImportToTempDirectory = !!chooseImporterOpts.isForceImportToTempDirectory;
	}

	_getImportOpts () {
		return this._isForceImportToTempDirectory
			? {isImportToTempDirectory: true}
			: {isTemp: true, isDataOnly: true};
	}

	_isImportSuccess (importSummary) {
		return (!this._isForceImportToTempDirectory && importSummary.status === UtilApplications.TASK_EXIT_COMPLETE_DATA_ONLY)
		|| (this._isForceImportToTempDirectory && importSummary.status === UtilApplications.TASK_EXIT_COMPLETE);
	}

	async _pHandleClickRunButton () {
		if (!this._list) return;

		try {
			const selItem = this._list.items
				.find(it => it.data.cbSel.checked);

			if (!selItem) return ui.notifications.warn(`Please select something from the list!`);

			this._isResolveOnClose = false;

			this.close();

			let entries = [this._content[selItem.ix]];

			entries = await this._pFnPostProcessEntries(entries);
			if (entries == null) return;

			const importOpts = this._getImportOpts();

			const importSummary = await this.pImportEntry(entries[0], importOpts);
			if (this._isImportSuccess(importSummary)) this._fnResolve(importSummary?.imported?.[0]?.document);
			else this._fnReject(new Error(`Import exited with status "${importSummary.status.toString()}"`));

			selItem.data.cbSel.checked = false;
			selItem.ele.classList.remove("list-multi-selected");
		} catch (e) {
			this._fnReject(e);
		}
	}

	_activateListeners_initPreviewImportButton (item, btnImport) {
		btnImport.addEventListener("click", async evt => {
			evt.stopPropagation();
			evt.preventDefault();

			try {
				let entries = [this._content[item.ix]];

				entries = await this._pFnPostProcessEntries(entries);
				if (entries == null) return;

				const importOpts = this._getImportOpts();

				const imported = await this.pImportEntry(entries[0], importOpts);
				if (this._isImportSuccess(imported)) this._fnResolve(imported?.imported?.[0]?.document);
				else this._fnReject(new Error(`Import exited with status "${imported.status.toString()}"`));

				this.close();
			} catch (e) {
				this._fnReject(e);
			}
		});
	}

	async close (...args) {
		await super.close(...args);
		if (this._isResolveOnClose) this._fnResolve(null);
	}

	async pPreRender (...preRenderArgs) {
		await super.pPreRender(...preRenderArgs);

		if (!preRenderArgs?.length) return;

		const [{fnResolve, fnReject, pResult}] = preRenderArgs;

		this._isResolveOnClose = true;
		this._fnResolve = fnResolve;
		this._fnReject = fnReject;
		this.pResult = pResult;
	}

	/**
	 * @param mode A predefined mode that the ChooseImporter wizard should use, rather than allowing the user to pick one.
	 * @param namespace A namespace for the ChooseImporter wizard. Useful for non-standard flows.
	 */
	static async pGetUserChoice (mode, namespace) {
		const {ChooseImporter} = await import("./ChooseImporter.js");

		const importer = new this({});
		await importer.pInit();

		let fnResolve = null;
		let fnReject = null;
		const pResult = new Promise((resolve, reject) => {
			fnResolve = resolve;
			fnReject = reject;
		});

		// Avoid passing in the actor, as we'll pull out the imported result and apply it to the actor ourselves
		const chooseImporter = new ChooseImporter(
			{
				mode: {
					...mode,
					importerInstance: importer,
				},
				namespace,
				isAlwaysCloseWindow: true,
				isTemp: true,
				isNoImport: true,
				importerPreRenderArgs: {
					fnResolve,
					fnReject,
					pResult,
				},
			},
		);
		chooseImporter.render(true);

		return pResult;
	}
};

class ImportSummary {
	/**
	 * @param {ImportedDocument[]} [imported] List of ImportedDocument
	 * @param status The overall exit status of the import
	 */
	constructor (
		{
			imported,
			status,
		},
	) {
		this.imported = imported;
		this.status = status;
	}

	static cancelled () { return new this({status: UtilApplications.TASK_EXIT_CANCELLED}); }
	static completedStub () { return new this({imported: [], status: UtilApplications.TASK_EXIT_COMPLETE}); }
}

class ImportedDocument {
	/**
	 * @param name A display name for this import, which is used in notifications (if present).
	 * @param isExisting If the document/embeddedDocument was an existing one (either skipped or updated)
	 * @param document The document.
	 * @param actor The actor this document was imported to, if this document was imported to an actor.
	 * @param embeddedDocument The embedded document, if this was document was imported to an actor.
	 * @param pack The pack this document was imported to, if this document was imported to a pack.
	 */
	constructor (
		{
			name = null,
			isExisting = false,
			document = null,
			actor = null,
			embeddedDocument = null,
			pack = null,
		},
	) {
		if (document && embeddedDocument) throw new Error(`Only one of "document" and "embeddedDocument" may be specified!`);
		if (actor && pack) throw new Error(`Only one of "actor" and "pack" may be specified!`);

		this.name = name;
		this.isExisting = isExisting;
		this.document = document;
		this.actor = actor;
		this.embeddedDocument = embeddedDocument;
		this.pack = pack;
	}
}

class ImportCustomizer extends Application {
	constructor (dataList, resolve, {title, template, titleSearch, isActor}) {
		super({
			title,
			template,
			width: 960,
			height: Util.getMaxWindowHeight(),
			resizable: true,
		});

		this._dataList = dataList;
		this._resolve = resolve;

		this._titleSearch = titleSearch;
		this._isActor = isActor;

		this._list = null;
		this._$btnReset = null;
	}

	getData () {
		return {
			titleSearch: this._titleSearch,
			isActor: this._isActor,
		};
	}

	activateListeners ($html) {
		super.activateListeners($html);

		this._activateListeners_initList({$html});

		const $wrpBtnsSort = $html.find(`[data-name="wrp-btns-sort"]`);
		SortUtil.initBtnSortHandlers($wrpBtnsSort, this._list);

		this._activateListeners_bindControls({$html, $wrpBtnsSort});

		// Reset list to initial state
		if (this._$btnReset) this._$btnReset.click();
	}

	_activateListeners_initList ({$html}) { throw new Error(`Unimplemented`); }
	_activateListeners_bindControls ({$html, $wrpBtnsSort}) { throw new Error(`Unimplemented`); }

	async close () {
		this._resolve(null);
		return super.close();
	}
}

export {ImportList, MixinUserChooseImporter, ImportSummary, ImportedDocument, ImportCustomizer};
