import {Vetools} from "./Vetools.js";
import {UtilActors} from "./UtilActors.js";
import {Config} from "./Config.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilApplications} from "./UtilApplications.js";
import {DataConverter} from "./DataConverter.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilDocuments} from "./UtilDocuments.js";

class DataConverterSpell {
	static _getConfigKeyIsSpellPoints (opts) {
		if (opts.actor?.type === "npc" || opts.isActorItemNpc) return "isSpellPointsNpc";
		return "isSpellPoints";
	}

	static isAllowSpellPoints (spell, opts) {
		return opts.target == null && opts.vetConsumes == null && Config.get("importSpell", this._getConfigKeyIsSpellPoints(opts)) && spell.level !== 0;
	}

	/**
	 *
	 * @param spell The spell entity.
	 * @param [opts] Options object.
	 * @param [opts.abilityAbv] A creature's spellcasting ability attribute (abbreviation).
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.isActorItem]
	 * @param [opts.isActorItemNpc]
	 * @param [opts.isPrepared]
	 * @param [opts.preparationMode]
	 * @param [opts.usesCurrent]
	 * @param [opts.usesMax]
	 * @param [opts.usesPer]
	 * @param [opts.consumeType]
	 * @param [opts.consumeAmount]
	 * @param [opts.consumeTarget]
	 * @param [opts.vetConsumes]
	 * @param [opts.durationAmount]
	 * @param [opts.durationUnit]
	 * @param [opts.castAtLevel] A level to force the spell to cast at *if it is an innate spell* (i.e., scaling dice
	 * will be set appropriately, as one cannot choose the casting level for innate spells).
	 *
	 * These parameters are used to link Charactermancer spells to their respective classes when re-loading the
	 * Charactermancer in order to level up.
	 * @param [opts.parentClassName]
	 * @param [opts.parentClassSource]
	 * @param [opts.parentSubclassName]
	 * @param [opts.parentSubclassSource]
	 * @param [opts.spellPointsItemId]
	 * @param [opts.actor]
	 * @param [opts.nameSuffix] A suffix to be added to the spell item's name, e.g. "(R)" for NPC rituals.
	 *
	 * @return {object} Item data.
	 */
	static async pGetSpellItem (spell, opts) {
		opts = opts || {};

		const srdData = await UtilCompendium.getSrdCompendiumEntity("spell", spell);

		const description = await this._pGetDescription(spell);

		const entriesStr = JSON.stringify(spell.entries);

		// region Prepared
		// Assume cantrips are always prepared
		let preparationMode = spell.level === 0 ? "always" : opts.preparationMode || "prepared";
		let isPrepared = spell.level === 0 ? true : !!opts.isPrepared;

		if (Config.get("importSpell", this._getConfigKeyIsSpellPoints(opts)) && spell.level !== 0 && (preparationMode === "prepared" || preparationMode === "always")) {
			// Avoid "spell slot" controls in spell points mode
			preparationMode = "atwill";
		}
		// endregion

		let actionType = "";
		if (spell.miscTags && spell.miscTags.includes("HL")) actionType = "heal";
		if (spell.savingThrow && spell.savingThrow.length) actionType = "save";
		if (entriesStr.toLowerCase().includes("melee spell attack")) actionType = "msak";
		if (entriesStr.toLowerCase().includes("ranged spell attack")) actionType = "rsak";
		actionType = actionType || "util";

		const school = UtilActors.VET_SPELL_SCHOOL_TO_ABV[spell.school] || "";
		const materials = spell.components && spell.components.m ? spell.components.m !== true ? `${spell.components.m.text || spell.components.m}` : "" : "";

		let durationVal = 0;
		let durationUnit = "";
		const duration0 = spell.duration[0];
		switch (duration0.type) {
			case "instant": durationUnit = "inst"; break;
			case "timed": {
				switch (duration0.duration.type) {
					case "turn": durationUnit = "turn"; durationVal = duration0.duration.amount; break;
					case "round": durationUnit = "round"; durationVal = duration0.duration.amount; break;
					case "minute": durationUnit = "minute"; durationVal = duration0.duration.amount; break;
					case "hour": durationUnit = "hour"; durationVal = duration0.duration.amount; break;
					case "day": durationUnit = "day"; durationVal = duration0.duration.amount; break;
					case "week": durationUnit = "day"; durationVal = duration0.duration.amount * 7; break;
					case "year": durationUnit = "year"; durationVal = duration0.duration.amount; break;
				}
				break;
			}
			case "permanent": durationUnit = "perm"; break;
			case "special": durationUnit = "spec"; break;
		}

		let rangeSize = 0;
		let rangeUnits = "";
		let targetSize = 0;
		let targetUnits = "";
		let targetType = "";
		switch (spell.range.type) {
			case RNG_SPECIAL: rangeUnits = "spec"; break;
			case RNG_POINT: {
				const dist = spell.range.distance;
				switch (dist.type) {
					case RNG_SELF: {
						targetUnits = "self";
						targetType = "self";
						rangeUnits = "self";
						break;
					}
					case RNG_UNLIMITED:
					case RNG_UNLIMITED_SAME_PLANE:
					case RNG_SIGHT:
					case RNG_SPECIAL: {
						targetUnits = "spec";
						rangeUnits = "spec";
						break;
					}
					case RNG_TOUCH: {
						targetUnits = "touch";
						rangeUnits = "touch";
						break;
					}
					case UNT_MILES: {
						rangeSize = Config.getMetricNumber({configGroup: "importSpell", originalValue: dist.amount, originalUnit: UNT_MILES});
						rangeUnits = Config.getMetricUnit({configGroup: "importSpell", originalUnit: UNT_MILES});
						break;
					}
					case UNT_FEET:
					default: {
						rangeSize = Config.getMetricNumber({configGroup: "importSpell", originalValue: dist.amount, originalUnit: UNT_FEET});
						rangeUnits = Config.getMetricUnit({configGroup: "importSpell", originalUnit: UNT_FEET});
						break;
					}
				}
				break;
			}
			case RNG_LINE:
			case RNG_CUBE:
			case RNG_CONE:
			case RNG_RADIUS:
			case RNG_SPHERE:
			case RNG_HEMISPHERE:
			case RNG_CYLINDER: {
				targetSize = Config.getMetricNumber({configGroup: "importSpell", originalValue: spell.range.distance.amount, originalUnit: spell.range.distance.type});

				targetUnits = Config.getMetricUnit({configGroup: "importSpell", originalUnit: spell.range.distance.type});

				if (spell.range.type === RNG_HEMISPHERE) targetType = "sphere";
				else targetType = spell.range.type; // all others map directly to FVTT values
			}
		}

		let damageParts = [];
		let cantripScaling = null;
		let scaling = null;
		let isCustomDamageParts = false; // Avoid using SRD damage if this is set

		if (spell.scalingLevelDice) { // cantrips with parsed out values
			const scalingLevelDice = [spell.scalingLevelDice].flat(); // convert object version to array

			const getLowestKey = scaling => Math.min(...Object.keys(scaling).map(k => Number(k)));
			const reDamageType = new RegExp(`(${UtilActors.VALID_DAMAGE_TYPES.join("|")})`, "i");

			damageParts.push(...scalingLevelDice.map(scl => {
				const lowKey = getLowestKey(scl.scaling);
				const lowDice = scl.scaling[lowKey];

				const mDamageType = reDamageType.exec(scl.label || "");

				return [
					(lowDice || "").replace(/{{spellcasting_mod}}/g, "@mod"),
					mDamageType ? mDamageType[1].toLowerCase() : null,
				];
			}));

			// TODO(Future): fix this for e.g. Toll the Dead if Foundry supports multiple scaling damage dice in future
			const firstScaling = scalingLevelDice[0];
			const lowKey = getLowestKey(firstScaling.scaling);
			cantripScaling = firstScaling.scaling[lowKey];
		} else {
			let damageTuples = []; // (<damage_dice>, <damage_type>)

			if (spell.damageInflict && spell.damageInflict.length) {
				// Try to extract cantrip scaling first
				if (entriesStr.toLowerCase().includes("when you reach 5th level")) {
					const diceTiers = [];
					// Find cantrip scaling values, which are shown in brackets
					entriesStr.replace(/\({@damage ([^}]+)}\)/g, (...m) => diceTiers.push(m[1]));
					// Cantrips scale at levels 5, 11, and 17
					if (diceTiers.length === 3) {
						// Find dice _not_ in brackets
						const baseVal = /(?:^|[^(]){@damage ([^}]+)}(?:[^)]|$)/.exec(entriesStr);
						if (baseVal) cantripScaling = baseVal[1];
						// failing that, just use the first bracketed value
						else cantripScaling = diceTiers[0];
					}
				}

				this._pGetSpellItem_parseAndAddDamage(entriesStr, damageTuples);
			}

