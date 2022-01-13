import {Vetools} from "./Vetools.js";
import {LGT, Util} from "./Util.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class Charactermancer_Background_Characteristics extends BaseComponent {
	// region External
	static async pGetUserInput ({entries} = {}) {
		if (!entries || !entries.length) return {isFormComplete: true, data: {}};

		const comp = new this({entries});
		return UtilApplications.pGetImportCompApplicationFormData({
			comp,
			width: Util.getMaxWindowWidth(640),
			height: Util.getMaxWindowHeight(),
		});
	}

	static async pFillActorCharacteristicsData (entries, actUpdate, opts) {
		if (!entries || !entries.length) return;

		const formData = await this.pGetUserInput({entries});
		if (!formData) return opts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.applyFormDataToActorUpdate(actUpdate, formData);
	}

	static applyFormDataToActorUpdate (actUpdate, formData) {
		MiscUtil.getOrSet(actUpdate, "data", "details", {});
		Charactermancer_Background_Characteristics._PROP_METAS.forEach(propMeta => {
			actUpdate.data.details[Charactermancer_Background_Characteristics._PROP_TO_ACTOR_DETAILS_PROP[propMeta.prop]] = [...new Array(propMeta.count || 1)]
				.map((_, i) => {
					const {propValue} = this._getProps(propMeta.prop, i);
					if (!formData.data[propValue]) return null;
					return formData.data[propValue];
				})
				.filter(Boolean)
				.join("\n\n");
		});
	}
	// endregion

	/**
	 * @param opts
	 * @param opts.entries
	 * @param [opts.$wrpHeaderControls]
	 */
	constructor (opts) {
		opts = opts || {};
		super();
		this._tables = Charactermancer_Background_Characteristics._getCharacteristicTables(opts.entries);
		this._$wrpHeaderControls = opts.$wrpHeaderControls;

		// Set initial modes
		Object.assign(
			this.__state,
			Charactermancer_Background_Characteristics._PROP_METAS
				.mergeMap(propMeta => ({[Charactermancer_Background_Characteristics._getProps(propMeta.prop).propMode]: this._tables[propMeta.prop] != null ? "standard" : "custom"})),
		);
	}

	static _getProps (prop, ix) {
		return {
			propValue: `${prop}_${ix}_value`,
			propMode: `${prop}_mode`,
		};
	}

	static _getCpyTableCell (tbl, ixRow) {
		const cell = tbl.rows[ixRow]?.[1];
		if (!cell) {
			ui.notifications.error(`No cell found for row ${ixRow}!`);
			return null;
		}
		return Renderer.stripTags(MiscUtil.copy(cell));
	}

	get modalTitle () { return `Characteristics`; }

	render ($wrp) {
		const $wrpsProp = Charactermancer_Background_Characteristics._PROP_METAS.map((propMeta, ixPt) => {
			const count = propMeta.count || 1;
			const {propMode} = this.constructor._getProps(propMeta.prop);

			let $stgToggleMode;
			let $stgStandard;
			if (this._tables[propMeta.prop]) {
				const $btnToggleMode = $(`<button class="btn btn-default btn-xs" title="Show/Hide Table">View Table</button>`)
					.click(() => this._state[propMode] = this._state[propMode] === "custom" ? "standard" : "custom");

				$stgToggleMode = $$`<div class="ve-flex-v-center">
					${$btnToggleMode}
				</div>`;

				const tbl = this._tables[propMeta.prop];

				const $rendered = Vetools.withCustomDiceRenderingPatch(
					() => {
						const $rendered = $(`${Renderer.get().render(tbl)}`);
						$rendered.find(`[data-plut-temp-dice]`).each((i, e) => {
							const $e = $(e);

							const $btnsRoller = [...new Array(count)].map((_, i) => {
								return $(`<button class="btn btn-xs btn-default">Roll${count > 1 ? ` ${Parser.getOrdinalForm(i + 1)}` : ""}</button>`)
									.click(async () => {
										const {propValue} = this.constructor._getProps(propMeta.prop, i);

										let roll;
										try {
											roll = new Roll(Renderer.stripTags(tbl.colLabels[0]));
											await roll.evaluate();
											roll.toMessage();
										} catch (e) {
											return ui.notifications.error(`Failed to roll dice! ${VeCt.STR_SEE_CONSOLE}`);
										}

										const cell = tbl.rows[roll.total - 1]?.[1];
										if (!cell) return ui.notifications.error(`No result found for roll of ${roll.total}!`);

										this._state[propValue] = Renderer.stripTags(MiscUtil.copy(cell));
									});
							});

							const $wrpBtnsRoller = $$`<div class="ve-flex-vh-center btn-group">${$btnsRoller}</div>`;

							$e.replaceWith($wrpBtnsRoller);
						});

						$rendered.find(`[data-roll-min]`).each((i, e) => {
							const $e = $(e);
							const html = $e.html();
							$(`<div class="render-roller">${html}</div>`)
								.click(evt => {
									const {propValue} = this.constructor._getProps(propMeta.prop, evt.ctrlKey ? 1 : 0);
									this._state[propValue] = this.constructor._getCpyTableCell(tbl, i);
								})
								.title(count > 1 ? `Left-click to set the first field; CTRL-click to set the second field.` : null)
								.appendTo($e.empty());
						});

						return $rendered;
					},
					() => {
						// Always return a generic span, regardless of arguments; we will find and replace it later
						return `<span data-plut-temp-dice="true"></span>`;
					},
				);

				$stgStandard = $$`<div class="ve-flex-col w-100 ve-small">
					${$rendered}
				</div>`;

				const hkMode = () => {
					$btnToggleMode.toggleClass("active", this._state[propMode] === "standard");
					$stgStandard.toggleVe(this._state[propMode] === "standard");
				};
				this._addHookBase(propMode, hkMode);
				hkMode();
			}

			const $iptsText = [...new Array(count)]
				.map((_, i) => ComponentUiUtil.$getIptEntries(this, this.constructor._getProps(propMeta.prop, i).propValue).addClass("resize-vertical"));

			// Glue together pairs+ of input fields
			if (count !== 1) {
				const iptsText = $iptsText.map(it => it[0]);
				const resizeObserver = new ResizeObserver(entries => {
					if (entries.length !== 1) return; // avoid successive retry triggers
					const eleResized = entries[0].target;
					iptsText.filter(ipt => ipt !== eleResized).forEach(ipt => ipt.style.height = eleResized.style.height);
				});
				iptsText.forEach(ipt => resizeObserver.observe(ipt));
			}

			return $$`<div class="ve-flex-col ${ixPt < Charactermancer_Background_Characteristics._PROP_METAS.length - 1 ? `mb-2` : ""}">
				<div class="split-v-center mb-1">
					<div>${Charactermancer_Background_Characteristics._PROP_TO_FULL[propMeta.prop]}:</div>
					${$stgToggleMode}
				</div>

				${$stgStandard}

				<div class="ve-flex">${$iptsText}</div>
			</div>`;
		});

		const hasAnyTable = !!Object.keys(this._tables).length;
		let $btnToggleAllTables;
		if (hasAnyTable) {
			$btnToggleAllTables = $(`<button class="btn btn-default btn-xs">Hide Tables</button>`)
				.click(() => {
					const isDoHide = $btnToggleAllTables.text() === "Hide Tables";

					this._proxyAssignSimple(
						"state",
						Charactermancer_Background_Characteristics._PROP_METAS
							.mergeMap(propMeta => ({[Charactermancer_Background_Characteristics._getProps(propMeta.prop).propMode]: this._tables[propMeta.prop] != null && !isDoHide ? "standard" : "custom"})),
					);

					$btnToggleAllTables.text(isDoHide ? "Show Tables" : "Hide Tables");
				});

			// region Switch "show/hide all" button text on all tables being shown/hidden
			const hkAllHidden = () => {
				const allModes = Charactermancer_Background_Characteristics._PROP_METAS
					.filter(propMeta => this._tables[propMeta.prop])
					.map(propMeta => this._state[Charactermancer_Background_Characteristics._getProps(propMeta.prop).propMode] === "custom");

				if (allModes.every(Boolean)) $btnToggleAllTables.text("Show Tables");
				else if (allModes.every(it => !it)) $btnToggleAllTables.text("Hide Tables");
			};
			Charactermancer_Background_Characteristics._PROP_METAS
				.map(propMeta => Charactermancer_Background_Characteristics._getProps(propMeta.prop).propMode)
				.forEach(propMode => this._addHookBase(propMode, hkAllHidden));
			hkAllHidden();
			// endregion
		}

		let $stgHeaderControls;
		if (!this._$wrpHeaderControls && hasAnyTable) {
			$stgHeaderControls = $$`<div class="mb-2 ve-flex-h-right">${$btnToggleAllTables}</div>`;
		} else if (this._$wrpHeaderControls && hasAnyTable) {
			this._$wrpHeaderControls.append($btnToggleAllTables);
		}

		$$($wrp)`
			${$stgHeaderControls}
			${$wrpsProp}
		`;
	}

	pGetFormData () {
		const rendered = Charactermancer_Background_Characteristics._PROP_METAS
			.map(propMeta => [...new Array(propMeta.count || 1)].map((_, i) => this.constructor._getProps(propMeta.prop, i).propValue))
			.flat()
			.mergeMap(propValue => ({[propValue]: UiUtil.getEntriesAsText(this._state[propValue])}));

		return {
			isFormComplete: Object.values(rendered).every(txt => txt.trim()),
			data: rendered,
		};
	}

	_getDefaultState () {
		return Charactermancer_Background_Characteristics._PROP_METAS
			.map(propMeta => [...new Array(propMeta.count || 1)].map((_, i) => this.constructor._getProps(propMeta.prop, i).propValue))
			.flat()
			.mergeMap(propValue => ({[propValue]: ""}));
	}

	static _getCharacteristicTables (entries) {
		if (!entries) return {};

		const out = {};

		// Walk the entries, finding tables with appropriate captions
		UtilDataConverter.WALKER_READONLY_GENERIC.walk(
			entries,
			{
				object: (obj) => {
					if (
						obj.type !== "table"
						|| obj?.colLabels?.length !== 2
						|| Renderer.getAutoConvertedTableRollMode(obj) !== RollerUtil.ROLL_COL_STANDARD
					) return;

					const captionFlat = obj.colLabels[1].toLowerCase().replace(/\s+/g, "");
					const mCaption = /^(personalitytrait|ideal|bond|flaw)s?$/i.exec(captionFlat);
					if (!mCaption) return;

					out[captionFlat] = MiscUtil.copy(obj);
				},
			},
		);

		return out;
	}
}
Charactermancer_Background_Characteristics._PROP_METAS = [
	{prop: "personalitytrait", count: 2},
	{prop: "ideal"},
	{prop: "bond"},
	{prop: "flaw"},
];
Charactermancer_Background_Characteristics._PROP_TO_FULL = {
	"personalitytrait": "Personality Traits",
	"ideal": "Ideal",
	"bond": "Bond",
	"flaw": "Flaw",
};
Charactermancer_Background_Characteristics._PROP_TO_ACTOR_DETAILS_PROP = {
	"personalitytrait": "trait",
	"ideal": "ideal",
	"bond": "bond",
	"flaw": "flaw",
};

