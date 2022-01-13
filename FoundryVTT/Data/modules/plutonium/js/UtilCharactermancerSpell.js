import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilActors} from "./UtilActors.js";
import {UtilApplications} from "./UtilApplications.js";
import {Charactermancer_Spell_SlotLevelSelect} from "./UtilCharactermancerSpellSlotLevelSelect.js";
import {LGT, Util} from "./Util.js";
import {Charactermancer_Util} from "./UtilCharactermancer.js";
import {DataConverterSpell} from "./DataConverterSpell.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class Charactermancer_Spell_Util {
	/**
	 * @param opts
	 * @param opts.casterProgression The class spellcasting progression
	 * @param opts.curLevel The current actor level (zero is valid)
	 * @param opts.targetLevel The target actor level
	 * @param [opts.isBreakpointsOnly] If class levels between jumps in spell level should be ignored.
	 */
	static getCasterProgressionMeta ({casterProgression, curLevel, targetLevel, isBreakpointsOnly = false}) {
		if (casterProgression == null || curLevel == null || targetLevel == null) return null;

		const progression = UtilActors.CASTER_TYPE_TO_PROGRESSION[casterProgression];
		if (!progression) return null;

		const levelToSpellLevel = [];
		let lastSpellLevel = 0;
		progression.forEach(slots => {
			let isFound = false;
			for (let i = 0; i < slots.length; ++i) {
				const spellLevel = i + 1;
				if (slots[i] && spellLevel > lastSpellLevel) {
					levelToSpellLevel.push(spellLevel);
					lastSpellLevel = spellLevel;
					isFound = true;
					break;
				}
			}
			if (!isFound) {
				if (isBreakpointsOnly) levelToSpellLevel.push(null);
				// Copy the last spell level to form a contiguous spell level array
				else levelToSpellLevel.push(levelToSpellLevel.length ? levelToSpellLevel.last() : null);
			}
		});

		const spannedLevels = levelToSpellLevel.slice(curLevel, targetLevel).filter(Boolean);
		if (!spannedLevels.length) return null;

		const spellLevelLow = Math.min(...spannedLevels);
		const spellLevelHigh = Math.max(...spannedLevels);

		const deltaLevels = Math.max(0, targetLevel - curLevel);
		const deltaSpellLevels = spellLevelHigh - spellLevelLow;

		return {
			spellLevelLow,
			spellLevelHigh,
			deltaLevels,
			deltaSpellLevels,
		};
	}

	static getCasterCantripProgressionMeta ({cls, sc, curLevel, targetLevel}) {
		if (cls == null || curLevel == null || targetLevel == null) return null;

		const atCurLevel = curLevel === 0 ? 0 : this.getMaxLearnedCantrips({cls, sc, targetLevel: curLevel});
		const atTargetLevel = this.getMaxLearnedCantrips({cls, sc, targetLevel: targetLevel});
		if (atCurLevel == null || atTargetLevel == null) return null;

		const deltaLevels = Math.max(0, targetLevel - curLevel);
		const deltaMaxCantrips = atTargetLevel - atCurLevel;

		return {
			maxCantripsLow: atCurLevel,
			maxCantripsHigh: atTargetLevel,
			deltaLevels,
			deltaMaxCantrips,
		};
	}

	static getMaxLearnedCantrips ({cls, sc, targetLevel}) {
		if (!cls || targetLevel == null) return null;

		let cantripProgression = DataConverter.getMaxCantripProgression(cls.cantripProgression, sc?.cantripProgression);

		// Auto-detect for homebrew, if required
		if (BrewUtil.hasSourceJson(cls.source) || (sc && BrewUtil.hasSourceJson(sc.source))) cantripProgression = cantripProgression || this._getApproximateCantripProgression({cls, sc});

		if (!cantripProgression) return null;

		return cantripProgression[targetLevel - 1];
	}

	static _getApproximateCantripProgression ({cls, sc}) {
		return this._getApproximateNumberCol({cls, sc, colNameLower: "cantrips known"});
	}

	static _getApproximateSpellsKnownProgression (cls, sc) {
		return this._getApproximateNumberCol({cls, sc, colNameLower: "spells known"});
	}

	static _getApproximateNumberCol ({cls, sc, colNameLower}) {
		const tableGroups = (BrewUtil.hasSourceJson(cls.source) ? cls.classTableGroups : null)
			|| ((sc && BrewUtil.hasSourceJson(sc.source)) ? sc?.subclassTableGroups : null);
		if (!tableGroups) return;
		for (const tblGroup of tableGroups) {
			const ixCol = (tblGroup.colLabels || []).findIndex(it => `${it}`.toLowerCase().includes(colNameLower));
			if (!~ixCol) continue;

			const numbers = (tblGroup.rowsSpellProgression || tblGroup.rows || []).map(row => row.filter((_, ixCell) => ixCell === ixCol)).flat();

			if (numbers.every(it => !isNaN(it))) return numbers.map(it => Number(it));
		}
	}

	static getFixedLearnedProgression ({cls, sc, targetLevel, isExistingClass, isDefault = false, formDataSlotSelectFromComp} = {}) {
		if (targetLevel == null) return null;

		const casterProgression = DataConverter.getMaxCasterProgression(cls.casterProgression, sc?.casterProgression);

		if (!casterProgression || !UtilActors.CASTER_TYPE_TO_PROGRESSION[casterProgression]) return null;

		const totalKnownPerLevel = [...new Array(9)].map(() => 0);

		let isAnyData = false;

		const formDataSlotSelect = (isExistingClass || isDefault)
			? Charactermancer_Spell_SlotLevelSelect.getDefaultFormData({
				targetLevel,
				casterProgression,
				// ISSUE(3) this should select the max
				spellsKnownProgression: cls?.spellsKnownProgression || sc?.spellsKnownProgression,
				// ISSUE(3) this should select the max
				spellsKnownProgressionFixed: cls?.spellsKnownProgressionFixed || sc?.spellsKnownProgressionFixed,
			})
			: formDataSlotSelectFromComp;

		if (formDataSlotSelect) {
			isAnyData = isAnyData || formDataSlotSelect?.isAnyData;
			if (formDataSlotSelect?.data) formDataSlotSelect.data.forEach((it, i) => totalKnownPerLevel[i] += it);
		}

		if (cls.spellsKnownProgressionFixedByLevel) {
			isAnyData = true;

			Object.entries(cls.spellsKnownProgressionFixedByLevel)
				.forEach(([lvl, spellSummary]) => {
					if (Number(lvl) > targetLevel) return;

					Object.entries(spellSummary)
						.forEach(([lvlSpell, count]) => {
							lvlSpell = Number(lvlSpell);
							totalKnownPerLevel[lvlSpell - 1] += count;
						});
				});
		}

		// If there is no slot data to apply, null out the field
		if (!isAnyData) return null;

		// For a 3rd-level Wizard, the output is e.g.:
		//   `[8, 2, 0, 0, 0, 0, 0, 0, 0]`
		return totalKnownPerLevel;
	}

	static getMaxPreparedSpells ({cls, sc, targetLevel, existingAbilityScores, abilityScoresFromComp} = {}) {
		if (!cls || targetLevel == null) return null;

		const casterProgression = DataConverter.getMaxCasterProgression(cls.casterProgression, sc?.casterProgression);

		if (!casterProgression || !UtilActors.CASTER_TYPE_TO_PROGRESSION[casterProgression]) return null;

		const spellSlotsAtLevel = UtilActors.CASTER_TYPE_TO_PROGRESSION[casterProgression][targetLevel - 1];
		if (!spellSlotsAtLevel) return null;

		// If there are no spell slots at this level, we can't prepare spells at this level
		if (!spellSlotsAtLevel.some(Boolean)) return null;

		let preparedSpellExpression = cls.preparedSpells;

		if (BrewUtil.hasSourceJson(cls.source)) {
			// Attempt to generate a prepared spell expression for homebrew classes, if it doesn't exist
			preparedSpellExpression = preparedSpellExpression || this._getApproximatePreparedFormula(cls, sc);
		}

		if (!preparedSpellExpression) return null;

		const totalsAsi = abilityScoresFromComp;
		const preparedSpellExpressionEvaluable = preparedSpellExpression.replace(/<\$([^$]+)\$>/g, (...m) => {
			switch (m[1]) {
				case "level": return targetLevel;
				case "str_mod": return this._getMaxPreparedSpells_getAbilityScore({ability: "str", totalsAsi, existingAbilityScores});
				case "dex_mod": return this._getMaxPreparedSpells_getAbilityScore({ability: "dex", totalsAsi, existingAbilityScores});
				case "con_mod": return this._getMaxPreparedSpells_getAbilityScore({ability: "con", totalsAsi, existingAbilityScores});
				case "int_mod": return this._getMaxPreparedSpells_getAbilityScore({ability: "int", totalsAsi, existingAbilityScores});
				case "wis_mod": return this._getMaxPreparedSpells_getAbilityScore({ability: "wis", totalsAsi, existingAbilityScores});
				case "cha_mod": return this._getMaxPreparedSpells_getAbilityScore({ability: "cha", totalsAsi, existingAbilityScores});
				default: throw new Error(`Unknown variable "${m[1]}"`);
			}
		});

		// eslint-disable-next-line no-eval
		const outRaw = eval(preparedSpellExpressionEvaluable);
		if (isNaN(outRaw)) {
			console.warn(...LGT, `Could not evaluate expression "${preparedSpellExpressionEvaluable}" (originally "${preparedSpellExpression}") as a number!`);
			return null;
		}

		// We prepare a minimum of 1 spell, and round down any fractions
		return Math.max(1, Math.floor(outRaw));
	}

	static getMaxPreparedSpellsFormula ({cls, sc} = {}) {
		if (!cls) return null;

		const casterProgression = DataConverter.getMaxCasterProgression(cls.casterProgression, sc?.casterProgression);

		if (!casterProgression || !UtilActors.CASTER_TYPE_TO_PROGRESSION[casterProgression]) return null;

		let preparedSpellExpression = cls.preparedSpells;

		if (BrewUtil.hasSourceJson(cls.source)) {
			// Attempt to generate a prepared spell expression for homebrew classes, if it doesn't exist
			preparedSpellExpression = preparedSpellExpression || this._getApproximatePreparedFormula(cls, sc);
		}

		if (!preparedSpellExpression) return null;

		const preparedSpellExpressionEvaluable = preparedSpellExpression.replace(/<\$([^$]+)\$>/g, (...m) => {
			switch (m[1]) {
				case "level": return `@classes.${Parser.stringToSlug(cls.name)}.levels`;
				case "str_mod":
				case "dex_mod":
				case "con_mod":
				case "int_mod":
				case "wis_mod":
				case "cha_mod": return `@abilities.${m[1].toLowerCase().slice(0, 3)}.mod`;
				default: throw new Error(`Unknown variable "${m[1]}"`);
			}
		});

		// We prepare a minimum of 1 spell, and round down any fractions
		return `max(1, floor(${preparedSpellExpressionEvaluable}))`;
	}

	static _getMaxPreparedSpells_getAbilityScore ({totalsAsi, existingAbilityScores, ability}) {
		if (existingAbilityScores) return existingAbilityScores[ability] || 0;
		return Parser.getAbilityModNumber(totalsAsi?.totals?.[totalsAsi.mode]?.[ability] || 0);
	}

	static _getApproximatePreparedFormula (cls, sc) {
		if (!cls) return null;

		const casterProgression = DataConverter.getMaxCasterProgression(cls.casterProgression, sc?.casterProgression);

		if (!casterProgression || (!cls.classTableGroups && !sc?.subclassTableGroups) || casterProgression === "pact") return null;

		const hasSpellsKnown = [cls.classTableGroups, sc?.subclassTableGroups]
			.filter(Boolean)
			.some(tableGroups => {
				tableGroups.map(it => it.colLabels || [])
					.flat()
					.map(lbl => Renderer.stripTags(`${lbl}`.trim()))
					.some(it => {
						const parts = it.toLowerCase().split(/[^a-z0-9]/g).map(it => it.trim()).filter(Boolean);
						return parts.some(pt => pt === "spell" || pt === "spells") && parts.some(pt => pt === "known");
					});
			});

		if (hasSpellsKnown) return null;

		// Default to "5" as the ability modifier if the ability score is unavailable--the user can trim down after
		return `<$level$> ${casterProgression !== "full" ? `/ 2 ` : ""}+ ${cls.spellcastingAbility ? `<$${cls.spellcastingAbility}_mod$>` : "5"}`;
	}

	static getExistingCasterMeta ({cls, sc, actor, targetLevel, formDataSlotSelectFromComp = null, abilityScoresFromComp = null}) {
		if (!targetLevel) return null;

		const casterProgression = DataConverter.getMaxCasterProgression(cls?.casterProgression, sc?.casterProgression);
		const casterProgressionMeta = Charactermancer_Spell_Util.getCasterProgressionMeta({casterProgression, curLevel: 0, targetLevel: targetLevel});

		return {
			maxLearnedCantrips: this.getMaxLearnedCantrips({cls, sc, targetLevel}),
			fixedLearnedProgression: this.getFixedLearnedProgression({cls, sc, targetLevel, isExistingClass: true, formDataSlotSelectFromComp}),
			maxPreparedSpells: this.getMaxPreparedSpells({cls, sc, targetLevel, existingAbilityScores: Charactermancer_Util.getCurrentAbilityScores(actor), abilityScoresFromComp}),
			spellLevelLow: casterProgressionMeta?.spellLevelLow,
			spellLevelLowHigh: casterProgressionMeta?.spellLevelHigh,
		};
	}
}

