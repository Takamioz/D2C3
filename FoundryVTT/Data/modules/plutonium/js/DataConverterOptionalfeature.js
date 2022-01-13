import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {DataConverterFeature} from "./DataConverterFeature.js";
import {PageFilterClassesFoundry} from "./UtilCharactermancerClass.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterOptionalfeature extends DataConverterFeature {
	static async pGetDereferencedOptionalFeatureFeatureItem (feature) {
		// Bypass the loader, since we don't expect refs in optional features (yet)
		if (feature.entries) return MiscUtil.copy(feature);

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OPT_FEATURES](feature);
		return Renderer.hover.pCacheAndGet(UrlUtil.PG_OPT_FEATURES, feature.source, hash, {isCopy: true});
	}

	static async pGetInitOptionalFeatureFeatureLoadeds (feature) {
		const asFeatRef = {optionalfeature: `${feature.name}|${feature.source}`};
		// Bypass the loader, since we don't expect refs in optional features (yet)
		await PageFilterClassesFoundry.pInitOptionalFeatureLoadeds({optionalfeature: asFeatRef, raw: feature});
		return asFeatRef;
	}

	/**
	 * @param optFeature
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.isActorItem]
	 * @param [opts.actor]
	 */
	static async pGetOptionalFeatureItem (optFeature, opts) {
		opts = opts || {};
		if (opts.actor) opts.isActorItem = true;

		let pOut;
		if (await this._pIsInSrd(optFeature, opts)) {
			pOut = this._pGetOptionalFeatureItem_fromSrd(optFeature, opts);
		} else {
			pOut = this._pGetOptionalFeatureItem_other(optFeature, opts);
		}
		return pOut;
	}

	static async _pIsInSrd (optFeature) {
		const srdData = await UtilCompendium.getSrdCompendiumEntity("optionalfeature", optFeature, {fnGetAliases: this._getSrdAliases});
		return !!srdData;
	}

	static async _pGetOptionalFeatureItem_fromSrd (optFeature, opts) {
		const srdData = await UtilCompendium.getSrdCompendiumEntity("optionalfeature", optFeature, {fnGetAliases: this._getSrdAliases});

		const descriptionValue = await this._pGetDescriptionValue(optFeature);
		const dataConsume = this._getData_getConsume({optFeature, actor: opts.actor});

		// Ensure the resource consumption section is displayed, if required
		const activationType = dataConsume?.type && !srdData.data?.activation?.type ? "special" : srdData.data?.activation?.type;

		const additionalData = await this._pGetAdditionalData(optFeature);
		const additionalFlags = await this._pGetAdditionalFlags(optFeature);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(optFeature, {isActorItem: opts.isActorItem})),
			type: srdData.type,
			data: {
				...srdData.data,

				activation: {type: activationType},

				source: UtilDataConverter.getSourceWithPagePart(optFeature),
				description: {value: descriptionValue, chat: "", unidentified: ""},
				requirements: this._getRequirementsString(optFeature),
				consume: this._getData_getConsume({optFeature, actor: opts.actor}),

				...additionalData,
			},
			permission: {default: 0},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetImagePath(optFeature, "optionalfeature"),
			),
			flags: {
				...this._getOptionalFeatureFlags(optFeature, opts),
				...additionalFlags,
			},
			effects: MiscUtil.copy(srdData.effects || []),
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importOptionalFeature", "permissions")};

		return out;
	}

	static async _pGetOptionalFeatureItem_other (optFeature, opts) {
		const descriptionValue = await this._pGetDescriptionValue(optFeature);
		const dataConsume = this._getData_getConsume({optFeature, actor: opts.actor});

		const additionalData = await this._pGetAdditionalData(optFeature);
		const additionalFlags = await this._pGetAdditionalFlags(optFeature);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(optFeature, {isActorItem: opts.isActorItem})),
			data: {
				source: UtilDataConverter.getSourceWithPagePart(optFeature),
				description: {value: descriptionValue, chat: "", unidentified: ""},

				activation: {type: dataConsume?.type ? "special" : "", cost: null, condition: ""},
				duration: {value: 0, units: ""},
				target: {value: 0, units: "", type: ""},
				range: {value: 0, long: 0, units: null},
				uses: {value: 0, max: 0, per: ""},
				ability: "",
				actionType: "",
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				damage: {parts: [], versatile: ""},
				formula: "",
				save: {ability: "", dc: null},
				requirements: this._getRequirementsString(optFeature),
				consume: dataConsume,
				recharge: {value: 0, charged: true},

				...additionalData,
			},
			permission: {default: 0},
			type: "feat",
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetImagePath(optFeature, "optionalfeature"),
			),
			flags: {
				...this._getOptionalFeatureFlags(optFeature, opts),
				...additionalFlags,
			},
			effects: [],
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importOptionalFeature", "permissions")};

		return out;
	}

	static _pGetDescriptionValue (optFeature) {
		if (!Config.get("importOptionalFeature", "isImportDescription")) return "";

		return UtilDataConverter.pGetWithDescriptionPlugins(() => {
			const prerequisite = Renderer.utils.getPrerequisiteHtml(optFeature.prerequisite);
			return `<div>
				${prerequisite ? `<p><i>${prerequisite}</i></p>` : ""}
				${Renderer.get().setFirstSection(true).render({entries: optFeature.entries}, 2)}
			</div>`;
		});
	}

	static _getRequirementsString (optFeature) {
		return optFeature._foundryData?.requirements // This is passed in by the class importer
			|| Renderer.utils.getPrerequisiteHtml(optFeature.prerequisite, {isTextOnly: true, isSkipPrefix: true});
	}

	static _getData_getConsume ({optFeature, actor}) {
		if (!optFeature?.consumes) return {};

		const sheetItem = DataConverter.getConsumedSheetItem({consumes: optFeature.consumes, actor});
		if (!sheetItem) return {};

		return {
			type: "charges",
			amount: optFeature.consumes.amount ?? 1,
			target: sheetItem.id,
		};
	}

	static _getOptionalFeatureFlags (optFeature, opts) {
		opts = opts || {};

		const out = {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_OPT_FEATURES,
				source: optFeature.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OPT_FEATURES](optFeature),
			},
		};

		if (opts.isAddDataFlags) {
			out[SharedConsts.MODULE_NAME_FAKE].propDroppable = "optionalfeature";
			out[SharedConsts.MODULE_NAME_FAKE].filterValues = opts.filterValues;
		}

		return out;
	}

	static async pMutActorUpdateOptionalFeature (actor, actorUpdate, optFeature, dataBuilderOpts) {
		const sideData = await this.pGetSideData(optFeature);
		DataConverter.mutActorUpdate(actor, actorUpdate, optFeature, {sideData});
	}

	static async _pGetImagePath (optFeature) {
		return super._pGetImagePath(optFeature, "optionalfeature", {fallback: `modules/${SharedConsts.MODULE_NAME}/media/icon/skills.svg`});
	}

	static async _getPreloadSideData () { return Vetools.pGetOptionalFeatureSideData(); }

	static async pGetSideData (optFeature) {
		return DataConverter.pGetSideData_(optFeature, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalData (optFeature) {
		return DataConverter.pGetAdditionalData_(optFeature, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalFlags (optFeature) {
		return DataConverter.pGetAdditionalFlags_(optFeature, this._SIDE_DATA_OPTS);
	}

	static async pHasOptionalFeatureSideLoadedEffects (actor, optFeature) {
		return (await DataConverter.pGetAdditionalEffectsRaw_(optFeature, this._SIDE_DATA_OPTS))?.length > 0;
	}

	static async pGetOptionalFeatureItemEffects (actor, optFeature, sheetItem, {additionalData, img} = {}) {
		const effectsRaw = await DataConverter.pGetAdditionalEffectsRaw_(optFeature, this._SIDE_DATA_OPTS);
		return UtilActiveEffects.getExpandedEffects(effectsRaw || [], {actor, sheetItem, parentName: optFeature.name, additionalData, img});
	}

	static _getSrdAliases (entity) {
		if (!entity.name || !entity.srd) return [];

		const out = [];

		for (const [featureTypeSet, fnGetName] of DataConverterOptionalfeature._FEATURE_TYPES.entries()) {
			if (entity.featureType.some(it => featureTypeSet.has(it))) out.push(fnGetName(entity));
		}

		return out;
	}

	static get _SIDE_DATA_OPTS () {
		return {propBrew: "foundryOptionalfeature", fnLoadJson: async () => this._SIDE_DATA || this._getPreloadSideData(), propJson: "optionalfeature"};
	}
}

DataConverterOptionalfeature._FEATURE_TYPES = new Map();
DataConverterOptionalfeature._FEATURE_TYPES.set(new Set(["EI"]), entity => `Invocation: ${entity.name}`);
DataConverterOptionalfeature._FEATURE_TYPES.set(new Set(["MM"]), entity => `Metamagic: ${entity.name}`);
DataConverterOptionalfeature._FEATURE_TYPES.set(new Set(["FS:F", "FS:B", "FS:P", "FS:R"]), entity => `Fighting Style: ${entity.name}`);

export {DataConverterOptionalfeature};
