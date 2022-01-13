import {SharedConsts} from "../shared/SharedConsts.js";
import {Util} from "./Util.js";
import {Config} from "./Config.js";
import {Vetools} from "./Vetools.js";
import {AppFilter} from "./FilterApplications.js";
import {UtilDataSource} from "./UtilDataSource.js";

/**
 * Can either be used as a standalone application, or used to generate pre-wired elements to insert into other UI.
 */
class AppSourceSelectorMulti extends Application {
	/**
	 * @param opts
	 * @param opts.title
	 * @param opts.sourcesToDisplay
	 * @param opts.savedSelectionKey
	 * @param opts.filterNamespace
	 * @param [opts.props] Props to map the loaded data to.
	 * @param [opts.isRadio] If the source list should use radio boxes rather than checkboxes.
	 */
	constructor (opts) {
		super({
			title: opts.title || "Select Sources",
			width: 800,
			template: `${SharedConsts.MODULE_LOCATION}/template/AppSourceSelectorMulti.hbs`,
			height: Util.getMaxWindowHeight(),
			resizable: true,
		});

		this._sourcesToDisplay = opts.sourcesToDisplay;
		this._savedSelectionKey = opts.savedSelectionKey;
		this._filterNamespace = opts.filterNamespace;
		this._props = opts.props;
		this._isRadio = !!opts.isRadio;

		this._list = null;
		this._pageFilter = null;

		this._$stgNone = null;
		this._$stgUpload = null;
		this._$stgUrl = null;
		this._$stgSpecial = null;

		this._comp = BaseComponent.fromObject({
			uploadedFileMetas: [],

			isShowCustomUrlForm: false,
			urlMetas: [],

			specialMetas: [],
		});

		// region Used in standalone app mode
		this._resolve = null;
		this._reject = null;
		this._pUserInput = null;
		// endregion
	}

	get pageFilter () { return this._pageFilter; }
	get uploadedFiles () { return this._comp._state.uploadedFileMetas.map(it => it.data.contents); }
	pGetSelectedSources () {
		if (!this._list) return this._pGetInitialSources();
		return this._list.items.filter(it => it.data.cbSel.checked).map(li => this._sourcesToDisplay[li.ix]);
	}

	async pGetElements ($wrpList, cbSourceChange) {
		return this._pGetElements_pGetListElements($wrpList, cbSourceChange);
	}

	_$getStageNone () {
		return $(`<div class="ve-flex-col mb-1 w-100">
			<div class="ve-flex-v-center"><i>Select a source to view import options</i></div>
			<hr class="hr-1">
		</div>`);
	}

