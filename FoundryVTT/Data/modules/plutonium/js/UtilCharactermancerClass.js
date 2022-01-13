import {Config} from "./Config.js";
import {DataConverterClass} from "./DataConverterClass.js";
import {DataConverterClassSubclassFeature} from "./DataConverterClassSubclassFeature.js";
import {DataConverterOptionalfeature} from "./DataConverterOptionalfeature.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {UtilActors} from "./UtilActors.js";
import {Consts} from "./Consts.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilApplications} from "./UtilApplications.js";
import {DataConverterFeat} from "./DataConverterFeat.js";
import {DataConverterReward} from "./DataConverterReward.js";
import {DataConverterCharCreationOption} from "./DataConverterCharCreationOption.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

// TODO factor this out when `PageFilterClassesRaw` is factored out to e.g. features
class PageFilterClassesFoundry extends PageFilterClassesRaw {
	static async _pPreloadSideData () {
		return Promise.all([
			DataConverterClass.pPreloadSideData(),
			DataConverterClassSubclassFeature.pPreloadSideData(),
			DataConverterOptionalfeature.pPreloadSideData(),
			DataConverterFeat.pPreloadSideData(),
			DataConverterReward.pPreloadSideData(),
		]);
	}

	static async _pGetSideData (entity, type) {
		switch (type) {
			case "class":
			case "subclass": return DataConverterClass.pGetSideData(entity, type);

			case "classFeature":
			case "subclassFeature": return DataConverterClassSubclassFeature.pGetSideData(entity, type);

			case "optionalfeature": return DataConverterOptionalfeature.pGetSideData(entity);

			case "feat": return DataConverterFeat.pGetSideData(entity);

			case "reward": return DataConverterReward.pGetSideData(entity);

			case "charoption": return DataConverterCharCreationOption.pGetSideData(entity);

			default: throw new Error(`Unhandled type "${type}"`);
		}
	}

	static _handleReferenceError (msg) { console.error(...LGT, msg); ui.notifications.error(msg); }
}

class Charactermancer_Class_Util {
	static getAllFeatures (cls) {
		let allFeatures = [];
		const seenSubclassFeatureHashes = new Set();

		const gainSubclassFeatureLevels = cls.classFeatures
			.filter(it => it.gainSubclassFeature)
			.map(cf => cf.level ?? DataUtil.class.unpackUidClassFeature(cf.classFeature || cf).level);

		// Fill array with class features; add subclass features as appropriate
		cls.classFeatures.forEach(cf => {
			allFeatures.push(cf);

			if (cf.gainSubclassFeature) {
				const cfLevel = cf.level ?? DataUtil.class.unpackUidClassFeature(cf.classFeature || cf).level;
				const nxtCfLevel = gainSubclassFeatureLevels.includes(cfLevel) ? gainSubclassFeatureLevels[gainSubclassFeatureLevels.indexOf(cfLevel) + 1] : null;

				cls.subclasses.forEach(sc => {
					sc.subclassFeatures
						.filter(scf => {
							const scfHash = scf.hash ?? DataUtil.class.unpackUidSubclassFeature(scf.subclassFeature || scf).hash;
							const scfLevel = scf.level ?? DataUtil.class.unpackUidSubclassFeature(scf.subclassFeature || scf).level;

							if (seenSubclassFeatureHashes.has(scfHash)) return false;

							if (scf.isGainAtNextFeatureLevel) {
								// On first gaining a subclass feature, include anything that we gained access to at earlier levels
								if (cfLevel === gainSubclassFeatureLevels[0] && scfLevel <= cfLevel) {
									return true;
								}

								// Thereafter, only include subclass levels in the range of <this class feature> - <next class feature>
								//   (and that have not already been added)
								if (scfLevel <= cfLevel && (nxtCfLevel == null || scfLevel < nxtCfLevel)) {
									return true;
								}

								return false;
							}

							return scfLevel === cfLevel;
						})
						.forEach(scf => {
							const scfHash = scf.hash ?? DataUtil.class.unpackUidSubclassFeature(scf.subclassFeature || scf).hash;
							seenSubclassFeatureHashes.add(scfHash);

							// Fake e.g. Strixhaven subclass levels as being of the appropriate level
							scf.level = cfLevel;

							allFeatures.push(scf);
						});
				});
			}
		});

		return MiscUtil.copy(allFeatures);
	}

	static getFilteredEntries (entries, pageFilter, filterValues) {
		const isDisplayableEntry = (ent) => {
			if (!ent.source) return true;
			return pageFilter.sourceFilter.toDisplay(filterValues, ent.source);
		};

		const recursiveFilter = (entry) => {
			if (entry == null) return entry;
			if (typeof entry === "object") {
				if (entry instanceof Array) {
					entry = entry.filter(it => isDisplayableEntry(it));
					return entry.map(it => recursiveFilter(it));
				} else {
					Object.keys(entry).forEach(k => {
						if (entry[k] instanceof Array) {
							entry[k] = recursiveFilter(entry[k]);
							if (!entry[k].length) delete entry[k];
						} else entry[k] = recursiveFilter(entry[k]);
					});
					return entry;
				}
			} else return entry;
		};

		entries = MiscUtil.copy(entries);
		return recursiveFilter(entries);
	}

	// region Spells
	static getPreparableSpells (spells, cls, spellLevelLow, spellLevelHigh) {
		Renderer.spell.populateHomebrewLookup(BrewUtil.homebrew, {isForce: true});

		return spells.filter(it => {
			if (!(it.level > 0 // Avoid importing cantrips
				&& it.level >= spellLevelLow && it.level <= spellLevelHigh)) return false;

			Renderer.spell.initClasses(it);

			const fromClassList = Renderer.spell.getCombinedClasses(it, "fromClassList");
			return fromClassList.some(c => (c.name || "").toLowerCase() === cls.name.toLowerCase() && (c.source || SRC_PHB).toLowerCase() === cls.source.toLowerCase());
		});
	}
	// endregion