class Charactermancer_Background_Features extends BaseComponent {
	static async pGetUserInput ({background, modalFilter, ...opts} = {}) {
		const comp = new this({background, modalFilter});
		return UtilApplications.pGetImportCompApplicationFormData({
			comp,
			width: Util.getMaxWindowWidth(640),
			height: Util.getMaxWindowHeight(480),
			...opts,
		});
	}

	/**
	 * @param opts
	 * @param opts.background
	 * @param opts.modalFilter
	 */
	constructor (opts) {
		opts = opts || {};
		super();

		this._background = opts.background;

		this._modalFilter = opts.modalFilter;
	}

	static _getFeatureEntries (bg) {
		return (bg?.entries || [])
			.filter(it => it.data?.isFeature)
			.map(ent => {
				// Copy the entry, and remove the "Feature: " prefix if one exists
				const cpyEnt = MiscUtil.copy(ent);
				if (cpyEnt.name) cpyEnt.name.replace(/^.*?:\s*/, "");
				return cpyEnt;
			});
	}

	get modalTitle () { return `Customize Background: Features`; }

	get mode () { return this._state.mode; }

	get ixBackgroundOther () { return this._state.ixBackgroundOther; }

	addHookPulseFeatures (hk) { this._addHookBase("pulseFeatures", hk); }

