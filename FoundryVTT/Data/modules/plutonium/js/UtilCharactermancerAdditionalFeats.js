import {UtilApplications} from "./UtilApplications.js";
import {LGT} from "./Util.js";
import {Vetools} from "./Vetools.js";
import {AppSourceSelectorMulti} from "./AppSourceSelectorMulti.js";
import {ModalFilterFeatsFvtt} from "./UtilModalFilter.js";
import {Charactermancer_FeatureOptionsSelect, Charactermancer_Util} from "./UtilCharactermancer.js";
import {Charactermancer_Class_Util} from "./UtilCharactermancerClass.js";
import {DataConverterFeat} from "./DataConverterFeat.js";

class Charactermancer_AdditionalFeatsSelect extends BaseComponent {
	// region External
	static async pGetUserInput ({available, actor}) {
		if (!available?.length) return {isFormComplete: true, data: {}};

		if (UtilAdditionalFeats.isNoChoice(available)) {
			const comp = new this({available});
			return comp.pGetFormData();
		}

		const {ImportListFeat} = await import("./ImportListFeat.js");
		const ImportListFeatSources = await (new ImportListFeat()).pGetSources();
		const appSourceSelector = new AppSourceSelectorMulti({
			title: `Select Feat Sources`,
			filterNamespace: `Charactermancer_AdditionalFeatsSelect_filter`,
			savedSelectionKey: `Charactermancer_AdditionalFeatsSelect_savedSelection`,
			sourcesToDisplay: ImportListFeatSources,
		});

		appSourceSelector.render(true);
		const choices = await appSourceSelector.pWaitForUserInput();
		if (choices == null) return null; // Pass a "Cancel" back

		const featDatas = choices.map(it => it.feat || []).flat();

		const modalFilterFeats = await this._pGetUserInput_pGetModalFilterFeats({featDatas});
		const modalFilterSpells = await this._pGetUserInput_pGetModalFilterSpells({featDatas});

		const comp = new this({
			available,
			actor,
			featDatas: featDatas,
			modalFilterFeats,
			modalFilterSpells,
		});
		return UtilApplications.pGetImportCompApplicationFormData({
			comp,
			width: 800,
			height: 640,
		});
	}

	static async _pGetUserInput_pGetModalFilterFeats ({featDatas}) {
		const modalFilterFeats = new ModalFilterFeatsFvtt({
			namespace: "Charactermancer_AdditionalFeatsSelect.feats",
			isRadio: true,
			allData: featDatas,
		});
		await modalFilterFeats.pPreloadHidden();
		return modalFilterFeats;
	}

	/**
	 * This is unused during the "pGetUserInput" flow, so avoid loading spell data.
	 * N.B. if it _were_ to be used, spell data will need to be loaded from a source selector.
	 */
	static async _pGetUserInput_pGetModalFilterSpells () {
		return null;
		// const modalFilterSpells = new ModalFilterSpellsFvtt({
		// 	namespace: "Charactermancer_AdditionalFeatsSelect.spells",
		// 	isRadio: true,
		// 	allData: (await Vetools.pGetAllSpells()).spell,
		// });
		// await modalFilterSpells.pPreloadHidden();
		// return modalFilterSpells;
	}
	// endregion