class Charactermancer_Spell_SpellMeta {
	constructor ({ix, spell, isPrepared, isLearned, isUpdateOnly, existingItemId, preparationMode, usesCurrent, usesMax, usesPer}) {
		this.ix = ix;
		this.spell = spell; // The spell entity
		this.isPrepared = isPrepared;
		this.isLearned = isLearned;

		// region Updates
		this.isUpdateOnly = isUpdateOnly; // If the spell should not be imported, but an existing sheet item should be updated
		this.existingItemId = existingItemId;
		// endregion

		// region Spell-importer-format options
		this.preparationMode = preparationMode;
		this.usesCurrent = usesCurrent;
		this.usesMax = usesMax;
		this.usesPer = usesPer;
		// endregion
	}
}

class Charactermancer_Spell extends BaseComponent {
	static async pApplyFormDataToActor (actor, formData, {cls, sc}) {
		const spells = formData?.data?.spells || [];
		for (let i = 0; i < spells.length; ++i) {
			const {
				spell,
				isPrepared,

				isUpdateOnly,
				existingItemId,

				preparationMode,
				usesCurrent,
				usesMax,
				usesPer,
				castAtLevel,
			} = spells[i];

			if (isUpdateOnly && existingItemId) {
				await DataConverterSpell.pSetSpellItemIsPrepared(actor.items.get(existingItemId), isPrepared);
				continue;
			}

			if (!Charactermancer_Spell._IMPORT_LIST_SPELL || Charactermancer_Spell._IMPORT_LIST_SPELL.actor !== actor) {
				const {ImportListSpell} = await import("./ImportListSpell.js");
				Charactermancer_Spell._IMPORT_LIST_SPELL = new ImportListSpell({actor: actor});
				await Charactermancer_Spell._IMPORT_LIST_SPELL.pInit();
			}

			await Charactermancer_Spell._IMPORT_LIST_SPELL.pImportEntry(
				spell,
				{
					isCharactermancer: true,
					opts_pGetSpellItem: {
						isActorItem: true,

						isPrepared: isPrepared,
						abilityAbv: sc?.spellcastingAbility || cls.spellcastingAbility,

						preparationMode,
						usesCurrent,
						usesMax,
						usesPer,
						castAtLevel,

						parentClassName: cls.name,
						parentClassSource: cls.source,
						parentSubclassName: sc?.name,
						parentSubclassShortName: sc?.shortName,
						parentSubclassSource: sc?.source,
					},
				},
			);
		}
	}

	/**
	 * Note that spell progressions are converted into a "fixed learned progression" by another component before being
	 * used here.
	 * @param opts
	 * @param opts.actor
	 * @param [opts.existingClass]
	 * @param [opts.existingCasterMeta]
	 * @param opts.spellDatas
	 * @param opts.className
	 * @param [opts.subclassName]
	 * @param [opts.subclassShortName]
	 * @param opts.classSource
	 * @param [opts.subclassSource]
	 * @param [opts.brewClassSpells] `"classSpells"` defined on the class.
	 * @param [opts.brewSubclassSpells] `"subclassSpells"` defined on the subclass.
	 * @param [opts.brewSubSubclassSpells] `"subSubclassSpells"` defined on the subclass.
	 * @param opts.pageFilter
	 * @param [opts.$wrpsPreparedLearned]
	 * @param [opts.maxLevel]
	 */
	constructor (opts) {
		opts = opts || {};
		super();

		this._actor = opts.actor;
		this._existingClass = opts.existingClass; // Only link by class, as we assume any subclass is part of the same class
		this._existingCasterMeta = opts.existingCasterMeta;
		this._spellDatas = opts.spellDatas;
		this._className = opts.className;
		this._classSource = opts.classSource;
		this._subclassName = opts.subclassName;
		this._subclassShortName = opts.subclassShortName;
		this._subclassSource = opts.subclassSource;
		this._compsLevel = [...new Array(opts.maxLevel != null ? (opts.maxLevel + 1) : 10)]
			.map((_, i) => new Charactermancer_Spell_Level({spellDatas: opts.spellDatas, spellLevel: i, parent: this}));
		this._pageFilter = opts.pageFilter;
		this._$wrpsPreparedLearned = opts.$wrpsPreparedLearned;

		this._spellDataLookup = this._getSpellDataLookup();
		this._existingSpellLookup = this._getExistingSpellLookup();

		this._cacheSelectedListItem = null;
		this._cacheFilterValues = null;
		this._cacheBrewClassSpells = Charactermancer_Spell._getBrewClassSubclassSpellCache(opts.brewClassSpells, opts.brewSubclassSpells, opts.brewSubSubclassSpells);
	}