	static getCasterProgression (cls, sc, {targetLevel, otherExistingClassItems = null}) {
		otherExistingClassItems = otherExistingClassItems || [];

		const isSpellcastingMulticlass = [
			...otherExistingClassItems.filter(it => it.data?.data?.spellcasting && it.data?.data?.spellcasting !== "none"),
			cls.casterProgression != null || sc?.casterProgression != null,
		]
			.filter(Boolean)
			.length > 1;

		let {
			totalSpellcastingLevels,
			casterClassCount,
			maxPactCasterLevel,
		} = UtilActors.getActorSpellcastingInfo({
			sheetItems: otherExistingClassItems,
			isForceSpellcastingMulticlass: isSpellcastingMulticlass,
		});

		maxPactCasterLevel = Math.max(maxPactCasterLevel, targetLevel);

		// Allow the subclass to override these
		const casterProgression = sc?.casterProgression || cls.casterProgression;
		const spellAbility = sc?.spellcastingAbility || cls.spellcastingAbility;

		if (casterProgression) {
			// Multiclassing rules say use floor, but single-class half/third casters use ceil.
			//   Therefore, if this is our only caster class, use ceil.
			const fnRound = casterClassCount ? Math.floor : Math.ceil;
			switch (casterProgression) {
				case "full": totalSpellcastingLevels += targetLevel; break;
				case "1/2": totalSpellcastingLevels += fnRound(targetLevel / 2); break;
				case "1/3": totalSpellcastingLevels += fnRound(targetLevel / 3); break;
				// (Do nothing if unrecognized, as this can be e.g. pact magic)
			}
		}

		return {
			casterProgression,
			spellAbility,
			totalSpellcastingLevels,
			maxPactCasterLevel,
		};
	}

	static getMysticProgression ({cls = null, targetLevel = 0, otherExistingClassItems = null}) {
		otherExistingClassItems = otherExistingClassItems || [];

		let totalMysticLevels = 0;

		if (cls?.name === "Mystic" && cls?.source === SRC_UATMC) totalMysticLevels += targetLevel;

		if (otherExistingClassItems) {
			totalMysticLevels += otherExistingClassItems
				.filter(it => it.name.toLowerCase().trim() === "mystic")
				.map(it => it.data.levels)
				.sum();
		}

		return {
			totalMysticLevels,
		};
	}

	/**
	 * For each class with an optional feature progression, add faux features which allow us to choose from a type of
	 * optional features.
	 * @param classList A list of all classes, which have been run through the feature post-loader.
	 * @param optfeatList A list of all optionalfeature entities.
	 */
	static addFauxOptionalFeatureFeatures (classList, optfeatList) {
		for (const cls of classList) {
			if (!cls.classFeatures || !cls.optionalfeatureProgression?.length) continue;
			for (const optFeatProgression of cls.optionalfeatureProgression) {
				this._addFauxOptionalFeatureFeatures_handleClassProgression(optfeatList, cls, optFeatProgression);
			}
		}
	}

	static _addFauxOptionalFeatureFeatures_handleClassProgression (optfeatList, cls, optFeatProgression) {
		const fauxLoadeds = this._addFauxOptionalFeatureFeatures_getLoadeds(optfeatList, cls, optFeatProgression);

		let cntPrev = 0;
		optFeatProgression.progression.forEach((cntOptFeats, ixLvl) => {
			if (cntOptFeats === cntPrev) return;
			const cntDelta = cntOptFeats - cntPrev;
			if (!~cntDelta) return; // Should never occur

			const lvl = ixLvl + 1;

			const feature = this._addFauxOptionalFeatureFeatures_getFauxFeature(cls, optFeatProgression, lvl, fauxLoadeds, cntDelta);

			// Insert the fake feature into the features array at the appropriate point
			const ixInsertBefore = cls.classFeatures.findIndex(it => {
				return (it.level || DataUtil.class.unpackUidClassFeature(it.classFeature || it).level) > lvl;
			});
			if (~ixInsertBefore) cls.classFeatures.splice(ixInsertBefore, 0, feature);
			else cls.classFeatures.push(feature);

			cntPrev = cntOptFeats;
		});
	}

	static _addFauxOptionalFeatureFeatures_getLoadeds (optfeatList, cls, optFeatProgression) {
		const availOptFeats = optfeatList.filter(it => optFeatProgression.featureType.some(ft => it.featureType.includes(ft)));
		const optionsMeta = {setId: CryptUtil.uid(), name: optFeatProgression.name};
		return availOptFeats.map(it => {
			return {
				type: "optionalfeature",
				entry: `{@optfeature ${it.name}|${it.source}}`,
				entity: MiscUtil.copy(it),
				optionsMeta,
				page: UrlUtil.PG_OPT_FEATURES,
				source: it.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OPT_FEATURES](it),
				isRequiredOption: false,
			};
		});
	}

	static _addFauxOptionalFeatureFeatures_getFauxFeature (cls, optFeatProgression, lvl, fauxLoadeds, cntOptions) {
		const loadeds = MiscUtil.copy(fauxLoadeds);

		loadeds.forEach(l => {
			l.optionsMeta.count = cntOptions;
			PageFilterClassesFoundry.populateEntityTempData({
				entity: l.entity,
				ancestorClassName: cls.name,
				ancestorType: "optionalfeature",
				displayName: `${optFeatProgression.name}: ${l.entity.name}`,
				foundryData: {
					requirements: `${cls.name} ${lvl.level}`,
				},
			});
		});

		return {
			name: optFeatProgression.name,
			source: cls.source,
			classFeature: `${optFeatProgression.name}|${cls.name}|${cls.source}|${lvl}|${SRC_5ETOOLS_TMP}`,
			hash: UrlUtil.URL_TO_HASH_BUILDER["classFeature"]({
				name: optFeatProgression.name,
				className: cls.name,
				classSource: cls.source,
				level: lvl,
				source: SRC_5ETOOLS_TMP,
			}),
			level: lvl,
			loadeds: loadeds,
		};
	}

	static getExistingClassItems (actor, cls) {
		if (!cls) return [];

		return actor.items.filter(actItem =>
			actItem.type === "class"
			&& (actItem.name || "").toLowerCase().trim() === cls.name.toLowerCase().trim()
			&& (
				!Config.get("import", "isStrictMatching")
				|| (UtilDataConverter.getItemSource(actItem) || "").toLowerCase() === Parser.sourceJsonToAbv(cls.source).toLowerCase()
			),
		);
	}

	static getClassFromExistingClassItem (existingClassItem, classes) {
		if (!existingClassItem || existingClassItem.type !== "class" || !classes?.length) return null;

		return classes.find(cls =>
			cls.name.toLowerCase().trim() === existingClassItem.name.toLowerCase().trim()
			&& (
				!Config.get("import", "isStrictMatching")
				|| (UtilDataConverter.getItemSource(existingClassItem) || "").toLowerCase() === Parser.sourceJsonToAbv(cls.source).toLowerCase()
			),
		);
	}

	static getSubclassFromExistingClassItem (existingClassItem, cls, subclasses) {
		if (!existingClassItem || existingClassItem.type !== "class" || !subclasses?.length) return null;

		subclasses = subclasses.filter(it => it.className === cls.name && it.classSource === cls.source);

		return subclasses.find(sc =>
			sc.name.toLowerCase().trim() === existingClassItem.data.data.subclass.toLowerCase().trim()
			|| sc.shortName.toLowerCase().trim() === existingClassItem.data.data.subclass.toLowerCase().trim(),
		);
	}
}