	/**
	 * @param opts
	 * @param opts.available
	 * @param opts.actor
	 * @param opts.featDatas Array of all feat data.
	 * @param [opts.modalFilterFeats]
	 * @param [opts.modalFilterSpells]
	 * @param [opts.featureSourceTracker]
	 * @param [opts.isFeatureSelect] If this component should display a "feature selection" section for each feat.
	 */
	constructor (opts) {
		opts = opts || {};
		super();

		this._available = opts.available;
		this._actor = opts.actor;
		this._featDatas = opts.featDatas || [];
		this._modalFilterFeats = opts.modalFilterFeats;
		this._modalFilterSpells = opts.modalFilterSpells;
		this._featureSourceTracker = opts.featureSourceTracker;
		this._isFeatureSelect = !!opts.isFeatureSelect;

		this._featDatas.forEach(it => it._hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS]({name: it.name, source: it.source}));
		this._compsFeatFeatureOptionsSelect = {};
	}

	get modalTitle () { return `Feats`; }

	get cntAny () {
		const featSet = this._available[this._state.ixSet];
		return featSet?.any || 0;
	}

	get ixSetAvailable () { return this._state.ixSet; }

	addHookIxSet (hk) { this._addHookBase("ixSet", hk); }

	addHookPulseFeats (hk) {
		this._addHookBase("pulse_feats", hk);
	}

	setStateFromStatgenFeatList_ (featList) {
		const featListChoose = featList
			.filter(it => it == null || it.type === "choose");

		let offsetIx = 0; // Offset for any "holes" caused by statgen
		const nxtState = {};
		const ixsStatgen = [];
		featListChoose
			.forEach((featMeta, ixRaw) => {
				if (!featMeta) return offsetIx++;
				ixsStatgen.push(ixRaw);

				const ix = ixRaw - offsetIx;

				const {type, ix: ixFeatRaw} = featMeta;
				const {propIxFeat} = this._getProps({ix, type});

				nxtState[propIxFeat] = ixFeatRaw === -1 ? null : ixFeatRaw;
			});

		// Track the statgen ASI indexes we used (if any), so we can map back the other way later
		nxtState.readonly_ixsStatgen = ixsStatgen;
		this._proxyAssignSimple("state", nxtState);
	}

	_getProps ({ix, type}) {
		return {
			propPrefixFeat: `feat_${ix}_${type}_`,
			propIxFeat: `feat_${ix}_${type}_ixFeat`,
		};
	}

	_getLocks ({ix, type}) {
		return {
			lockChangeFeat: `feat_${ix}_${type}_pHkChangeFeat`,
			lockRenderFeatureOptionsSelects: `feat_${ix}_${type}_renderFeatureOptionsSelects`,
		};
	}

	render ($wrp) {
		const $wrpLeft = $(`<div class="ve-flex-col w-100 h-100 min-h-0 overflow-y-auto"></div>`);
		const $wrpRight = $(`<div class="ve-flex-col w-100 h-100 min-h-0 overflow-y-auto"></div>`);

		this.renderTwoColumn({$wrpLeft, $wrpRight});

		$$($wrp)`<div class="ve-flex w-100 h-100 min-h-0">
			${$wrpLeft}
			<div class="vr-3"></div>
			${$wrpRight}
		</div>
		`;
	}

	renderTwoColumn ({$wrpLeft, $wrpRight}) {
		this._render_$getStgSelGroup({$wrpLeft});
		const $stgGroupLeft = $$`<div class="ve-flex-col"></div>`.appendTo($wrpLeft);
		const $stgGroupRight = $$`<div class="ve-flex-col"></div>`.appendTo($wrpRight);

		const lastMetas = [];
		const boundHkIxSet = this._hk_ixSet.bind(this, {$stgGroupLeft, $stgGroupRight, lastMetas});
		this._addHookBase("ixSet", boundHkIxSet);
		boundHkIxSet();
	}

	_render_$getStgSelGroup ({$wrpLeft}) {
		if (this._available.length <= 1) return;

		const {$sel: $selGroup} = UtilAdditionalFeats.getSelIxSetMeta({
			comp: this,
			prop: "ixSet",
			available: this._available,
		});

		return $$`<div class="w-100 mb-2 ve-flex-v-center">
			<div class="mr-2 no-shrink bold">Feat Set:</div>
			${$selGroup}
		</div>`.appendTo($wrpLeft);
	}

	_hk_ixSet ({$stgGroupLeft, $stgGroupRight, lastMetas}) {
		$stgGroupLeft.empty();
		$stgGroupRight.empty();
		lastMetas.splice(0, lastMetas.length).forEach(it => it.cleanup());
		const featSet = this._available[this._state.ixSet];
		this._hk_ixSet_renderPts({$stgGroupLeft, $stgGroupRight, featSet, lastMetas});
		this._state.pulse_feats = !this._state.pulse_feats;
	}

	_hk_ixSet_renderPts ({$stgGroupLeft, $stgGroupRight, featSet, lastMetas}) {
		const hasStatic = Object.keys(featSet).some(it => it !== "any");
		const hasChoose = !!featSet.any;

		if (hasStatic) this._render_renderPtStatic({$stgGroupLeft, $stgGroupRight, featSet});
		if (hasStatic && hasChoose) $stgGroupLeft.append(`<hr class="hr-2 mt-0 hr--dotted">`);
		if (hasChoose) this._render_renderPtChooseFromFilter({$stgGroupLeft, $stgGroupRight, featSet, lastMetas});
		if (hasStatic || hasChoose) $stgGroupLeft.append(`<hr class="hr-2>`);
	}

	_render_renderPtStatic ({$stgGroupLeft, $stgGroupRight, featSet}) {
		const type = "static";
		const uidsStatic = UtilAdditionalFeats.getUidsStatic(featSet);

		const rowMetas = uidsStatic.map((uid, ix) => {
			// region Props and locks
			const {
				lockRenderFeatureOptionsSelects,
			} = this._getLocks({ix, type});
			// endregion

			const {name, source} = DataUtil.proxy.unpackUid("feat", uid, "feat");
			const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS]({name, source});
			const feat = this._featDatas.find(it => it._hash === hash);

			if (!feat) { // Tolerate missing feat data
				console.warn(...LGT, `Could not find feat "${hash}" in loaded feat data!`);
				return null;
			}

			const $stgFeatureOptions = this._isFeatureSelect ? $(`<div class="ve-flex-col w-100"></div>`) : null;

			const $rowLeft = $$`<div class="mb-2">
				<div class="ve-flex-v-center">
					<div class="bold mr-2 no-shrink">Feat:</div>
					${Renderer.get().render(`{@feat ${feat.name}|${feat.source}}`)}
				</div>
				${$stgFeatureOptions}
			</div>`;

			const $rowRight = $(`<div class="ve-flex-col w-100"></div>`);
			this._render_displayFeat({$wrp: $rowRight, feat});

			if (this._isFeatureSelect) {
				this._feat_pGetFilteredFeatures(feat)
					.then(async filteredFeatures => {
						await this._feat_pRenderFeatureOptionsSelects({ix, type, $stgFeatureOptions, filteredFeatures, lockRenderFeatureOptionsSelects});
					});
			}

			return {
				$rowLeft,
				$rowRight,
			};
		}).filter(Boolean);

		$$`<div class="ve-flex-col w-100">
			${rowMetas.map(it => it.$rowLeft)}
		</div>`.appendTo($stgGroupLeft);

		$$`<div class="ve-flex-col w-100">
			${rowMetas.map(it => it.$rowRight)}
		</div>`.appendTo($stgGroupRight);
	}

	_render_displayFeat ({$wrp, feat}) {
		$wrp.empty();
		if (!feat) {
			$wrp.append(`<div class="ve-muted mb-2 italic ve-flex-vh-center">No feat selected.</div>`);
		} else {
			// TODO improve styling to match e.g. classes; spells
			// TODO make it collapsible
			$wrp.append(Vetools.withUnpatchedDiceRendering(() => Renderer.hover.$getHoverContent_stats(UrlUtil.PG_FEATS, feat)));
		}
		$wrp.append(`<hr class="hr-0">`);
	}

	/**
	 * Note: not actually implement as "from filter," currently, since this is only used for "any" (i.e., an "allow all" filter).
	 */
	_render_renderPtChooseFromFilter ({$stgGroupLeft, $stgGroupRight, featSet, lastMetas}) {
		const type = "choose";

		const rowMetas = [...new Array(featSet.any)].map((_, ix) => {
			// region Props and locks
			const {propIxFeat, propPrefixFeat} = this._getProps({ix, type});

			const {
				lockChangeFeat,
				lockRenderFeatureOptionsSelects,
			} = this._getLocks({ix, type});
			// endregion

			const {$sel: $selFeat, $btnFilter: $btnFilterForFeat, unhook} = Charactermancer_Util.getFilterSearchMeta({
				comp: this,
				prop: propIxFeat,
				data: this._featDatas,
				modalFilter: this._modalFilterFeats,
				title: "Feat",
			});
			lastMetas.push({cleanup: unhook});

			const $dispFeat = $(`<div class="ve-flex-col w-100"></div>`);

			const $stgFeatureOptions = this._isFeatureSelect ? $(`<div class="ve-flex-col w-100 mt-2"></div>`) : null;

			const $rowLeft = $$`<div class="ve-flex-col w-100">
				<div class="bold mb-2">Select a Feat</div>
				<div class="ve-flex-v-center btn-group w-100">${$btnFilterForFeat}${$selFeat}</div>
				${$stgFeatureOptions}
				<hr class="hr-1">
			</div>`;

			const _pHkChangeFeat = async () => {
				// On changing feat, reset other feat state
				const nxtState = Object.keys(this.__state).filter(it => it.startsWith(propPrefixFeat) && it !== propIxFeat).mergeMap(it => ({[it]: null}));
				this._proxyAssignSimple("state", nxtState);

				const feat = this._featDatas[this._state[propIxFeat]];

				this._render_displayFeat({$wrp: $dispFeat, feat});

				// region Render feature/etc. selects
				if (this._isFeatureSelect) {
					const filteredFeatures = await this._feat_pGetFilteredFeatures(feat);

					await this._feat_pRenderFeatureOptionsSelects({ix, type, $stgFeatureOptions, filteredFeatures, lockRenderFeatureOptionsSelects});
				}
				// endregion

				this._state.pulse_feats = !this._state.pulse_feats;
			};
			const pHkChangeFeat = async (isLaterRun) => {
				try {
					await this._pLock(lockChangeFeat);
					await _pHkChangeFeat(isLaterRun);
				} finally {
					this._unlock(lockChangeFeat);
				}
			};
			this._addHookBase(propIxFeat, pHkChangeFeat);
			lastMetas.push({cleanup: () => this._removeHookBase(propIxFeat, pHkChangeFeat)});

			_pHkChangeFeat();

			return {
				$rowLeft,
				$rowRight: $dispFeat,
			};
		});

		$$`<div class="ve-flex-col w-100">
			${rowMetas.map(it => it.$rowLeft)}
		</div>`.appendTo($stgGroupLeft);

		$$`<div class="ve-flex-col w-100">
			${rowMetas.map(it => it.$rowRight)}
		</div>`.appendTo($stgGroupRight);
	}

	// region Feature selection
	async _feat_pGetFilteredFeatures (feat) {
		if (!feat) return [];

		const feature = await DataConverterFeat.pGetInitFeatFeatureLoadeds(feat);

		return Charactermancer_Util.getFilteredFeatures(
			[feature],
			this._modalFilterFeats.pageFilter,
			this._modalFilterFeats.pageFilter.filterBox.getValues(),
		);
	}

	async _feat_pRenderFeatureOptionsSelects (opts) {
		const {lockRenderFeatureOptionsSelects} = opts;

		try {
			await this._pLock(lockRenderFeatureOptionsSelects);
			return this._feat_pRenderFeatureOptionsSelects_(opts);
		} finally {
			this._unlock(lockRenderFeatureOptionsSelects);
		}
	}

	async _feat_pRenderFeatureOptionsSelects_ ({ix, type, filteredFeatures, $stgFeatureOptions}) {
		const prevCompsFeatures = this._compsFeatFeatureOptionsSelect[type]?.[ix] || [];

		$stgFeatureOptions.empty();

		const existingFeatureChecker = new Charactermancer_Class_Util.ExistingFeatureChecker(this._actor);

		const importableFeatures = Charactermancer_Util.getImportableFeatures(filteredFeatures);
		const cpyImportableFeatures = MiscUtil.copy(importableFeatures);
		Charactermancer_Util.doApplyFilterToFeatureEntries(
			cpyImportableFeatures,
			this._modalFilterFeats.pageFilter,
			this._modalFilterFeats.pageFilter.filterBox.getValues(),
		);
		const importableFeaturesGrouped = Charactermancer_Util.getFeaturesGroupedByOptionsSet(cpyImportableFeatures);

		this._feat_unregisterFeatureSourceTrackingFeatureComps(ix, type);

		for (const topLevelFeatureMeta of importableFeaturesGrouped) {
			const {topLevelFeature, optionsSets} = topLevelFeatureMeta;

			for (const optionsSet of optionsSets) {
				const compFeatureOptionsSelect = new Charactermancer_FeatureOptionsSelect({
					featureSourceTracker: this._featureSourceTracker,
					existingFeatureChecker,
					actor: this._actor,
					optionsSet,
					level: topLevelFeature.level,
					modalFilterSpells: this._modalFilterSpells,
					isSkipRenderingFirstFeatureTitle: true,
				});
				const tgt = MiscUtil.getOrSet(this._compsFeatFeatureOptionsSelect, type, ix, []);
				tgt.push(compFeatureOptionsSelect);
				compFeatureOptionsSelect.findAndCopyStateFrom(prevCompsFeatures);
			}
		}

		await this._feat_pRenderFeatureComps(ix, type, {$stgFeatureOptions});
	}

	_feat_unregisterFeatureSourceTrackingFeatureComps (ix, type) {
		(this._compsFeatFeatureOptionsSelect[type]?.[ix] || []).forEach(comp => comp.unregisterFeatureSourceTracking());
		delete this._compsFeatFeatureOptionsSelect[type]?.[ix];
	}

	async _feat_pRenderFeatureComps (ix, type, {$stgFeatureOptions}) {
		for (const compFeatureOptionsSelect of (this._compsFeatFeatureOptionsSelect[type]?.[ix] || [])) {
			if (await compFeatureOptionsSelect.pIsNoChoice() && !(await compFeatureOptionsSelect.pIsForceDisplay())) continue;

			$stgFeatureOptions
				.showVe()
				.append(`${compFeatureOptionsSelect.modalTitle ? `<hr class="hr-2"><div class="mb-2 bold w-100">${compFeatureOptionsSelect.modalTitle}</div>` : ""}`);
			compFeatureOptionsSelect.render($stgFeatureOptions);
		}
	}
	// endregion

	/**
	 * NOTE: this should not rely on `this._featDatas`, as this is not guaranteed to be available.
	 */
	async pGetFormData () {
		const out = [];

		const ptrIsComplete = {_: true};

		const featSet = this._available[this._state.ixSet];
		await this._pGetFormData_static({out, featSet, ptrIsComplete});
		await this._pGetFormData_choose({out, featSet, ptrIsComplete});

		return {
			isFormComplete: ptrIsComplete._,
			data: out,
			ixsStatgen: this._state.readonly_ixsStatgen ? MiscUtil.copy(this._state.readonly_ixsStatgen) : null,
		};
	}

	async _pGetFormData_static ({out, featSet, ptrIsComplete}) {
		const uidsStatic = UtilAdditionalFeats.getUidsStatic(featSet);
		if (!uidsStatic?.length) return;

		const type = "static";

		for (let ix = 0; ix < uidsStatic.length; ++ix) {
			const outItem = this._getFormData_static_ix({uidsStatic, ix});
			if (outItem) out.push(outItem);

			if (!this._isFeatureSelect || !outItem) continue;

			const formDatasFeatureOptionsSelect = await (this._compsFeatFeatureOptionsSelect[type]?.[ix] || [])
				.filter(Boolean)
				.pSerialAwaitMap(it => it.pGetFormData());

			if (formDatasFeatureOptionsSelect.some(it => !it.isFormComplete)) ptrIsComplete._ = false;

			outItem.formDatasFeatureOptionsSelect = formDatasFeatureOptionsSelect;
		}
	}

	async _pGetFormData_choose ({out, featSet, ptrIsComplete}) {
		if (!featSet.any) return;

		const type = "choose";

		for (let ix = 0; ix < featSet.any; ++ix) {
			const outItem = this._getFormData_choose_ix({ix, ptrIsComplete});
			if (outItem) out.push(outItem);

			if (!this._isFeatureSelect || !outItem) continue;

			const formDatasFeatureOptionsSelect = await (this._compsFeatFeatureOptionsSelect[type]?.[ix] || [])
				.filter(Boolean)
				.pSerialAwaitMap(it => it.pGetFormData());

			if (formDatasFeatureOptionsSelect.some(it => !it.isFormComplete)) ptrIsComplete._ = false;

			outItem.formDatasFeatureOptionsSelect = formDatasFeatureOptionsSelect;
		}
	}

	/**
	 * NOTE: this should not rely on `this._featDatas`, as this is not guaranteed to be available.
	 */
	getFormDataReduced () {
		const out = [];

		const ptrIsComplete = {_: true};

		const featSet = this._available[this._state.ixSet];
		this._getFormDataReduced_static({out, featSet});
		this._getFormDataReduced_choose({out, featSet, ptrIsComplete});

		return {
			isFormComplete: ptrIsComplete._,
			data: out,
			ixsStatgen: this._state.readonly_ixsStatgen ? MiscUtil.copy(this._state.readonly_ixsStatgen) : null,
		};
	}

	_getFormDataReduced_static ({out, featSet}) {
		const uidsStatic = UtilAdditionalFeats.getUidsStatic(featSet);
		if (!uidsStatic?.length) return;

		for (let ix = 0; ix < uidsStatic.length; ++ix) {
			const outItem = this._getFormData_static_ix({uidsStatic, ix});
			if (outItem) out.push(outItem);
		}
	}

	_getFormDataReduced_choose ({out, featSet, ptrIsComplete}) {
		if (!featSet.any) return;

		for (let ix = 0; ix < featSet.any; ++ix) {
			const outItem = this._getFormData_choose_ix({ix, ptrIsComplete});
			if (outItem) out.push(outItem);
		}
	}

	_getFormData_static_ix ({uidsStatic, ix}) {
		const uid = uidsStatic[ix];

		const {name, source} = DataUtil.proxy.unpackUid("feat", uid, "feat");
		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS]({name, source});
		const ixFeat = this._featDatas.findIndex(it => it._hash === hash);
		const feat = this._featDatas[ixFeat];

		return {
			page: UrlUtil.PG_FEATS,
			source,
			hash,
			feat: MiscUtil.copy(feat, true),
			ixFeat,
			type: "static",
			ix,
		};
	}

	_getFormData_choose_ix ({ix, ptrIsComplete}) {
		const {propIxFeat} = this._getProps({ix, type: "choose"});
		const ixFeat = this._state[propIxFeat];
		if (ixFeat == null || !~ixFeat) {
			ptrIsComplete._ = false;
			return;
		}

		const feat = this._featDatas[ixFeat];
		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS](feat);

		return {
			page: UrlUtil.PG_FEATS,
			source: feat.source,
			hash,
			feat: MiscUtil.copy(feat, true),
			ixFeat,
			type: "choose",
			ix,
		};
	}

	_getDefaultState () {
		return {
			ixSet: 0,

			pulse_feats: false,
			readonly_ixsStatgen: null,
		};
	}
}

export {Charactermancer_AdditionalFeatsSelect};