	_getSpellDataLookup () {
		const out = {};
		this._spellDatas.forEach(sp => {
			MiscUtil.set(out, "hash", UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_SPELLS](sp), sp);
			MiscUtil.set(out, "slug", Parser.stringToSlug(Parser.sourceJsonToAbv(sp.source)), Parser.stringToSlug(sp.name), sp);
		});
		return out;
	}

	_getExistingSpellLookup () {
		if (!this._existingClass || !this._existingCasterMeta) return null;

		const spItems = this._actor.items
			.filter(it => it.type === "spell");

		const cntsSeenLearnedPerLevel = {};
		const cntsSeenPreparedPerLevel = {};

		const out = {};

		[...spItems]
			// Process any spell items with class info flags first
			.sort((a, b) => {
				const flagsA = a.data.flags?.[SharedConsts.MODULE_NAME_FAKE];
				const flagsB = b.data.flags?.[SharedConsts.MODULE_NAME_FAKE];
				const a_ = flagsA?.parentClassName && flagsA?.parentClassSource ? 1 : 0;
				const b_ = flagsB?.parentClassName && flagsB?.parentClassSource ? 1 : 0;
				return b_ - a_;
			})
			.forEach(spItem => {
				const level = Number(spItem.data.data.level || 0);
				const lookupName = (spItem.name || "").trim().toLowerCase();
				// Use empty string as the source value if we don't care about source
				const lookupSource = (Config.get("import", "isStrictMatching") ? UtilDataConverter.getItemSource(spItem) : "").toLowerCase();

				const flags = spItem.data.flags?.[SharedConsts.MODULE_NAME_FAKE];
				const parentClassName = flags?.parentClassName;
				const parentClassSource = flags?.parentClassSource;

				const isItemPrepared = spItem.data.data.preparation?.mode === "prepared" && spItem.data.data.preparation?.prepared;
				const isItemAlwaysPrepared = spItem.data.data.preparation?.mode === "always"; // Trust the item data on this

				// Skip any spells that are definitely from another class
				if (parentClassName && parentClassSource && parentClassName !== this._existingClass.name && parentClassSource !== this._existingClass.source) return;

				// Forcibly add any spells which are definitely from this class
				if (parentClassName && parentClassSource && parentClassName === this._existingClass.name && parentClassSource === this._existingClass.source) {
					const isLearned = level === 0 || (level !== 0 && this._existingCasterMeta.fixedLearnedProgression != null);
					const isPrepared = this._existingCasterMeta.maxPreparedSpells != null && isItemPrepared;

					if (isLearned) cntsSeenLearnedPerLevel[level] = (cntsSeenLearnedPerLevel[level] || 0) + 1;
					if (isPrepared) cntsSeenPreparedPerLevel[level] = (cntsSeenPreparedPerLevel[level] || 0) + 1;

					MiscUtil.set(out, level, lookupSource, lookupName, new Charactermancer_Spell.ExistingSpell({
						item: spItem,
						isLearned,
						isPrepared,
						isAlwaysPrepared: isItemAlwaysPrepared,
					}));

					return;
				}

				// For other spells, if they *could* be from this class, count them, assuming we're below our limits
				const isItemLearned = level === 0
					// Ignore at-will/innate spells, as we assume they are not from standard spellcasting
					|| (spItem.data.data.preparation?.mode === "prepared" || spItem.data.data.preparation?.mode === "pact");

				const isLearned = level === 0
					? isItemLearned && this._existingCasterMeta.maxLearnedCantrips != null && ((cntsSeenLearnedPerLevel[level] || 0) < this._existingCasterMeta.maxLearnedCantrips)
					: isItemLearned && this._canLearnMoreFixedSpellsOfLevel({lvl: level, fixedLearnedProgression: this._existingCasterMeta.fixedLearnedProgression, cntSpellsKnown: cntsSeenLearnedPerLevel[level] || 0});

				const isPrepared = isItemPrepared
					&& this._existingCasterMeta.maxPreparedSpells != null
					&& (cntsSeenPreparedPerLevel[level] || 0) < this._existingCasterMeta.maxPreparedSpells;

				/* Note: best not to do this, as it breaks e.g. levelling up a non-Charactermancer actor
				// If it's neither learned nor prepared, bail out
				if (!isLearned && !isPrepared && !isItemAlwaysPrepared) return;
				 */

				// If it's not on our known spell list, bail out
				if (!this._getExistingSpellLookup_isOnSpellList(spItem)) return;

				// If it should be a learned spell and we've not learned it, bail out
				if (!isLearned && this._isLearnedFixedSpellCasterAtLevel({lvl: level, fixedLearnedProgression: this._existingCasterMeta.fixedLearnedProgression})) return;

				if (isLearned) cntsSeenLearnedPerLevel[level] = (cntsSeenLearnedPerLevel[level] || 0) + 1;
				if (isPrepared) cntsSeenPreparedPerLevel[level] = (cntsSeenPreparedPerLevel[level] || 0) + 1;

				MiscUtil.set(out, level, lookupSource, lookupName, new Charactermancer_Spell.ExistingSpell({
					item: spItem,
					isLearned,
					isPrepared,
					isAlwaysPrepared: isItemAlwaysPrepared,
				}));
			});

		return out;
	}

	/** Attempt to map the spell item to an equivalent 5etools spell. */
	_getExistingSpellLookup_isOnSpellList (spItem) {
		// region If we're lucky enough to have Plutonium flags, use them
		const flags = spItem.data.flags?.[SharedConsts.MODULE_NAME_FAKE];

		if (flags?.page && flags?.source && flags?.hash) {
			const sp = this._spellDataLookup.hash[flags.hash];
			if (!sp) return false;
			return this.isAvailableClassSpell_(sp) || this.isAvailableSubclassSpell_(sp) || this.isAvailableExpandedSpell_(sp);
		}
		// endregion

		// Otherwise, slug the name/source, and do a lookup
		const itemSourceClean = UtilDataConverter.getItemSource(spItem) || SRC_PHB;
		const itemNameClean = spItem.name.trim().replace(/\s+/g, " ").toLowerCase();
		const sp = MiscUtil.get(this._spellDataLookup.slug, Parser.stringToSlug(itemSourceClean), Parser.stringToSlug(itemNameClean));
		if (!sp) return false;
		return this.isAvailableClassSpell_(sp) || this.isAvailableSubclassSpell_(sp) || this.isAvailableExpandedSpell_(sp);
	}

	static _getBrewClassSubclassSpellCache (brewClassSpells, brewSubclassSpells, brewSubSubclassSpells) {
		const out = {};
		(brewClassSpells || []).forEach(it => this._getBrewClassSubclassSpellCache_addItem(out, it));
		(brewSubclassSpells || []).forEach(it => this._getBrewClassSubclassSpellCache_addItem(out, it));
		(brewSubSubclassSpells || []).forEach(it => this._getBrewClassSubclassSpellCache_addItem(out, it));
		return out;
	}

	static _getBrewClassSubclassSpellCache_addItem (out, it) {
		if (typeof it === "string") MiscUtil.set(out, "spell", SRC_PHB.toLowerCase(), it.trim().toLowerCase(), true);
		else if (it.name) MiscUtil.set(out, "spell", (it.source || SRC_PHB).trim().toLowerCase(), it.name.trim().toLowerCase(), true);
		else if (it.className) {
			let prop = "class";
			const classSource = it.classSource || SRC_PHB;
			const path = [classSource, it.className];
			if (it.subclassName) {
				prop = "subclass";
				const subclassSource = it.subclassSource || classSource;
				path.push(subclassSource, it.subclassName);
				if (it.subSubclassName) {
					prop = "subSubclass";
					path.push(it.subSubclassName);
				}
			}
			MiscUtil.set(out, prop, ...path.map(it => it.trim().toLowerCase()), true);
		}
	}

	get pageFilter () { return this._pageFilter; }

	set subclassName (val) { this._subclassName = val; }
	set subclassShortName (val) { this._subclassShortName = val; }
	set subclassSource (val) { this._subclassSource = val; }

	get cacheSelectedListItem () { return this._cacheSelectedListItem; }
	set cacheSelectedListItem (val) { this._cacheSelectedListItem = val; }

	get isPreparedCaster () { return this._state.maxPrepared != null; }

	set spellLevelLow (val) { this._state.spellLevelLow = val; }
	get spellLevelLow () { return this._state.spellLevelLow; }

	set spellLevelHigh (val) { this._state.spellLevelHigh = val; }
	get spellLevelHigh () { return this._state.spellLevelHigh; }

	get ixViewedSpell () { return this._state.ixViewedSpell; }
	set ixViewedSpell (val) { this._state.ixViewedSpell = val; }

	get maxLearnedCantrips () { return this._state.maxLearnedCantrips; }
	set maxLearnedCantrips (val) { this._state.maxLearnedCantrips = val; }

	get fixedLearnedProgression () { return this._state.fixedLearnedProgression; }
	set fixedLearnedProgression (val) { this._state.fixedLearnedProgression = val; }

	get fixedLearnedProgressionDefault () { return this._state.fixedLearnedProgressionDefault; }
	set fixedLearnedProgressionDefault (val) { this._state.fixedLearnedProgressionDefault = val; }

	get pulseFixedLearned () { return this._state.pulseFixedLearned; }
	set pulseFixedLearned (val) { this._state.pulseFixedLearned = val; }

	set maxPrepared (val) {
		this._state.maxPrepared = val;
		if (val != null) this._state.maxLearned = null;
	}

	get cntLearnedSpells () { return this._state.cntLearnedSpells; }
	set cntLearnedSpells (val) { this._state.cntLearnedSpells = val; }

	get cntLearnedCantrips () { return this._state.cntLearnedCantrips; }
	set cntLearnedCantrips (val) { this._state.cntLearnedCantrips = val; }

	get cntPrepared () { return this._state.cntPrepared; }
	set cntPrepared (val) { this._state.cntPrepared = val; }

	get casterProgression () { return this._state.casterProgression; }
	set casterProgression (val) { this._state.casterProgression = val; }

	set isIncludeUaEtcSpellLists (val) { this._state.isIncludeUaEtcSpellLists = val; }

	addHookMaxLearnedCantrips (hk) { this._addHookBase("maxLearnedCantrips", hk); }
	addHookSpellLevelLow (hk) { this._addHookBase("spellLevelLow", hk); }
	addHookSpellLevelHigh (hk) { this._addHookBase("spellLevelHigh", hk); }
	addHookFixedLearnedProgression (hk) { this._addHookBase("fixedLearnedProgression", hk); }

	addHookIsPreparedCaster (hk) { this._addHookBase("maxPrepared", hk); }

	addHookIsMaxLearnedSpells (hk) {
		this._addHookBase("fixedLearnedProgression", hk);
		this._addHookBase("pulseFixedLearned", hk);
		this._addHookBase("spellLevelLow", hk);
		this._addHookBase("spellLevelHigh", hk);
	}

	addHookIsMaxLearnedCantrips (hk) {
		this._addHookBase("cntLearnedCantrips", hk);
		this._addHookBase("maxLearnedCantrips", hk);
	}

	addHookIsMaxPrepared (hk) {
		this._addHookBase("cntPrepared", hk);
		this._addHookBase("maxPrepared", hk);
	}

	isLearnedFixedSpellCasterAtLevel_ (lvl) {
		// Use the default spell progression, so we don't "forget" we are a learned caster if we have converted all
		//   fixed slots for this level to slots of another level.
		return this._isLearnedFixedSpellCasterAtLevel({lvl, fixedLearnedProgression: this._state.fixedLearnedProgressionDefault});
	}

	_isLearnedFixedSpellCasterAtLevel ({lvl, fixedLearnedProgression}) {
		return lvl > 0 && fixedLearnedProgression != null && fixedLearnedProgression[lvl - 1] > 0;
	}

	canLearnMoreFixedSpellsOfLevel_ (lvl) {
		return this._canLearnMoreFixedSpellsOfLevel({
			lvl,
			fixedLearnedProgression: this._state.fixedLearnedProgression,
			cntSpellsKnown: this._compsLevel[lvl].getSpellsKnown().length,
		});
	}

	_canLearnMoreFixedSpellsOfLevel ({lvl, fixedLearnedProgression, cntSpellsKnown}) {
		if (!fixedLearnedProgression) return false;
		if (!fixedLearnedProgression[lvl - 1]) return false;
		return cntSpellsKnown < fixedLearnedProgression[lvl - 1];
	}

	isOverLearnFixedSpellsLimitOfLevel_ (lvl) {
		if (!this._state.fixedLearnedProgression) return false;
		if (!this._state.fixedLearnedProgression[lvl - 1]) return false;
		const spellsKnown = this._compsLevel[lvl].getSpellsKnown();
		return spellsKnown.length > this._state.fixedLearnedProgression[lvl - 1];
	}

	canLearnMoreCantrips_ () { return this._state.cntLearnedCantrips < (this._state.maxLearnedCantrips || 0); }
	isOverLearnCantripsLimit_ () { return this._state.cntLearnedCantrips > (this._state.maxLearnedCantrips || 0); }

	canPrepareMore_ () { return this._state.cntPrepared < (this._state.maxPrepared || 0); }
	isOverPrepareLimit_ () { return this._state.cntPrepared > (this._state.maxPrepared || 0); }

	_getCntSpellsKnown () { return this._compsLevel.map(it => it.getSpellsKnown().length).sum(); }
	_getTotalSpellsKnown () { return (this._state.fixedLearnedProgression || []).sum(); }

	render ($wrp, $dispSpell) {
		// region Spells prepared and learned
		const hkPreparedLearned = () => {
			const parts = [
				this._state.maxLearnedCantrips ? `Cantrips learned: ${this._state.cntLearnedCantrips}/${this._state.maxLearnedCantrips}` : null,
				this._state.fixedLearnedProgression ? `Spells learned: ${this._getCntSpellsKnown()}/${this._getTotalSpellsKnown()}` : null,
				this._state.maxPrepared ? `Prepared: ${this._state.cntPrepared}/${this._state.maxPrepared}` : null,
			].filter(Boolean);

			(this._$wrpsPreparedLearned || [])
				.forEach($it => {
					$it
						.toggleVe(parts.length)
						.html(parts.join(`<div class="mx-1">\u2014</div>`));
				});
		};
		this._addHookBase("cntPrepared", hkPreparedLearned);
		this._addHookBase("maxPrepared", hkPreparedLearned);
		this._addHookBase("fixedLearnedProgression", hkPreparedLearned);
		this._addHookBase("pulseFixedLearned", hkPreparedLearned);
		this._addHookBase("cntLearnedCantrips", hkPreparedLearned);
		this._addHookBase("maxLearnedCantrips", hkPreparedLearned);
		hkPreparedLearned();
		// endregion

		// region Always prepared spell lists
		const hkAlwaysPreparedSpells = () => this._handleAlwaysPreparedSpells();
		this._addHookBase("alwaysPreparedSpellsRace", hkAlwaysPreparedSpells);
		this._addHookBase("alwaysPreparedSpellsBackground", hkAlwaysPreparedSpells);
		this._addHookBase("alwaysPreparedSpellsClass", hkAlwaysPreparedSpells);
		this._addHookBase("alwaysPreparedSpellsSubclass", hkAlwaysPreparedSpells);
		hkAlwaysPreparedSpells();
		// endregion

		// region Expanded spell lists (and UA spell lists)
		const hkExpandedSpells = () => this.handleFilterChange();
		this._addHookBase("expandedSpellsRace", hkExpandedSpells);
		this._addHookBase("expandedSpellsBackground", hkExpandedSpells);
		this._addHookBase("expandedSpellsClass", hkExpandedSpells);
		this._addHookBase("expandedSpellsSubclass", hkExpandedSpells);

		this._addHookBase("isIncludeUaEtcSpellLists", hkExpandedSpells);
		hkExpandedSpells();
		// endregion

		// region Learned cantrips
		const hkAlwaysKnownSpells = () => this._handleAlwaysKnownSpells();
		this._addHookBase("alwaysKnownSpellsRace", hkAlwaysKnownSpells);
		this._addHookBase("alwaysKnownSpellsBackground", hkAlwaysKnownSpells);
		this._addHookBase("alwaysKnownSpellsClass", hkAlwaysKnownSpells);
		this._addHookBase("alwaysKnownSpellsSubclass", hkAlwaysKnownSpells);
		hkAlwaysKnownSpells();
		// endregion

		// region Render level parts
		this._compsLevel.forEach(it => it.render($wrp));
		// endregion

		// region Init spell display
		const hkDisplaySpell = () => {
			// Note that multiple spell components from multiple classes share the same display component; that is, the
			//   spell displayed is not guaranteed to match the internal state of every component, only the most recently
			//   modified one.
			$dispSpell.empty();
			const spell = this._spellDatas[this._state.ixViewedSpell];
			if (!spell) return $dispSpell.append(`<div class="ve-flex-vh-center w-100 h-100 italic">Select a spell to view</div>`);

			$dispSpell.append(Renderer.hover.$getHoverContent_stats(UrlUtil.PG_SPELLS, MiscUtil.copy(spell)));
		};
		this._addHookBase("ixViewedSpell", hkDisplaySpell);
		hkDisplaySpell();
		// endregion
	}

	_handleAlwaysPreparedSpells () { this._compsLevel.forEach(it => it.handleAlwaysPreparedSpells_()); }
	_handleAlwaysKnownSpells () { this._compsLevel.forEach(it => it.handleAlwaysKnownSpells_()); }

	handleFilterChange (f) {
		this._cacheFilterValues = f || this._cacheFilterValues;
		if (!this._cacheFilterValues) return; // Filtering with no values, and no cached values, is a no-op
		this._compsLevel.forEach(it => it.handleFilterChange(this._cacheFilterValues));
	}

	handleSearch (searchTerm) { this._compsLevel.forEach(it => it.handleSearch(searchTerm)); }

	getExistingSpellMeta_ (spell) {
		if (!this._existingCasterMeta || !this._existingSpellLookup) return null;
		const lookupSource = (Config.get("import", "isStrictMatching") ? Parser.sourceJsonToAbv(spell.source) : "").toLowerCase();
		const lookupName = spell.name.toLowerCase();
		return this._existingSpellLookup[spell.level]?.[lookupSource]?.[lookupName];
	}

	isAvailableClassSpell_ (sp) {
		if (!this._className || !this._classSource) return false;

		const fromClassList = Renderer.spell.getCombinedClasses(sp, "fromClassList");
		const fromClassListVariant = Renderer.spell.getCombinedClasses(sp, "fromClassListVariant")
			.filter(it => this._state.isIncludeUaEtcSpellLists ? true : !SourceUtil.isNonstandardSource(it.definedInSource));

		const {className, classSource} = this.constructor._getMappedClassDetails({className: this._className, classSource: this._classSource});

		if (
			!fromClassList.some(it => it.name === className && it.source === classSource)
			&& !fromClassListVariant.some(it => it.name === className && it.source === classSource)
			&& !this._hasBrewClassSpell(sp, fromClassList, fromClassListVariant)) return false;

		return true;
	}

	isAvailableSubclassSpell_ (sp) {
		if ((!this._subclassName && !this._subclassShortName) || !this._subclassSource) return false;

		const fromSubclassList = Renderer.spell.getCombinedClasses(sp, "fromSubclass");

		const scName = this._subclassShortName || this._subclassName;

		if (!fromSubclassList.some(it => it?.class.name === this._className && it?.class.source === this._classSource && it?.subclass.name === scName && it?.subclass.source === this._subclassSource)
			&& !this._hasBrewSubclassSpell(sp, fromSubclassList)) return false;

		return true;
	}

	_hasBrewClassSpell (sp, fromClassList, fromClassListVariant) {
		if (MiscUtil.get(this._cacheBrewClassSpells, "spell", sp.source.toLowerCase(), sp.name.toLowerCase())) return true;
		if (fromClassList.some(it => MiscUtil.get(this._cacheBrewClassSpells, "class", it.source.toLowerCase(), it.name.toLowerCase()))) return true;
		if (fromClassListVariant.some(it => MiscUtil.get(this._cacheBrewClassSpells, "class", it.source.toLowerCase(), it.name.toLowerCase()))) return true;
		return false;
	}

	_hasBrewSubclassSpell (sp, fromSubclassList) {
		if (MiscUtil.get(this._cacheBrewClassSpells, "spell", sp.source.toLowerCase(), sp.name.toLowerCase())) return true;
		if (fromSubclassList.some(it => !it.subSubclass && MiscUtil.get(this._cacheBrewClassSpells, "subclass", it.class.source.toLowerCase(), it.class.name.toLowerCase(), it.subclass.source.toLowerCase(), it.subclass.name.toLowerCase()))) return true;
		if (fromSubclassList.some(it => it.subSubclass && MiscUtil.get(this._cacheBrewClassSpells, "subSubclass", it.class.source.toLowerCase(), it.class.name.toLowerCase(), it.subclass.source.toLowerCase(), it.subclass.name.toLowerCase(), it.subclass.subSubclass.toLowerCase()))) return true;
		return false;
	}

	isAlwaysPreparedSpell_ (sp) {
		const spellUid = this.constructor._getSpellUid(sp);
		if (this._state.alwaysPreparedSpellsRace.includes(spellUid)) return true;
		if (this._state.alwaysPreparedSpellsBackground.includes(spellUid)) return true;
		if (this._state.alwaysPreparedSpellsClass.includes(spellUid)) return true;
		if (this._state.alwaysPreparedSpellsSubclass.includes(spellUid)) return true;
		// TODO(future) handle feats?
		return false;
	}

	isAvailableExpandedSpell_ (sp) {
		const spellUid = this.constructor._getSpellUid(sp);
		if (this._state.expandedSpellsRace.includes(spellUid)) return true;
		if (this._state.expandedSpellsBackground.includes(spellUid)) return true;
		if (this._state.expandedSpellsClass.includes(spellUid)) return true;
		if (this._state.expandedSpellsSubclass.includes(spellUid)) return true;
		// TODO(future) handle feats?
		return false;
	}

	isAlwaysKnownSpell_ (sp) {
		const spellUid = this.constructor._getSpellUid(sp);
		if (this._state.alwaysKnownSpellsRace.includes(spellUid)) return true;
		if (this._state.alwaysKnownSpellsBackground.includes(spellUid)) return true;
		if (this._state.alwaysKnownSpellsClass.includes(spellUid)) return true;
		if (this._state.alwaysKnownSpellsSubclass.includes(spellUid)) return true;
		// TODO(future) handle feats?
		return false;
	}

	static _getSpellUid (sp) { return `${sp.name.toLowerCase()}|${sp.source.toLowerCase()}`; }

	// region Always prepared spell sources
	set alwaysPreparedSpellsRace (val) { this._state.alwaysPreparedSpellsRace = val; }
	set alwaysPreparedSpellsBackground (val) { this._state.alwaysPreparedSpellsBackground = val; }
	set alwaysPreparedSpellsClass (val) { this._state.alwaysPreparedSpellsClass = val; }
	set alwaysPreparedSpellsSubclass (val) { this._state.alwaysPreparedSpellsSubclass = val; }
	// endregion

	// region Expanded spell sources
	set expandedSpellsRace (val) { this._state.expandedSpellsRace = val; }
	set expandedSpellsBackground (val) { this._state.expandedSpellsBackground = val; }
	set expandedSpellsClass (val) { this._state.expandedSpellsClass = val; }
	set expandedSpellsSubclass (val) { this._state.expandedSpellsSubclass = val; }
	// endregion

	// region Learned cantrip sources
	set alwaysKnownSpellsRace (val) { this._state.alwaysKnownSpellsRace = val; }
	set alwaysKnownSpellsBackground (val) { this._state.alwaysKnownSpellsBackground = val; }
	set alwaysKnownSpellsClass (val) { this._state.alwaysKnownSpellsClass = val; }
	set alwaysKnownSpellsSubclass (val) { this._state.alwaysKnownSpellsSubclass = val; }
	// endregion

	async pGetFormData (filterValues) {
		return {
			isFormComplete: (this._state.cntLearnedCantrips === this._state.maxLearnedCantrips || 0)
				&& (this._state.cntPrepared === this._state.maxPrepared || 0),
			data: {
				spells: this._compsLevel.map(comp => comp.getFormSubData(filterValues)).flat(),
			},
		};
	}

	_getDefaultState () {
		return {
			spellLevelLow: null,
			spellLevelHigh: null,
			ixViewedSpell: null,

			cntLearnedCantrips: 0,
			maxLearnedCantrips: null,

			fixedLearnedProgression: null,
			pulseFixedLearned: false,

			cntPrepared: 0,
			maxPrepared: null,

			alwaysPreparedSpellsRace: [],
			alwaysPreparedSpellsBackground: [],
			alwaysPreparedSpellsClass: [],
			alwaysPreparedSpellsSubclass: [],
			// region TODO(future) unused; consider handling in the future
			alwaysPreparedSpellsFeat: {},
			// endregion

			expandedSpellsRace: [],
			expandedSpellsBackground: [],
			expandedSpellsClass: [],
			expandedSpellsSubclass: [],
			// region TODO(future) unused; consider handling in the future
			expandedSpellsFeat: {},
			// endregion

			alwaysKnownSpellsRace: [],
			alwaysKnownSpellsBackground: [],
			alwaysKnownSpellsClass: [],
			alwaysKnownSpellsSubclass: [],
			// region TODO(future) unused; consider handling in the future
			alwaysKnownSpellsFeat: {},
			// endregion

			casterProgression: null,

			isIncludeUaEtcSpellLists: false,
		};
	}

	/** Map one class to another for the purpose of "class spell" lookups. */
	static _getMappedClassDetails ({className, classSource}) {
		return Charactermancer_Spell_Level._CLASS_MAP?.[classSource]?.[className] || {className, classSource};
	}
}
Charactermancer_Spell._IMPORT_LIST_SPELL = null;
Charactermancer_Spell._CLASS_MAP = {
	[SRC_UATRR]: {
		"Ranger (Revised)": {
			className: "Ranger",
			classSource: SRC_PHB,
		},
	},
};