Charactermancer_Class_Util.ExistingFeatureChecker = class {
	constructor (actor) {
		this._actor = actor;

		this._existingSheetFeatures = {};
		this._existingImportFeatures = {};

		actor.items
			.filter(it => it.type === "feat")
			.forEach(it => {
				const cleanSource = (UtilDataConverter.getItemSource(it) || "").trim().toLowerCase();
				Charactermancer_Class_Util.ExistingFeatureChecker._getNameAliases(it.name)
					.forEach(alias => this._existingSheetFeatures[alias] = cleanSource);

				const {page, source, hash} = it.data.flags?.[SharedConsts.MODULE_NAME_FAKE] || {};
				if (page && source && hash) this.addImportFeature(page, source, hash);
			});
	}

	static _getNameAliases (name) {
		const cleanName = name.trim().toLowerCase();
		const out = [
			cleanName,
		];

		const mTrailingParens = /^(.*?)\(.*\)$/.exec(cleanName);
		if (mTrailingParens) out.push(mTrailingParens[1].trim());

		// Optional features are imported as e.g. `Eldritch Invocations: Agonizing Blast` by the class importer, so
		//   strip the leading feature type.
		if (cleanName.includes(": ")) {
			const cleanNamePostColon = cleanName.split(":").slice(1).join(":").trim();
			out.push(cleanNamePostColon);
			const mTrailingParensPostColon = /^(.*?)\(.*\)$/.exec(cleanNamePostColon);
			if (mTrailingParensPostColon) out.push(mTrailingParensPostColon[1].trim());
		}

		return out;
	}

	isExistingFeature (name, page, source, hash) {
		if (MiscUtil.get(this._existingImportFeatures, page, source, hash)) return true;

		const searchNameAliases = Charactermancer_Class_Util.ExistingFeatureChecker._getNameAliases(name);
		if (!searchNameAliases.some(it => this._existingSheetFeatures[it])) return false;

		if (!Config.get("import", "isStrictMatching")) return true;

		const searchSource = Parser.sourceJsonToAbv(source).trim().toLowerCase();
		return searchNameAliases.some(it => this._existingSheetFeatures[it] === searchSource);
	}

	addImportFeature (page, source, hash) {
		MiscUtil.set(this._existingImportFeatures, page, source, hash, true);
	}
};

class Charactermancer_Class_LevelSelect extends BaseComponent {
	// region External
	/**
	 * @param opts
	 * @param opts.features
	 * @param opts.isSubclass
	 * @param opts.maxPreviousLevel
	 */
	static async pGetUserInput (opts) {
		return UtilApplications.pGetImportCompModalFormData({
			comp: new this(opts),
			isUnskippable: true,
			fnGetInvalidMeta: (formData) => {
				if (formData.data.length === 0) return {type: "error", message: `Please select some levels first!`};
			},
		});
	}
	// endregion

	/**
	 * @param opts
	 * @param opts.features
	 * @param [opts.isRadio] Select all levels below the currently selected level.
	 * @param [opts.isForceSelect] Force select the next level.
	 * @param [opts.isSubclass]
	 * @param [opts.maxPreviousLevel]
	 */
	constructor (opts) {
		super();

		this._isSubclass = !!opts.isSubclass;
		this._isRadio = !!opts.isRadio;
		this._isForceSelect = !!opts.isForceSelect;
		this._featureArr = this.constructor._getLevelGroupedFeatures(opts.features, this._isSubclass);
		this._maxPreviousLevel = opts.maxPreviousLevel || 0;

		this._list = null;

		this._fnsOnChange = [];
	}

	get modalTitle () { return `Select ${this._isSubclass ? "Subclass" : "Class"} Levels`; }

	onchange (fn) {
		this._fnsOnChange.push(fn);
	}

	_doRunFnsOnchange () {
		this._fnsOnChange.forEach(fn => fn());
	}

	setFeatures (features) {
		this._featureArr = this.constructor._getLevelGroupedFeatures(features, this._isSubclass);
		this._list.items.forEach(it => it.data.fnUpdateRowText());
	}

	render ($wrp) {
		const $cbAll = this._isRadio ? null : $(`<input type="checkbox" name="cb-select-all">`);
		const $wrpList = $(`<div class="veapp__list mb-1"></div>`);

		this._list = new List({
			$wrpList: $wrpList,
			fnSort: null,
			isUseJquery: true,
		});

		for (let ix = 0; ix < this._featureArr.length; ++ix) {
			const $cb = this._render_$getCbRow(ix);

			const $dispFeatures = $(`<span class="col-9-5"></span>`);
			const fnUpdateRowText = () => $dispFeatures.text(this.constructor._getRowText(this._featureArr[ix]));
			fnUpdateRowText();

			const $li = $$`<label class="w-100 ve-flex veapp__list-row veapp__list-row-hoverable ${this._isRadio && this._isForceSelect && ix <= this._maxPreviousLevel ? `list-multi-selected` : ""} ${ix < this._maxPreviousLevel ? `ve-muted` : ""}">
				<span class="col-1 ve-flex-vh-center">${$cb}</span>
				<span class="col-1-5 text-center">${ix + 1}</span>
				${$dispFeatures}
			</label>`
				.click((evt) => {
					this._handleSelectClick(listItem, evt);
				});

			const listItem = new ListItem(
				ix,
				$li,
				"",
				{},
				{
					cbSel: $cb[0],
					fnUpdateRowText,
				},
			);
			this._list.addItem(listItem);
		}

		if (!this._isRadio) ListUiUtil.bindSelectAllCheckbox($cbAll, this._list);

		this._list.init();

		$$`<div class="ve-flex-col min-h-0">
			<div class="ve-flex-v-stretch input-group mb-1 no-shrink">
				<label class="btn btn-5et col-1 px-1 ve-flex-vh-center">${$cbAll}</label>
				<button class="btn-5et col-1-5">Level</button>
				<button class="btn-5et col-9-5">Features</button>
			</div>

			${$wrpList}
		</div>`.appendTo($wrp);
	}

