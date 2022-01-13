import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {DataConverterFeature} from "./DataConverterFeature.js";
import {PageFilterClassesFoundry} from "./UtilCharactermancerClass.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterFeat extends DataConverterFeature {
	static async pGetDereferencedFeatFeatureItem (feature) {
		// Bypass the loader, since we don't expect refs in feats (yet)
		if (feature.entries) return MiscUtil.copy(feature);

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS](feature);
		return Renderer.hover.pCacheAndGet(UrlUtil.PG_FEATS, feature.source, hash, {isCopy: true});
	}

	static async pGetInitFeatFeatureLoadeds (feature) {
		const asFeatRef = {feat: `${feature.name}|${feature.source}`};
		// Bypass the loader, since we don't expect refs in feats (yet)
		await PageFilterClassesFoundry.pInitFeatLoadeds({feat: asFeatRef, raw: feature});
		return asFeatRef;
	}

	/**
	 * @param feat
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.filterValues] Pre-baked filter values to be re-used when importing this from the item.
	 * @param [opts.isAddDataFlags]
	 * @param [opts.isActorItem]
	 */
	static async pGetFeatItem (feat, opts) {
		opts = opts || {};

		const content = await UtilDataConverter.pGetWithDescriptionPlugins(() => {
			const prerequisite = Renderer.utils.getPrerequisiteHtml(feat.prerequisite);
			Renderer.feat.initFullEntries(feat);
			return `<div>
				${prerequisite ? `<p><i>Prerequisite: ${prerequisite}</i></p>` : ""}
				${Renderer.get().setFirstSection(true).render({entries: feat._fullEntries || feat.entries}, 2)}
			</div>`;
		});

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await this._pGetFeatItem_getFeatImagePath(feat),
		);

		const additionalData = await this._pGetAdditionalData(feat);
		const additionalFlags = await this._pGetAdditionalFlags(feat);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(feat, {isActorItem: opts.isActorItem})),
			data: {
				source: UtilDataConverter.getSourceWithPagePart(feat),
				description: {
					value: Config.get("importFeat", "isImportDescription") ? content : "",
					chat: "",
					unidentified: "",
				},

				activation: {type: "", cost: 0, condition: ""},
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
				requirements: Renderer.utils.getPrerequisiteHtml(feat.prerequisite, {isTextOnly: true, isSkipPrefix: true}),
				recharge: {value: 0, charged: true},

				...additionalData,
			},
			permission: {default: 0},
			type: "feat",
			img,
			flags: {
				...this._getFeatFlags(feat, opts),
				...additionalFlags,
			},
			effects: [],
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importFeat", "permissions")};

		return out;
	}

	static async _pGetFeatItem_getFeatImagePath (feat) {
		if (feat.foundryImg) return feat.foundryImg;
		return (await DataConverter.pGetIconImage("feat", feat)) || `modules/${SharedConsts.MODULE_NAME}/media/icon/mighty-force.svg`;
	}

	static _getFeatFlags (feat, opts) {
		opts = opts || {};

		const out = {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_FEATS,
				source: feat.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS](feat),
			},
		};

		if (opts.isAddDataFlags) {
			out[SharedConsts.MODULE_NAME_FAKE].propDroppable = "feat";
			out[SharedConsts.MODULE_NAME_FAKE].filterValues = opts.filterValues;
		}

		return out;
	}

	static async pMutActorUpdateFeat (actor, actorUpdate, feat, dataBuilderOpts) {
		const sideData = await this.pGetSideData(feat);
		DataConverter.mutActorUpdate(actor, actorUpdate, feat, {sideData});
	}

	static async pGetSideData (feat) {
		return DataConverter.pGetSideData_(feat, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalFlags (feat) {
		return DataConverter.pGetAdditionalFlags_(feat, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalData (feat) {
		return DataConverter.pGetAdditionalData_(feat, this._SIDE_DATA_OPTS);
	}

	static async pHasFeatSideLoadedEffects (actor, feat) {
		return (await DataConverter.pGetAdditionalEffectsRaw_(feat, this._SIDE_DATA_OPTS))?.length > 0;
	}

	static async pGetFeatItemEffects (actor, feat, sheetItem, {additionalData, img} = {}) {
		const effectsRaw = await DataConverter.pGetAdditionalEffectsRaw_(feat, this._SIDE_DATA_OPTS);
		return UtilActiveEffects.getExpandedEffects(effectsRaw || [], {actor, sheetItem, parentName: feat.name, additionalData, img});
	}

	static async _getPreloadSideData () { return Vetools.pGetFeatSideData(); }

	static get _SIDE_DATA_OPTS () {
		return {propBrew: "foundryFeat", fnLoadJson: async () => this._SIDE_DATA || this._getPreloadSideData(), propJson: "feat"};
	}
}

export {DataConverterFeat};
