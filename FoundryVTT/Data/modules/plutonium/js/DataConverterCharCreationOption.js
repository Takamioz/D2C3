import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {DataConverterFeature} from "./DataConverterFeature.js";
import {PageFilterClassesFoundry} from "./UtilCharactermancerClass.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterCharCreationOption extends DataConverterFeature {
	static async pGetDereferencedCharCreationOptionFeatureItem (feature) {
		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CHAR_CREATION_OPTIONS](feature);
		return Renderer.hover.pCacheAndGet(UrlUtil.PG_CHAR_CREATION_OPTIONS, feature.source, hash, {isCopy: true});
	}

	static async pGetInitCharCreationOptionFeatureLoadeds (feature) {
		const asFeatRef = {charoption: `${feature.name}|${feature.source}`};
		await PageFilterClassesFoundry.pInitCharCreationOptionLoadeds({charoption: asFeatRef, raw: feature});
		return asFeatRef;
	}

	/**
	 * @param ent
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.isActorItem]
	 * @param [opts.actor]
	 */
	static async pGetCharCreationOptionItem (ent, opts) {
		opts = opts || {};
		if (opts.actor) opts.isActorItem = true;

		return this._pGetCharCreationOptionItem(ent, opts);
	}

	static async _pGetCharCreationOptionItem (ent, opts) {
		const descriptionValue = await this._pGetGenericDescription(ent, "importCharCreationOption");

		const additionalData = await this._pGetAdditionalData(ent);
		const additionalFlags = await this._pGetAdditionalFlags(ent);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(ent, {isActorItem: opts.isActorItem})),
			data: {
				source: UtilDataConverter.getSourceWithPagePart(ent),
				description: {value: descriptionValue, chat: "", unidentified: ""},

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
				requirements: "",
				recharge: {value: 0, charged: true},

				...additionalData,
			},
			permission: {default: 0},
			type: "feat",
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetImagePath(ent, "charoption"),
			),
			flags: {
				...this._getCharCreationOptionFlags(ent, opts),
				...additionalFlags,
			},
			effects: [],
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importCharCreationOption", "permissions")};

		return out;
	}

	static _getCharCreationOptionFlags (ent, opts) {
		opts = opts || {};

		const out = {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_CHAR_CREATION_OPTIONS,
				source: ent.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CHAR_CREATION_OPTIONS](ent),
			},
		};

		if (opts.isAddDataFlags) {
			out[SharedConsts.MODULE_NAME_FAKE].propDroppable = "charoption";
			out[SharedConsts.MODULE_NAME_FAKE].filterValues = opts.filterValues;
		}

		return out;
	}

	static async pMutActorUpdateCharCreationOption (actor, actorUpdate, ent, dataBuilderOpts) {
		const sideData = await this.pGetSideData(ent);
		DataConverter.mutActorUpdate(actor, actorUpdate, ent, {sideData});
	}

	static async _getPreloadSideData () { return Vetools.pGetCharCreationOptionSideData(); }

	static async pGetSideData (ent) {
		return DataConverter.pGetSideData_(ent, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalData (ent) {
		return DataConverter.pGetAdditionalData_(ent, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalFlags (ent) {
		return DataConverter.pGetAdditionalFlags_(ent, this._SIDE_DATA_OPTS);
	}

	static async pHasCharCreationOptionSideLoadedEffects (actor, ent) {
		return (await DataConverter.pGetAdditionalEffectsRaw_(ent, this._SIDE_DATA_OPTS))?.length > 0;
	}

	static async pGetCharCreationOptionItemEffects (actor, ent, sheetItem, {additionalData, img} = {}) {
		const effectsRaw = await DataConverter.pGetAdditionalEffectsRaw_(ent, this._SIDE_DATA_OPTS);
		return UtilActiveEffects.getExpandedEffects(effectsRaw || [], {actor, sheetItem, parentName: ent.name, additionalData, img});
	}

	static get _SIDE_DATA_OPTS () {
		return {propBrew: "foundryCharoption", fnLoadJson: async () => this._SIDE_DATA || this._getPreloadSideData(), propJson: "charoption"};
	}
}

export {DataConverterCharCreationOption};
