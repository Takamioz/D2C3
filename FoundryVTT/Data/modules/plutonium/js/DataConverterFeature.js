import {UtilCompendium} from "./UtilCompendium.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterFeature {
	static async pPreloadSideData () {
		this._SIDE_DATA = await this._getPreloadSideData();
	}

	static async _getPreloadSideData () { throw new Error("Unimplemented!"); }

	static async _pGetImagePath (
		ent,
		prop,
		{
			fallback = `modules/${SharedConsts.MODULE_NAME}/media/icon/mighty-force.svg`,
		} = {},
	) {
		if (ent.foundryImg) return ent.foundryImg;

		const fromCompendium = await UtilCompendium.pGetCompendiumImage(prop, ent, {fnGetAliases: this._getSrdAliases});
		if (fromCompendium) return fromCompendium;

		return fallback;
	}

	static _getSrdAliases () { return []; }

	static _pGetGenericDescription (ent, configGroup) {
		return Config.get(configGroup, "isImportDescription")
			? UtilDataConverter.pGetWithDescriptionPlugins(() => `<div>${Renderer.get().setFirstSection(true).render({entries: ent.entries}, 2)}</div>`)
			: "";
	}
}
DataConverterFeature._SIDE_DATA = null;

export {DataConverterFeature};