	_render_$getCbRow (ix) {
		if (!this._isRadio) return $(`<input type="checkbox" class="no-events">`);

		const $cb = $(`<input type="radio" class="no-events">`);
		if (ix === this._maxPreviousLevel && this._isForceSelect) $cb.prop("checked", true);
		else if (ix < this._maxPreviousLevel) $cb.prop("disabled", true);

		return $cb;
	}

	_handleSelectClick (listItem, evt) {
		if (!this._isRadio) return ListUiUtil.handleSelectClick(this._list, listItem, evt);

		const isCheckedOld = listItem.data.cbSel.checked;

		const isDisabled = this._handleSelectClickRadio(this._list, listItem, evt);
		if (isDisabled) return;

		const isCheckedNu = listItem.data.cbSel.checked;
		if (isCheckedOld !== isCheckedNu) this._doRunFnsOnchange();
	}

	/** Displays all levels less than the one selected as also being selected. */
	_handleSelectClickRadio (list, item, evt) {
		evt.preventDefault();
		evt.stopPropagation();

		if (item.data.cbSel.disabled) return true;

		list.items.forEach(it => {
			if (it === item) {
				// If we're allowed to toggle, toggle it
				if (it.data.cbSel.checked && !this._isForceSelect) {
					it.data.cbSel.checked = false;
					it.ele.removeClass("list-multi-selected");
					return;
				}

				it.data.cbSel.checked = true;
				it.ele.addClass("list-multi-selected");
			} else {
				it.data.cbSel.checked = false;
				if (it.ix < item.ix) it.ele.addClass("list-multi-selected");
				else it.ele.removeClass("list-multi-selected");
			}
		});
	}

	pGetFormData () {
		let out = this._list.items
			.filter(it => it.data.cbSel.checked)
			.map(it => it.ix);

		// If in radio mode, back-fill all previous levels
		if (this._isRadio && out.length) {
			const max = out[0] + 1;
			out = [];
			for (let i = this._maxPreviousLevel; i < max; ++i) out.push(i);
		}

		return {
			isFormComplete: !!out.length,
			data: out,
		};
	}

	/** Get the current level. */
	getCurLevel () {
		if (this._maxPreviousLevel) return this._maxPreviousLevel;
		return 0;
	}

	/** Get the max selected level. */
	getTargetLevel () {
		const ixs = this._list.items
			.filter(it => it.data.cbSel.checked)
			.map(it => it.ix);
		if (!ixs.length) return null;
		return Math.max(...ixs) + 1;
	}

	static _getRowText (lvl) { return lvl.map(f => f.name).join(", ") || "\u2014"; }

	/**
	 * Convert an array of the form:
	 * [{classFeature: "...", level: 1}, {classFeature: "...", level: 1}, {classFeature: "...", level: 2}]
	 * To an array of arrays of the form:
	 * [
	 *   [{classFeature: "...", level: 1}, {classFeature: "...", level: 1}],
	 *   [{classFeature: "...", level: 2}]
	 * ]
	 * @param allFeatures
	 * @param isSubclass
	 */
	static _getLevelGroupedFeatures (allFeatures, isSubclass) {
		allFeatures = MiscUtil.copy(allFeatures);
		if (!isSubclass) allFeatures = allFeatures.filter(it => it.classFeature); // Only show class feature names
		const allFeaturesByLevel = [];

		let level = 1;
		let stack = [];
		const output = () => {
			allFeaturesByLevel.push(stack);
			stack = [];
		};
		allFeatures.forEach(f => {
			// Ensure all levels are filled, even if it's with an empty array
			while (level < f.level) {
				output();
				level++;
			}
			stack.push(f);
			level = f.level;
		});
		output();

		// Fill out higher levels, to show a complete table
		while (level < Consts.CHAR_MAX_LEVEL) {
			output();
			level++;
		}

		return allFeaturesByLevel;
	}
}

class Charactermancer_Class_HpIncreaseModeSelect extends BaseComponent {
	// region External
	static async pGetUserInput () {
		return UtilApplications.pGetImportCompModalFormData({
			comp: new this(),
		});
	}

	static isHpAvailable (cls) {
		return cls.hd && cls.hd.number && !isNaN(cls.hd.number) && cls.hd.faces && !isNaN(cls.hd.faces);
	}
	// endregion

	pGetFormData () {
		return {
			isFormComplete: true,
			data: this._state.mode,
		};
	}

	get modalTitle () { return `Select Hit Points Increase Mode`; }

	render ($wrp) {
		const $sel = ComponentUiUtil.$getSelEnum(
			this,
			"mode",
			{
				values: [
					Charactermancer_Class_HpIncreaseModeSelect.MODE_TAKE_AVERAGE,
					Charactermancer_Class_HpIncreaseModeSelect.MODE_ROLL,
					Charactermancer_Class_HpIncreaseModeSelect.MODE_DO_NOT_INCREASE,
				],
				fnDisplay: mode => Charactermancer_Class_HpIncreaseModeSelect.DISPLAY_MODES[mode],
			},
		);

		$$`<div class="ve-flex-col min-h-0">
			${$sel}
		</div>`.appendTo($wrp);
	}