	render ($wrp) {
		const $selMode = ComponentUiUtil.$getSelEnum(
			this,
			"mode",
			{
				values: [
					Charactermancer_Background_Features._MODE_DEFAULT,
					Charactermancer_Background_Features._MODE_OTHER_BACKGROUND,
					Charactermancer_Background_Features._MODE_MANUAL,
				],
				fnDisplay: v => Charactermancer_Background_Features._MODE_TO_FULL[v],
			},
		);
		this._addHookBase("mode", () => this._state.pulseFeatures = !this._state.pulseFeatures);

		const $btnAddManual = $(`<button class="btn btn-xs btn-5et ml-1"><span class="glyphicon glyphicon-plus"></span> Add Feature</button>`)
			.click(() => {
				const nxt = this._getDefaultState_manualEntryMeta();
				this._state.manualEntryMetas = [...this._state.manualEntryMetas, nxt];
			});
		const hkMode = () => $btnAddManual.toggleVe(this._state.mode === Charactermancer_Background_Features._MODE_MANUAL);
		this._addHookBase("mode", hkMode);
		hkMode();

		const $stgDefault = this._render_default();
		const $stgOther = this._render_other();
		const $stgManual = this._render_manual();

		$$($wrp)`
			<div class="ve-flex-v-center mb-1">
				${$selMode}
				${$btnAddManual}
			</div>
			${$stgDefault}
			${$stgOther}
			${$stgManual}
		`;
	}

