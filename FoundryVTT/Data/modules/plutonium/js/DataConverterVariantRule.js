import {UtilApplications} from "./UtilApplications.js";
import {Config} from "./Config.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {Vetools} from "./Vetools.js";

class DataConverterVariantRule {
	/**
	 * @param rule
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 */
	static async pGetVariantRuleJournal (rule, opts) {
		opts = opts || {};

		const cpy = MiscUtil.copy(rule);
		delete cpy.name;
		delete cpy.page;
		delete cpy.source;

		const content = await UtilDataConverter.pGetWithDescriptionPlugins(() => `<div>${Renderer.get().setFirstSection(true).render(cpy)}</div>`);

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await this._pGetVariantRuleJournal_getVariantRuleImagePath(rule),
		);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(rule)),
			permission: {default: 0},
			entryTime: Date.now(),
			content,
			img,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importRule", "permissions")};

		return out;
	}

	static async _pGetVariantRuleJournal_getVariantRuleImagePath (ent) {
		if (ent.foundryImg) return ent.foundryImg;
		return null;
	}
}

export {DataConverterVariantRule};