	_getDefaultState () {
		return {
			mode: Charactermancer_Class_HpIncreaseModeSelect.MODE_TAKE_AVERAGE,
		};
	}
}
Charactermancer_Class_HpIncreaseModeSelect.MODE_TAKE_AVERAGE = 0;
Charactermancer_Class_HpIncreaseModeSelect.MODE_ROLL = 1;
Charactermancer_Class_HpIncreaseModeSelect.MODE_DO_NOT_INCREASE = 2;

Charactermancer_Class_HpIncreaseModeSelect.DISPLAY_MODES = {
	[Charactermancer_Class_HpIncreaseModeSelect.MODE_TAKE_AVERAGE]: "Take Average",
	[Charactermancer_Class_HpIncreaseModeSelect.MODE_ROLL]: "Roll",
	[Charactermancer_Class_HpIncreaseModeSelect.MODE_DO_NOT_INCREASE]: "Do Not Increase HP",
};

class Charactermancer_Class_HpInfo extends BaseComponent {
	constructor ({className, hitDice}) {
		super();
		this._className = className;
		this._hitDice = hitDice;
	}

	render ($wrp) {
		const hdEntry = Renderer.class.getHitDiceEntry(this._hitDice);

		$$`<div class="ve-flex-col min-h-0 ve-small">
			<div class="block"><div class="inline-block bold mr-1">Hit Dice:</div>${Vetools.withUnpatchedDiceRendering(() => Renderer.getEntryDice(hdEntry, "Hit die"))}</div>
			<div class="block"><div class="inline-block bold mr-1">Hit Points:</div>${Renderer.class.getHitPointsAtFirstLevel(this._hitDice)}</div>
			<div class="block"><div class="inline-block bold mr-1">Hit Points at Higher Levels:</div>${Vetools.withUnpatchedDiceRendering(() => Renderer.class.getHitPointsAtHigherLevels(this._className, this._hitDice, hdEntry))}</div>
		</div>`.appendTo($wrp);
	}
}

class Charactermancer_Class_ProficiencyImportModeSelect extends BaseComponent {
	// region External
	static async pGetUserInput () {
		return UtilApplications.pGetImportCompModalFormData({
			comp: new this(),
			isUnskippable: true,
		});
	}
	// endregion

	pGetFormData () {
		return {
			isFormComplete: true,
			data: this._state.mode,
		};
	}

	get modalTitle () { return `Select Class Proficiency Import Mode`; }

	render ($wrp) {
		const $sel = ComponentUiUtil.$getSelEnum(
			this,
			"mode",
			{
				values: [
					Charactermancer_Class_ProficiencyImportModeSelect.MODE_MULTICLASS,
					Charactermancer_Class_ProficiencyImportModeSelect.MODE_PRIMARY,
					Charactermancer_Class_ProficiencyImportModeSelect.MODE_NONE,
				],
				fnDisplay: mode => Charactermancer_Class_ProficiencyImportModeSelect.DISPLAY_MODES[mode],
			},
		);

		$$`<div class="ve-flex-col min-h-0">
			${$sel}
		</div>`.appendTo($wrp);
	}

	_getDefaultState () {
		return {
			mode: Charactermancer_Class_ProficiencyImportModeSelect.MODE_MULTICLASS,
		};
	}
}
Charactermancer_Class_ProficiencyImportModeSelect.MODE_MULTICLASS = 0;
Charactermancer_Class_ProficiencyImportModeSelect.MODE_PRIMARY = 1;
Charactermancer_Class_ProficiencyImportModeSelect.MODE_NONE = 2;

Charactermancer_Class_ProficiencyImportModeSelect.DISPLAY_MODES = {
	[Charactermancer_Class_HpIncreaseModeSelect.MODE_TAKE_AVERAGE]: "Add multiclass proficiencies (this is my second+ class)",
	[Charactermancer_Class_HpIncreaseModeSelect.MODE_ROLL]: "Add base class proficiencies and equipment (this is my first class)",
	[Charactermancer_Class_HpIncreaseModeSelect.MODE_DO_NOT_INCREASE]: "Do not add proficiencies or equipment",
};

/** Deals with weapon, armor, and tool proficiencies, which are (generally) static on classes. */
class Charactermancer_Class_StartingProficiencies extends BaseComponent {
	// region External
	static get (
		{
			featureSourceTracker,
			primaryProficiencies,
			multiclassProficiencies,
			savingThrowsProficiencies,
			mode,
			existingProficienciesFvttArmor,
			existingProficienciesFvttWeapons,
			existingProficienciesFvttTools,
			existingProficienciesFvttSavingThrows,
		} = {},
	) {
		const {
			existingProficienciesVetArmor,
			existingProficienciesCustomArmor,

			existingProficienciesVetWeapons,
			existingProficienciesCustomWeapons,

			existingProficienciesVetTools,
			existingProficienciesCustomTools,

			existingProficienciesVetSavingThrows,
		} = this._getExistingProficienciesVet({
			existingProficienciesFvttArmor,
			existingProficienciesFvttWeapons,
			existingProficienciesFvttTools,
			existingProficienciesFvttSavingThrows,
		});

		const comp = new this({
			featureSourceTracker,
			primaryProficiencies,
			multiclassProficiencies,
			savingThrowsProficiencies,
			existingProficienciesVetArmor,
			existingProficienciesVetWeapons,
			existingProficienciesVetTools,
			existingProficienciesVetSavingThrows,

			existingProficienciesCustomArmor,
			existingProficienciesCustomWeapons,
			existingProficienciesCustomTools,

			// These are passed through and returned in the form data
			existingProficienciesFvttArmor,
			existingProficienciesFvttWeapons,
			existingProficienciesFvttTools,
			existingProficienciesFvttSavingThrows,
		});

		if (mode != null) comp.mode = mode;

		return comp;
	}

	static async pGetUserInput (
		{
			featureSourceTracker,
			primaryProficiencies,
			multiclassProficiencies,
			savingThrowsProficiencies,
			mode,
			existingProficienciesFvttArmor,
			existingProficienciesFvttWeapons,
			existingProficienciesFvttTools,
			existingProficienciesFvttSavingThrows,
		} = {},
	) {
		return this.get({
			featureSourceTracker,
			primaryProficiencies,
			multiclassProficiencies,
			savingThrowsProficiencies,
			mode,
			existingProficienciesFvttArmor,
			existingProficienciesFvttWeapons,
			existingProficienciesFvttTools,
			existingProficienciesFvttSavingThrows,
		}).pGetFormData();
	}