Charactermancer_Spell.ExistingSpell = class {
	constructor ({item, isLearned, isPrepared, isAlwaysPrepared}) {
		this.item = item; // The current sheet item
		this.isLearned = isLearned;
		this.isPrepared = isPrepared;
		this.isAlwaysPrepared = isAlwaysPrepared;
	}
};

class Charactermancer_Spell_Modal extends Charactermancer_Spell {
	constructor (opts) {
		opts.pageFilter = new PageFilterSpells();

		super(opts);
	}

	static pGetUserInput (opts) {
		const comp = new this(opts);
		comp.maxLearnedCantrips = opts.maxLearnedCantrips;

		return UtilApplications.pGetImportCompApplicationFormData({
			comp,
			width: Util.getMaxWindowWidth(1200),
			height: Util.getMaxWindowHeight(),
		});
	}

	get modalTitle () { return `Select Cantrips`; }

	pRender ($wrpModalInner) {
		const $wrpLhs = $(`<div class="ve-flex-col h-100 w-50"></div>`);
		const $wrpRhs = $(`<div class="ve-flex-col h-100 w-50"></div>`);

		const pRender = this._render_pFilterBox($wrpLhs);
		$wrpRhs.append(`<i class="ve-muted text-center">Select a spell to view it here.</i>`);

		$$`<div class="split w-100 h-100">
			${$wrpLhs}
			<div class="vr-1 h-100"></div>
			${$wrpRhs}
		</div>`.appendTo($wrpModalInner);

		super.render($wrpLhs, $wrpRhs);

		return pRender
			.then(() => {
				this.handleFilterChange(this._pageFilter.filterBox.getValues());
			});
	}