	/**
	 * This assumes that, at most, a single "file upload" source is present in the list.
	 */
	_$getStageUpload () {
		const $btnAddUpload = $(`<button class="btn btn-5et btn-default btn-xs">Add File</button>`)
			.click(() => {
				const nxt = {
					id: CryptUtil.uid(),
					data: {
						name: null,
						contents: null,
					},
				};
				this._comp._state.uploadedFileMetas = [...this._comp._state.uploadedFileMetas, nxt];

				// Click the upload button on the newest one, to immediately allow a file to be loaded
				const renderedCollection = this._comp._getRenderedCollection({prop: "uploadedFileMetas"});
				const renderedMeta = renderedCollection[nxt.id];
				renderedMeta.$btnUpload.click();
			});

		const $wrpUploadRows = $(`<div class="ve-flex-col w-100"></div>`);

		const $stgUpload = $$`<div class="ve-flex-col w-100 py-1">
			<div class="mb-1 split-v-center">
				<div>File Sources:</div>
				${$btnAddUpload}
			</div>
			${$wrpUploadRows}
			<hr class="hr-1">
		</div>`;

		const hkUploadFileMetas = () => {
			this._comp._renderCollection({
				prop: "uploadedFileMetas",
				fnUpdateExisting: (renderedMeta, uploadFileMeta) => {
					renderedMeta.comp._proxyAssignSimple("state", uploadFileMeta.data, true);
					if (!renderedMeta.$wrpRow.parent().is($wrpUploadRows)) renderedMeta.$wrpRow.appendTo($wrpUploadRows);
				},
				fnGetNew: uploadFileMeta => {
					const comp = BaseComponent.fromObject(uploadFileMeta.data, "*");
					comp._addHookAll("state", () => {
						uploadFileMeta.data = comp.toObject("*");
						this._comp._triggerCollectionUpdate("uploadedFileMetas");
					});

					const $dispName = $(`<div class="imp__disp-filename mr-1 ve-muted w-100"></div>`)
						.click(() => $btnUpload.click());
					const hkName = () => $dispName.text(comp._state.name || "Select file...").title(comp._state.name || "");
					comp._addHookBase("name", hkName);
					hkName();

					const $btnUpload = $(`<button class="btn btn-5et btn-xs mr-1">Upload File</button>`)
						.click(() => {
							const $ipt = $(`<input type="file" accept=".json" class="ve-hidden">`)
								.change(evt => {
									const input = evt.target;
									const files = $ipt[0].files;

									const reader = new FileReader();
									reader.onload = async () => {
										const file = (files[0] || {});

										try {
											const json = JSON.parse(reader.result);
											Vetools.addToHomebrewSourceLookup(json);
											await Vetools.pAddToHomebrew(json);
											const fileData = await DataUtil.pDoMetaMerge(CryptUtil.uid(), json);
											comp._proxyAssignSimple("state", {name: file.name, contents: fileData});
										} catch (e) {
											ui.notifications.error(`Failed to read file! ${VeCt.STR_SEE_CONSOLE}`);
											throw e;
										}
									};
									reader.readAsText(input.files[0]);
								})
								.click();
						});

					const $btnDelete = $(`<button class="btn btn-5et btn-xs btn-danger" title="Delete"><span class="glyphicon glyphicon-trash"></span></button>`)
						.click(() => this._comp._state.uploadedFileMetas = this._comp._state.uploadedFileMetas.filter(it => it !== uploadFileMeta));

					const $wrpRow = $$`<div class="ve-flex-v-center my-1 w-100">
						${$btnUpload}${$dispName}${$btnDelete}
					</div>`.appendTo($wrpUploadRows);

					return {
						comp,
						$wrpRow,
						$btnUpload,
					};
				},
			});
		};
		hkUploadFileMetas();
		this._comp._addHookBase("uploadedFileMetas", hkUploadFileMetas);

		return $stgUpload;
	}

	_$getStageUrl () {
		const $btnAddUrl = $(`<button class="btn btn-5et btn-default btn-xs">Add Custom</button>`)
			.click(() => {
				const nxt = {
					id: CryptUtil.uid(),
					data: {
						displayName: "Custom Url",
						isCustom: true,
						url: null,
					},
				};

				this._comp._state.urlMetas = [
					...this._comp._state.urlMetas,
					nxt,
				];

				// Focus the new URL input
				const renderedCollection = this._comp._getRenderedCollection({prop: "urlMetas"});
				const renderedMeta = renderedCollection[nxt.id];
				renderedMeta.$iptUrl.focus();
			});
		const hkIsCustomUrls = () => $btnAddUrl.toggleVe(this._comp._state.isShowCustomUrlForm);
		this._comp._addHookBase("isShowCustomUrlForm", hkIsCustomUrls);
		hkIsCustomUrls();

		const $wrpUrlRows = $(`<div class="ve-flex-col w-100"></div>`);

		const $stgUrl = $$`<div class="ve-flex-col w-100 py-1">
			<div class="mb-1 split-v-center">
				<div>URL Sources:</div>
				${$btnAddUrl}
			</div>
			${$wrpUrlRows}
			<hr class="hr-1">
		</div>`;

		const hkUrlMetas = () => {
			this._comp._renderCollection({
				prop: "urlMetas",
				fnUpdateExisting: (renderedMeta, urlMeta) => {
					renderedMeta.comp._proxyAssignSimple("state", urlMeta.data, true);
					if (!renderedMeta.$wrpRow.parent().is($wrpUrlRows)) renderedMeta.$wrpRow.appendTo($wrpUrlRows);
				},
				fnGetNew: urlMeta => {
					const comp = BaseComponent.fromObject(urlMeta.data, "*");
					comp._addHookAll("state", () => {
						urlMeta.data = comp.toObject("*");
						this._comp._triggerCollectionUpdate("urlMetas");
					});

					const $iptUrl = ComponentUiUtil.$getIptStr(comp, "url");
					if (Config.get("ui", "isStreamerMode")) $iptUrl.addClass("text-sneaky");
					const hkDisplayNameUrl = () => {
						if (comp._state.isCustom) {
							$iptUrl.title("Enter JSON URL").placeholder("Enter JSON URL").val(comp._state.url);
						} else {
							$iptUrl.title("JSON URL").val(comp._state.displayName).disable();
						}
					};
					this._comp._addHookBase("url", hkDisplayNameUrl);
					this._comp._addHookBase("displayName", hkDisplayNameUrl);
					hkDisplayNameUrl();

					const $btnDelete = !comp._state.isCustom ? null : $(`<button class="btn btn-5et btn-xs btn-danger ml-2" title="Delete"><span class="glyphicon glyphicon-trash"></span></button>`)
						.click(() => this._comp._state.urlMetas = this._comp._state.urlMetas.filter(it => it !== urlMeta));

					const $wrpRow = $$`<div class="ve-flex-v-center my-1 w-100">
						${$iptUrl}${$btnDelete}
					</div>`.appendTo($wrpUrlRows);

					return {
						comp,
						$wrpRow,
						$iptUrl,
					};
				},
			});
		};
		hkUrlMetas();
		this._comp._addHookBase("urlMetas", hkUrlMetas);

		return $stgUrl;
	}