	/** Form data is a list of clean strings per proficiency type. */
	static applyFormDataToActorUpdate (actUpdate, formData) {
		MiscUtil.getOrSet(actUpdate, "data", "traits", {});

		this._applyFormDataToActorUpdate_applyProfList({
			actUpdate,
			profList: formData?.data?.armor || [],
			profsExisting: formData?.existingDataFvtt?.existingProficienciesArmor || {},
			propTrait: "armorProf",
			fnGetMapped: UtilActors.getMappedArmorProficiency.bind(UtilActors),
		});

		this._applyFormDataToActorUpdate_applyProfList({
			actUpdate,
			profList: formData.data?.weapons || [],
			profsExisting: formData?.existingDataFvtt?.existingProficienciesWeapons || {},
			propTrait: "weaponProf",
			fnGetMapped: UtilActors.getMappedWeaponProficiency.bind(UtilActors),
			fnGetPreMapped: UtilActors.getItemUIdFromWeaponProficiency.bind(UtilActors),
		});

		this._applyFormDataToActorUpdate_applyProfList({
			actUpdate,
			profList: formData.data?.tools || [],
			profsExisting: formData?.existingDataFvtt?.existingProficienciesTools || {},
			propTrait: "toolProf",
			fnGetMapped: UtilActors.getMappedTool.bind(UtilActors),
			fnGetPreMapped: UtilActors.getItemUIdFromToolProficiency.bind(UtilActors),
		});

		const tgtAbils = MiscUtil.getOrSet(actUpdate, "data", "abilities", {});
		[...(formData.data?.savingThrows || []), ...(formData.existingDataFvtt?.savingThrows || [])]
			.forEach(abv => (tgtAbils[abv] = tgtAbils[abv] || {}).proficient = 1);
	}

	static _applyFormDataToActorUpdate_addIfNotExists (arr, itm) {
		if (!arr.some(it => it.toLowerCase().trim() === itm.toLowerCase().trim())) arr.push(itm);
	}

	static _applyFormDataToActorUpdate_applyProfList (
		{
			actUpdate,
			profList,
			profsExisting,
			propTrait,
			fnGetMapped,
			fnGetPreMapped,
		},
	) {
		if (!profList?.length) return;

		const tgt = MiscUtil.getOrSet(actUpdate, "data", "traits", propTrait, {});
		tgt.value = tgt.value || [];
		tgt.custom = tgt.custom || "";

		const customArr = tgt.custom.split(";").map(it => it.trim()).filter(Boolean);

		// region Add existing proficiencies
		(profsExisting.value || [])
			.forEach(it => this._applyFormDataToActorUpdate_addIfNotExists(tgt.value, it));

		(profsExisting.custom || "")
			.split(";")
			.map(it => it.trim())
			.filter(Boolean)
			.forEach(it => this._applyFormDataToActorUpdate_addIfNotExists(customArr, it));
		// endregion

		profList.forEach(it => {
			// Try to match as a generic string
			const clean = (fnGetPreMapped ? fnGetPreMapped(it) : null) ?? Renderer.stripTags(it).toLowerCase();
			const mapped = fnGetMapped(clean);
			if (mapped) return this._applyFormDataToActorUpdate_addIfNotExists(tgt.value, mapped);

			// Try to match an item within the string, if one exists
			const [itemTag] = /{@item [^}]+}/i.exec(it) || [];
			if (itemTag) {
				const mappedAlt = fnGetMapped(Renderer.stripTags(itemTag));
				if (mappedAlt) return this._applyFormDataToActorUpdate_addIfNotExists(tgt.value, mappedAlt);
			}

			// Otherwise, add it as a custom proficiency
			this._applyFormDataToActorUpdate_addIfNotExists(customArr, Renderer.stripTags(it));
		});