	_render_pFilterBox ($wrp) {
		const $btnFilter = $(`<button class="btn-5et veapp__btn-filter">Filter</button>`);
		const $btnToggleFilterSummary = $(`<button class="btn btn-5et" title="Toggle Filter Summary Display"><span class="glyphicon glyphicon-resize-small"></span></button>`);
		const $iptSearch = $(`<input type="search" class="search w-100 form-control" placeholder="Find spell...">`);
		const $btnReset = $(`<button class="btn-5et veapp__btn-list-reset">Reset</button>`)
			.click(() => $iptSearch.val("").keyup());

		const $wrpMiniPills = $(`<div class="fltr__mini-view btn-group"></div>`);

		$$($wrp)`
			<div class="ve-flex-v-stretch input-group input-group--top no-shrink">
				${$btnFilter}
				${$btnToggleFilterSummary}
				${$iptSearch}
				${$btnReset}
			</div>
			${$wrpMiniPills}
			<div class="ve-flex-v-stretch input-group input-group--bottom mb-1 no-shrink">
				<button class="btn-5et w-100" disabled></button>
			</div>
		`;

		return this._pageFilter.pInitFilterBox({
			$iptSearch: $iptSearch,
			$btnReset: $btnReset,
			$btnOpen: $btnFilter,
			$btnToggleSummaryHidden: $btnToggleFilterSummary,
			$wrpMiniPills: $wrpMiniPills,
			namespace: `Charactermancer_Spell_Modal.filter`,
		}).then(() => {
			this._spellDatas.forEach(it => this._pageFilter.mutateAndAddToFilters(it));

			this._pageFilter.trimState();
			this._pageFilter.filterBox.render();

			UiUtil.bindTypingEnd({
				$ipt: $iptSearch,
				fnKeyup: () => {
					const val = List.getCleanSearchTerm($iptSearch.val());
					if (this._lastSearchTermSpells === val) return;
					this._lastSearchTermSpells = val;

					this.handleSearch(val);
				},
			});

			this._pageFilter.filterBox.on(FilterBox.EVNT_VALCHANGE, () => {
				this.handleFilterChange(this._pageFilter.filterBox.getValues());
			});
		});
	}
}

