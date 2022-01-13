import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterCultBoon {
	/**
	 * @param ent
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.isActorItem]
	 */
	static async pGetCultBoonItem (ent, opts) {
		opts = opts || {};

		const content = Config.get("importCultBoon", "isImportDescription")
			? await UtilDataConverter.pGetWithDescriptionPlugins(() => `<div>${Renderer.get().setFirstSection(true).render({entries: ent.entries}, 2)}</div>`)
			: "";

		const additionalData = await this._pGetAdditionalData(ent);
		const additionalFlags = await this._pGetAdditionalFlags(ent);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(ent, {isActorItem: opts.isActorItem})),
			data: {
				source: UtilDataConverter.getSourceWithPagePart(ent),
				description: {
					value: content,
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
				requirements: "",
				recharge: {value: 0, charged: true},

				...additionalData,
			},
			permission: {default: 0},
			type: "feat",
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				await this._pGetCultBoonItem_getCultBoonImagePath(ent),
			),
			flags: {
				[SharedConsts.MODULE_NAME_FAKE]: {
					page: UrlUtil.PG_CULTS_BOONS,
					source: ent.source,
					hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CULTS_BOONS](ent),
					propDroppable: ent.__prop,
				},
				...additionalFlags,
			},
			effects: [],
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importCultBoon", "permissions")};

		return out;
	}

	static async _pGetCultBoonItem_getCultBoonImagePath (ent) {
		if (ent.foundryImg) return ent.foundryImg;
		return `modules/${SharedConsts.MODULE_NAME}/media/icon/diablo-skull.svg`;
	}

	static async _pGetAdditionalData (ent) {
		return DataConverter.pGetAdditionalData_(ent, this._getSideDataOpts(ent));
	}

	static async _pGetAdditionalFlags (ent) {
		return DataConverter.pGetAdditionalFlags_(ent, this._getSideDataOpts(ent));
	}

	static _getSideDataOpts (ent) {
		return {propBrew: ent.__prop === "cult" ? "foundryCult" : "foundryBoon", fnLoadJson: Vetools.pGetCultBoonSideData, propJson: ent.__prop};
	}
}

export {DataConverterCultBoon};