		tgt.custom = customArr.join("; ");
	}

	static getExistingProficienciesFvttSavingThrows (actor) {
		// While these are _technically_ a list of proficiency types (i.e. proficient/expert/...), treat them as boolean
		//   flags, since nothing in the game gives "saving throw expertise."
		return Object.entries(MiscUtil.get(actor, "data", "data", "abilities") || {})
			.filter(([, abMeta]) => abMeta.proficient)
			.map(([ab]) => ab);
	}
	// endregion

	static _getExistingProficienciesVet ({existingProficienciesFvttArmor, existingProficienciesFvttWeapons, existingProficienciesFvttTools, existingProficienciesFvttSavingThrows}) {
		const vetValidWeapons = new Set();
		const customWeapons = new Set();
		const vetValidArmors = new Set();
		const customArmors = new Set();
		const vetValidTools = new Set();
		const customTools = new Set();

		this._getExistingProficienciesVet_({
			existingFvtt: existingProficienciesFvttWeapons,
			fnGetUnmapped: UtilActors.getUnmappedWeaponProficiency.bind(UtilActors),
			fnCheckUnmappedAlt: UtilActors.getItemUIdFromWeaponProficiency.bind(UtilActors),
			vetValidSet: vetValidWeapons,
			customSet: customWeapons,
		});

		this._getExistingProficienciesVet_({
			existingFvtt: existingProficienciesFvttArmor,
			fnGetUnmapped: UtilActors.getUnmappedArmorProficiency.bind(UtilActors),
			vetValidSet: vetValidArmors,
			customSet: customArmors,
		});

		this._getExistingProficienciesVet_({
			existingFvtt: existingProficienciesFvttTools,
			fnGetUnmapped: UtilActors.getUnmappedTool.bind(UtilActors),
			fnCheckUnmappedAlt: UtilActors.getItemUIdFromToolProficiency.bind(UtilActors),
			vetValidSet: vetValidTools,
			customSet: customTools,
		});

		return {
			existingProficienciesVetWeapons: [...vetValidWeapons],
			existingProficienciesCustomWeapons: [...customWeapons],
			existingProficienciesVetArmor: [...vetValidArmors],
			existingProficienciesCustomArmor: [...customArmors],
			existingProficienciesVetTools: [...vetValidTools],
			existingProficienciesCustomTools: [...customTools],
			existingProficienciesVetSavingThrows: existingProficienciesFvttSavingThrows, // Pass-through
		};
	}

	static _getExistingProficienciesVet_ ({
		existingFvtt,
		vetValidSet,
		customSet,
		fnGetUnmapped,
		fnCheckUnmappedAlt,
	}) {
		(existingFvtt?.value || []).forEach(it => {
			const unmapped = fnGetUnmapped(it);
			if (unmapped) vetValidSet.add(unmapped);
			else {
				if (fnCheckUnmappedAlt) {
					const unmappedVet = fnCheckUnmappedAlt(it);
					// If it was in the set, we can map it again later, but keep it as plain text for now
					if (unmappedVet) vetValidSet.add(it);
					else customSet.add(it);
				} else {
					customSet.add(it);
				}
			}
		});

		(existingFvtt?.custom || "").trim().split(";").map(it => it.trim()).filter(Boolean).forEach(it => {
			const low = it.toLowerCase();
			const unmapped = fnGetUnmapped(low);
			if (unmapped) vetValidSet.add(unmapped);
			else {
				if (fnCheckUnmappedAlt) {
					const unmappedVet = fnCheckUnmappedAlt(low);
					// If it was in the set, we can map it again later, but keep it as plain text for now
					if (unmappedVet) vetValidSet.add(low);
					else customSet.add(it);
				} else {
					customSet.add(it);
				}
			}
		});
	}

	/** Convert the 5etools data to arrays of strings. */
	static _getCleanVetProfs (vetProfs) {
		if (!vetProfs) return {};

		const out = {};

		if (vetProfs.armor) out.armor = this._getCleanVetProfs_getMappedItemTags(vetProfs.armor.map(it => it.proficiency || it));
		if (vetProfs.weapons) out.weapons = this._getCleanVetProfs_getMappedItemTags(vetProfs.weapons.map(it => (it.proficiency || it).toLowerCase().trim()));
		if (vetProfs.tools) out.tools = this._getCleanVetProfs_getMappedItemTags(vetProfs.tools.map(it => (it.proficiency || it).toLowerCase().trim()));

		return out;
	}

	static _getCleanVetProfs_getMappedItemTags (arr) {
		return arr.map(it => it.replace(/^{@item ([^}]+)}$/g, (...m) => {
			const [name, source] = Renderer.splitTagByPipe(m[1]);
			return `${name}|${source || SRC_DMG}`.toLowerCase();
		}));
	}

	constructor (
		{
			featureSourceTracker,
			primaryProficiencies,
			multiclassProficiencies,
			savingThrowsProficiencies,
			existingProficienciesVetArmor,
			existingProficienciesVetWeapons,
			existingProficienciesVetTools,
			existingProficienciesVetSavingThrows,
			existingProficienciesFvttArmor,
			existingProficienciesFvttWeapons,
			existingProficienciesFvttTools,
			existingProficienciesFvttSavingThrows,
			existingProficienciesCustomArmor,
			existingProficienciesCustomWeapons,
			existingProficienciesCustomTools,
		} = {},
	) {
		super();
		this._featureSourceTracker = featureSourceTracker;
		this._primaryProficiencies = Charactermancer_Class_StartingProficiencies._getCleanVetProfs(primaryProficiencies);
		this._multiclassProficiencies = Charactermancer_Class_StartingProficiencies._getCleanVetProfs(multiclassProficiencies);
		this._savingThrowsProficiencies = savingThrowsProficiencies;

		this._existingProficienciesVetArmor = existingProficienciesVetArmor;
		this._existingProficienciesVetWeapons = existingProficienciesVetWeapons;
		this._existingProficienciesVetTools = existingProficienciesVetTools;
		this._existingProficienciesVetSavingThrows = existingProficienciesVetSavingThrows;

		this._existingProficienciesCustomArmor = existingProficienciesCustomArmor;
		this._existingProficienciesCustomWeapons = existingProficienciesCustomWeapons;
		this._existingProficienciesCustomTools = existingProficienciesCustomTools;
		// region Pass-throughs to form data
		// NPCs don't have data here, so, support null
		this._existingProficienciesFvttArmor = existingProficienciesFvttArmor ? MiscUtil.copy(existingProficienciesFvttArmor) : null;
		this._existingProficienciesFvttWeapons = existingProficienciesFvttWeapons ? MiscUtil.copy(existingProficienciesFvttWeapons) : null;
		this._existingProficienciesFvttTools = existingProficienciesFvttTools ? MiscUtil.copy(existingProficienciesFvttTools) : null;
		this._existingProficienciesFvttSavingThrows = existingProficienciesFvttSavingThrows ? MiscUtil.copy(existingProficienciesFvttSavingThrows) : null;
		// endregion
	}

	set mode (mode) { this._state.mode = mode; }

	_getFormData () {
		const isPrimary = this._state.mode === Charactermancer_Class_ProficiencyImportModeSelect.MODE_PRIMARY;
		const profs = isPrimary ? this._primaryProficiencies : this._multiclassProficiencies;

		if (!profs) return {isFormComplete: true, data: {}, existingData: {}};

		return {
			isFormComplete: true,
			data: {
				armor: profs.armor || [],
				weapons: profs.weapons || [],
				tools: profs.tools || [],
				savingThrows: isPrimary ? (this._savingThrowsProficiencies || []) : [],
			},
			existingDataFvtt: {
				existingProficienciesArmor: this._existingProficienciesFvttArmor,
				existingProficienciesWeapons: this._existingProficienciesFvttWeapons,
				existingProficienciesTools: this._existingProficienciesFvttTools,
				// N.b. this is mapped, and is actually a list of abbreviations
				existingProficienciesSavingThrows: this._existingProficienciesFvttSavingThrows,
			},
		};
	}

	pGetFormData () { return this._getFormData(); }

	render ($wrp) {
		const $wrpDisplay = $(`<div class="ve-flex-col min-h-0 ve-small"></div>`).appendTo($wrp);

		const fnsCleanup = [];

		const hkMode = () => {
			fnsCleanup.forEach(fn => fn());
			fnsCleanup.splice(0, fnsCleanup.length);

			$wrpDisplay.empty();
			const isPrimary = this._state.mode === Charactermancer_Class_ProficiencyImportModeSelect.MODE_PRIMARY;

			const profs = isPrimary ? this._primaryProficiencies : this._multiclassProficiencies;
			if (profs) {
				this._render_profType({
					profList: profs.armor,
					title: "Armor",
					$wrpDisplay,
					propTracker: "armorProficiencies",
					propTrackerPulse: "pulseArmorProficiencies",
					fnsCleanup,
					existing: this._existingProficienciesVetArmor,
					existingProficienciesCustom: this._existingProficienciesCustomArmor,
					fnDisplay: str => ["light", "medium", "heavy"].includes(str) ? `${str} armor` : str.includes("|") ? `{@item ${str}}` : str,
				});

				this._render_profType({
					profList: profs.weapons,
					title: "Weapons",
					$wrpDisplay,
					propTracker: "weaponProficiencies",
					propTrackerPulse: "pulseWeaponProficiencies",
					fnsCleanup,
					existing: this._existingProficienciesVetWeapons,
					existingProficienciesCustom: this._existingProficienciesCustomWeapons,
					fnDisplay: str => ["simple", "martial"].includes(str) ? `${str} weapons` : str.includes("|") ? `{@item ${str}}` : str,
				});

				this._render_profType({
					profList: profs.tools,
					title: "Tools",
					$wrpDisplay,
					propTracker: "toolProficiencies",
					propTrackerPulse: "pulseToolProficiencies",
					fnsCleanup,
					existing: this._existingProficienciesVetTools,
					existingProficienciesCustom: this._existingProficienciesCustomTools,
				});
			}

			if (isPrimary && this._savingThrowsProficiencies) {
				this._render_profType({
					profList: this._savingThrowsProficiencies,
					title: "Saving Throws",
					$wrpDisplay,
					propTracker: "savingThrowProficiencies",
					propTrackerPulse: "pulseSavingThrowProficiencies",
					fnsCleanup,
					existing: this._existingProficienciesVetSavingThrows,
					fnDisplay: str => Parser.attAbvToFull(str),
				});
			}

			// region Networking with other armor proficiency components
			if (this._featureSourceTracker) this._featureSourceTracker.setState(this, this._getStateTrackerData());
			// endregion
		};
		this._addHookBase("mode", hkMode);
		hkMode();
	}

	_getStateTrackerData () {
		const formData = this._getFormData();

		const getNoTags = (arr) => arr.map(it => this.constructor._getUid(it)).filter(Boolean);

		return {
			armorProficiencies: getNoTags(formData.data?.armor || []).mergeMap(it => ({[it]: true})),
			weaponProficiencies: getNoTags(formData.data?.weapons || []).mergeMap(it => ({[it]: true})),
			toolProficiencies: getNoTags(formData.data?.tools || []).mergeMap(it => ({[it]: true})),
		};
	}

	static _getUid (str) {
		if (!str.startsWith("{@item")) return str;

		let [name, source] = Renderer.splitTagByPipe((Renderer.splitFirstSpace(str.slice(1, -1))[1] || "").toLowerCase());
		source = source || SRC_DMG.toLowerCase();
		if (!name) return null;

		return `${name}|${source}`;
	}

	_render_profType ({profList, title, $wrpDisplay, propTracker, propTrackerPulse, fnsCleanup, existing, existingProficienciesCustom, fnDisplay}) {
		if (!profList?.length) return;

		const profListUids = profList.map(prof => this.constructor._getUid(prof));

		const $ptsExisting = {};

		const $wrps = profList.map((it, i) => {
			const $ptExisting = $(`<div class="ve-small veapp__msg-warning inline-block"></div>`);
			const uid = profListUids[i];
			$ptsExisting[uid] = $ptExisting;
			const isNotLast = i < profList.length - 1;
			return $$`<div class="inline-block ${isNotLast ? "mr-1" : ""}">${Renderer.get().render(fnDisplay ? fnDisplay(it) : it)}${$ptExisting}${isNotLast ? `,` : ""}</div>`;
		});

		$$`<div class="block">
			<div class="mr-1 bold inline-block">${title}:</div>${$wrps}
		</div>`.appendTo($wrpDisplay);

		const pHkUpdatePtsExisting = async () => {
			try {
				await this._pLock("updateExisting");
				await pHkUpdatePtsExisting_();
			} finally {
				this._unlock("updateExisting");
			}
		};

		const pHkUpdatePtsExisting_ = async () => {
			const otherStates = this._featureSourceTracker ? this._featureSourceTracker.getStatesForKey(propTracker, {ignore: this}) : null;

			for (const v of profListUids) {
				if (!$ptsExisting[v]) return;

				const parentGroup = await UtilDataConverter.pGetItemWeaponType(v);

				// Value from sheet
				let isExisting = (existing || []).includes(v)
					|| (parentGroup && (existing || []).includes(parentGroup))
					|| (existingProficienciesCustom || []).includes(v)
					|| (parentGroup && (existingProficienciesCustom || []).includes(parentGroup));

				// Value from other networked components
				isExisting = isExisting
					|| (otherStates || []).some(otherState => !!otherState[v] || (parentGroup && !!otherState[parentGroup]));

				$ptsExisting[v]
					.title(isExisting ? "Proficient from Another Source" : "")
					.toggleClass("ml-1", isExisting)
					.html(isExisting ? `(<i class="fas fa-fw ${UtilActors.PROF_TO_ICON_CLASS[1]}"></i>)` : "");
			}
		};
		if (this._featureSourceTracker) {
			this._featureSourceTracker.addHook(this, propTrackerPulse, pHkUpdatePtsExisting);
			fnsCleanup.push(() => this._featureSourceTracker.removeHook(this, propTrackerPulse, pHkUpdatePtsExisting));
		}
		pHkUpdatePtsExisting();
	}

	_getDefaultState () {
		return {
			mode: Charactermancer_Class_ProficiencyImportModeSelect.MODE_PRIMARY,
		};
	}
}

export {
	PageFilterClassesFoundry,
	Charactermancer_Class_Util,
	Charactermancer_Class_LevelSelect,
	Charactermancer_Class_HpIncreaseModeSelect,
	Charactermancer_Class_HpInfo,
	Charactermancer_Class_ProficiencyImportModeSelect,
	Charactermancer_Class_StartingProficiencies,
};
