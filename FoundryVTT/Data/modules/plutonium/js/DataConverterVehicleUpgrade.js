import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterVehicleUpgrade {
	/**
	 * @param vehUpgrade
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.isActorItem]
	 */
	static async pGetVehicleUpgradeItem (vehUpgrade, opts) {
		opts = opts || {};
		return this._pGetVehicleUpgradeItem_other(vehUpgrade, opts);
	}

	static async _pGetVehicleUpgradeItem_other (vehUpgrade, opts) {
		const descriptionValue = await this._pGetDescriptionValue(vehUpgrade);

		const tempAdditionalData = vehUpgrade._foundryData || {};
		const additionalData = await this._pGetAdditionalData(vehUpgrade);
		const additionalFlags = await this._pGetAdditionalFlags(vehUpgrade);
		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await this._pGetImagePath(vehUpgrade),
		);
		const effects = (await this._pGetVehicleUpgradeEffects(vehUpgrade, img, opts)) || [];

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(vehUpgrade, {isActorItem: opts.isActorItem})),
			data: {
				source: UtilDataConverter.getSourceWithPagePart(vehUpgrade),
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
				requirements: tempAdditionalData.requirements || "",
				recharge: {value: 0, charged: true},

				...additionalData,
			},
			permission: {default: 0},
			type: "feat",
			img,
			flags: {
				...this._getVehicleUpgradeFlags(vehUpgrade, opts),
				...additionalFlags,
			},
			effects,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importVehicleUpgrade", "permissions")};

		return out;
	}

	static _pGetDescriptionValue (vehUpgrade) {
		if (!Config.get("importVehicleUpgrade", "isImportDescription")) return "";

		return UtilDataConverter.pGetWithDescriptionPlugins(() => {
			return `<div>
				<p><i>${Renderer.vehicle.getUpgradeSummary(vehUpgrade)}</i></div></p>
				${Renderer.get().setFirstSection(true).render({entries: vehUpgrade.entries}, 1)}
			</div>`;
		});
	}

	static _getVehicleUpgradeFlags (vehUpgrade, opts) {
		opts = opts || {};

		const out = {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_VEHICLES,
				source: vehUpgrade.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VEHICLES](vehUpgrade),
			},
		};

		if (opts.isAddDataFlags) {
			out[SharedConsts.MODULE_NAME_FAKE].propDroppable = "vehicleUpgrade";
			out[SharedConsts.MODULE_NAME_FAKE].filterValues = opts.filterValues;
		}

		return out;
	}

	static async _pGetImagePath (vehUpgrade) {
		if (vehUpgrade.foundryImg) return vehUpgrade.foundryImg;
		return `modules/${SharedConsts.MODULE_NAME}/media/icon/gears.svg`;
	}

	static async _pGetVehicleUpgradeEffects (vehUpgrade, img, {isActorItem} = {}) {
		if (isActorItem) return []; // For actor items, the effects are handled at the importer level
		if (await this.pHasVehicleUpgradeSideLoadedEffects(null, vehUpgrade)) return this.pGetVehicleUpgradeItemEffects(null, vehUpgrade, null, {img});
		return [];
	}

	static async _pGetAdditionalData (vehUpgrade) {
		return DataConverter.pGetAdditionalData_(vehUpgrade, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalFlags (vehUpgrade) {
		return DataConverter.pGetAdditionalFlags_(vehUpgrade, this._SIDE_DATA_OPTS);
	}

	static async pHasVehicleUpgradeSideLoadedEffects (actor, vehUpgrade) {
		return (await DataConverter.pGetAdditionalEffectsRaw_(vehUpgrade, this._SIDE_DATA_OPTS))?.length > 0;
	}

	static async pGetVehicleUpgradeItemEffects (actor, vehUpgrade, sheetItem, {additionalData, img} = {}) {
		const effectsRaw = await DataConverter.pGetAdditionalEffectsRaw_(vehUpgrade, this._SIDE_DATA_OPTS);
		return UtilActiveEffects.getExpandedEffects(effectsRaw || [], {actor, sheetItem, parentName: vehUpgrade.name, additionalData, img});
	}

	static get _SIDE_DATA_OPTS () {
		return {propBrew: "foundryVehicleUpgrade", fnLoadJson: Vetools.pGetVehicleUpgradeSideData, propJson: "vehicleUpgrade"};
	}
}

export {DataConverterVehicleUpgrade};