	_render_default () {
		const $stg = $$`<div class="ve-flex-col mt-1">
			<div class="w-100">${Vetools.withUnpatchedDiceRendering(() => Renderer.get().render({type: "entries", entries: this.constructor._getFeatureEntries(this._background)}))}</div>
		</div>`;

		const hkMode = () => $stg.toggleVe(this._state.mode === Charactermancer_Background_Features._MODE_DEFAULT);
		this._addHookBase("mode", hkMode);
		hkMode();

		return $stg;
	}

	_getOtherBackground () { return this._modalFilter.allData[this._state.ixBackgroundOther]; }

	_render_other () {
		const $btnSelect = $(`<button class="btn btn-default btn-5et w-100 mr-2 mb-2">Choose Background</button>`)
			.click(async () => {
				const selecteds = await this._modalFilter.pGetUserSelection();
				if (selecteds == null || !selecteds.length) return;

				this._state.ixBackgroundOther = selecteds[0]?.ix;
			});

		const $dispOther = $(`<div class="w-100"></div>`);
		const hkOther = () => {
			const otherBackground = this._getOtherBackground();
			if (!otherBackground) {
				$dispOther.html(`<i class="ve-muted">Select an alternate background, whose feature(s) will replace your current background's feature(s).</i>`);
				return;
			}

			const otherBackgroundFeatureEntries = this.constructor._getFeatureEntries(otherBackground);
			$dispOther.html(Vetools.withUnpatchedDiceRendering(() => Renderer.get().render(otherBackgroundFeatureEntries?.length ? {type: "entries", entries: otherBackgroundFeatureEntries} : {type: "entries", entries: ["{@note (No feature(s)).}"]})));
			this._state.pulseFeatures = !this._state.pulseFeatures;
		};
		this._addHookBase("ixBackgroundOther", hkOther);
		hkOther();

		const $stg = $$`<div class="ve-flex-col mt-1">
			${$btnSelect}
			${$dispOther}
		</div>`;

		const hkMode = () => $stg.toggleVe(this._state.mode === Charactermancer_Background_Features._MODE_OTHER_BACKGROUND);
		this._addHookBase("mode", hkMode);
		hkMode();

		return $stg;
	}

