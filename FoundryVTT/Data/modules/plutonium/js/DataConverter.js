import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilActors} from "./UtilActors.js";
import {Config} from "./Config.js";
import {UtilApplications} from "./UtilApplications.js";
import {Vetools} from "./Vetools.js";
import {Consts} from "./Consts.js";
import {
	Charactermancer_ConditionImmunitySelect,
	Charactermancer_DamageVulnerabilitySelect,
	Charactermancer_DamageResistanceSelect,
	Charactermancer_DamageImmunitySelect,
	Charactermancer_OtherProficiencySelect,
	Charactermancer_ExpertiseSelect,
} from "./UtilCharactermancer.js";
import {LGT, Util} from "./Util.js";
import {UtilCompat} from "./UtilCompat.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverter {
	static getTagUids (tag, str) {
		const re = new RegExp(`{@${tag} ([^}]+)}`, "gi");
		const out = [];
		str.replace(re, (...m) => out.push(m[1]));
		return out;
	}

	static async pGetIconImage (entityType, entity) {
		switch (entityType) {
			case "feat":
			case "spell": {
				const iconLookup = await Vetools.pGetIconLookup(entityType);
				const path = MiscUtil.get(iconLookup, entity.source, entity.name);
				if (!path) return null;
				return `modules/${SharedConsts.MODULE_NAME}/${path}`;
			}
			default: return null;
		}
	}

	/** Combine Foundry-specific data found on entries. Pure takes precedence over underscore. */
	static getCombinedFoundryData (foundryData, _foundryData) {
		if (!_foundryData && !foundryData) return {};

		const combinedFoundryData = MiscUtil.copy(_foundryData || {});
		Object.assign(combinedFoundryData, MiscUtil.copy(foundryData || {}));

		return combinedFoundryData;
	}

	/** Combine Foundry-specific flags found on entries. Pure takes precedence over underscore. */
	static getCombinedFoundryFlags (foundryFlags, _foundryFlags) {
		if (!foundryFlags && !_foundryFlags) return {};

		const combinedFoundryFlags = MiscUtil.copy(_foundryFlags || {});

		// Since flags are namespaced at the outer level, overwrite entries at one level deep.
		Object.entries(MiscUtil.copy(foundryFlags || {}))
			.forEach(([flagNamespace, flagData]) => {
				if (!combinedFoundryFlags[flagNamespace]) return combinedFoundryFlags[flagNamespace] = flagData;
				Object.assign(combinedFoundryFlags[flagNamespace], flagData);
			});

		return combinedFoundryFlags;
	}

	/**
	 * @param entry Entry to render.
	 * @param [opts] Options object.
	 * @param [opts.prop] Entry property.
	 * @param [opts.depth] Render depth.
	 * @param [opts.summonSpellLevel]
	 * @return {Promise<String>}
	 */
	static async pGetEntryDescription (entry, opts) {
		opts = opts || {};
		opts.prop = opts.prop || "entries";

		let description = "";
		if (entry[opts.prop]) {
			let cpyEntries = MiscUtil.copy(entry[opts.prop]);

			cpyEntries = UtilDataConverter.WALKER_GENERIC.walk(
				cpyEntries,
				{
					string: (str) => {
						return str
							// Replace `@hitYourSpellAttack`
							.replace(/{@hitYourSpellAttack}/gi, () => `{@dice 1d20 + @srd5e.userchar.spellAttackRanged|your spell attack modifier}`)
							.replace(/{(@dice|@damage|@scaledice|@scaledamage) ([^}]+)}/gi, (...m) => {
								const [, tag, text] = m;
								let [rollText, displayText, name, ...others] = Renderer.splitTagByPipe(text);
								const originalRollText = rollText;

								rollText = rollText
									// Replace `+ PB`
									.replace(/\bPB\b/gi, `@srd5e.userchar.pb`)
									// Replace `+ summonSpellLevel`
									.replace(/\bsummonSpellLevel\b/gi, `${opts.summonSpellLevel ?? 0}`);

								// If we did any replaces, ensure the display text does not change
								if (!displayText && originalRollText !== rollText) {
									displayText = originalRollText
										// Replace `+ summonSpellLevel`
										.replace(/\bsummonSpellLevel\b/gi, `the spell's level`);
								}

								return `{${tag} ${[rollText, displayText || "", name || "", ...others].join("|")}}`;
							})
						;
					},
				},
			);

			description = await UtilDataConverter.pGetWithDescriptionPlugins(
				() => Renderer.get().setFirstSection(true).render(
					{
						type: "entries",
						entries: cpyEntries,
					},
					opts.depth != null ? opts.depth : 2,
				),
			);
		}

		return description;
	}

	/**
	 * Note that (where appropriate) updates should first load the actor's data, copy it, and modify it to suit.
	 *
	 * @param actor The actor's current data.
	 * @param actorUpdate The actor update data to be mutated.
	 * @param entry Entry to process.
	 * @param [opts] Options object.
	 * @param [opts.sideData] Side-loaded Foundry data.
	 * @param [opts.sideData.actorDataMod] Generic actor data modifications to apply.
	 * @param [opts.sideData.actorTokenMod] Generic actor token modifications to apply.
	 */
	static mutActorUpdate (actor, actorUpdate, entry, opts) {
		opts = opts || {};

		this._mutActorUpdate_mutFromSideDataMod(actor, actorUpdate, opts);
		this._mutActorUpdate_mutFromSideTokenMod(actor, actorUpdate, opts);
	}

	static _mutActorUpdate_mutFromSideDataMod (actor, actorUpdate, opts) {
		return this._mutActorUpdate_mutFromSideMod(actor, actorUpdate, opts, "actorDataMod", "data");
	}

	static _mutActorUpdate_mutFromSideTokenMod (actor, actorUpdate, opts) {
		return this._mutActorUpdate_mutFromSideMod(actor, actorUpdate, opts, "actorTokenMod", "token");
	}

	static _mutActorUpdate_mutFromSideMod (actor, actorUpdate, opts, sideProp, actorProp) {
		if (!opts.sideData || !opts.sideData[sideProp]) return;

		Object.entries(opts.sideData[sideProp])
			.forEach(([path, modMetas]) => this._mutActorUpdate_mutFromSideMod_handleProp(actor, actorUpdate, opts, sideProp, actorProp, path, modMetas));
	}

	static _mutActorUpdate_mutFromSideMod_handleProp (actor, actorUpdate, opts, sideProp, actorProp, path, modMetas) {
		const pathParts = path.split(".");

		// "Special" paths
		if (path === "_") {
			modMetas.forEach(modMeta => {
				switch (modMeta.mode) {
					case "conditionals": {
						for (const cond of modMeta.conditionals) {
							// If there is no condition (i.e. this is the "else" branch), always run.
							//   Otherwise, evaluate the condition.

							// Create a context for our variables to avoid any minification renames
							window.PLUT_CONTEXT = {actor};

							// eslint-disable-next-line no-eval
							if (cond.condition && !eval(cond.condition)) continue;

							Object.entries(cond.mod)
								.forEach(([path, modMetas]) => this._mutActorUpdate_mutFromSideMod_handleProp(actor, actorUpdate, opts, sideProp, actorProp, path, modMetas));

							break;
						}

						break;
					}

					default: throw new Error(`Unhandled mode "${modMeta.mode}"`);
				}
			});
			return;
		}

		const fromActor = MiscUtil.get(actor, "data", actorProp, ...pathParts);
		const fromUpdate = MiscUtil.get(actorUpdate, actorProp, ...pathParts);
		const existing = fromUpdate || fromActor;

		modMetas.forEach(modMeta => {
			switch (modMeta.mode) {
				case "appendStr": {
					const existing = MiscUtil.get(actorUpdate, actorProp, ...pathParts);
					const next = existing ? `${existing}${modMeta.joiner || ""}${modMeta.str}` : modMeta.str;
					MiscUtil.set(actorUpdate, actorProp, ...pathParts, next);
					break;
				}

				case "appendIfNotExistsArr": {
					const existingArr = MiscUtil.copy(existing || []);
					const out = [...existingArr];
					out.push(...modMeta.items.filter(it => !existingArr.some(x => CollectionUtil.deepEquals(it, x))));
					MiscUtil.set(actorUpdate, actorProp, ...pathParts, out);
					break;
				}

				case "scalarAdd": {
					MiscUtil.set(actorUpdate, actorProp, ...pathParts, modMeta.scalar + existing || 0);
					break;
				}

				case "scalarAddUnit": {
					const existingLower = `${existing || 0}`.toLowerCase();

					const handle = (toFind) => {
						const ix = existingLower.indexOf(toFind.toLowerCase());
						let numPart = existing.slice(0, ix);
						const rest = existing.slice(ix);
						const isSep = numPart.endsWith(" ");
						numPart = numPart.trim();

						if (!isNaN(numPart)) {
							const out = `${modMeta.scalar + Number(numPart)}${isSep ? " " : ""}${rest}`;
							MiscUtil.set(actorUpdate, actorProp, ...pathParts, out);
						} // else silently fail
					};

					if (!existing) MiscUtil.set(actorUpdate, actorProp, ...pathParts, `${modMeta.scalar} ${modMeta.unitShort || modMeta.unit}`);
					else if (modMeta.unit && existingLower.includes(modMeta.unit.toLowerCase())) {
						handle(modMeta.unit);
					} else if (modMeta.unitShort && existingLower.includes(modMeta.unitShort.toLowerCase())) {
						handle(modMeta.unitShort);
					} // else silently fail
					break;
				}

				// Set something to the numerical max of its existing value and the incoming value
				case "setMax": {
					const existingLower = `${existing || 0}`.toLowerCase();
					let asNum = Number(existingLower);
					if (isNaN(asNum)) asNum = 0;
					const maxValue = Math.max(asNum, modMeta.value);
					MiscUtil.set(actorUpdate, actorProp, ...pathParts, maxValue);
					break;
				}

				case "set": {
					MiscUtil.set(actorUpdate, actorProp, ...pathParts, MiscUtil.copy(modMeta.value));
					break;
				}

				default: throw new Error(`Unhandled mode "${modMeta.mode}"`);
			}
		});
	}

	/**
	 * Generic entry -> item data parsing.
	 * @param entry Entry to process.
	 * @param opts Options object.
	 * @param opts.mode Parsing mode; `"creature"` or `"player" or "object"`.
	 * @param [opts.modeOptions] Parsing mode options.
	 * @param [opts.modeOptions.isChannelDivinity]
	 * @param opts.fvttType Foundry type.
	 * @param opts.img Image path.
	 * @param [opts.effects] Item effects.
	 * @param opts.source Item source.
	 * @param [opts.renderDepth] Render depth.
	 * @param [opts.activationType] Foundry activation type.
	 * @param [opts.activationCost] Foundry action type.
	 * @param [opts.consumeType]
	 * @param [opts.consumeTarget]
	 * @param [opts.consumeAmount]
	 * @param [opts.formula]
	 * @param [opts.description] Pre-rendered description.
	 * @param [opts.isSkipDescription] If a description should not be created from the entry.
	 * @param [opts.actor] Actor data.
	 * @param [opts.summonSpellLevel] Spell level used to summon the creature this item will belong to, if appropriate.
	 * @param [opts.additionalData] Additional side-loaded Foundry data.
	 * @param [opts.additionalFlags] Additional side-loaded Foundry flags.
	 * @param [opts.pb] A proficiency bonus for this actor. Used for creature text parsing.
	 * @param [opts.entity] An entity with str/dex/con/int/wis/cha scores. Used for creature text parsing.
	 * @param [opts.entity.str]
	 * @param [opts.entity.dex]
	 * @param [opts.entity.con]
	 * @param [opts.entity.int]
	 * @param [opts.entity.wis]
	 * @param [opts.entity.cha]
	 */
	static async pGetItemActorPassive (entry, opts) {
		opts = opts || {};
		opts.modeOptions = opts.modeOptions || {};

		// Treat object parses as creature parses; potentially to be reworked in future.
		if (opts.mode === "object") opts.mode = "creature";

		// region Inputs
		let {
			description,

			activationType,
			activationCost,
			activationCondition,

			saveAbility,
			saveDc,
			saveScaling,

			damageParts,

			attackBonus,

			requirements,

			actionType,

			durationValue,
			durationUnits,

			consumeType,
			consumeTarget,
			consumeAmount,

			formula,

			targetValue,
			targetUnits,
			targetType,

			usesCount,
			usesCountMax,
			usesPer,

			rangeShort,
			rangeLong,

			foundryData,
			_foundryData,
			foundryFlags,
			_foundryFlags,
		} = opts;

		const combinedFoundryData = DataConverter.getCombinedFoundryData(foundryData, _foundryData);
		const combinedFoundryFlags = DataConverter.getCombinedFoundryFlags(foundryFlags, _foundryFlags);

		description = description || (opts.isSkipDescription ? "" : await DataConverter.pGetEntryDescription(entry, {depth: opts.renderDepth, summonSpellLevel: opts.summonSpellLevel}));

		activationType = activationType || "";
		activationCost = activationCost || 0;
		activationCondition = activationCondition || "";

		saveAbility = saveAbility || "";
		saveDc = saveDc || null;
		saveScaling = saveScaling || "";

		damageParts = damageParts || [];

		attackBonus = attackBonus || null;

		requirements = requirements || "";

		actionType = actionType || "";

		durationValue = durationValue || null;
		durationUnits = durationUnits || "";

		consumeType = consumeType || null;
		consumeTarget = consumeTarget || null;
		consumeAmount = consumeAmount || null;

		formula = formula || "";

		targetValue = targetValue || null;
		targetUnits = targetUnits || "";
		targetType = targetType || "";

		usesCount = usesCount || 0; // This is always a number
		usesCountMax = usesCountMax || "0"; // This can be a formula
		usesPer = usesPer || null; // Foundry currently (2020-04-26) supports "Day", "Short Rest", "Long Rest", and "Charges"

		rangeShort = rangeShort ?? null;
		rangeLong = rangeLong ?? null;
		// endregion

		let name = UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(entry, {isActorItem: true}));
		const strEntries = entry.entries ? JSON.stringify(entry.entries) : null;

		// region Recharge
		let rechargeOn = null;
		if (entry.name) {
			const mRecharge = /{@recharge( \d+)?}/gi.exec(entry.name);
			if (mRecharge) {
				rechargeOn = mRecharge[1] ? Number(mRecharge[1].trim()) : 6;
				name = name
					.replace(/\(Recharge \d+(–\d+)?\)/gi, "")
					.trim()
					.replace(/[ ]+/g, " ")
				;
			}
		}
		// endregion

		// region Activation
		if (entry.entries) {
			// For other features, actions/reaction
			if (opts.mode === "player") {
				if (!activationType && !activationCost) {
					let isAction = false;
					let isBonusAction = false;
					let isReaction = false;

					const walker = UtilDataConverter.WALKER_READONLY_GENERIC;
					walker.walk(
						entry.entries,
						{
							string: (str) => {
								if (activationType) return str;

								const sentences = Util.getSentences(str);
								for (const sentence of sentences) {
									if (/\b(?:as an action|can take an action|can use your action)\b/i.test(sentence)) {
										isAction = true;
										break;
									}

									if (/\bbonus action\b/i.test(sentence)) {
										isBonusAction = true;
										break;
									}

									const mReact = /\b(?:you can use your reaction|using your reaction|you can use this special reaction)\b/i.exec(sentence);
									if (mReact) {
										isReaction = true;

										// Attempt to pull out a condition from the preceding text, e.g.
										// "When an enemy within 30 feet of you, ..., you can use your reaction"
										let preceding = sentence.slice(0, mReact.index).trim().replace(/,$/, "");
										const mCondition = /(^|\W)(?:if|when)(?:|\W)/i.exec(preceding);
										if (mCondition) {
											preceding = preceding.slice(mCondition.index + mCondition[1].length).trim();
											activationCondition = activationCondition || preceding;
										}

										break;
									}
								}
							},
						},
					);

					// Prefer action -> bonus action -> reaction, as some actions (e.g. Tortle's "Shell Defense" have 'bonus
					//   action to end' clauses.
					if (isAction) activationType = "action";
					else if (isBonusAction) activationType = "bonus";
					else if (isReaction) activationType = "reaction";

					if (isAction || isBonusAction || isReaction) activationCost = 1;

					// If we could not find a well-defined action type, fall back on "special" in some cases
					if (!activationType) {
						walker.walk(
							entry.entries,
							{
								string: (str) => {
									if (activationType) return str;

									const sentences = Util.getSentences(str);

									for (const sentence of sentences) {
										if (/you can't use this feature again|once you use this feature/i.test(sentence)) activationType = "special";
									}
								},
							},
						);
					}
				}
			}

			if (opts.mode === "creature" && entry.name) {
				if (!activationType && !activationCost) {
					// For creatures, bonus actions end up in traits, so pull these out
					if (/\bbonus action\b/i.test(strEntries)) {
						activationType = "bonus";
						activationCost = 1;
					}

					if (/^legendary resistance/i.test(entry.name)) {
						activationType = "special";
					}
				}
			}
		}
		// endregion

		// region Uses
		// For creatures, use information is given in the name
		if (opts.mode === "creature" && entry.name) {
			name = name.replace(/\(\s*(\d+)\s*\/\s*(Day|Short Rest|Long Rest)\s*\)/i, (...m) => {
				usesCount = Number(m[1]);
				usesCountMax = `${usesCount}`;

				const cleanTime = m[2].trim().toLowerCase();
				switch (cleanTime) {
					case "day": usesPer = "day"; break;
					case "short rest": usesPer = "sr"; break;
					case "long rest": usesPer = "lr"; break;
				}

				return "";
			});

			if (!usesPer) {
				name = name.replace(/\(\s*(\d+)\s+Charges\s*\)/i, (...m) => {
					usesCount = Number(m[1]);
					usesCountMax = `${usesCount}`;
					usesPer = "charges";

					return "";
				});
			}

			if (usesPer) { // If we found any "uses" part
				// Clean the name after doing any replaces
				name = name.trim().replace(/[ ]+/g, " ");

				// Force an activation cost if we have an activation cost, as it is required to display the form correctly
				activationType = activationType || "none";

				// If the first line of the entries starts with "If ..." or "When ...", use the first line as the condition
				if (entry.entries && typeof entry.entries[0] === "string" && /^(?:If |When )/i.test(entry.entries[0].trim())) {
					activationCondition = entry.entries[0].trim();
				}
			}

			// Avoid adding usage info to legendary resistances, as they will be tracked as resource usage on the sheet
			if (/legendary resistance/gi.test(name)) {
				usesCount = 0;
				usesCountMax = `${usesCount}`;
				usesPer = null;
			}
		}

		if (opts.mode === "player" && entry.entries) {
			// region Resting
			const isShortRest = /\b(?:finish|complete) a short rest\b/.test(strEntries) || /\b(?:finish|complete) a short or long rest\b/.test(strEntries) || /\b(?:finish|complete) a short rest or a long rest\b/.test(strEntries) || /\b(?:finish|complete) a short or long rest\b/.test(strEntries);
			const isLongRest = !isShortRest && /\b(?:finish|complete) a long rest\b/.test(strEntries);

			if (isShortRest) usesPer = "sr";
			else if (isLongRest) usesPer = "lr";
			// endregion

			// region Uses
			const mAbilModifier = new RegExp(`a number of times equal to(?: (${Consts.TERMS_COUNT.map(it => it.tokens.join("")).join("|")}))? your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier(?: \\(minimum of (${Consts.TERMS_COUNT.map(it => it.tokens.join("")).join("|")})\\))?`, "i").exec(strEntries);
			if (mAbilModifier && opts.actor) {
				const abv = mAbilModifier[2].slice(0, 3).toLowerCase();
				const abilScore = MiscUtil.get(opts.actor, "data", "data", "abilities", abv, "value");
				if (abilScore != null) {
					let mod = Parser.getAbilityModNumber(abilScore);
					// FIXME(Future) Test/use the proper version when dnd5e 1.3.0 is released
					// let modFormula = `@abilities.${abv}.mod`;
					let modFormula = `floor((@abilities.${abv}.value - 10) / 2)`;

					if (mAbilModifier[1]) {
						const multiplier = (Consts.TERMS_COUNT.find(it => it.tokens.join(" ") === mAbilModifier[1].trim().toLowerCase()) || {}).count || 1;
						mod = mod * multiplier;
						modFormula = `${modFormula} * ${multiplier}`;
					}

					if (mAbilModifier[3]) {
						const min = (Consts.TERMS_COUNT.find(it => it.tokens.join("") === mAbilModifier[3].trim().toLowerCase()) || {}).count || 1;
						mod = Math.max(min, mod);
						modFormula = `max(${min}, ${modFormula})`;
					}

					usesCount = mod;
					usesCountMax = modFormula;
				}
			}

			strEntries.replace(/you can use ([^.!?]+) a number of times equal to(?<mult> twice)? your proficiency bonus/i, (...m) => {
				const mult = m.last().mult
					? (Consts.TERMS_COUNT.find(meta => CollectionUtil.deepEquals(meta.tokens, m.last().mult.trim().toLowerCase().split(/( )/g)))?.count || 1)
					: 1;
				usesCount = opts.actor ? (opts.actor.getRollData().prof * mult) : null;
				usesCountMax = `@prof${mult > 1 ? ` * ${mult}` : ""}`;
			});

			// If we found no use count, assume it's one-use
			if (usesPer && !usesCount && (!usesCountMax || usesCountMax === "0")) {
				usesCount = 1;
				usesCountMax = `${usesCount}`;
			}
			// endregion
		}
		// endregion

		// region Saving throws
		if (opts.mode === "player" && entry.entries) {
			UtilDataConverter.WALKER_READONLY_GENERIC.walk(
				entry.entries,
				{
					object: (obj) => {
						if (obj.type !== "abilityDc") return obj;

						if (actionType && saveScaling) return obj;

						actionType = actionType || "save";
						saveScaling = obj.attributes[0]; // Use the first available attribute

						return obj;
					},
					string: (str) => {
						if (actionType && saveAbility && saveScaling) return str;

						// region "8 + pb + mod"
						str.replace(/8\s*\+\s*your proficiency bonus\s*\+\s*your (.*?) modifier/i, (...m) => {
							const customAbilities = [];
							m[1].replace(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i, (...m2) => {
								customAbilities.push(m2[1].toLowerCase().slice(0, 3));
							});
							if (!customAbilities.length) return;

							actionType = actionType || "save";
							saveScaling = customAbilities[0]; // Use the first available attribute
						});
						// endregion

						// region Spell save
						// e.g.:
						// - "succeed on a Wisdom saving throw against your spell save DC"
						str.replace(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw against your (.*? )spell save DC/i, (...m) => {
							actionType = actionType || "save";
							saveAbility = saveAbility || m[1].toLowerCase().slice(0, 3);
							saveScaling = saveScaling || "spell";
						});
						// endregion

						if (opts.modeOptions.isChannelDivinity) {
							str.replace(/(?:make a|succeed on a) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/gi, (...m) => {
								actionType = actionType || "save";
								saveAbility = saveAbility || m[1].toLowerCase().slice(0, 3);
								saveScaling = saveScaling || "spell";
							});
						}

						return str;
					},
				},
			);
		}

		if (opts.mode === "creature" && entry.entries) {
			// If a "passive" text feature has one or more DCs embedded, use the first as the save DC info.
			strEntries.replace(/{@dc ([-+]?\s*\d+)}\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/, (...m) => {
				const dcNum = Number(m[1].replace(/\s*/g, ""));
				if (isNaN(dcNum)) return;

				actionType = actionType || "save";
				saveAbility = saveAbility || m[2].toLowerCase().slice(0, 3);
				saveDc = dcNum;

				if (opts.pb == null || opts.entity == null || Parser.ABIL_ABVS.some(it => opts.entity[it] == null)) {
					saveScaling = "flat";
					return;
				}

				// If there is exactly one ability score that our saving throw could be based on, use it,
				//   rather than flat scaling.
				const fromAbil = dcNum - opts.pb - 8;
				const abilToBonus = Parser.ABIL_ABVS.map(it => ({ability: it, bonus: Parser.getAbilityModNumber(opts.entity[it])}));
				const matchingAbils = abilToBonus.filter(it => it.bonus === fromAbil);

				if (matchingAbils.length === 1) saveScaling = saveScaling || matchingAbils[0].ability;
				else saveScaling = "flat";
			});
		}
		// endregion

		// region Duration
		if (opts.mode === "player" && entry.entries) {
			UtilDataConverter.WALKER_READONLY_GENERIC.walk(
				entry.entries,
				{
					string: (str) => {
						// Only update the duration if we can set both units and value
						if (durationValue || durationUnits) return;

						// "lasts for 1 minute"
						// "lasts for 8 hours"
						str.replace(/(?:^|\W)lasts for (\d+) (minute|hour|day|month|year|turn|round)s?(?:\W|$)/gi, (...m) => {
							durationValue = Number(m[1]);
							durationUnits = m[2].toLowerCase();
						});

						// "for the next 8 hours"
						str.replace(/(?:^|\W)for the next (\d+) (minute|hour|day|month|year|turn|round)s?(?:\W|$)/gi, (...m) => {
							durationValue = Number(m[1]);
							durationUnits = m[2].toLowerCase();
						});

						// "turned for 1 minute" (e.g. channel divinity)
						str.replace(/(?:^|\W)turned for (\d+) (minute|hour|day|month|year|turn|round)s?(?:\W|$)/gi, (...m) => {
							durationValue = Number(m[1]);
							durationUnits = m[2].toLowerCase();
						});

						// "this effect lasts for 1 minute"
						str.replace(/(?:^|\W)this effect lasts for (\d+) (minute|hour|day|month|year|turn|round)s?(?:\W|$)/gi, (...m) => {
							durationValue = Number(m[1]);
							durationUnits = m[2].toLowerCase();
						});

						// "until the end of your next turn"
						str.replace(/(?:^|\W)until the end of your next turn(?:\W|$)/gi, () => {
							durationValue = 1;
							durationUnits = "turn";
						});

						// "it is charmed by you for 1 minute"
						Renderer.stripTags(str).replace(/(?:^|\W)is \w+ by you for (\d+) (minute|hour|day|month|year|turn|round)s(?:\W|$)/gi, (...m) => {
							durationValue = Number(m[1]);
							durationUnits = m[2].toLowerCase();
						});
					},
				},
			);
		}
		// endregion

		// region Resource Consumption
		if (opts.mode === "player" && entry.entries) {
			UtilDataConverter.WALKER_READONLY_GENERIC.walk(
				entry.entries,
				{
					string: (str) => {
						if (consumeType || consumeTarget || consumeAmount) return;

						str.replace(/(?:(\d+) to )?(\d+) (?:ki|sorcery) point/i, (...m) => {
							consumeType = "attribute";
							consumeTarget = "resources.primary.value";
							consumeAmount = Number(m[1] || m[2]);
						});
					},
				},
			);
		}
		// endregion

		// region Damage
		let strEntriesNoDamageDice = strEntries;
		if ((opts.mode === "player" || opts.mode === "vehicle") && entry.entries && !damageParts.length) {
			const {str, damageTupleMetas} = DataConverter.getDamageTupleMetas(strEntries, {summonSpellLevel: opts.summonSpellLevel});
			strEntriesNoDamageDice = str;

			const {damageParts: damageParts_, formula: formula_} = DataConverter.getDamagePartsAndOtherFormula(damageTupleMetas);

			damageParts = damageParts_;
			formula = formula || formula_;
		}
		// endregion

		// region Other Formulas
		if ((opts.mode === "player" || opts.mode === "vehicle") && entry.entries && !formula) {
			// Note: not `[g]lobal`, as only one "other formula" is supported
			strEntriesNoDamageDice.replace(/{(?:@dice|@scaledice) ([^}]+)}/i, (...m) => {
				const [dice] = m[1].split("|");
				formula = dice;
			});
		}
		// endregion

		// region Target
		if (opts.mode === "creature" && strEntries && !targetValue && !targetUnits && !targetType) {
			const targetMeta = this._pGetItemActorPassive_getTargetMeta(strEntries);
			targetValue = targetMeta.targetValue || targetValue;
			targetUnits = targetMeta.targetUnits || targetUnits;
			targetType = targetMeta.targetType || targetType;
		}
		// endregion

		// region Post-processing
		try { activationCondition = Renderer.stripTags(activationCondition); } catch (e) { console.error(...LGT, e); }
		// endregion

		name = name.trim().replace(/\s+/g, " ");
		if (!name) name = "(Unnamed)"; // Empty names are invalid in Foundry

		return {
			name: name,
			type: opts.fvttType,
			data: {
				source: opts.source ? Parser.sourceJsonToAbv(opts.source) : "",
				description: {value: description, chat: "", unidentified: ""},

				damage: {
					parts: damageParts,
					versatile: "",
				},
				duration: {
					value: durationValue,
					units: durationUnits,
				},
				range: {value: rangeShort, long: rangeLong, units: (rangeShort != null || rangeLong != null) ? "ft" : ""},
				requirements,

				save: {
					ability: saveAbility,
					dc: saveDc,
					scaling: saveScaling || "flat",
				},

				activation: {
					type: activationType,
					cost: activationCost,
					condition: activationCondition,
				},

				target: {
					value: targetValue,
					units: targetUnits,
					type: targetType,
				},

				uses: {
					value: usesCount,
					max: usesCountMax,
					per: usesPer,
				},
				ability: "",
				actionType: actionType || "other",
				attackBonus: attackBonus,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},

				formula,

				recharge: {
					value: rechargeOn,
					charged: rechargeOn != null,
				},

				consume: {
					type: consumeType,
					target: consumeTarget,
					amount: consumeAmount,
				},

				...(combinedFoundryData || {}),
				...(opts.additionalData || {}),
			},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(opts.img),
			flags: {
				...(UtilCompat.getFeatureFlags({isReaction: activationType === "reaction"})),
				...(combinedFoundryFlags || {}),
				...opts.additionalFlags,
			},
			effects: opts.effects || [],
		};
	}

	static _pGetItemActorPassive_getTargetMeta (strEntries) {
		let targetValue, targetUnits, targetType;
		let found = false;

		let tmpEntries = strEntries
			// Dragon breath weapons; abominable yeti breath weapon
			.replace(/exhales [^.]*a (?<size>\d+)-foot[- ](?<shape>cone|line)/, (...m) => {
				targetValue = Number(m.last().size);
				targetUnits = "ft";
				targetType = m.last().shape; // "cone" and "line" are both valid values

				found = true;

				return "";
			});

		if (found) return {targetValue, targetUnits, targetType};

		// e.g. Djinni "Create Whirlwind"
		tmpEntries = tmpEntries.replace(/(?<size>\d+)-foot-radius,? \d+-foot-tall cylinder/, (...m) => {
			targetValue = Number(m.last().size);
			targetUnits = "ft";
			targetType = "cylinder";

			found = true;
			return "";
		});

		if (found) return {targetValue, targetUnits, targetType};

		// e.g.:
		// - Azer "Illumination"
		// - Beholder variant "Death Ray"
		tmpEntries = tmpEntries.replace(/(?<size>\d+)-foot[- ]radius(?<ptSphere> sphere)?/, (...m) => {
			targetValue = Number(m.last().size);
			targetUnits = "ft";
			targetType = (m.last().ptSphere ? "sphere" : "radius");

			found = true;
			return "";
		});

		if (found) return {targetValue, targetUnits, targetType};

		// e.g. Beholder "Disintegration Ray"
		tmpEntries = tmpEntries.replace(/(?<size>\d+)-foot[- ]cube/, (...m) => {
			targetValue = Number(m.last().size);
			targetUnits = "ft";
			targetType = "cube";

			found = true;
			return "";
		});

		if (found) return {targetValue, targetUnits, targetType};

		// e.g. Beholder variant "Petrification Ray"
		tmpEntries = tmpEntries.replace(/(?<size>\d+)-foot[- ]square/, (...m) => {
			targetValue = Number(m.last().size);
			targetUnits = "ft";
			targetType = "square";

			found = true;
			return "";
		});

		if (found) return {targetValue, targetUnits, targetType};

		// e.g. Marid "Water Jet"
		tmpEntries = tmpEntries.replace(/(?<size>\d+)-foot line/, (...m) => {
			targetValue = Number(m.last().size);
			targetUnits = "ft";
			targetType = "line";

			found = true;
			return "";
		});

		// e.g. Mind Flayer "Mind Blast"
		tmpEntries = tmpEntries.replace(/(?<size>\d+)-foot cone/, (...m) => {
			targetValue = Number(m.last().size);
			targetUnits = "ft";
			targetType = "cone";

			found = true;
			return "";
		});

		if (found) return {targetValue, targetUnits, targetType};
		return {};
	}

	static getMaxCasterProgression (...casterProgressions) {
		casterProgressions = casterProgressions.filter(Boolean);
		const ixs = casterProgressions.map(it => this._CASTER_PROGRESSIONS.indexOf(it)).filter(ix => ~ix);
		if (!ixs.length) return null;
		return this._CASTER_PROGRESSIONS[Math.min(...ixs)];
	}

	static getMaxCantripProgression (...casterProgressions) {
		const out = [];
		casterProgressions
			.filter(Boolean)
			.forEach(progression => {
				progression.forEach((cnt, i) => {
					if (out[i] == null) return out[i] = cnt;
					out[i] = Math.max(out[i], cnt);
				});
			});
		return out;
	}

	/**
	 * @param existingProficienciesSkills Actor's current skill proficiencies.
	 * @param existingProficienciesTools Actor's current tool proficiencies.
	 * @param existingProficienciesLanguages Actor's current languages.
	 * @param skillProficiencies Data from a background or race.
	 * @param languageProficiencies Data from a background or race.
	 * @param toolProficiencies Data from a background or race.
	 * @param skillToolLanguageProficiencies Data from a background or race.
	 * @param actorData Actor update object to fill.
	 * @param importOpts
	 * @param [titlePrefix]
	 */
	static async pFillActorSkillToolLanguageData (
		{
			existingProficienciesSkills,
			existingProficienciesTools,
			existingProficienciesLanguages,
			skillProficiencies,
			languageProficiencies,
			toolProficiencies,
			skillToolLanguageProficiencies,
			actorData,
			importOpts,
			// Other options
			titlePrefix,
		},
	) {
		skillToolLanguageProficiencies = this._pFillActorSkillToolLanguageData_getMergedProfs({
			skillProficiencies,
			languageProficiencies,
			toolProficiencies,
			skillToolLanguageProficiencies,
		});

		const formData = await Charactermancer_OtherProficiencySelect.pGetUserInput({
			titlePrefix,
			existingFvtt: {
				skillProficiencies: existingProficienciesSkills,
				toolProficiencies: existingProficienciesTools,
				languageProficiencies: existingProficienciesLanguages,
			},
			available: skillToolLanguageProficiencies,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplySkillFormDataToActorUpdate({
			existingProfsActor: existingProficienciesSkills,
			formData,
			actorData,
		});

		this.doApplyOtherProficienciesFormData({
			existingProfsActor: existingProficienciesLanguages,
			formData,
			formDataProp: "languageProficiencies",
			actorData,
			opts: {
				fnGetMappedItem: it => UtilActors.getMappedLanguage(it),
				actorTraitProp: "languages",
			},
		});

		this.doApplyOtherProficienciesFormData({
			existingProfsActor: existingProficienciesTools,
			formData,
			formDataProp: "toolProficiencies",
			actorData,
			opts: {
				fnGetMappedItem: it => UtilActors.getMappedTool(it),
				actorTraitProp: "toolProf",
			},
		});
		// endregion
	}

	// TODO expand this and use for e.g. armor and weapon profs too
	static _pFillActorSkillToolLanguageData_getMergedProfs (
		{
			skillProficiencies,
			languageProficiencies,
			toolProficiencies,
			skillToolLanguageProficiencies,
		},
	) {
		const hasAnySingles = skillProficiencies?.length || languageProficiencies?.length || toolProficiencies?.length;
		if (!hasAnySingles) return skillToolLanguageProficiencies;

		if (!skillToolLanguageProficiencies?.length) {
			const out = [];
			this._pFillActorSkillToolLanguageData_doMergeToSingleArray({
				targetArray: out,
				skillProficiencies,
				languageProficiencies,
				toolProficiencies,
			});
			return out;
		}

		if (skillToolLanguageProficiencies?.length && hasAnySingles) console.warn(...LGT, `Founds individual skill/language/tool proficiencies alongside combined skill/language/tool; these will be merged together.`);

		const out = MiscUtil.copy(skillToolLanguageProficiencies || []);
		this._pFillActorSkillToolLanguageData_doMergeToSingleArray({
			targetArray: out,
			skillProficiencies,
			languageProficiencies,
			toolProficiencies,
		});
		return out;
	}

	static _pFillActorSkillToolLanguageData_doMergeToSingleArray (
		{
			targetArray,
			skillProficiencies,
			languageProficiencies,
			toolProficiencies,
		},
	) {
		const maxLen = Math.max(
			targetArray?.length || 0,
			skillProficiencies?.length || 0,
			languageProficiencies?.length || 0,
			toolProficiencies?.length || 0,
		);
		for (let i = 0; i < maxLen; ++i) {
			const tgt = (targetArray[i] = {});

			const skillProfSet = skillProficiencies?.[i];
			const langProfSet = languageProficiencies?.[i];
			const toolProfSet = toolProficiencies?.[i];

			// region Skills
			if (skillProfSet) {
				this._pFillActorSkillToolLanguageData_doAddProfType({
					targetObject: tgt,
					profSet: skillProfSet,
					validKeySet: new Set(Object.keys(Parser.SKILL_TO_ATB_ABV)),
					anyKeySet: new Set(["any"]),
					anyKeySuffix: "Skill",
				});
			}
			// endregion

			// region Languages
			if (langProfSet) {
				this._pFillActorSkillToolLanguageData_doAddProfType({
					targetObject: tgt,
					profSet: langProfSet,
					anyKeySet: new Set(["any", "anyStandard"]),
					anyKeySuffix: "Language",
				});
			}
			// endregion

			// region Tools
			if (toolProfSet) {
				this._pFillActorSkillToolLanguageData_doAddProfType({
					targetObject: tgt,
					profSet: toolProfSet,
					anyKeySet: new Set(["any"]),
					anyKeySuffix: "Tool",
				});
			}
			// endregion
		}
	}

	static _pFillActorSkillToolLanguageData_doAddProfType (
		{
			targetObject,
			profSet,
			validKeySet,
			anyKeySet,
			anyKeySuffix,
		},
	) {
		Object.entries(profSet)
			.forEach(([k, v]) => {
				switch (k) {
					case "choose": {
						if (v?.from?.length) {
							const choose = MiscUtil.copy(v);
							choose.from = choose.from.filter(kFrom => !validKeySet || validKeySet.has(kFrom));
							if (choose.from.length) {
								const tgtChoose = (targetObject.choose = targetObject.choose || []);
								tgtChoose.push(choose);
							}
						}
						break;
					}

					default: {
						if (anyKeySet && anyKeySet.has(k)) {
							targetObject[`${k}${anyKeySuffix}`] = MiscUtil.copy(v);
							break;
						}

						if (!validKeySet || validKeySet.has(k)) targetObject[k] = MiscUtil.copy(v);
					}
				}
			});
	}

	/**
	 * @param existingProfsActor Existing skill data.
	 * @param skillProficiencies Data from a background or race.
	 * @param actorData Actor update object to fill.
	 * @param importOpts
	 * @param [opts] Options
	 * @param [opts.titlePrefix]
	 * @return {Promise<object>}
	 */
	static async pFillActorSkillData (existingProfsActor, skillProficiencies, actorData, importOpts, opts) {
		opts = opts || {};

		if (!skillProficiencies) return {};
		skillProficiencies = Charactermancer_OtherProficiencySelect.getMappedSkillProficiencies(skillProficiencies);

		const formData = await Charactermancer_OtherProficiencySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				skillProficiencies: existingProfsActor,
			},
			available: skillProficiencies,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		return this.doApplySkillFormDataToActorUpdate({existingProfsActor, formData, actorData});
	}

	static doApplySkillFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		if (!formData?.data?.skillProficiencies) return;

		const out = {};

		// 0 = not, 1 = proficient, 2 = expert, 0.5 = jack of all trades
		actorData.skills = actorData.skills || {};
		Object.entries(UtilActors.SKILL_ABV_TO_FULL)
			.filter(([_, name]) => formData.data.skillProficiencies[name])
			.forEach(([abv, name]) => {
				out[abv] = formData.data.skillProficiencies[name];

				const maxValue = Math.max(
					(existingProfsActor[abv] || {}).value || 0,
					formData.data.skillProficiencies[name] != null ? Number(formData.data.skillProficiencies[name]) : 0,
					(actorData.skills[abv] || {}).value || 0,
				);

				const isUpdate = maxValue > (MiscUtil.get(actorData.skills, abv, "value") || 0);
				if (isUpdate) (actorData.skills[abv] = actorData.skills[abv] || {}).value = maxValue;
			});

		return out;
	}

	/**
	 * @param existingProfsActor Actor's current languages.
	 * @param importingProfs Data from a background or race.
	 * @param data Actor update object to fill.
	 * @param importOpts
	 * @param [opts] Options
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorLanguageData (existingProfsActor, importingProfs, data, importOpts, opts) {
		opts = opts || {};

		if (!importingProfs) return;
		importingProfs = Charactermancer_OtherProficiencySelect.getMappedLanguageProficiencies(importingProfs);

		const formData = await Charactermancer_OtherProficiencySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				languageProficiencies: existingProfsActor,
			},
			available: importingProfs,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyLanguageProficienciesFormDataToActorUpdate({existingProfsActor, formData, actorData: data});
	}

	static doApplyLanguageProficienciesFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplyOtherProficienciesFormData({
			existingProfsActor,
			formData,
			formDataProp: "languageProficiencies",
			actorData,
			opts: {
				fnGetMappedItem: it => UtilActors.getMappedLanguage(it),
				actorTraitProp: "languages",
			},
		});
	}

	/**
	 * @param existingProfsActor Actor's current tool proficiencies.
	 * @param importingProfs Data from a background or race.
	 * @param data Actor update object to fill.
	 * @param importOpts
	 * @param [opts] Options
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorToolProfData (existingProfsActor, importingProfs, data, importOpts, opts) {
		opts = opts || {};

		if (!importingProfs) return;
		importingProfs = Charactermancer_OtherProficiencySelect.getMappedToolProficiencies(importingProfs);

		const formData = await Charactermancer_OtherProficiencySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				toolProficiencies: existingProfsActor,
			},
			available: importingProfs,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyToolProficienciesFormDataToActorUpdate({existingProfsActor, formData, actorData: data});
	}

	static doApplyToolProficienciesFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplyOtherProficienciesFormData({
			existingProfsActor,
			formData,
			formDataProp: "toolProficiencies",
			actorData,
			opts: {
				fnGetMappedItem: it => UtilActors.getMappedTool(it),
				actorTraitProp: "toolProf",
			},
		});
	}

	/**
	 * @param existingProfsLanguages Actor's current languages.
	 * @param existingProfsTools Actor's current tool proficiencies.
	 * @param importingProfs Data from a background or race.
	 * @param actorData Actor update object to fill.
	 * @param importOpts
	 * @param [opts] Options
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorLanguageOrToolData (existingProfsLanguages, existingProfsTools, importingProfs, actorData, importOpts, opts) {
		opts = opts || {};

		if (!importingProfs) return;
		importingProfs = Charactermancer_OtherProficiencySelect.getMappedLanguageProficiencies(importingProfs);
		importingProfs = Charactermancer_OtherProficiencySelect.getMappedToolProficiencies(importingProfs);

		const formData = await Charactermancer_OtherProficiencySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				languageProficiencies: existingProfsLanguages,
				toolProficiencies: existingProfsTools,
			},
			available: importingProfs,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyOtherProficienciesFormData({
			existingProfsActor: existingProfsLanguages,
			formData,
			formDataProp: "languageProficiencies",
			actorData,
			opts: {
				fnGetMappedItem: it => UtilActors.getMappedLanguage(it),
				actorTraitProp: "languages",
			},
		});

		this.doApplyOtherProficienciesFormData({
			existingProfsActor: existingProfsTools,
			formData,
			formDataProp: "toolProficiencies",
			actorData,
			opts: {
				fnGetMappedItem: it => UtilActors.getMappedTool(it),
				actorTraitProp: "toolProf",
			},
		});
	}

	/**
	 * @param existingProfsActor Actor's current tool proficiencies.
	 * @param importingProfs Data from a background or race.
	 * @param data Actor update object to fill.
	 * @param importOpts
	 * @param [opts] Options
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorArmorProfData (existingProfsActor, importingProfs, data, importOpts, opts) {
		opts = opts || {};

		if (!importingProfs) return;
		importingProfs = Charactermancer_OtherProficiencySelect.getMappedArmorProficiencies(importingProfs);

		const formData = await Charactermancer_OtherProficiencySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				armorProficiencies: existingProfsActor,
			},
			available: importingProfs,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyArmorProficienciesFormDataToActorUpdate({existingProfsActor, formData, actorData: data});
	}

	static doApplyArmorProficienciesFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplyOtherProficienciesFormData({
			existingProfsActor,
			formData,
			formDataProp: "armorProficiencies",
			actorData,
			opts: {
				fnGetMappedItem: it => UtilActors.getMappedArmorProficiency(it),
				fnGetMappedCustomItem: it => Renderer.splitTagByPipe(it)[0].toTitleCase(),
				actorTraitProp: "armorProf",
			},
		});
	}

	/**
	 * @param existingProfsActor Actor's current tool proficiencies.
	 * @param importingProfs Data from a background or race.
	 * @param data Actor update object to fill.
	 * @param importOpts
	 * @param [opts] Options
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorWeaponProfData (existingProfsActor, importingProfs, data, importOpts, opts) {
		opts = opts || {};

		if (!importingProfs) return;
		importingProfs = Charactermancer_OtherProficiencySelect.getMappedWeaponProficiencies(importingProfs);

		const formData = await Charactermancer_OtherProficiencySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				weaponProficiencies: existingProfsActor,
			},
			available: importingProfs,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyWeaponProficienciesFormDataToActorUpdate({existingProfsActor, formData, actorData: data});
	}

	static doApplyWeaponProficienciesFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplyOtherProficienciesFormData({
			existingProfsActor,
			formData,
			formDataProp: "weaponProficiencies",
			actorData,
			opts: {
				fnGetMappedItem: it => UtilActors.getMappedWeaponProficiency(it),
				fnGetMappedCustomItem: it => Renderer.splitTagByPipe(it)[0].toTitleCase(),
				actorTraitProp: "weaponProf",
			},
		});
	}

	/**
	 * @param existingProfsActor Actor's current proficiencies.
	 * @param formData Data from a background or race.
	 * @param formDataProp Property within `formData` to use.
	 * @param actorData Actor update object to fill.
	 * @param opts Options object
	 * @param [opts.fnGetMappedItem]
	 * @param [opts.fnGetMappedCustomItem]
	 * @param opts.actorTraitProp
	 */
	static doApplyOtherProficienciesFormData ({existingProfsActor, formData, formDataProp, actorData, opts}) {
		if (!formData?.data?.[formDataProp]) return false;

		existingProfsActor = existingProfsActor || {};

		const formDataSet = formData.data[formDataProp];

		if (!Object.keys(formDataSet).length) return false;
		const cpyFormDataSet = MiscUtil.copy(formDataSet);

		const profSet = new Set();
		Object.keys(cpyFormDataSet).filter(k => cpyFormDataSet[k]).forEach(k => profSet.add(k));

		// Map known items to their respective Foundry values; keep invalid items as-is
		const mappedValidItems = new Set();
		const customItems = [];

		// Keep existing items
		(existingProfsActor.value || []).forEach(it => mappedValidItems.add(it));
		(existingProfsActor.custom || "").split(";").map(it => it.trim()).filter(Boolean).forEach(it => this._doApplyFormData_doCheckAddCustomItem(customItems, it));

		// Keep items already in the actor update
		const existingProfsActorData = MiscUtil.get(actorData, "traits", opts.actorTraitProp);
		(existingProfsActorData?.value || []).forEach(it => mappedValidItems.add(it));
		(existingProfsActorData?.custom || "").split(";").map(it => it.trim()).filter(Boolean).forEach(it => this._doApplyFormData_doCheckAddCustomItem(customItems, it));

		// Add new items
		profSet.forEach(it => {
			const mapped = opts.fnGetMappedItem ? opts.fnGetMappedItem(it) : it;
			if (mapped) mappedValidItems.add(mapped);
			else {
				const toAdd = opts.fnGetMappedCustomItem ? opts.fnGetMappedCustomItem(it) : it.toTitleCase();
				this._doApplyFormData_doCheckAddCustomItem(customItems, toAdd);
			}
		});

		// Set data
		const dataTarget = MiscUtil.set(actorData, "traits", opts.actorTraitProp, {});
		dataTarget.value = [...mappedValidItems].map(it => it.toLowerCase()).sort(SortUtil.ascSortLower);
		dataTarget.custom = customItems.join(";");
	}

	static _doApplyFormData_doCheckAddCustomItem (customItems, item) {
		const cleanItem = item.trim().toLowerCase();
		if (!customItems.some(it => it.trim().toLowerCase() === cleanItem)) customItems.push(item);
	}

	static doApplySavingThrowProficienciesFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		if (!formData?.data?.savingThrowProficiencies) return;

		actorData.abilities = actorData.abilities || {};
		Parser.ABIL_ABVS
			.filter(ab => formData.data.savingThrowProficiencies[ab])
			.forEach(ab => {
				const maxValue = Math.max(
					existingProfsActor[ab]?.proficient || 0,
					formData.data.savingThrowProficiencies[ab] ? 1 : 0,
					actorData.abilities[ab]?.proficient || 0,
				);
				const isUpdate = maxValue > (MiscUtil.get(actorData.abilities, ab, "proficient") || 0);
				if (isUpdate) MiscUtil.set(actorData.abilities, ab, "proficient", maxValue);
			});
	}

	/**
	 * @param existingProfsActor Actor's current damage immunities.
	 * @param [importing] Custom data from a race.
	 * @param data Actor update object to fill.
	 * @param importOpts
	 * @param [opts]
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorImmunityData (existingProfsActor, importing, data, importOpts, opts) {
		opts = opts || {};

		const formData = await Charactermancer_DamageImmunitySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				immune: existingProfsActor,
			},
			available: importing,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyDamageImmunityFormDataToActorUpdate({existingProfsActor, formData, actorData: data});
	}

	/**
	 * @param existingProfsActor Actor's current damage resistances.
	 * @param [importing] Custom data from a race.
	 * @param data Actor update object to fill.
	 * @param importOpts
	 * @param [opts]
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorResistanceData (existingProfsActor, importing, data, importOpts, opts) {
		opts = opts || {};

		const formData = await Charactermancer_DamageResistanceSelect.pGetUserInput({
			...opts,
			existingFvtt: {
				resist: existingProfsActor,
			},
			available: importing,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyDamageResistanceFormDataToActorUpdate({existingProfsActor, formData, actorData: data});
	}

	/**
	 * @param existingProfsActor Actor's current damage vulnerabilities.
	 * @param [importing] Custom data from a race.
	 * @param data Actor update object to fill.
	 * @param importOpts
	 * @param [opts]
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorVulnerabilityData (existingProfsActor, importing, data, importOpts, opts) {
		opts = opts || {};

		const formData = await Charactermancer_DamageVulnerabilitySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				vulnerable: existingProfsActor,
			},
			available: importing,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyDamageVulnerabilityFormDataToActorUpdate({existingProfsActor, formData, actorData: data});
	}

	/**
	 * @param existing Actor's current condition immunities.
	 * @param [importing] Custom data from a race.
	 * @param data Actor update object to fill.
	 * @param importOpts
	 * @param [opts]
	 * @param [opts.titlePrefix]
	 */
	static async pFillActorConditionImmunityData (existing, importing, data, importOpts, opts) {
		opts = opts || {};

		const formData = await Charactermancer_ConditionImmunitySelect.pGetUserInput({
			...opts,
			existingFvtt: {
				conditionImmune: existing,
			},
			available: importing,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyConditionImmunityFormDataToActorUpdate({existingProfsActor: existing, formData, actorData: data});
	}

	static doApplyDamageImmunityFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplyOtherProficienciesFormData({
			existingProfsActor,
			formData,
			formDataProp: "immune",
			actorData,
			opts: {
				actorTraitProp: "di",
			},
		});
	}

	static doApplyDamageResistanceFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplyOtherProficienciesFormData({
			existingProfsActor,
			formData,
			formDataProp: "resist",
			actorData,
			opts: {
				actorTraitProp: "dr",
			},
		});
	}

	static doApplyDamageVulnerabilityFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplyOtherProficienciesFormData({
			existingProfsActor,
			formData,
			formDataProp: "vulnerable",
			actorData,
			opts: {
				actorTraitProp: "dv",
			},
		});
	}

	static doApplyConditionImmunityFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplyOtherProficienciesFormData({
			existingProfsActor,
			formData,
			formDataProp: "conditionImmune",
			actorData,
			opts: {
				fnGetMappedItem: it => it === "disease" ? "diseased" : it,
				actorTraitProp: "ci",
			},
		});
	}

	/**
	 * @param existingProficienciesSkills Actor's current skill proficiencies.
	 * @param existingProficienciesTools Actor's current tool proficiencies.
	 * @param existingProficienciesLanguages Actor's current languages.
	 * @param expertise Data from background or race.
	 * @param actorData Actor update object to fill.
	 * @param importOpts
	 * @param [titlePrefix]
	 */
	static async pFillActorExpertiseData (
		{
			existingProficienciesSkills,
			existingProficienciesTools,
			expertise,
			actorData,
			importOpts,
			// Other options
			titlePrefix,
		},
	) {
		const formData = await Charactermancer_ExpertiseSelect.pGetUserInput({
			titlePrefix,
			existingFvtt: {
				skillProficiencies: existingProficienciesSkills,
				toolProficiencies: existingProficienciesTools,
			},
			available: expertise,
		});
		if (!formData) return importOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		this.doApplyExpertiseFormDataToActorUpdate({
			existingProfsActor: {
				skillProficiencies: existingProficienciesSkills,
				toolProficiencies: existingProficienciesTools,
			},
			formData,
			actorData: actorData,
		});
	}

	static doApplyExpertiseFormDataToActorUpdate ({existingProfsActor, formData, actorData}) {
		this.doApplySkillFormDataToActorUpdate({
			existingProfsActor: existingProfsActor.skillProficiencies,
			formData,
			actorData,
		});

		this.doApplyOtherProficienciesFormData({
			existingProfsActor: existingProfsActor.toolProficiencies,
			formData,
			formDataProp: "toolProficiencies",
			actorData,
			opts: {
				// FIXME(Future) As of 2021-06-13 Foundry does not support tool expertise in a useful way (it can only be
				//   defined on a tool item, rather than character-wide), so work around this by using custom values.
				fnGetMappedItem: it => {
					if (formData?.data?.toolProficiencies[it] === 2) return null;
					return UtilActors.getMappedTool(it);
				},
				fnGetMappedCustomItem: it => {
					if (formData?.data?.toolProficiencies[it] === 2) return `${it.toTitleCase()} (Expertise)`;
					return it.toTitleCase();
				},
				actorTraitProp: "toolProf",
			},
		});
	}

	static getDamageTupleMetas (str, {summonSpellLevel = 0} = {}) {
		const damageTupleMetas = [];

		const ixFirstDc = str.indexOf(`{@dc `);

		// number or roll; will be a number for e.g. "1 piercing damage"
		// "the spell's level" part for e.g. TCE's Aberrant Spirit
		// "plus ..." part for e.g. Orc War Chief
		const strOut = str.replace(/(?:(\d+)|\(?{@(?:dice|damage) ([^}]+)}(?:\s+[-+]\s+the spell's level)?(?: plus {@(?:dice|damage) ([^}]+)})?\)?)(?:\s+[-+]\s+[-+a-zA-Z0-9 ]*?)? ([^ ]+) damage/gi, (...mDamage) => {
			const [, dmgFlat, dmgDice1, dmgDice2, dmgType, ixMatch] = mDamage;

			const isFlatDamage = dmgFlat != null;
			let dmg = isFlatDamage
				? dmgFlat
				: dmgDice2
					? `${dmgDice1} + ${dmgDice2}` : dmgDice1;

			// Ensure the flat damage is not a condition, e.g. CoS Tree Blight "by dealing 6 slashing damage [to the blight]"
			if (isFlatDamage) {
				const tokens = str.split(/( )/g);
				let lenTokenStack = 0;
				const tokenStack = [];
				for (let i = 0; i < tokens.length; ++i) {
					tokenStack.push(tokens[i]);
					lenTokenStack += tokens[i].length;

					if (lenTokenStack === ixMatch) {
						const lastFourTokens = tokenStack.slice(-4);
						if (/^by dealing$/i.test(lastFourTokens.join("").trim())) {
							return "";
						}
					}
				}
			}

			// Switch out proficiency bonus
			dmg = dmg.replace(/\bPB\b/gi, "@srd5e.userchar.pb");

			// Switch out `summonSpellLevel`
			dmg = dmg.replace(/\bsummonSpellLevel\b/gi, `${summonSpellLevel ?? 0}`);

			const tupleMeta = {
				tuple: [dmg, dmgType],
			};

			// If this damage appears to be from failing a DC, mark it as such
			if (~ixFirstDc && ixMatch >= ixFirstDc) {
				tupleMeta.isOnFailSavingThrow = true;
			}

			damageTupleMetas.push(tupleMeta);

			return "";
		});

		return {
			str: strOut, // Return this string without damage parts
			damageTupleMetas: damageTupleMetas.filter(it => it.tuple.length),
		};
	}

	static getDamagePartsAndOtherFormula (damageTupleMetas) {
		damageTupleMetas = damageTupleMetas || [];

		if (!Config.get("import", "isUseOtherFormulaFieldForSaveHalvesDamage")) return {damageParts: damageTupleMetas.map(it => it.tuple), formula: ""};

		const damageTuples = [];
		let otherFormula = ``;

		damageTupleMetas.forEach(meta => {
			if (otherFormula || !meta.isOnFailSavingThrow) return damageTuples.push(meta.tuple);

			otherFormula = `${meta.tuple[0]}${meta.tuple[1] ? `[${meta.tuple[1]}]` : ""}`;
		});

		// If the "save halves" damage is not a rider on some other damage, return generic damage
		if (!damageTuples.length) return {damageParts: damageTupleMetas.map(it => it.tuple), formula: ""};

		return {damageParts: damageTuples, formula: otherFormula};
	}

	static getSpeedValue (speed, prop, configGroup) {
		if (typeof speed === "number") {
			return prop === "walk"
				? Config.getMetricNumber({configGroup, originalValue: speed, originalUnit: "feet"})
				: null;
		}
		speed = speed[prop];
		if (speed == null) return null;
		if (speed.number != null) return Config.getMetricNumber({configGroup, originalValue: speed.number, originalUnit: "feet"});
		if (isNaN(speed)) return null;
		return Config.getMetricNumber({configGroup, originalValue: Number(speed), originalUnit: "feet"});
	}

	static isSpeedHover (speed) {
		if (typeof speed === "number") return false;
		return !!speed.canHover;
	}

	static getMovement (speed, {configGroup = null} = {}) {
		return {
			burrow: DataConverter.getSpeedValue(speed, "burrow", configGroup),
			climb: DataConverter.getSpeedValue(speed, "climb", configGroup),
			fly: DataConverter.getSpeedValue(speed, "fly", configGroup),
			swim: DataConverter.getSpeedValue(speed, "swim", configGroup),
			walk: DataConverter.getSpeedValue(speed, "walk", configGroup),
			units: Config.getMetricUnit({configGroup, originalUnit: "ft"}),
			hover: DataConverter.isSpeedHover(speed),
		};
	}

	static getParsedWeaponEntryData (imp, weap) {
		if (!(weap.entries && weap.entries[0] && typeof weap.entries[0] === "string")) return;

		const damageTupleMetas = [];
		let attackBonus = 0;

		const str = weap.entries[0];

		damageTupleMetas.push(...DataConverter.getDamageTupleMetas(str).damageTupleMetas);

		const {rangeShort, rangeLong} = DataConverter.getAttackRange(str);

		const mHit = /{@hit ([^}]+)}/gi.exec(str);
		if (mHit) {
			const hitBonus = Number(mHit[1]);
			if (!isNaN(hitBonus)) {
				attackBonus = hitBonus;
			}
		}

		const {isAttack, actionType, attackTypes} = DataConverter.getAttackActionType(str);

		return {
			damageTupleMetas,
			isAttack,
			rangeShort,
			rangeLong,
			actionType,
			attackBonus,
			attackTypes, // 5etools flags from `@atk` tags, e.g. "m", "s", "r", "w"...
		};
	}

	static getAttackRange (str) {
		let rangeShort = 0;
		let rangeLong = 0;

		// Prioritise range first, as you can throw a melee weapon, but you Can't:tm: melee with a ranged weapon
		const mRange = /range (\d+)\/(\d+) ft/gi.exec(str);
		if (mRange) {
			rangeShort = Number(mRange[1]);
			rangeLong = Number(mRange[2]);
		} else {
			const mReach = /reach (\d+) ft/gi.exec(str);
			if (mReach) {
				rangeShort = Number(mReach[1]);
			}
		}

		return {rangeShort, rangeLong};
	}

	static getAttackActionType (str) {
		let actionType = "";
		let isAttack = false;
		let attackTypes = "";

		const mAtk = /{@atk ([^}]+)}/gi.exec(str);
		if (mAtk) {
			attackTypes = mAtk[1];
			isAttack = true;

			if (attackTypes.includes("s")) {
				if (attackTypes.includes("m")) actionType = "msak";
				else actionType = "rsak";
			} else if (attackTypes.includes("m")) actionType = "mwak";
			else if (attackTypes.includes("r")) actionType = "rwak";
		}

		return {actionType, isAttack, attackTypes};
	}

	static getCleanOriginalData (data) {
		data = MiscUtil.copy(data);

		// Delete temp filter data
		Object.keys(data)
			.filter(k => /^_f[A-Z]/.test(k))
			.forEach(k => delete data[k]);

		this._getCleanOriginalData_recurse(data);

		return data;
	}

	static _getCleanOriginalData_recurse (obj) {
		if (obj == null) return;
		if (typeof obj !== "object") return;

		if (obj instanceof Array) {
			obj.forEach(it => this._getCleanOriginalData_recurse(it));
		} else {
			Object.entries(obj).forEach(([k, v]) => {
				// Foundry data objects cannot have keys starting with "$"
				if (k.includes("$")) {
					delete obj[k];
					console.warn(...LGT, `Removed key "${k}" from object`);
				} else this._getCleanOriginalData_recurse(v);
			});
		}
	}

	static getActorDamageResImmVulnConditionImm (ent) {
		const out = {};

		const allDis = new Set();
		let customDis = [];
		this._getActorDamageResImmVulnConditionImm_addDamageTypesOrConditionTypes({
			ent,
			validTypesArr: UtilActors.VALID_DAMAGE_TYPES,
			fnRender: Parser.getFullImmRes,
			prop: "immune",
			allSet: allDis,
			customStack: customDis,
		});

		out.di = {
			value: [...allDis],
			custom: customDis.join(", "),
		};

		const allDrs = new Set();
		let customDrs = [];
		this._getActorDamageResImmVulnConditionImm_addDamageTypesOrConditionTypes({
			ent,
			validTypesArr: UtilActors.VALID_DAMAGE_TYPES,
			fnRender: Parser.getFullImmRes,
			prop: "resist",
			allSet: allDrs,
			customStack: customDrs,
		});

		out.dr = {
			value: [...allDrs],
			custom: customDrs.join(", "),
		};

		const allDvs = new Set();
		let customDvs = [];
		this._getActorDamageResImmVulnConditionImm_addDamageTypesOrConditionTypes({
			ent,
			validTypesArr: UtilActors.VALID_DAMAGE_TYPES,
			fnRender: Parser.getFullImmRes,
			prop: "vulnerable",
			allSet: allDvs,
			customStack: customDvs,
		});

		out.dv = {
			value: [...allDvs],
			custom: customDvs.join(", "),
		};

		const allCis = new Set();
		let customCis = [];
		this._getActorDamageResImmVulnConditionImm_addDamageTypesOrConditionTypes({
			ent,
			validTypesArr: UtilActors.VALID_CONDITIONS,
			fnRender: arr => Parser.getFullCondImm(arr, true),
			prop: "conditionImmune",
			allSet: allCis,
			customStack: customCis,
		});

		out.ci = {
			value: [...allCis],
			custom: customCis.join(", "),
		};

		return out;
	}

	static _getActorDamageResImmVulnConditionImm_addDamageTypesOrConditionTypes (
		{ent, validTypesArr, fnRender, prop, allSet, customStack},
	) {
		if (!ent[prop]) return;

		ent[prop].forEach(it => {
			if (validTypesArr.includes(it)) allSet.add(it);
			else if (
				this._PROPS_DAMAGE_IMM_VULN_RES.has(prop)
				&& it[prop]
				&& it[prop] instanceof Array
				&& CollectionUtil.setEq(new Set(it[prop]), this._SET_PHYSICAL_DAMAGE)
				&& it.note
				&& /\bnon[- ]?magical\b/.test(it.note)
				&& it.cond
			) {
				allSet.add("physical");
			} else {
				const asText = fnRender([it]);
				customStack.push(asText);
			}
		});
	}

	static async pGetSideData_ (ent, {propBrew, fnLoadJson, propJson, fnMatch}) {
		let found = (MiscUtil.get(BrewUtil, "homebrew", propBrew) || [])
			.find(it => (fnMatch || this._pGetAdditional_fnMatch)(ent, it));

		if (!found) {
			const additionalData = await fnLoadJson();
			found = (additionalData[propJson] || [])
				.find(it => (fnMatch || this._pGetAdditional_fnMatch)(ent, it));
		}

		return found;
	}

	static _pGetAdditional_fnMatch (entity, additionalDataEntity) {
		return entity.name === additionalDataEntity.name && entity.source === additionalDataEntity.source;
	}

	static async pGetAdditionalData_ (ent, {propBrew, fnLoadJson, propJson, fnMatch}) {
		return this._pGetAdditionalStar(ent, {propBrew, fnLoadJson, propJson, fnMatch, propFromEntity: "foundryData", propFromSideLoaded: "data"});
	}

	static async pGetSideLoadedType_ (ent, {propBrew, fnLoadJson, propJson, fnMatch, validTypes}) {
		let out = await this._pGetAdditionalStar(ent, {propBrew, fnLoadJson, propJson, fnMatch, propFromEntity: "foundryType", propFromSideLoaded: "type"});
		if (!out) return out;
		out = out.toLowerCase().trim();
		if (validTypes && !validTypes.has(out)) return null;
		return out;
	}

	static async pGetAdditionalEffectsRaw_ (ent, {propBrew, fnLoadJson, propJson, fnMatch}) {
		return this._pGetAdditionalStar(ent, {propBrew, fnLoadJson, propJson, fnMatch, propFromEntity: "foundryEffects", propFromSideLoaded: "effects"});
	}

	static async _pGetAdditionalStar (ent, {propBrew, fnLoadJson, propJson, fnMatch, propFromEntity, propFromSideLoaded}) {
		const found = await this.pGetSideData_(ent, {propBrew, fnLoadJson, propJson, fnMatch});
		return this.pGetAdditionalStarFromFound_(ent, {propFromEntity, propFromSideLoaded, found});
	}

	static async pGetAdditionalStarFromFound_ (ent, {propFromEntity, propFromSideLoaded, found}) {
		const fromEntity = ent[propFromEntity];

		if ((!found || !found[propFromSideLoaded]) && !fromEntity) return null;

		// Allow the `foundryData` property on the entity to override/compliment anything defined as separate data
		const out = MiscUtil.copy(found?.[propFromSideLoaded] ? found[propFromSideLoaded] : fromEntity);
		if (found?.[propFromSideLoaded] && fromEntity) {
			if (out instanceof Array) out.push(...MiscUtil.copy(fromEntity)); // Array merge strategy, for effects
			else Object.assign(out, MiscUtil.copy(fromEntity)); // Object merge strategy, for data
		}

		return out;
	}

	static async pGetAdditionalFlags_ (ent, {propBrew, fnLoadJson, propJson, fnMatch}) {
		return this._pGetAdditionalStar(ent, {propBrew, fnLoadJson, propJson, fnMatch, propFromEntity: "foundryFlags", propFromSideLoaded: "flags"});
	}

	static getImportedEmbed (importedEmbeds, itemData) {
		const importedEmbed = importedEmbeds.find(it => it.raw === itemData);

		if (!importedEmbed) {
			ui.notifications.warn(`Failed to link embedded entity for active effects! ${VeCt.STR_SEE_CONSOLE}`);
			console.warn(...LGT, `Could not find loaded item data`, itemData, `in imported embedded entities`, importedEmbeds);
			return null;
		}

		return importedEmbed;
	}

	static getConsumedSheetItem ({consumes, actor}) {
		return (actor?.items?.contents || []).find(it => it.type === "feat" && it.name.toLowerCase().trim() === consumes.name.toLowerCase().trim());
	}
}

DataConverter.SYM_AT = "<PLUT_SYM__AT>";

DataConverter.ITEM_TYPES_ACTOR_TOOLS = new Set(["AT", "GS", "INS", "T"]);
DataConverter.ITEM_TYPES_ACTOR_WEAPONS = new Set(["M", "R"]);
DataConverter.ITEM_TYPES_ACTOR_ARMOR = new Set(["LA", "MA", "HA", "S"]);

DataConverter._PROPS_DAMAGE_IMM_VULN_RES = new Set(["immune", "resist", "vulnerable"]);
DataConverter._SET_PHYSICAL_DAMAGE = new Set(["bludgeoning", "piercing", "slashing"]);

DataConverter._CASTER_PROGRESSIONS = [ // Ordered by max spell slots
	"full",
	"artificer",
	"1/2",
	"1/3",
	"pact",
];

export {DataConverter};