class Charactermancer_Spell_Level extends BaseComponent {
	/**
	 * opts
	 * opts.spellDatas
	 * opts.spellLevel
	 * opts.parent
	 */
	constructor (opts) {
		super();
		opts = opts || {};

		this._spellDatas = opts.spellDatas;
		this._spellLevel = opts.spellLevel;
		this._parent = opts.parent;

		this._$wrpRows = null;
		this._$dispNoRows = null;
		this._list = null;
	}

	_isAvailableSpell (sp) {
		return sp.level === this._spellLevel;
	}

	render ($wrp) {
		this._$wrpRows = $$`<div class="ve-flex-col manc__list mt-1 mb-3"></div>`;

		this._$dispNoRows = $(`<div class="ve-flex-vh-center italic ve-muted ve-small mt-1">No matching spells</div>`).hideVe();
		const doUpdateDispNoRows = () => {
			this._$dispNoRows.toggleVe(!this._list.visibleItems.length && $btnToggle.text() !== "[+]");
		};

		const $wrpBtnsSort = $(`<div class="ve-flex-v-stretch input-group no-shrink">
			<button class="btn-5et btn-xxs col-3-2 pr-1 sort" data-sort="name">Name</button>
			<button class="btn-5et btn-xxs col-1-2 px-1 sort" data-sort="time">Time</button>
			<button class="btn-5et btn-xxs col-1-2 px-1 sort" data-sort="school">School</button>
			<button class="btn-5et btn-xxs col-0-5 px-1 sort" data-sort="concentration" title="Concentration">C.</button>
			<button class="btn-5et btn-xxs col-0-5 px-1 sort" data-sort="ritual" title="Ritual">R.</button>
			<button class="btn-5et btn-xxs col-2-6 px-1 sort" data-sort="range">Range</button>
			<button class="btn-5et btn-xxs col-1-2 px-1 sort" data-sort="source">Source</button>
			<button class="btn-5et btn-xxs col-1-6 pl-1" disabled>&nbsp;</button>
		</div>`);

		this._list = new List({
			$wrpList: this._$wrpRows,
			fnSort: PageFilterSpells.sortSpells,
			fnSearch: (li, searchTerm) => {
				const {ixLearned, ixPrepared, ixAlwaysPrepared, ixAlwaysKnownSpell} = this.constructor._getProps(li.ix);

				// Force-show any "active" rows
				if ([ixLearned, ixPrepared, ixAlwaysPrepared, ixAlwaysKnownSpell].some(k => this._state[k])) return true;

				return li.searchText.includes(searchTerm);
			},
		});
		SortUtil.initBtnSortHandlers($wrpBtnsSort, this._list);

		this._list.on("updated", () => doUpdateDispNoRows());

		const $btnToggle = $(`<div class="py-1 clickable ve-muted">[\u2012]</div>`)
			.click(() => {
				$btnToggle.text($btnToggle.text() === "[+]" ? "[\u2012]" : "[+]");
				this._$wrpRows.toggleVe();
				$wrpBtnsSort.toggleVe();
				doUpdateDispNoRows();
			});

		const $wrpInner = $$`<div class="ve-flex-col w-100">
			<div class="split-v-center">
				<div class="bold">${Parser.spLevelToFullLevelText(this._spellLevel)}</div>
				${$btnToggle}
			</div>
			${$wrpBtnsSort}
			${this._$dispNoRows}
			${this._$wrpRows}
		</div>`.appendTo($wrp);

		const len = this._spellDatas.length;
		for (let i = 0; i < len; ++i) {
			const sp = this._spellDatas[i];

			if (!this._isAvailableSpell(sp)) continue;

			const listItem = this._getListItem(sp, i);
			if (!listItem) continue;
			this._list.addItem(listItem);
		}

		this._list.init();

		const hkSpellLevel = () => {
			const isWithinRange = this._isWithinLevelRange();

			$wrpInner.toggleVe(isWithinRange);
			if (!isWithinRange) this._resetLevelSpells();
		};
		this._parent.addHookMaxLearnedCantrips(hkSpellLevel);
		this._parent.addHookSpellLevelLow(hkSpellLevel);
		this._parent.addHookSpellLevelHigh(hkSpellLevel);
		this._parent.addHookFixedLearnedProgression(hkSpellLevel);
		hkSpellLevel();

		if (this._spellLevel === 0) this._render_bindCantripHooks();
		else this._render_bindLevelledSpellHooks();
	}

	_render_bindCantripHooks () {
		const hkIsMaxLearnedCantrips = () => {
			this._$wrpRows.toggleClass("manc-sp__is-max-learned-cantrips", !this._parent.canLearnMoreCantrips_());
			this._$wrpRows.toggleClass("manc-sp__is-max-learned-cantrips--is-over-limit", this._parent.isOverLearnCantripsLimit_());
		};
		this._parent.addHookIsMaxLearnedCantrips(hkIsMaxLearnedCantrips);
		hkIsMaxLearnedCantrips();
	}

	_render_bindLevelledSpellHooks () {
		const hkIsPrepared = () => this._$wrpRows.toggleClass("manc-sp__is-prepared-caster", this._parent.isPreparedCaster);
		this._parent.addHookIsPreparedCaster(hkIsPrepared);
		hkIsPrepared();

		const hkIsMaxLearnedSpells = () => {
			const isLearnCaster = this._parent.isLearnedFixedSpellCasterAtLevel_(this._spellLevel);

			let isMaxLearnedSpells = true;
			let isOverMaxLearnedSpells = true;

			if (isLearnCaster) {
				if (this._parent.canLearnMoreFixedSpellsOfLevel_(this._spellLevel)) isMaxLearnedSpells = false;
				if (!this._parent.isOverLearnFixedSpellsLimitOfLevel_(this._spellLevel)) isOverMaxLearnedSpells = false;
			}

			this._$wrpRows.toggleClass("manc-sp__is-learn-caster", isLearnCaster);
			this._$wrpRows.toggleClass("manc-sp__is-max-learned-spells", isLearnCaster && isMaxLearnedSpells);
			this._$wrpRows.toggleClass("manc-sp__is-max-learned-spells--is-over-limit", isLearnCaster && isOverMaxLearnedSpells);
		};
		this._parent.addHookIsMaxLearnedSpells(hkIsMaxLearnedSpells);
		hkIsMaxLearnedSpells();

		const hkIsMaxPrepared = () => {
			this._$wrpRows.toggleClass("manc-sp__is-max-prepared-spells", !this._parent.canPrepareMore_());
			this._$wrpRows.toggleClass("manc-sp__is-max-prepared-spells--is-over-limit", this._parent.isOverPrepareLimit_());
		};
		this._parent.addHookIsMaxPrepared(hkIsMaxPrepared);
		hkIsMaxPrepared();
	}