			if (spell.miscTags && spell.miscTags.some(str => str === "HL")) {
				const healingTuple = ["", "healing"];

				// Arbitrarily pick the first dice expression we find
				entriesStr.replace(this._getReDiceYourSpellcastingMod(), (...m) => {
					const [, dicePart, modPart] = m;

					healingTuple[0] = dicePart;
					if (modPart) healingTuple[0] = `${healingTuple[0]} + @mod`;
				});

				damageTuples.push(healingTuple);
			}

			const metaHigherLevel = this._pGetSpellItem_getHigherLevelMeta({spell, opts, damageTuples, isCustomDamageParts, scaling, preparationMode});
			if (metaHigherLevel) {
				damageTuples = metaHigherLevel.damageTuples;
				isCustomDamageParts = metaHigherLevel.isCustomDamageParts;
				scaling = metaHigherLevel.scaling;
			}

			// Do a final step to scoop up any damage info we might have missed, if we have yet to find any
			if (!damageTuples.length) this._pGetSpellItem_parseAndAddDamage(entriesStr, damageTuples);

			damageParts.push(...damageTuples);
		}
		damageParts = damageParts.filter(Boolean);

		let formula = "";
		// If there are no damage parts, arbitrarily pick the first dice expression and use that as the "other formula"
		if (!damageParts.length && !isCustomDamageParts && !MiscUtil.get(srdData, "data", "damage", "parts")) {
			entriesStr.replace(this._getReDiceYourSpellcastingMod(), (...m) => {
				const [, dicePart, modPart] = m;

				formula = dicePart;
				if (modPart) formula = `${formula} + @mod`;
			});
		}

		let savingThrow = "";
		if (spell.savingThrow && spell.savingThrow.length) savingThrow = spell.savingThrow[0].substring(0, 3).toLowerCase();

		let saveScaling = "spell";
		if (opts.abilityAbv) saveScaling = opts.abilityAbv;

		const {type: consumeType, amount: consumeAmount, target: consumeTarget} = this._pGetSpellItem_getConsumes({spell, opts});

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await this._pGetSpellItem_getSpellImagePath(spell),
		);

		// region Apply data from the SRD compendium, if available
		if (srdData) {
			targetSize = Config.getMetricNumber({configGroup: "importSpell", originalValue: MiscUtil.get(srdData, "data", "target", "value"), originalUnit: UNT_FEET}) || targetSize;
			targetUnits = Config.getMetricUnit({configGroup: "importSpell", originalUnit: MiscUtil.get(srdData, "data", "target", "units")}) || targetUnits;
			targetType = MiscUtil.get(srdData, "data", "target", "type") || targetType;
			if (!isCustomDamageParts) damageParts = MiscUtil.get(srdData, "data", "damage", "parts") || damageParts;
			if (!cantripScaling && !scaling) scaling = MiscUtil.get(srdData, "data", "scaling", "formula");
		}
		// endregion

		const additionalData = await this._pGetAdditionalData(spell, {targetUnits});
		const additionalFlags = await this._pGetAdditionalFlags(spell);

		// region Apply custom options data
		if (opts.durationAmount !== undefined) durationVal = opts.durationAmount;
		if (opts.durationUnit !== undefined) durationUnit = opts.durationUnit;
		// endregion

		const out = {
			name: UtilApplications.getCleanEntityName(`${UtilDataConverter.getNameWithSourcePart(spell, {isActorItem: opts.isActorItem})}${opts.nameSuffix || ""}`),
			type: "spell",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(spell),
				description: {value: description, chat: "", unidentified: ""},

				actionType: actionType,
				level: this._pGetSpellItem_getLevel(spell),
				school: school,
				components: {
					value: "",
					vocal: spell.components && spell.components.v,
					somatic: spell.components && spell.components.s,
					material: !!(spell.components && spell.components.m),
					ritual: spell.meta && spell.meta.ritual,
					concentration: !!MiscUtil.get(spell, "duration", "0", "concentration"),
				},
				materials: {
					value: materials,
					consumed: !!MiscUtil.get(spell, "components", "m", "consume"),
					cost: Math.round((MiscUtil.get(spell, "components", "m", "cost") || 0) / 100),
					supply: 0,
				},
				target: {value: targetSize, units: targetUnits, type: targetType},
				range: {value: rangeSize, units: rangeUnits, long: null},
				activation: {
					type: spell.time[0].unit,
					cost: spell.time[0].number,
					condition: Renderer.stripTags(spell.time[0].condition || ""),
				},
				duration: {
					value: durationVal,
					units: durationUnit,
				},
				damage: {
					parts: damageParts,
					versatile: "",
				},
				scaling: {
					mode: cantripScaling ? "cantrip" : scaling ? "level" : "none",
					formula: cantripScaling || scaling || "",
				},
				save: {ability: savingThrow, dc: null, scaling: saveScaling},
				ability: opts.abilityAbv || "",
				uses: {
					value: opts.usesCurrent || 0,
					max: opts.usesMax || 0,
					per: opts.usesPer || "",
				},
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				formula,
				preparation: {
					mode: preparationMode,
					prepared: isPrepared,
				},
				consume: {
					type: consumeType,
					target: consumeTarget,
					amount: consumeAmount,
				},
				...(additionalData || {}),
			},
			img,
			flags: {
				...this._getSpellFlags(spell, opts),
				...additionalFlags,
			},
			effects: await this._pGetSpellEffects(spell, srdData, img),
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importSpell", "permissions")};

		return out;
	}

	static _pGetSpellItem_getConsumes ({spell, opts}) {
		const out = {
			type: opts.consumeType ?? "",
			target: opts.consumeTarget ?? null,
			amount: opts.consumeAmount ?? null,
		};

		if (opts.vetConsumes) {
			out.type = "charges";
			out.amount = opts.vetConsumes.amount ?? 1;

			const sheetItem = DataConverter.getConsumedSheetItem({consumes: opts.vetConsumes, actor: opts.actor});
			if (!sheetItem) return out;

			out.target = sheetItem.id;

			return out;
		}

		if (this.isAllowSpellPoints(spell, opts)) {
			const resource = Config.getSpellPointsResource({isValueKey: true});
			out.amount = Parser.spLevelToSpellPoints(spell.level);

			if (resource === ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM) {
				out.type = "charges";
				out.target = opts.spellPointsItemId;
			} else {
				out.type = "attribute";
				out.target = resource;
			}
		}

		return out;
	}

	static _pGetSpellItem_getLevel (spell) {
		if (!isNaN(spell.level) && spell.level >= 0 && spell.level <= 9) return Math.round(spell.level);
		if (!isNaN(spell.level)) return Math.clamped(Math.round(spell.level), 0, 9);
		return 0;
	}

	static async _pGetSpellItem_getSpellImagePath (spell) {
		if (spell.foundryImg) return spell.foundryImg;

		const getters = [
			this._pGetSpellItem_getSpellImagePath_fromPlutonium.bind(this, spell),
			this._pGetSpellItem_getSpellImagePath_fromFoundry.bind(this, spell),
		];
		if (Config.get("import", "isPreferFoundryImages")) getters.reverse();

		for (const getter of getters) {
			const url = await getter();
			if (url) return url;
		}

		switch (spell.school) {
			case "A": return `icons/magic/defensive/shield-barrier-blue.webp`;
			case "C": return `icons/magic/unholy/silhouette-evil-horned-giant.webp`;
			case "D": return `icons/magic/perception/orb-eye-scrying.webp`;
			case "E": return `icons/magic/air/wind-vortex-swirl-purple.webp`;
			case "V": return `icons/magic/fire/projectile-fireball-orange-yellow.webp`;
			case "I": return `icons/magic/defensive/illusion-evasion-echo-purple.webp`;
			case "N": return `icons/magic/unholy/hand-fire-skeleton-pink.webp`;
			case "T": return `icons/magic/movement/abstract-ribbons-red-orange.webp`;
			default: return `modules/${SharedConsts.MODULE_NAME}/media/icon/scroll-unfurled.svg`;
		}
	}

	static async _pGetSpellItem_getSpellImagePath_fromFoundry (spell) { return UtilCompendium.pGetCompendiumImage("spell", spell); }
	static async _pGetSpellItem_getSpellImagePath_fromPlutonium (spell) { return DataConverter.pGetIconImage("spell", spell); }

	static _getSpellFlags (
		spell,
		{
			parentClassName,
			parentClassSource,
			parentSubclassName,
			parentSubclassSource,
		} = {},
	) {
		const out = {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_SPELLS,
				source: spell.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_SPELLS](spell),
				propDroppable: "spell",
			},
		};

		if (!parentClassName && !parentClassSource && !parentSubclassName && !parentSubclassSource) return out;

		out[SharedConsts.MODULE_NAME_FAKE].parentClassName = parentClassName;
		out[SharedConsts.MODULE_NAME_FAKE].parentClassSource = parentClassSource;
		out[SharedConsts.MODULE_NAME_FAKE].parentSubclassName = parentSubclassName;
		out[SharedConsts.MODULE_NAME_FAKE].parentSubclassSource = parentSubclassSource;

		return out;
	}

	static async _pGetSpellEffects (spell, srdData, img) {
		const out = MiscUtil.copy(srdData?.effects || []);
		out.forEach(effect => effect.icon = img);

		if (await this.pHasSpellSideLoadedEffects(null, spell)) {
			out.push(...(await this.pGetSpellItemEffects(null, spell, null, {img})));
		}

		out.forEach(effect => {
			const disabled = Config.get("importSpell", "setEffectDisabled");
			if (disabled !== ConfigConsts.C_USE_PLUT_VALUE) effect.disabled = disabled === ConfigConsts.C_BOOL_ENABLED;
			const transfer = Config.get("importSpell", "setEffectTransfer");
			if (transfer !== ConfigConsts.C_USE_PLUT_VALUE) effect.transfer = transfer === ConfigConsts.C_BOOL_ENABLED;
		});

		return out;
	}

	static _pGetSpellItem_parseAndAddDamage (entriesStr, damageTuples) {
		// If there's a damage type, try find the spell's damage
		entriesStr.replace(/{@damage ([^}]+)} ([^ ]+)(, [^ ]+)*(,? or [^ ]+)? damage/ig, (...m) => {
			// TODO(Future): add multiple damage types as choices when Foundry supports this--for now, just
			//   choose the first we find
			damageTuples.push([m[1], m[2]]);
		});
	}

	static _getReDiceYourSpellcastingMod () {
		// Only capture the first result (i.e. no [g]lobal)
		return /{@dice ([^}]+)}(\s*\+\s*your\s+spellcasting\s+ability\s+modifier)?/i;
	}

	static _pGetSpellItem_getHigherLevelMeta (
		{
			spell,
			opts,
			damageTuples,
			isCustomDamageParts,
			scaling,
			preparationMode,
		},
	) {
		if (!spell.entriesHigherLevel) return;

		const out = {
			damageTuples: MiscUtil.copy(damageTuples),
			isCustomDamageParts,
			scaling,
		};

		const reHigherLevel = /{@(?:scaledice|scaledamage) ([^}]+)}/gi;
		const resAdditionalNumber = [
			/\badditional (?<addPerLevel>\d+) for each (?:slot )?level\b/gi,
			/\bincreases by (?<addPerLevel>\d+) for each (?:slot )?level\b/gi,
		];

		let fnStr = null;

		// region Innate spellcasters
		const ixsScaled = new Set(); // Track which we've scaled, to avoid scaling the same tuple multiple times

		const fnStrInnate = str => {
			str
				.replace(reHigherLevel, (...m) => {
					const [base] = m[1].split("|").map(it => it.trim());

					const [tag, text] = Renderer.splitFirstSpace(m[0].slice(1, -1));
					const scaleOptions = Renderer.parseScaleDice(tag, text);

					const ixDamageTuple = out.damageTuples.findIndex(it => (it[0] || "").trim().toLowerCase() === base.toLowerCase());
					if (!ixsScaled.has(ixDamageTuple) && ~ixDamageTuple) {
						const diceAtLevel = scaleOptions?.prompt?.options?.[opts.castAtLevel];
						if (diceAtLevel) {
							ixsScaled.add(ixDamageTuple);
							out.damageTuples[ixDamageTuple][0] += `+ ${diceAtLevel}`;
							out.isCustomDamageParts = true;
						}
					}
				});

			resAdditionalNumber.forEach(re => {
				str
					.replace(re, (...m) => {
						if (!out.damageTuples.length) return;

						const toAdd = opts.castAtLevel * Number(m.last().addPerLevel);
						// For generic "add N"s (e.g. the Aid spell) add to the first dice expression
						out.damageTuples[0][0] += `+ ${toAdd}`;
						out.isCustomDamageParts = true;
					});
			});
		};
		// endregion

		// region Standard spellcasters
		// FIXME(future) FVTT doesn't yet support progression in non-linear increments, or multiple scaling
		//   modes, so just pick the first one
		const fnStrStandard = str => {
			if (out.scaling) return;

			str
				.replace(reHigherLevel, (...m) => {
					if (out.scaling) return;

					const [, , addPerProgress] = m[1].split("|");
					out.scaling = addPerProgress;
				});
			resAdditionalNumber.forEach(re => {
				str
					.replace(re, (...m) => {
						if (out.scaling) return;
						out.scaling = m.last().addPerLevel;
					});
			});
		};
		// endregion

		// For innate spells cast at a higher level, override the damage tuples with the upscaled version of the
		//   spell. We do this as Foundry doesn't let you choose the spell level when casting an innate spell.
		if (opts.castAtLevel != null && opts.castAtLevel !== spell.level && out.damageTuples.length && preparationMode === "innate") {
			fnStr = fnStrInnate;
		} else {
			fnStr = fnStrStandard;
		}

		MiscUtil.getWalker({isNoModification: true})
			.walk(
				spell.entriesHigherLevel,
				{
					string: str => fnStr(str),
				},
			);

		return out;
	}

	static _pGetDescription (spell) {
		if (!Config.get("importSpell", "isImportDescription")) return "";

		return UtilDataConverter.pGetWithDescriptionPlugins(async () => {
			const entries = await DataConverter.pGetEntryDescription(spell);
			const entriesHigherLevel = spell.entriesHigherLevel
				? await DataConverter.pGetEntryDescription(spell, {prop: "entriesHigherLevel"})
				: "";

			const stackPts = [entries, entriesHigherLevel];

			if (Config.get("importSpell", "isIncludeClassesInDescription")) {
				const fromClassList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
				if (fromClassList?.length) {
					const [current] = Parser.spClassesToCurrentAndLegacy(fromClassList);
					stackPts.push(`<div><span class="bold">Classes: </span>${Parser.spMainClassesToFull(current, {isTextOnly: true})}</div>`);
				}
			}

			return stackPts.filter(Boolean).join("");
		});
	}

	static async _pGetAdditionalData (spell, {targetUnits} = {}) {
		const out = await DataConverter.pGetAdditionalData_(spell, this._SIDE_DATA_OPTS);
		if (!out) return out;

		// Apply metric conversion to loaded data, if required
		if (out["target.value"]) out["target.value"] = Config.getMetricNumber({configGroup: "importSpell", originalValue: out["target.value"], originalUnit: out["target.units"] || targetUnits});
		if (out["target.units"]) out["target.units"] = Config.getMetricUnit({configGroup: "importSpell", originalUnit: out["target.units"] || targetUnits});

		return out;
	}

	static async _pGetAdditionalFlags (spell) {
		return DataConverter.pGetAdditionalFlags_(spell, this._SIDE_DATA_OPTS);
	}

	static getActorSpell (actor, name, source) {
		if (!name || !source) return null;
		return actor.items && actor.items.find(it =>
			(it.name || "").toLowerCase() === name.toLowerCase()
			&& (
				!Config.get("import", "isStrictMatching")
				|| (UtilDataConverter.getItemSource(it) || "").toLowerCase() === source.toLowerCase()
			),
		);
	}

	static async pSetSpellItemIsPrepared (item, isPrepared) {
		if (!item) return;
		await UtilDocuments.pUpdateDocument(item, {data: {preparation: {prepared: isPrepared}}});
	}

	static async pHasSpellSideLoadedEffects (actor, spell) {
		return (await DataConverter.pGetAdditionalEffectsRaw_(spell, this._SIDE_DATA_OPTS))?.length > 0;
	}

	static async pGetSpellItemEffects (actor, spell, sheetItem, {additionalData, img} = {}) {
		const effectsRaw = await DataConverter.pGetAdditionalEffectsRaw_(spell, this._SIDE_DATA_OPTS);
		return UtilActiveEffects.getExpandedEffects(effectsRaw || [], {actor, sheetItem, parentName: spell.name, additionalData, img});
	}

	static get _SIDE_DATA_OPTS () {
		return {propBrew: "foundrySpell", fnLoadJson: Vetools.pGetSpellSideData, propJson: "spell"};
	}
}

export {DataConverterSpell};