	_$getStageSpecial () {
		const $wrpSpecialRows = $(`<div class="ve-flex-col w-100"></div>`);

		const $stgSpecial = $$`<div class="ve-flex-col w-100 py-1">
			<div class="mb-1 ve-flex-v-center">
				<div>Pre-Compiled Sources:</div>
			</div>
			${$wrpSpecialRows}
			<hr class="hr-1">
		</div>`;

		const hkSpecialMetas = () => {
			this._comp._renderCollection({
				prop: "specialMetas",
				fnUpdateExisting: (renderedMeta, specialMeta) => {
					renderedMeta.comp._proxyAssignSimple("state", specialMeta.data, true);
					if (!renderedMeta.$wrpRow.parent().is($wrpSpecialRows)) renderedMeta.$wrpRow.appendTo($wrpSpecialRows);
				},
				fnGetNew: specialMetas => {
					const comp = BaseComponent.fromObject(specialMetas.data, "*");
					comp._addHookAll("state", () => {
						specialMetas.data = comp.toObject("*");
						this._comp._triggerCollectionUpdate("urlMetas");
					});

					const $dispName = $(`<div class="w-100 italic ${Config.get("ui", "isStreamerMode") ? "text-sneaky" : ""}"></div>`);
					const hkDisplayName = () => $dispName.text(comp._state.displayName);
					this._comp._addHookBase("displayName", hkDisplayName);
					hkDisplayName();

					const $wrpRow = $$`<div class="ve-flex-v-center my-1 w-100">${$dispName}</div>`
						.appendTo($wrpSpecialRows);

					return {
						comp,
						$wrpRow,
					};
				},
			});
		};
		hkSpecialMetas();
		this._comp._addHookBase("specialMetas", hkSpecialMetas);

		return $stgSpecial;
	}

	async _pGetInitialSources () {
		const initialSourceIds = new Set((await StorageUtil.pGet(this._savedSelectionKey)) || []);
		const initialSources = this._sourcesToDisplay.filter(it => initialSourceIds.has(it.identifier));
		if (!initialSources.length) initialSources.push(...this._sourcesToDisplay.filter(it => it.isDefault));
		return initialSources;
	}