	_isWithinLevelRange () {
		// If we have a fixed number of spells available at this level, e.g. Warlock Mystic Arcanum, it's within range
		if (this._spellLevel !== 0 && this._parent.fixedLearnedProgression != null && this._parent.fixedLearnedProgression[this._spellLevel - 1]) return true;

		if (this._spellLevel === 0) {
			// If it's the cantrip level, hide it if the parent doesn't have cantrips
			return !!this._parent.maxLearnedCantrips;
		}

		return this._spellLevel >= (this._parent.spellLevelLow ?? Number.MAX_SAFE_INTEGER)
			&& this._spellLevel <= (this._parent.spellLevelHigh ?? Number.MIN_SAFE_INTEGER);
	}

	_getListItem (spell, spI) {
		const {ixLearned, ixPrepared, ixAlwaysPrepared, ixAlwaysKnownSpell} = this.constructor._getProps(spI);

		const existingSpellMeta = this._parent.getExistingSpellMeta_(spell);
		if (existingSpellMeta) {
			if (existingSpellMeta.isLearned) {
				this._state[ixLearned] = true;
				if (spell.level === 0) this._parent.cntLearnedCantrips++;
			}

			if (existingSpellMeta.isPrepared && !existingSpellMeta.isAlwaysPrepared) {
				this._state[ixPrepared] = true;
				this._parent.cntPrepared++;
			}

			if (existingSpellMeta.isAlwaysPrepared) {
				this._state[ixAlwaysPrepared] = true;
			}
		}

		const eleRow = document.createElement("div");
		eleRow.className = `ve-flex-v-center manc__list-row clickable veapp__list-row veapp__list-row-hoverable`;
		eleRow.dataset.ix = spI;

		const source = Parser.sourceJsonToAbv(spell.source);
		const time = PageFilterSpells.getTblTimeStr(spell.time[0]);
		const school = Parser.spSchoolAndSubschoolsAbvsShort(spell.school, spell.subschools);
		const concentration = spell._isConc ? "×" : "";
		const ritual = spell.meta?.ritual ? "×" : "";
		const range = Parser.spRangeToFull(spell.range);

		const isLearnDisabled = existingSpellMeta || this._state[ixAlwaysKnownSpell];

		const isPrepareDisabledExistingSpell = existingSpellMeta
			&& (this._spellLevel === 0 || existingSpellMeta.isLearned);
		const isPrepareDisabled = isPrepareDisabledExistingSpell || this._state[ixAlwaysPrepared];

		eleRow.innerHTML = `
			<div class="col-3-2 pl-0">${spell.name}</div>
			<div class="col-1-2 text-center">${time}</div>
			<div class="col-1-2 sp__school-${spell.school} text-center" title="${Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools)}" ${Parser.spSchoolAbvToStyle(spell.school)}>${school}</div>
			<div class="col-0-5 text-center bold imp-sp__disp-conc" title="Concentration">${concentration}</div>
			<div class="col-0-5 text-center bold imp-sp__disp-ritual" title="Ritual">${ritual}</div>
			<div class="col-2-6 text-right">${range}</div>
			<div class="col-1-2 text-center ${Parser.sourceJsonToColor(spell.source)}" title="${Parser.sourceJsonToFull(spell.source)}" ${BrewUtil.sourceJsonToStyle(spell.source)}>${source}</div>

			<div class="ve-flex-vh-center col-1-6 pr-0">
				<button
					class="btn manc__list-row-button ${this._spellLevel === 0 ? "manc-sp__btn-learn-cantrip" : "manc-sp__btn-learn-spell"} ${this._state[ixLearned] || existingSpellMeta?.isLearned || this._state[ixAlwaysKnownSpell] ? "active" : ""}"
					name="${this._spellLevel === 0 ? "btn-learn-cantrip" : "btn-learn-spell"}"
					${isLearnDisabled ? `disabled` : ""}
					${existingSpellMeta ? `data-plut-is-existing-spell="true"` : ""}
					${existingSpellMeta ? `title="(Previously Learned Spell)"` : ""}
				>Learn</button>

				${this._spellLevel !== 0 ? `<button
					class="btn manc__list-row-button manc-sp__btn-prepare ${this._state[ixPrepared] || this._state[ixAlwaysPrepared] || existingSpellMeta?.isPrepared || existingSpellMeta?.isAlwaysPrepared ? "active" : ""}"
					name="btn-prepare"
					title="${isPrepareDisabledExistingSpell ? `(Previously Added Spell)` : `Prepare`}"
					${isPrepareDisabled ? `disabled` : ""}
					${isPrepareDisabledExistingSpell ? `data-plut-is-existing-spell="true"` : ""}
				>Prep.</button>` : ""}
			</div>
		`;

		const elesBtns = eleRow.querySelectorAll("button");
		const [btnLearn, btnPrepare] = elesBtns;

		const listItem = new ListItem(
			spI,
			eleRow,
			spell.name,
			{
				source,
				level: spell.level,
				time,
				school: Parser.spSchoolAbvToFull(spell.school),
				concentration,
				ritual,
				normalisedTime: spell._normalisedTime,
				normalisedRange: spell._normalisedRange,
			},
			{
				btnLearn,
				btnPrepare,
			},
		);

		elesBtns.forEach(btn => {
			btn.addEventListener("click", evt => {
				evt.stopPropagation();
				evt.preventDefault();

				const isActive = btn.classList.contains("active");

				switch (btn.name) {
					case "btn-learn-cantrip": {
						if (!isActive && !this._parent.canLearnMoreCantrips_()) return;

						btn.classList.toggle("active");
						this._state[ixLearned] = !this._state[ixLearned];
						if (this._state[ixLearned]) this._parent.cntLearnedCantrips++;
						else this._parent.cntLearnedCantrips--;

						break;
					}

					case "btn-learn-spell": {
						this._handleListItemBtnLearnClick_doFixed({btnLearn, btnPrepare, isActive, ixPrepared, ixLearned});
						break;
					}

					case "btn-prepare": {
						if (!isActive && !this._parent.canPrepareMore_()) return;

						// If we are trying to prepare a spell which we have not learned (and we're a learned caster), try to
						//   learn the spell first. If we can't, cancel the prepare attempt.
						if (!isActive && this._parent.isLearnedFixedSpellCasterAtLevel_(this._spellLevel) && !this._state[ixLearned]) {
							const isLearned = this._handleListItemBtnLearnClick_doFixed({btnLearn, btnPrepare, isActive: this._state[ixLearned], ixPrepared, ixLearned});
							if (!isLearned) return;
						}

						btn.classList.toggle("active");
						this._state[ixPrepared] = !this._state[ixPrepared];
						if (this._state[ixPrepared]) this._parent.cntPrepared++;
						else this._parent.cntPrepared--;

						break;
					}

					default: throw new Error(`Unhandled button name: "${btn.name}"`);
				}
			});
		});

		eleRow.addEventListener("click", evt => {
			evt.stopPropagation();
			evt.preventDefault();

			if (this._parent.cacheSelectedListItem) this._parent.cacheSelectedListItem.ele.classList.remove("list-multi-selected");

			eleRow.classList.add("list-multi-selected");
			this._parent.ixViewedSpell = spI;
			this._parent.cacheSelectedListItem = listItem;
		});

		return listItem;
	}

	_handleListItemBtnLearnClick_do_doLearn ({btnLearn, btnPrepare, isActive, ixPrepared, ixLearned}) {
		// If we are un-learning a spell we have prepared, un-prepare the spell
		if (isActive && this._parent.isPreparedCaster && this._state[ixPrepared]) {
			this._state[ixPrepared] = false;
			btnPrepare.classList.remove("active");
			this._parent.cntPrepared--;
		}

		btnLearn.classList.toggle("active");
		this._state[ixLearned] = !this._state[ixLearned];
	}

	_handleListItemBtnLearnClick_doFixed ({btnLearn, btnPrepare, isActive, ixPrepared, ixLearned}) {
		if (!isActive && !this._parent.canLearnMoreFixedSpellsOfLevel_(this._spellLevel)) return false;

		this._handleListItemBtnLearnClick_do_doLearn({btnLearn, btnPrepare, isActive, ixPrepared, ixLearned});
		this._parent.pulseFixedLearned = !this._parent.pulseFixedLearned;

		return true;
	}

	handleFilterChange (f) {
		if (!this._list) return;

		this._list.filter(it => {
			const sp = this._spellDatas[it.ix];

			if (!this._parent.isAvailableClassSpell_(sp) && !this._parent.isAvailableSubclassSpell_(sp) && !this._parent.isAvailableExpandedSpell_(sp)) return false;

			const {ixLearned, ixPrepared, ixAlwaysPrepared, ixAlwaysKnownSpell} = this.constructor._getProps(it.ix);

			// Force-show any "active" rows
			if ([ixLearned, ixPrepared, ixAlwaysPrepared, ixAlwaysKnownSpell].some(k => this._state[k])) return true;

			return this._parent.pageFilter.toDisplay(f, sp);
		});
	}

