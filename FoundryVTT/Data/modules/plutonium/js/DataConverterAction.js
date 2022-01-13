import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterAction {
	/**
	 * @param ent
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.isActorItem]
	 */
	static async pGetActionItem (ent, opts) {
		opts = opts || {};

		const content = Config.get("importAction", "isImportDescription")
			? await UtilDataConverter.pGetWithDescriptionPlugins(() => `<div>${Renderer.get().setFirstSection(true).render({entries: ent.entries}, 2)}</div>`)
			: "";

		let activationType = "special";
		let activationCost = 0;
		if (ent.time?.length && typeof ent.time[0] !== "string") {
			const time0 = ent.time[0];
			activationType = time0.unit || "special";
			activationCost = time0.number ?? 0;
		}

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

				activation: {type: activationType, cost: activationCost, condition: ""},
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
				await this._pGetActionItem_getActionImagePath(ent),
			),
			flags: {
				...this._getActionFlags(ent),
				...additionalFlags,
			},
			effects: [],
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importAction", "permissions")};

		return out;
	}

	static async _pGetActionItem_getActionImagePath (ent) {
		if (ent.foundryImg) return ent.foundryImg;
		return `modules/${SharedConsts.MODULE_NAME}/media/icon/jump-across.svg`;
	}

	static _getActionFlags (action) {
		return {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_ACTIONS,
				source: action.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ACTIONS](action),
				propDroppable: "action",
			},
		};
	}

	static async _pGetAdditionalData (ent) {
		return DataConverter.pGetAdditionalData_(ent, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalFlags (ent) {
		return DataConverter.pGetAdditionalFlags_(ent, this._SIDE_DATA_OPTS);
	}

	static get _SIDE_DATA_OPTS () {
		return {propBrew: "foundryAction", fnLoadJson: Vetools.pGetActionSideData, propJson: "action"};
	}
}

export {DataConverterAction};
