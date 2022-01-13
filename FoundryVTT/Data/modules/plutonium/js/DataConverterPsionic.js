import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {ConfigConsts} from "./ConfigConsts.js";

class DataConverterPsionic {
	/**
	 * @param psi
	 * @param [opts]
	 * @param [opts.filterValues]
	 * @param [opts.psiPointsItemId]
	 */
	static async pGetPsionicItems (psi, opts) {
		opts = opts || {};
		return [
			await this._getPsionicItems_pGetTalentItem(psi, opts),
			await this._getPsionicItems_pGetDisciplineFocusItem(psi, opts),
			...(await this._getPsionicItems_pGetDisciplineActiveItems(psi, opts)),
		].filter(Boolean);
	}

	static _getPsionicFlags (psi, opts) {
		opts = opts || {};

		const out = {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_PSIONICS,
				source: psi.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_PSIONICS](psi),
			},
		};

		if (opts.isAddDataFlags) {
			out[SharedConsts.MODULE_NAME_FAKE].propDroppable = "psionic";
			out[SharedConsts.MODULE_NAME_FAKE].filterValues = opts.filterValues;
		}

		return out;
	}

	static async _getPsionicItems_pGetTalentItem (psi, opts) {
		if (psi.type !== "T") return null;

		const strEntries = JSON.stringify(psi.entries);
		const actionType = this._getPsionicItems_getActionTypeFromString(strEntries);

		let damageDice = "";
		let cantripScaling = null;
		const diceTiers = [];
		// Find cantrip scaling values, which are shown in brackets
		strEntries.replace(/\({@damage ([^}]+)}\)/g, (...m) => diceTiers.push(m[1]));
		// Find dice _not_ in brackets
		const baseVal = /(?:^|[^(]){@dice ([^}]+)}(?:[^)]|$)/.exec(strEntries);
		// Cantrips scale at levels 5, 11, and 17
		if (diceTiers.length === 3) {
			if (baseVal) cantripScaling = baseVal[1];
			// failing that, just use the first bracketed value
			else cantripScaling = diceTiers[0];
		}
		if (baseVal) damageDice = baseVal[1];
		else if (diceTiers.length) damageDice = diceTiers[0];

		if (!Config.get("importPsionic", "isImportAsSpell")) {
			// Manually add cantrip scaling, since we don't use spells
			if (damageDice && cantripScaling) {
				damageDice = `${damageDice} + (max(sign(floor((@details.level + 1) / 6)), 0) * (${cantripScaling})) + (max(sign(floor((@details.level - 5) / 6)), 0) * (${cantripScaling})) + (max(sign(floor((@details.level - 11) / 6)), 0) * (${cantripScaling}))`;
			}
		}

		const damageType = this._getPsionicItems_getDamageTypeFromString(strEntries);
		const damage = damageDice ? [damageDice, damageType].filter(Boolean) : null;
		const saveAbility = this._getPsionicItems_getSaveFromString(strEntries);

		const dataSpellFeature = Config.get("importPsionic", "isImportAsSpell")
			? {
				level: 0,
				school: "evo",
				components: {value: "", vocal: false, somatic: false, material: false, ritual: false, concentration: false},
				materials: {value: "", consumed: false, cost: 0, supply: 0},
				scaling: {
					mode: cantripScaling ? "cantrip" : "none",
					formula: cantripScaling || "",
				},
				preparation: {mode: "always", prepared: true},
			}
			: {};

		const additionalData = await this._pGetAdditionalData(psi);
		const additionalFlags = await this._pGetAdditionalFlags(psi);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(psi, {isActorItem: true})),
			type: Config.get("importPsionic", "isImportAsSpell") ? "spell" : "feat",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(psi),
				description: {
					value: Config.get("importPsionic", "isImportDescription")
						? await UtilDataConverter.pGetWithDescriptionPlugins(() => `<div>${Renderer.psionic.getBodyText(psi, Renderer.get())}</div>`)
						: "",
					chat: "",
					unidentified: "",
				},

				...dataSpellFeature,

				actionType: actionType,
				target: {value: 0, units: "", type: ""},
				range: {value: null, units: "", long: null},
				activation: {type: actionType, cost: 1, condition: ""},
				duration: {value: 0, units: ""},
				damage: {
					parts: [damage].filter(Boolean),
					versatile: "",
				},
				save: {ability: saveAbility, dc: null},
				ability: "int",
				uses: {value: 0, max: 0, per: ""},
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				formula: "",

				...additionalData,
			},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetPsionicItems_pGetPsionicImagePath(psi, "talent"),
			),
			flags: {
				...this._getPsionicFlags(psi, opts),
				...additionalFlags,
			},
			effects: [],
		};
	}

	static async _pGetPsionicItems_pGetPsionicImagePath (psi, type) {
		if (psi.foundryImg) return psi.foundryImg;
		return `modules/${SharedConsts.MODULE_NAME}/media/icon/brain.svg`;
	}

	static async _getPsionicItems_pGetDisciplineFocusItem (psi, opts) {
		if (psi.type !== "D") return null;

		const dataSpellFeature = Config.get("importPsionic", "isImportAsSpell")
			? {
				level: 0,
				school: "evo",
				components: {value: "", vocal: false, somatic: false, material: false, ritual: false, concentration: false},
				materials: {value: "", consumed: false, cost: 0, supply: 0},
				scaling: {mode: "none", formula: ""},
				preparation: {mode: "always", prepared: true},
			}
			: {};

		const additionalData = await this._pGetDisciplineFocusAdditionalData(psi);
		const additionalFlags = await this._pGetDisciplineFocusAdditionalFlags(psi);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(psi, {displayName: `${psi.name} - Focus`, isActorItem: true})),
			type: Config.get("importPsionic", "isImportAsSpell") ? "spell" : "feat",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(psi),
				description: {
					value: Config.get("importPsionic", "isImportDescription")
						? await UtilDataConverter.pGetWithDescriptionPlugins(() => `<div>${Renderer.get().setFirstSection(true).render({entries: [psi.focus]})}</div>`)
						: "",
					chat: "",
					unidentified: "",
				},

				...dataSpellFeature,

				actionType: "bonus",
				target: {value: 0, units: "", type: ""},
				range: {value: null, units: "", long: null},
				activation: {type: "bonus", cost: 1, condition: "(Only one focus may be active at a time)"},
				duration: {value: 0, units: ""},
				damage: {parts: [], versatile: ""},
				save: {ability: null, dc: null},
				ability: "int",
				uses: {value: 0, max: 0, per: ""},
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				formula: "",

				...additionalData,
			},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetPsionicItems_pGetPsionicImagePath(psi, "disciplineFocus"),
			),
			flags: {
				...this._getPsionicFlags(psi, opts),
				...additionalFlags,
			},
			effects: [],
		};
	}

	static async _getPsionicItems_pGetDisciplineActiveItems (psi, opts) {
		if (psi.type === "T") return [];

		const out = [];
		for (const psiMode of psi.modes) {
			const subFeature = await this._getPsionicItems_pGetDisciplineActiveItem(psi, psiMode, opts);
			out.push(subFeature);

			if (psiMode.submodes) {
				for (const psiSubMode of psiMode.submodes) {
					const subSubFeature = await this._getPsionicItems_pGetDisciplineActiveItem(psi, psiSubMode, opts, {actionType: subFeature.data.actionType});
					out.push(subSubFeature);
				}
			}
		}

		return out;
	}

	static async _getPsionicItems_pGetDisciplineActiveItem (psi, psiMode, opts, {actionType} = {}) {
		const getCostPart = (it) => it.cost ? ` (${it.cost.min === it.cost.max ? it.cost.min : `${it.cost.min}-${it.cost.max}`}psi)` : "";

		const name = UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(psi, {displayName: `${psi.name} - ${psiMode.name}`, isActorItem: true}));

		const submodePart = psiMode.submodes
			? Renderer.get().setFirstSection(true).render(
				{
					type: "list",
					style: "list-hang-notitle",
					items: psiMode.submodes.map(it => ({
						type: "item",
						name: `${it.name}${getCostPart(it)}`,
						entry: it.entries.join("<br>"),
					})),
				},
				2)
			: "";

		const strEntries = JSON.stringify(psiMode.entries);
		const foundActionType = this._getPsionicItems_getActionTypeFromString(strEntries);
		if (foundActionType) actionType = foundActionType;

		let scaling = null;
		const damageList = [];
		// Just assume that whatever the first damage type turns out to be is the damage type for everything
		const damageType = this._getPsionicItems_getDamageTypeFromString(strEntries);
		// Assume the first scaling dice is the only scaling dice
		strEntries.replace(/{@(?:scaledice|scaledamage) ([^}]+)}/, (...m) => {
			const [baseDamage, _, addPerProgress] = m[1].split("|");
			damageList.push(baseDamage);
			scaling = addPerProgress;
		});

		// Prefer damage values from @scaledice/@scaledamage, as most psionics have 1-7 point damage scaling
		if (!damageList.length) {
			strEntries.replace(/{@damage ([^}]+)}/g, (...m) => damageList.push(m[1]));
		}

		const damageParts = damageList.map(dmg => [dmg, damageType].filter(Boolean));
		const saveAbility = this._getPsionicItems_getSaveFromString(strEntries);

		const level = psiMode.cost ? psiMode.cost.min : psiMode.submodes ? MiscUtil.get(psiMode.submodes.find(it => it.cost), "cost", "min") || 1 : 1;

		const durationVal = psiMode.concentration ? psiMode.concentration.duration : 0;
		const durationUnit = (psiMode.concentration ? DataConverterPsionic._PSI_DURATION_MAP[psiMode.concentration.unit] : "") || "";

		const {consumeType, consumeTarget, consumeAmount} = this._getPsionicItems_getConsume({psi, psiMode, opts, level});

		const dataSpellFeature = Config.get("importPsionic", "isImportAsSpell")
			? {
				level: level,
				school: "evo",
				components: {value: "", vocal: false, somatic: false, material: false, ritual: false, concentration: !!psiMode.concentration},
				materials: {value: "", consumed: false, cost: 0, supply: 0},
				scaling: {mode: scaling ? "level" : "none", formula: scaling || ""},
				critical: {threshold: null, damage: ""},
				preparation: {mode: "always", prepared: true},
			}
			: {};

		const additionalData = await this._pGetDisciplineActiveAdditionalData({name, source: psi.source, psionicName: psi.name, psionicSource: psi.source});
		const additionalFlags = await this._pGetDisciplineActiveAdditionalFlags({name, source: psi.source, psionicName: psi.name, psionicSource: psi.source});

		return {
			name,
			type: Config.get("importPsionic", "isImportAsSpell") ? "spell" : "feat",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(psi),
				description: {
					value: Config.get("importPsionic", "isImportDescription")
						? await UtilDataConverter.pGetWithDescriptionPlugins(() => `<div>
							${Renderer.get().setFirstSection(true).render({entries: psiMode.entries}, 2)}
							${submodePart}
						</div>`)
						: "",
					chat: "",
					unidentified: "",
				},

				...dataSpellFeature,

				consume: {type: consumeType, target: consumeTarget, amount: consumeAmount},
				actionType: actionType,
				target: {value: 0, units: "", type: ""},
				range: {value: null, units: "", long: null},
				activation: {type: actionType, cost: 1, condition: ""},
				duration: {value: durationVal, units: durationUnit},
				damage: {parts: damageParts, versatile: ""},
				save: {ability: saveAbility, dc: null},
				ability: "int",
				uses: {value: 0, max: 0, per: ""},
				attackBonus: null,
				chatFlavor: "",
				formula: "",

				...additionalData,
			},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetPsionicItems_pGetPsionicImagePath(psi, "disciplineMode"),
			),
			flags: {
				...this._getPsionicFlags(psi, opts),
				...additionalFlags,
			},
			effects: [],
		};
	}

	// region psionic utils
	static _getPsionicItems_getConsume ({opts, level}) {
		let consumeType = opts.consumeType ?? "";
		let consumeTarget = opts.consumeTarget ?? null;
		let consumeAmount = opts.consumeAmount ?? null;

		if (opts.consumeTarget != null) return {consumeType, consumeTarget, consumeAmount};

		const resource = Config.getPsiPointsResource({isValueKey: true});
		consumeAmount = level;

		if (resource === ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM) {
			consumeType = "charges";
			consumeTarget = opts.psiPointsItemId;
		} else {
			consumeType = "attribute";
			consumeTarget = resource;
		}

		return {consumeType, consumeTarget, consumeAmount};
	}

	static _getPsionicItems_getActionTypeFromString (strEntries) {
		const isBonusAction = /bonus action/i.test(strEntries);
		const isAction = /as an action|using your action/i.test(strEntries);
		return isBonusAction ? "bonus" : isAction ? "action" : "";
	}

	static _getPsionicItems_getDamageTypeFromString (strEntries) {
		const msDamageTypes = Parser.DMG_TYPES.map(typ => (new RegExp(`(${typ})[^.]+damage`, "ig")).exec(strEntries));
		const damageTypes = msDamageTypes.filter(Boolean).map(it => it[1].toLowerCase());
		return damageTypes[0] || null;
	}

	static _getPsionicItems_getSaveFromString (strEntries) {
		const msSaves = Object.values(Parser.ATB_ABV_TO_FULL).map(atb => (new RegExp(`(${atb}) saving throw`, "ig")).exec(strEntries));
		const saves = msSaves.filter(Boolean).map(it => it[1].slice(0, 3).toLowerCase());
		return saves[0] || null;
	}
	// endregion

	// TODO(Future) expand/replace this as Foundry allows
	/**
	 * @param psi
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 */
	static async pGetPsionicItem (psi, opts) {
		opts = opts || {};

		const typeOrderStr = Renderer.psionic.getTypeOrderString(psi);
		const desc = `<p><i>${typeOrderStr}</i></p>${Renderer.psionic.getBodyText(psi, Renderer.get().setFirstSection(true))}`;

		const additionalData = await this._pGetAdditionalData(psi);
		const additionalFlags = await this._pGetAdditionalFlags(psi);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(psi)),
			type: "feat",
			data: {
				description: {
					value: Config.get("importPsionic", "isImportDescription")
						? await UtilDataConverter.pGetWithDescriptionPlugins(() => `<div>${desc}</div>`)
						: "",
					chat: "",
					unidentified: "",
				},
				source: UtilDataConverter.getSourceWithPagePart(psi),

				// region unused
				damage: {parts: []},
				activation: {type: "", cost: 0, condition: ""},
				duration: {value: null, units: ""},
				target: {value: null, units: "", type: ""},
				range: {value: null, long: null, units: ""},
				uses: {value: 0, max: 0, per: null},
				ability: null,
				actionType: "",
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				formula: "",
				save: {ability: "", dc: null},
				requirements: "",
				recharge: {value: null, charged: false},
				// endregion

				...additionalData,
			},
			flags: {
				...this._getPsionicFlags(psi, opts),
				...additionalFlags,
			},
			effects: [],
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetPsionicItems_pGetPsionicImagePath(psi),
			),
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importPsionic", "permissions")};

		return out;
	}

	static async _pGetAdditionalData (psi) {
		return DataConverter.pGetAdditionalData_(psi, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalFlags (psi) {
		return DataConverter.pGetAdditionalFlags_(psi, this._SIDE_DATA_OPTS);
	}

	static async _pGetDisciplineFocusAdditionalData (psi) {
		return DataConverter.pGetAdditionalData_(psi, this._SIDE_DATA_DISCIPLINE_FOCUS_OPTS);
	}

	static async _pGetDisciplineFocusAdditionalFlags (psi) {
		return DataConverter.pGetAdditionalFlags_(psi, this._SIDE_DATA_DISCIPLINE_FOCUS_OPTS);
	}

	static async _pGetDisciplineActiveAdditionalData (psi) {
		return DataConverter.pGetAdditionalData_(psi, this._SIDE_DATA_DISCIPLINE_ACTIVE_OPTS);
	}

	static async _pGetDisciplineActiveAdditionalFlags (psi) {
		return DataConverter.pGetAdditionalData_(psi, this._SIDE_DATA_DISCIPLINE_ACTIVE_OPTS);
	}

	static get _SIDE_DATA_OPTS () {
		return {propBrew: "foundryPsionic", fnLoadJson: Vetools.pGetPsionicsSideData, propJson: "psionic"};
	}

	static get _SIDE_DATA_DISCIPLINE_FOCUS_OPTS () {
		return {propBrew: "foundryPsionicDisciplineFocus", fnLoadJson: Vetools.pGetPsionicsSideData, propJson: "psionicDisciplineFocus"};
	}

	static get _SIDE_DATA_DISCIPLINE_ACTIVE_OPTS () {
		return {propBrew: "foundryPsionicDisciplineActive", fnLoadJson: Vetools.pGetPsionicsSideData, propJson: "psionicDisciplineActive", fnMatch: (ent, entAdd) => entAdd.name === ent.name && entAdd.source === ent.source && entAdd.psionicName === ent.psionicName && entAdd.psionicSource === ent.psionicSource};
	}
}

DataConverterPsionic._PSI_DURATION_MAP = {
	"min": "minute",
	"hr": "hour",
	"rnd": "round",
};

export {DataConverterPsionic};
