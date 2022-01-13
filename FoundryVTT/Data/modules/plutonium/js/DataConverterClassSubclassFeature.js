import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {DataConverterFeature} from "./DataConverterFeature.js";
import {PageFilterClassesFoundry} from "./UtilCharactermancerClass.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterClassSubclassFeature extends DataConverterFeature {
	static async pGetDereferencedClassSubclassFeatureItem (feature) {
		const type = this._getEntityType(feature);
		const hash = UrlUtil.URL_TO_HASH_BUILDER[type](feature);
		// `type` will be either `classFeature` or `subclassFeature`; passing either of these to the standard cache-get
		//   will return a de-referenced version.
		return Renderer.hover.pCacheAndGet(type, feature.source, hash, {isCopy: true});
	}

	static async pGetInitClassSubclassFeatureLoadeds (feature) {
		const type = this._getEntityType(feature);
		switch (type) {
			case "classFeature": {
				const uid = DataUtil.class.packUidClassFeature(feature);
				const asClassFeatureRef = {classFeature: uid};
				await PageFilterClassesFoundry.pInitClassFeatureLoadeds({classFeature: asClassFeatureRef, className: feature.className});
				return asClassFeatureRef;
			}
			case "subclassFeature": {
				const uid = DataUtil.class.packUidSubclassFeature(feature);
				const asSubclassFeatureRef = {subclassFeature: uid};
				const subclassNameLookup = await DataUtil.class.pGetSubclassLookup();
				const subclassName = MiscUtil.get(subclassNameLookup, feature.classSource, feature.className, feature.subclassSource, feature.subclassShortName);
				await PageFilterClassesFoundry.pInitSubclassFeatureLoadeds({subclassFeature: asSubclassFeatureRef, className: feature.className, subclassName: subclassName});
				return asSubclassFeatureRef;
			}
			default: throw new Error(`Unhandled feature type "${type}"`);
		}
	}

	/**
	 * @param feature
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.filterValues] Pre-baked filter values to be re-used when importing this from the item.
	 * @param [opts.isAddDataFlags]
	 * @param [opts.isActorItem]
	 * @param [opts.type] The (optional) feature type. If not specified, will be automatically chosen.
	 * @param [opts.actor] The actor the feature will belong to.
	 */
	static async pGetClassSubclassFeatureItem (feature, opts) {
		opts = opts || {};
		if (opts.actor) opts.isActorItem = true;

		const out = await this._pGetClassSubclassFeatureItem(feature, opts);

		const additionalData = await this._pGetAdditionalData(feature);
		Object.assign(out.data, additionalData);

		const additionalFlags = await this._pGetAdditionalFlags(feature);
		Object.assign(out.flags, additionalFlags);

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importClassSubclassFeature", "permissions")};

		return out;
	}

	static async _getPreloadSideData () { return Vetools.pGetClassSubclassSideData(); }

	static async pGetSideData (feature, {type = null} = {}) {
		type = type || this._getEntityType(feature);
		switch (type) {
			case "classFeature": {
				let found = (MiscUtil.get(BrewUtil, "homebrew", "foundryClassFeature") || []).find(it => it.name === feature.name && it.source === feature.source && it.className === feature.className && it.classSource === feature.classSource && it.level === feature.level);

				if (!found) {
					const additionalData = DataConverterClassSubclassFeature._SIDE_DATA || await this._getPreloadSideData();
					found = (additionalData.classFeature || []).find(it => it.name === feature.name && it.source === feature.source && it.className === feature.className && it.classSource === feature.classSource && it.level === feature.level);
				}

				if (!found) return null;
				return found;
			}

			case "subclassFeature": {
				let found = (MiscUtil.get(BrewUtil, "homebrew", "foundrySubclassFeature") || []).find(it => it.name === feature.name && it.source === feature.source && it.className === feature.className && it.classSource === feature.classSource && it.subclassShortName === feature.subclassShortName && it.subclassSource === feature.subclassSource && it.level === feature.level);

				if (!found) {
					const additionalData = DataConverterClassSubclassFeature._SIDE_DATA || await this._getPreloadSideData();
					found = (additionalData.subclassFeature || []).find(it => it.name === feature.name && it.source === feature.source && it.className === feature.className && it.classSource === feature.classSource && it.subclassShortName === feature.subclassShortName && it.subclassSource === feature.subclassSource && it.level === feature.level);
				}

				if (!found) return null;
				return found;
			}

			default: throw new Error(`Unhandled type "${type}"`);
		}
	}

	static async _pGetAdditionalData (feature) {
		return DataConverter.pGetAdditionalData_(feature, this._getSideDataOpts(feature));
	}

	static async _pGetAdditionalFlags (feature) {
		return DataConverter.pGetAdditionalData_(feature, this._getSideDataOpts(feature));
	}

	static async pHasClassSubclassSideLoadedEffects (actor, feature) {
		if (this._isUnarmoredDefense(feature)) return true;
		return (
			await DataConverter.pGetAdditionalEffectsRaw_(
				feature,
				this._getSideDataOpts(feature),
			)
		)?.length > 0;
	}

	static _isUnarmoredDefense (feature) {
		const cleanLowerName = (feature.name || "").toLowerCase().trim();
		return /^unarmored defen[sc]e/.test(cleanLowerName);
	}

	static _getUnarmoredDefenseMeta (entity) {
		if (!entity.entries) return null;

		const attribs = new Set();

		JSON.stringify(entity.entries).replace(/(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha) modifier/gi, (fullMatch, ability) => {
			ability = ability.slice(0, 3).toLowerCase();
			attribs.add(ability);
		});

		const predefinedKey = CollectionUtil.setEq(DataConverterClassSubclassFeature._UNARMORED_DEFENSE_BARBARIAN, attribs) ? "unarmoredBarb" : CollectionUtil.setEq(DataConverterClassSubclassFeature._UNARMORED_DEFENSE_MONK, attribs) ? "unarmoredMonk" : null;

		return {
			formula: ["10", ...[...attribs].map(ab => `@abilities.${ab}.mod`)].join(" + "),
			abilities: [...attribs],
			predefinedKey,
		};
	}

	static async pGetClassSubclassFeatureItemEffects (actor, feature, sheetItem, {additionalData, img} = {}) {
		const out = [];

		if (this._isUnarmoredDefense(feature)) {
			const unarmoredDefenseMeta = this._getUnarmoredDefenseMeta(feature);
			if (unarmoredDefenseMeta) {
				let fromUnarmoredDefence;
				if (unarmoredDefenseMeta.predefinedKey) {
					fromUnarmoredDefence = UtilActiveEffects.getExpandedEffects(
						[
							{
								name: "Unarmored Defense",
								changes: [
									{
										key: "data.attributes.ac.calc",
										mode: "OVERRIDE",
										value: unarmoredDefenseMeta.predefinedKey,
									},
								],
							},
						],
						{
							actor,
							sheetItem,
							parentName: feature.name,
							additionalData,
						},
					);
				} else {
					fromUnarmoredDefence = UtilActiveEffects.getExpandedEffects(
						[
							{
								name: "Unarmored Defense",
								changes: [
									{
										key: "data.attributes.ac.calc",
										mode: "OVERRIDE",
										value: "custom",
									},
								],
							},
							{
								name: "Unarmored Defense",
								changes: [
									{
										key: "data.attributes.ac.formula",
										mode: "UPGRADE",
										value: unarmoredDefenseMeta.formula,
									},
								],
							},
						],
						{
							actor,
							sheetItem,
							parentName: feature.name,
							additionalData,
						},
					);
				}

				if (fromUnarmoredDefence) out.push(...fromUnarmoredDefence);
			}
		}

		const effectsRaw = await DataConverter.pGetAdditionalEffectsRaw_(
			feature,
			{
				propBrew: this._getBrewProp(feature),
				fnLoadJson: Vetools.pGetClassSubclassSideData,
				propJson: this._getEntityType(feature),
				fnMatch: this._isMatchClassSubclassFeature.bind(this),
			},
		);
		const fromSide = UtilActiveEffects.getExpandedEffects(effectsRaw || [], {
			actor,
			sheetItem,
			parentName: feature.name,
			additionalData,
			img,
		});
		if (fromSide) out.push(...fromSide);

		return out;
	}

	static _isMatchClassSubclassFeature (ent, entAdd) {
		return entAdd.name === ent.name && entAdd.source === ent.source && entAdd.className === ent.className && entAdd.classSource === ent.classSource && entAdd.subclassName === ent.subclassName && entAdd.subclassSource === ent.subclassSource && ent.level === entAdd.level;
	}

	static async _pGetClassSubclassFeatureItem (feature, opts) {
		opts = opts || {};

		let {type = null, actor} = opts;
		type = type || this._getEntityType(feature);

		let pOut;
		if (await this._pIsInSrd(feature, type)) {
			pOut = this._pGetClassSubclassFeatureItem_fromSrd(feature, type, actor, opts);
		} else {
			pOut = this._pGetClassSubclassFeatureItem_other(feature, type, actor, opts);
		}
		return pOut;
	}

	static _getEntityType (feature) {
		if (feature.subclassShortName) return "subclassFeature";
		if (feature.className) return "classFeature";
		return null;
	}

	static _getBrewProp (feature) {
		const type = this._getEntityType(feature);
		switch (type) {
			case "classFeature": return "foundryClassFeature";
			case "subclassFeature": return "foundrySubclassFeature";
			default: throw new Error(`Unhandled feature type "${type}"`);
		}
	}

	static async _pIsInSrd (feature, type) {
		const srdData = await UtilCompendium.getSrdCompendiumEntity(type, feature, {fnGetAliases: this._getSrdAliases});
		return !!srdData;
	}

	static async _pGetClassSubclassFeatureItem_fromSrd (feature, type, actor, opts) {
		const srdData = await UtilCompendium.getSrdCompendiumEntity(type, feature, {fnGetAliases: this._getSrdAliases});

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(feature, {isActorItem: actor != null})),
			type: srdData.type,
			data: {
				...srdData.data,

				source: UtilDataConverter.getSourceWithPagePart(feature),
				description: {value: await DataConverter.pGetEntryDescription(feature), chat: "", unidentified: ""},

				...(feature.foundryAdditionalData || {}),
			},
			effects: MiscUtil.copy(srdData.effects || []),
			flags: {
				...this._getClassSubclassFeatureFlags(feature, type, opts),
				...(feature.foundryAdditionalFlags || {}),
			},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetClassSubclassFeatureItem_pGetImagePath(feature, type),
			),
		};
	}

	static _getClassSubclassFeatureFlags (feature, type, opts) {
		opts = opts || {};

		const out = {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_CLASS_SUBCLASS_FEATURES,
				source: feature.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASS_SUBCLASS_FEATURES](feature),
			},
		};

		if (opts.isAddDataFlags) {
			out[SharedConsts.MODULE_NAME_FAKE].propDroppable = this._getEntityType(feature);
			out[SharedConsts.MODULE_NAME_FAKE].filterValues = opts.filterValues;
		}

		return out;
	}

	static async _pGetClassSubclassFeatureItem_other (entity, type, actor, opts) {
		return DataConverter.pGetItemActorPassive(
			entity,
			{
				mode: "player",
				modeOptions: {
					isChannelDivinity: entity.className === "Cleric" && entity.name.toLowerCase().startsWith("channel divinity:"),
				},
				renderDepth: 0,
				fvttType: "feat",
				img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
					await this._pGetClassSubclassFeatureItem_pGetImagePath(entity, type),
				),
				source: UtilDataConverter.getSourceWithPagePart(entity),
				requirements: `${entity.className} ${entity.level}${entity.subclassShortName ? ` (${entity.subclassShortName})` : ""}`,
				additionalData: entity.foundryAdditionalData,
				foundryFlags: this._getClassSubclassFeatureFlags(entity, type, opts),
				additionalFlags: entity.foundryAdditionalFlags,
				actor,
			},
		);
	}

	static async _pGetClassSubclassFeatureItem_pGetImagePath (entity, type) {
		return this._pGetImagePath(entity, type);
	}

	static _getSrdAliases (entity) {
		if (!entity.name) return [];

		const out = [];

		const noBrackets = entity.name
			.replace(/\([^)]+\)/g, "")
			.replace(/\s+/g, " ")
			.trim();
		if (noBrackets !== entity.name) out.push(noBrackets);

		const lowName = entity.name.toLowerCase().trim();
		if (DataConverterClassSubclassFeature._FEATURE_SRD_ASLIAS_WITH_CLASSNAME.has(lowName)) {
			out.push(`${entity.name} (${entity.className})`);
		}

		if (lowName.startsWith("mystic arcanum")) {
			out.push(`${noBrackets} (${((entity.level - 9) / 2) + 5}th-Level Spell)`);
		}

		return out;
	}

	static async pMutActorUpdateClassSubclassFeatureItem (actor, actorUpdate, feature, dataBuilderOpts) {
		const sideData = await this.pGetSideData(feature);
		DataConverter.mutActorUpdate(actor, actorUpdate, feature, {sideData});
	}

	static _getSideDataOpts (feature) {
		return {
			propBrew: this._getBrewProp(feature),
			fnLoadJson: Vetools.pGetClassSubclassSideData,
			propJson: this._getEntityType(feature),
			fnMatch: this._isMatchClassSubclassFeature.bind(this),
		};
	}
}

DataConverterClassSubclassFeature._FEATURE_SRD_ASLIAS_WITH_CLASSNAME = new Set([
	"unarmored defense",
	"channel divinity",
	"expertise",
	"land's stride",
	"timeless body",
]);

DataConverterClassSubclassFeature._UNARMORED_DEFENSE_BARBARIAN = new Set(["dex", "con"]);
DataConverterClassSubclassFeature._UNARMORED_DEFENSE_MONK = new Set(["dex", "wis"]);

export {DataConverterClassSubclassFeature};