	_render_manual () {
		const $dispNoRows = $(`<div class="italic text-center ve-muted my-1">No features.</div>`);
		const $wrpRows = $(`<div class="ve-flex-col"></div>`);

		const hkManualMetas = () => {
			this._renderCollection({
				prop: "manualEntryMetas",
				fnDeleteExisting: () => {
					this._state.pulseFeatures = !this._state.pulseFeatures;
				},
				fnUpdateExisting: (renderedMeta, featureMeta) => {
					renderedMeta.comp._proxyAssignSimple("state", featureMeta.data, true);
					this._state.pulseFeatures = !this._state.pulseFeatures;
				},
				fnGetNew: featureMeta => {
					const comp = BaseComponent.fromObject(featureMeta.data, "*");
					comp._addHookAll("state", () => {
						featureMeta.data = comp.toObject("*");
						this._triggerCollectionUpdate("manualEntryMetas");
					});

					const $iptName = ComponentUiUtil.$getIptStr(comp, "name");

					const $iptText = ComponentUiUtil.$getIptEntries(comp, "entries");

					const $btnDelete = $(`<button class="btn btn-5et btn-xs btn-danger ml-1" title="Delete"><span class="glyphicon glyphicon-trash"></span></button>`)
						.click(() => this._state.manualEntryMetas = this._state.manualEntryMetas.filter(it => it !== featureMeta));

					const $wrpRow = $$`<div class="ve-flex-col py-1 w-100 stripe-even">
						<div class="split-v-center mb-1">
							<label class="ve-flex-v-center w-100"><div class="mr-1 text-right pr-1 no-shrink w-50p">Name</div>${$iptName}</label>
							${$btnDelete}
						</div>
						<label class="ve-flex-v-center w-100"><div class="mr-1 text-right pr-1 no-shrink w-50p">Text</div>${$iptText}</label>
					</div>`.appendTo($wrpRows);

					return {
						comp,
						$wrpRow,
					};
				},
			});

			$dispNoRows.toggleVe(!this._state.manualEntryMetas?.length);
		};
		hkManualMetas();
		this._addHookBase("manualEntryMetas", hkManualMetas);

		const $stg = $$`<div class="ve-flex-col">
			<hr class="hr-1">
			${$dispNoRows}
			${$wrpRows}
		</div>`;

		const hkMode = () => $stg.toggleVe(this._state.mode === Charactermancer_Background_Features._MODE_MANUAL);
		this._addHookBase("mode", hkMode);
		hkMode();

		return $stg;
	}

	getFormData () {
		let isComplete = true;
		const entries = [];
		const background = MiscUtil.copy(this._background);

		const fromFeature = Object.entries(background.fromFeature || {}).filter(([, v]) => v).map(([k]) => k);

		switch (this._state.mode) {
			case Charactermancer_Background_Features._MODE_DEFAULT: {
				entries.push(...this.constructor._getFeatureEntries(this._background));
				break;
			}
			case Charactermancer_Background_Features._MODE_OTHER_BACKGROUND: {
				const otherBackground = this._getOtherBackground();

				if (!otherBackground) {
					isComplete = false;
					fromFeature.forEach(k => delete background[k]);
					break;
				}

				entries.push(...this.constructor._getFeatureEntries(otherBackground));

				this._getFormData_doMergeOtherBackground({background, otherBackground, fromFeature});

				break;
			}
			case Charactermancer_Background_Features._MODE_MANUAL: {
				const ents = this._state.manualEntryMetas
					.filter(({data}) => data.entries && data.entries.length)
					.map(({data}) => {
						data = MiscUtil.copy(data);
						data.name = data.name || "(Unnamed Feature)"; // Ensure a name, so as not to crash the sheet
						data.type = "entries";
						return data;
					});

				if (!ents.length) isComplete = false;

				entries.push(...ents);

				fromFeature.forEach(k => delete background[k]);

				break;
			}
		}

		return {
			isFormComplete: isComplete,
			data: {
				entries,
				isCustomize: this._state.mode !== Charactermancer_Background_Features._MODE_DEFAULT,
				background,
			},
		};
	}