	async _pGetElements_pGetListElements ($wrpList, cbSourceChange = null) {
		this._$stgNone = this._$getStageNone();
		this._$stgUpload = this._$getStageUpload();
		this._$stgUrl = this._$getStageUrl();
		this._$stgSpecial = this._$getStageSpecial();

		const initialSources = await this._pGetInitialSources();

		const setSources = ({isSkipSave} = {}) => {
			const selSources = this._list.items.filter(it => it.data.cbSel.checked).map(li => this._sourcesToDisplay[li.ix]);

			const selSourceIdentifiers = selSources.map(source => source.identifier);
			if (!isSkipSave) StorageUtil.pSet(this._savedSelectionKey, selSourceIdentifiers);

			const isShowStageUpload = selSources.some(it => it.isFile);
			const isShowStageUrl = selSources.some(it => it.url != null);
			const isShowStageSpecial = selSources.some(it => it.url == null && !it.isFile);

			this._$stgNone.toggleVe(!isShowStageUpload && !isShowStageUrl && !isShowStageSpecial);
			this._$stgUpload.toggleVe(isShowStageUpload);
			this._$stgUrl.toggleVe(isShowStageUrl);
			this._$stgSpecial.toggleVe(isShowStageSpecial);

			// region Convert list state to component state
			if (isShowStageUrl) {
				this._comp._state.isShowCustomUrlForm = selSources.some(it => it.url === "");

				const customUrlMetas = this._comp._state.isShowCustomUrlForm
					? this._comp._state.urlMetas.filter(it => it.data.isCustom)
					: [];

				this._comp._state.urlMetas = [
					...selSources.filter(it => it.url).map(it => ({id: it.url, data: {isCustom: false, displayName: it.url}})),
					...customUrlMetas,
				];
			} else {
				this._comp._state.urlMetas = [];
			}

			if (isShowStageSpecial) {
				this._comp._state.specialMetas = [
					...selSources.filter(it => it.url == null && !it.isFile).map(it => ({id: it.cacheKey, data: {displayName: it.name}})),
				];
			} else {
				this._comp._state.specialMetas = [];
			}
			// endregion

			// Run any source-change callbacks
			if (cbSourceChange) cbSourceChange(selSources);
		};

		if (this._pageFilter) this._pageFilter.teardown();
		this._pageFilter = new AppSourceSelectorMulti.AppSourceSelectorAppFilter();

		const $btnOpenFilter = $(`<button class="btn-5et veapp__btn-filter">Filter</button>`);
		const $btnToggleSummaryHidden = $(`<button class="btn btn-5et" title="Toggle Filter Summary Display"><span class="glyphicon glyphicon-resize-small"></span></button>`);
		const $iptSearch = $(`<input type="search" class="search w-100 form-control" placeholder="Find source...">`);
		const $btnReset = $(`<button class="btn-5et veapp__btn-list-reset">Reset</button>`)
			.click(() => $iptSearch.val(""));
		const $wrpMiniPills = $(`<div class="fltr__mini-view btn-group"></div>`);

		const $cbAll = this._isRadio ? null : $(`<input type="checkbox" class="no-events">`);
		const $lblCbAll = $$`<label class="btn btn-5et btn-xs col-0-5 ve-flex-vh-center" ${this._isRadio ? "disabled" : ""}>${$cbAll}</label>`;

		const $wrpBtnsSort = $$`<div class="ve-flex-v-stretch input-group input-group--bottom mb-1 no-shrink">
			${$lblCbAll}
			<button class="btn-5et btn-xs col-11-5 sort" data-sort="name">Name</button>
		</div>`;
		const $list = $(`<div class="veapp__list mb-1 h-100 min-h-0"></div>`);
		$$($wrpList)`
			<div class="ve-flex-v-stretch input-group input-group--top no-shrink">
				${$btnOpenFilter}
				${$btnToggleSummaryHidden}
				${$iptSearch}
				${$btnReset}
			</div>
			${$wrpMiniPills}
			${$wrpBtnsSort}
			${$list}
		`;

		this._list = new List({
			$iptSearch,
			$wrpList: $list,
			fnSort: this.constructor._sortListItems,
		});
		SortUtil.initBtnSortHandlers($wrpBtnsSort, this._list);
		if (!this._isRadio) {
			ListUiUtil.bindSelectAllCheckbox($cbAll, this._list);
			$cbAll.change(() => setSources());
		}

		await this._pageFilter.pInitFilterBox({
			$iptSearch,
			$btnReset,
			$btnOpen: $btnOpenFilter,
			$btnToggleSummaryHidden,
			$wrpMiniPills,
			namespace: this._filterNamespace,
		});

		this._sourcesToDisplay.forEach((src, srcI) => {
			const isSelected = initialSources.includes(src);

			this._pageFilter.mutateAndAddToFilters(src);

			const eleLi = document.createElement("label");
			eleLi.className = `row imp-wiz__row veapp__list-row-hoverable ve-flex-v-center ${isSelected ? "list-multi-selected" : ""}`;

			const eleCb = this._isRadio
				? Util.htmlToNode(`<input type="radio" name="radio" class="no-events mx-1">`)
				: Util.htmlToNode(`<input type="checkbox" class="no-events mx-1">`);
			if (isSelected) eleCb.checked = true;

			const eleWrpCb = Util.htmlToNode(`<span class="col-0-5 ve-flex-vh-center"></span>`);
			eleWrpCb.append(eleCb);

			eleLi.append(eleWrpCb);
			eleLi.append(Util.htmlToNode(`<span class="col-11-5">${this.constructor._getFilterTypesIcon(src.filterTypes)}${src.name}</span>`));

			const listItem = new ListItem(
				srcI,
				eleLi,
				src.name,
				{
					filterTypes: src.filterTypes,
					abbreviations: src.abbreviations || [],
				},
				{
					cbSel: eleCb,
				},
			);

			eleLi.addEventListener("click", evt => {
				if (this._isRadio) ListUiUtil.handleSelectClickRadio(this._list, listItem, evt);
				else ListUiUtil.handleSelectClick(this._list, listItem, evt);
				setSources();
			});

			this._list.addItem(listItem);
		});

		setSources({isSkipSave: true});

		this._list.init();

		this._pageFilter.trimState();
		this._pageFilter.filterBox.render();

		this._pageFilter.filterBox.on(
			FilterBox.EVNT_VALCHANGE,
			this._handleFilterChange.bind(this),
		);

		this._handleFilterChange();

		return {
			$stgNone: this._$stgNone,
			$stgUpload: this._$stgUpload,
			$stgUrl: this._$stgUrl,
			$stgSpecial: this._$stgSpecial,

			$iptSearch,
		};
	}