	handleSearch (searchTerm) {
		this._list.search(searchTerm);
	}

	handleAlwaysPreparedSpells_ () {
		return this._handleAlwaysStateSpells_(
			{
				propIx: "ixPrepared",
				propIxAlways: "ixAlwaysPrepared",
				propBtn: "btnPrepare",
				propExistingSpellMetaAlways: "isAlwaysPrepared",
				fnParentCheckAlways: this._parent.isAlwaysPreparedSpell_.bind(this._parent),
			},
		);
	}

	handleAlwaysKnownSpells_ () {
		return this._handleAlwaysStateSpells_(
			{
				propIx: "ixLearned",
				propIxAlways: "ixAlwaysKnownSpell",
				propBtn: "btnLearn",
				fnParentCheckAlways: this._parent.isAlwaysKnownSpell_.bind(this._parent),
			},
		);
	}

	_handleAlwaysStateSpells_ (
		{
			propIx,
			propIxAlways,
			propBtn,
			propExistingSpellMetaAlways,
			fnParentCheckAlways,
			fnFilterSpell,
		},
	) {
		if (!this._list) return;

		this._list.items.forEach(it => {
			const sp = this._spellDatas[it.ix];

			if (fnFilterSpell && !fnFilterSpell(sp)) return;

			const existingSpellMeta = this._parent.getExistingSpellMeta_(sp);
			if (existingSpellMeta?.isLearned || existingSpellMeta?.isPrepared) return;

			const allProps = this.constructor._getProps(it.ix);
			const propIxProp = allProps[propIx];
			const propIxAlwaysProp = allProps[propIxAlways];

			const isAlways = (propExistingSpellMetaAlways && existingSpellMeta?.[propExistingSpellMetaAlways])
				|| fnParentCheckAlways(sp);

			// If it's always prepared/learned, don't count it as prepared/learned; instead, disable the button.
			if (isAlways) {
				// Consider the spell un-prepared/un-learned, as it does not count towards our total prepared/learned spells
				if (this._state[propIxProp]) {
					this._state[allProps[propIx]] = false;
					this._parent.cntPrepared--;
				}

				if (!this._state[propIxAlwaysProp] && it.data[propBtn]) {
					it.data[propBtn].classList.add("active");
					it.data[propBtn].disabled = true;
				}
			} else {
				if (this._state[propIxAlwaysProp] && it.data[propBtn]) {
					it.data[propBtn].classList.remove("active");
					it.data[propBtn].disabled = false;
				}
			}

			this._state[propIxAlwaysProp] = isAlways;
		});
	}

	static _getProps (ix) {
		return {
			ixLearned: `ix_learned_${ix}`,
			ixPrepared: `ix_prepared_${ix}`,
			ixAlwaysPrepared: `ix_always_prepared_${ix}`,
			ixAlwaysKnownSpell: `ix_always_known_spell_${ix}`,
		};
	}

	/** Clean up any lingering state, to ensure we don't learn/prepare spells that are outside our level range. */
	_resetLevelSpells () {
		let numDeLearned = 0;
		let numDePrepared = 0;
		const nxtState = {};

		const len = this._spellDatas.length;
		for (let i = 0; i < len; ++i) {
			const sp = this._spellDatas[i];

			if (!this._isAvailableSpell(sp)) continue;

			const existingSpellMeta = this._parent.getExistingSpellMeta_(sp);
			if (existingSpellMeta) continue;

			const {ixLearned, ixPrepared, ixAlwaysPrepared, ixAlwaysKnownSpell} = this.constructor._getProps(i);

			if (this._state[ixLearned]) {
				nxtState[ixLearned] = false;
				numDeLearned++;
			}

			if (this._state[ixPrepared]) {
				nxtState[ixPrepared] = false;
				numDePrepared++;
			}

			if (this._state[ixAlwaysPrepared]) nxtState[ixAlwaysPrepared] = false;

			if (this._state[ixAlwaysKnownSpell]) nxtState[ixAlwaysKnownSpell] = false;
		}

		this._proxyAssignSimple("state", nxtState);

		if (numDeLearned) {
			if (this._spellLevel === 0) {
				this._parent.cntLearnedCantrips -= numDeLearned;
				this._$wrpRows[0].querySelectorAll(`.manc-sp__btn-learn-cantrip`).forEach(it => {
					if (it.dataset?.["plut-is-existing-spell"]) return;
					it.classList.remove("active");
				});
			} else {
				this._parent.cntLearnedSpells -= numDeLearned;
				this._$wrpRows[0].querySelectorAll(`.manc-sp__btn-learn-spell`).forEach(it => {
					if (it.dataset?.["plut-is-existing-spell"]) return;
					it.classList.remove("active");
				});
			}
		}

		if (numDePrepared) {
			this._parent.cntPrepared -= numDePrepared;
			this._$wrpRows[0].querySelectorAll(`.manc-sp__btn-prepare`).forEach(it => {
				if (it.dataset?.["plut-is-existing-spell"]) return;
				it.classList.remove("active");
			});
		}
	}

	getSpellsKnown () { // TODO this is a performance hog; find a way to speed it up (use state rather than looping every spell?)
		if (!this._isWithinLevelRange() || this._spellLevel === 0) return [];

		const out = [];

		const len = this._spellDatas.length;
		for (let i = 0; i < len; ++i) {
			const sp = this._spellDatas[i];

			if (!this._isAvailableSpell(sp)) continue;
			if (!this._parent.isAvailableClassSpell_(sp) && !this._parent.isAvailableSubclassSpell_(sp) && !this._parent.isAvailableExpandedSpell_(sp)) continue;

			const {ixLearned} = this.constructor._getProps(i);

			if (!this._state[ixLearned]) continue;

			out.push({
				ix: i,
				spell: this._spellDatas[i],
			});
		}

		return out;
	}

	getFormSubData (filterValues) {
		if (!this._isWithinLevelRange()) return [];

		const out = [];

		const isLearnedAtLevel = this._parent.isLearnedFixedSpellCasterAtLevel_(this._spellLevel);

		const len = this._spellDatas.length;
		for (let i = 0; i < len; ++i) {
			const sp = this._spellDatas[i];

			if (!this._isAvailableSpell(sp)) continue;
			if (!this._parent.isAvailableClassSpell_(sp) && !this._parent.isAvailableSubclassSpell_(sp) && !this._parent.isAvailableExpandedSpell_(sp)) continue;

			const {ixLearned, ixPrepared, ixAlwaysPrepared, ixAlwaysKnownSpell} = this.constructor._getProps(i);

			// If the spell is "always prepared" or an "always learned cantrip," ignore it,
			//   as a separate additional spell pass (i.e. `Charactermancer_FeatureOptionsSelect.pDoApplyAdditionalSpellsFormDataToActor`)
			//   will handle it.
			if (this._state[ixAlwaysPrepared] || this._state[ixAlwaysKnownSpell]) continue;

			const isLearned = this._state[ixLearned];
			const isPrepared = this._state[ixPrepared] || (this._spellLevel === 0 && isLearned);

			if (this._spellLevel === 0 && !isLearned) continue;

			let isUpdatePrepared = false;
			const existingSpellMeta = this._parent.getExistingSpellMeta_(sp);
			if (existingSpellMeta) {
				if (this._spellLevel === 0) continue;
				if (isLearnedAtLevel) continue;
				isUpdatePrepared = existingSpellMeta.isPrepared !== isPrepared;
				if (!isUpdatePrepared) continue;
			}

			// Track only learned spells if we're a learned spell caster. If we're a prepared spell caster, everything will
			//   be tracked.
			if (!isLearned && isLearnedAtLevel) continue;

			// For unused prepared caster spells that we would import, check that they match the current filters
			if (this._parent.isPreparedCaster && !isLearned && !isPrepared && !this._parent.pageFilter.toDisplay(filterValues, sp)) continue;

			const spellImportOpts = this._getFormSubData_getSpellImportOpts({isLearned});

			out.push(new Charactermancer_Spell_SpellMeta({
				...spellImportOpts,
				ix: i,
				spell: this._spellDatas[i],
				isPrepared,
				isLearned,
				isUpdateOnly: isUpdatePrepared,
				existingItemId: existingSpellMeta?.item?.id,
			}));
		}

		return out;
	}

	_getFormSubData_getSpellImportOpts ({isLearned}) {
		let preparationMode = "always";
		let usesCurrent = null;
		let usesMax = null;
		let usesPer = null;

		if (this._parent.casterProgression === "pact") {
			if (isLearned) {
				// Set e.g. Mythic Arcanum spells as "at-will", to avoid having them using spell slots
				if (this._spellLevel > UtilActors.PACT_CASTER_MAX_SPELL_LEVEL) {
					preparationMode = "atwill";
					usesCurrent = 1;
					usesMax = 1;
					usesPer = "lr";
				} else preparationMode = "pact";
			}
		} else {
			preparationMode = this._parent.isPreparedCaster ? "prepared" : "always";
		}

		return {preparationMode, usesCurrent, usesMax, usesPer};
	}
}

export {
	Charactermancer_Spell_Util,
	Charactermancer_Spell,
	Charactermancer_Spell_Modal,
};