	_getFormData_doMergeOtherBackground ({background, otherBackground, fromFeature}) {
		fromFeature.forEach(k => {
			if (!otherBackground[k]) return delete background[k];
			background[k] = MiscUtil.copy(otherBackground[k]);
		});

		const fromFeatureOtherBackground = Object.entries(otherBackground.fromFeature || {}).filter(([, v]) => v).map(([k]) => k);
		fromFeatureOtherBackground.forEach(prop => {
			if (!otherBackground[prop]) return; // Should never occur

			if (!background[prop]) {
				background[prop] = MiscUtil.copy(otherBackground[prop], true);
				return;
			}

			// If both the original background and the other background have this data, attempt to merge
			switch (prop) {
				default: {
					const typeA = typeof background[prop];
					const typeB = typeof otherBackground[prop];

					// If the types don't match, use the original
					if (
						typeA !== typeB
						|| (typeA === "object" && (Array.isArray(background[prop]) !== Array.isArray(otherBackground[prop])))
					) {
						return;
					}

					// If both are primitive types, use the original
					if (typeA !== "object") return;

					// Attempt to merge arrays
					if (Array.isArray(background[prop])) {
						this._getFormData_doMergeOtherBackground_array({background, otherBackground, prop});
						return;
					}

					// Attempt to merge objects
					this._getFormData_doMergeOtherBackground_object({background, otherBackground, prop});
				}
			}
		});
	}

	_getFormData_doMergeOtherBackground_array ({background, otherBackground, prop}) {
		switch (prop) {
			case "additionalSpells": {
				// For complex cases, bail out, and use the original
				if (background[prop].length !== 1 || background[prop].length !== otherBackground[prop].length) return;

				Object.entries(otherBackground[prop][0])
					.forEach(([addSpellK, addSpellV]) => {
						if (!["innate", "known", "prepared", "expanded"].includes(addSpellK)) {
							console.warn(...LGT, `Could not merge additionalSpell property "${addSpellK}"--no merge strategy defined!`);
							return;
						}

						if (!background[prop][0][addSpellK]) background[prop][0][addSpellK] = {};

						Object.entries(addSpellV)
							.forEach(([kLevel, spellList]) => {
								background[prop][0][addSpellK][kLevel] = background[prop][0][addSpellK][kLevel] || [];
								background[prop][0][addSpellK][kLevel].push(...spellList);
							});
					});

				break;
			}

			case "feats": {
				// For complex cases, bail out, and use the original
				if (background[prop].length !== 1 || background[prop].length !== otherBackground[prop].length) return;

				const out = {};
				// Convert `true` to `1`, as we only check for truthy values in true-false maps, but we count totals in e.g. `any`
				Object.entries(background[prop][0])
					.forEach(([k, v]) => out[k] = (out[k] || 0) + Number(v));
				Object.entries(otherBackground[prop][0])
					.forEach(([k, v]) => out[k] = (out[k] || 0) + Number(v));
				background[prop][0] = out;

				break;
			}

			default: {
				background[prop] = [...background[prop], ...otherBackground[prop]].unique();
			}
		}
	}

	_getFormData_doMergeOtherBackground_object ({background, otherBackground, prop}) {
		switch (prop) {
			default: Object.assign(background[prop], otherBackground[prop]);
		}
	}

	pGetFormData () { return this.getFormData(); }

	_getDefaultState_manualEntryMeta () {
		return {
			id: CryptUtil.uid(),
			data: {
				name: "",
				entries: [],
			},
		};
	}

	_getDefaultState () {
		return {
			mode: Charactermancer_Background_Features._MODE_DEFAULT,

			ixBackgroundOther: null,

			manualEntryMetas: [this._getDefaultState_manualEntryMeta()],

			pulseFeatures: false,
		};
	}
}
Charactermancer_Background_Features._MODE_DEFAULT = 0;
Charactermancer_Background_Features._MODE_OTHER_BACKGROUND = 1;
Charactermancer_Background_Features._MODE_MANUAL = 2;

Charactermancer_Background_Features._MODE_TO_FULL = {
	[Charactermancer_Background_Features._MODE_DEFAULT]: "Add Features from This Background",
	[Charactermancer_Background_Features._MODE_OTHER_BACKGROUND]: "Customize your Background: Add Feature(s) from Another Background",
	[Charactermancer_Background_Features._MODE_MANUAL]: "Customize your Background: Add Custom Feature(s)",
};

export {Charactermancer_Background_Characteristics, Charactermancer_Background_Features};