	_handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(li => this._pageFilter.toDisplay(f, this._sourcesToDisplay[li.ix]));
	}

	static _sortListItems (a, b, o) {
		const ixTypeA = Math.min(...a.values.filterTypes.map(it => UtilDataSource.SOURCE_TYPE_ORDER.indexOf(it)));
		const ixTypeB = Math.min(...b.values.filterTypes.map(it => UtilDataSource.SOURCE_TYPE_ORDER.indexOf(it)));

		return SortUtil.ascSort(ixTypeA, ixTypeB) || SortUtil.compareListNames(a, b);
	}

	static _getFilterTypesIcon (filterTypes) {
		if (filterTypes.includes(UtilDataSource.SOURCE_TYP_OFFICIAL_ALL) || filterTypes.includes(UtilDataSource.SOURCE_TYP_OFFICIAL_SINGLE)) {
			return `<i class="fab fa-d-and-d mr-1 sourceAL" title="${UtilDataSource.SOURCE_TYP_OFFICIAL_BASE}"></i>`;
		}

		if (filterTypes.includes(UtilDataSource.SOURCE_TYP_ARCANA)) {
			return `<i class="fas fa-fw fa-vial mr-1 sourceSpicy" title="${UtilDataSource.SOURCE_TYP_ARCANA}"></i>`;
		}

		if (filterTypes.includes(UtilDataSource.SOURCE_TYP_BREW_LOCAL)) {
			return `<i class="fas fa-fw fa-beer mr-1 sourceHomebrew sourceHomebrew--local" title="${UtilDataSource.SOURCE_TYP_BREW_LOCAL}"></i>`;
		}

		if (filterTypes.includes(UtilDataSource.SOURCE_TYP_BREW)) {
			return `<i class="fas fa-fw fa-beer mr-1 sourceHomebrew" title="${UtilDataSource.SOURCE_TYP_BREW}"></i>`;
		}

		if (filterTypes.includes(UtilDataSource.SOURCE_TYP_CUSTOM)) {
			return `<i class="fas fa-fw fa-user ve-muted mr-1" title="${UtilDataSource.SOURCE_TYP_CUSTOM}"></i>`;
		}

		if (filterTypes.includes(UtilDataSource.SOURCE_TYP_UNKNOWN)) {
			return `<i class="fas fa-fw fa-question-circle ve-muted mr-1" title="${UtilDataSource.SOURCE_TYP_CUSTOM}"></i>`;
		}

		return "";
	}

	// region Standalone app
	activateListeners ($html) {
		(async () => {
			const $ovrLoading = $(`<div class="veapp-loading__wrp-outer"><i>Loading...</i></div>`)
				.appendTo($html.empty());

			const $wrpList = $(`<div class="ve-flex-col w-100 h-100 min-h-0"></div>`);

			const {$iptSearch} = await this.pGetElements($wrpList);

			$iptSearch.keydown(evt => {
				if (evt.key === "Enter") $btnAccept.click();
			});

			const $btnAccept = $(`<button class="mt-auto btn btn-5et">Confirm</button>`)
				.click(async () => {
					try {
						$ovrLoading.showVe();

						const sources = await this.pGetSelectedSources();
						if (!sources.length) {
							$ovrLoading.hideVe();
							return ui.notifications.error(`No sources selected!`);
						}

						if (sources.length > 10) {
							const isContinue = await InputUiUtil.pGetUserBoolean({
								title: `You have many sources selected, which may negatively impact performance. Do you want to continue?`,
								storageKey: "AppSourceSelectorMulti__massSelectionWarning",
								textYesRemember: "Continue and Remember",
								textYes: "Continue",
								textNo: "Cancel",
							});

							if (!isContinue) {
								$ovrLoading.hideVe();
								return;
							}
						}

						const out = await this._pGetOutputEntities(sources);

						if (!out.length) {
							$ovrLoading.hideVe();
							return ui.notifications.warn(`No sources to be loaded! Please finish entering source details first.`);
						}

						this._resolve(out);
						this.close();
					} catch (e) {
						$ovrLoading.hideVe();
						ui.notifications.error(`Failed to load sources! ${VeCt.STR_SEE_CONSOLE}`);
						throw e;
					}
				});

			$$($html)`
			${$wrpList}
			<hr class="hr-1">
			<div class="ve-flex-col w-100 overflow-y-auto pr-1 max-h-40 imp__disp-import-from no-shrink">
				<h3 class="mb-1">Import From</h3>
				${this._$stgNone}
				${this._$stgUpload}
				${this._$stgUrl}
				${this._$stgSpecial}
			</div>
			${$btnAccept}
			${$ovrLoading.hideVe()}`;

			$iptSearch.focus();
		})();
	}

	async _pGetOutputEntities (sources) {
		let out = [];
		for (const source of sources) {
			// Returns an array, as multiple files may be loaded
			if (source.isFile) out.push(...(await this._handleAccept_pGetFileOutputs(source)));
			// Returns an array, as multiple URLs may be specified for a "custom URL" source
			else if (source.url != null) out.push(...(await this._handleAccept_pGetUrlOutputs(source)));
			// Returns a single item
			else out.push(await this._handleAccept_pGetSpecialOutput(source));
		}

		// Flatten all the items into one continual array
		out = out.flat(2);

		return out;
	}

	getCustomUrls () {
		return this._comp._state.urlMetas
			.filter(it => it.data.isCustom && it.data.url && it.data.url.trim())
			.map(it => it.data.url.trim());
	}

	async _handleAccept_pGetFileOutputs (source) {
		const loadedMeta = await UtilDataSource.pGetFileOutputs(this, source, this._props);
		return loadedMeta.contents;
	}

	async _handleAccept_pGetUrlOutputs (source) {
		const loadedMeta = await UtilDataSource.pGetUrlOutputs(this, source, this._props);
		return loadedMeta.contents;
	}

	async _handleAccept_pGetSpecialOutput (source) {
		const loadedMeta = await UtilDataSource.pGetSpecialOutput(source, this._props);
		return loadedMeta.contents;
	}

	handlePreClose () {
		this._comp._detachCollection("urlMetas");
		this._comp._detachCollection("uploadedFileMetas");
		this._comp._detachCollection("specialMetas");
	}

	handlePostClose () {
		if (this._pageFilter) this._pageFilter.teardown();
	}

	async close (...args) {
		this.handlePreClose();
		await super.close(...args);
		this.handlePostClose();
	}

	pWaitForUserInput () {
		this._pUserInput = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
		return this._pUserInput;
	}
	// endregion

	/**
	 * Get an initial selection. If the user has used this UI before, load up the sources they selected last. Otherwise,
	 * load a default set.
	 */
	async pLoadInitialSelection () {
		const initialSources = await this._pGetInitialSources();
		return this._pGetOutputEntities(initialSources);
	}
}

AppSourceSelectorMulti.AppSourceSelectorAppFilter = class extends AppFilter {
	static _sortTypeFilterItems (a, b) {
		a = a.item;
		b = b.item;

		const ixA = UtilDataSource.SOURCE_TYPE_ORDER__FILTER.indexOf(a);
		const ixB = UtilDataSource.SOURCE_TYPE_ORDER__FILTER.indexOf(b);

		return SortUtil.ascSort(ixA, ixB);
	}

	constructor () {
		super();

		this._typeFilter = new Filter({
			header: "Type",
			itemSortFn: AppSourceSelectorMulti.AppSourceSelectorAppFilter._sortTypeFilterItems,
		});
	}

	static mutateForFilters () {
		// (Do nothing)
	}

	addToFilters (entity, isExcluded) {
		if (isExcluded) return;

		this._typeFilter.addItem(entity.filterTypes);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._typeFilter,
		];
	}

	toDisplay (values, ent) {
		return this._filterBox.toDisplay(
			values,
			ent.filterTypes,
		);
	}
};

export {AppSourceSelectorMulti};
