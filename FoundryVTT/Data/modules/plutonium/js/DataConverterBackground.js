import {UtilApplications} from "./UtilApplications.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterBackground {
	// TODO(Future) expand/replace this as Foundry allows
	/**
	 * @param bg
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.filterValues] Pre-baked filter values to be re-used when importing this from the item.
	 */
	static async pGetBackgroundItem (bg, opts) {
		opts = opts || {};

		const originalData = DataConverter.getCleanOriginalData(bg);
		const fluff = opts.fluff || await Renderer.background.pGetFluff(bg);

		const description = Config.get("importBackground", "isImportDescription")
			? await UtilDataConverter.pGetWithDescriptionPlugins(() => {
				const rendered = [
					fluff?.entries?.length ? Renderer.get().setFirstSection(true).render({type: "entries", entries: fluff?.entries}) : "",
					Renderer.get().setFirstSection(true).render({type: "entries", entries: bg.entries}),
				].filter(Boolean);
				return `<div>${rendered.join("<hr>")}</div>`;
			})
			: "";

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await this._pGetBackgroundItem_pGetImagePath(bg, fluff),
		);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(bg)),
			type: "feat",
			data: {
				description: {value: description, chat: "", unidentified: ""},
				source: UtilDataConverter.getSourceWithPagePart(bg),

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
				consume: {type: "", target: "", amount: null},
				// endregion
			},
			flags: {
				[SharedConsts.MODULE_NAME_FAKE]: {
					page: UrlUtil.PG_BACKGROUNDS,
					source: bg.source,
					hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BACKGROUNDS](bg),
					propDroppable: "background",
					data: {
						background: originalData,
					},
					filterValues: opts.filterValues,
				},
			},
			effects: [],
			img,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importBackground", "permissions")};

		return out;
	}

	static async _pGetBackgroundItem_pGetImagePath (bg, fluff) {
		if (bg.foundryImg) return bg.foundryImg;

		const fromFluff = await Vetools.pGetImageUrlFromFluff(fluff);
		if (fromFluff) return fromFluff;

		return `modules/${SharedConsts.MODULE_NAME}/media/icon/farmer.svg`;
	}

	static async pGetBackgroundFeatureItem (bg, featureEntry, actor, dataBuilderOpts) {
		const fauxEntry = this._getFauxBackgroundFeature(bg, featureEntry);

		return DataConverter.pGetItemActorPassive(
			featureEntry,
			{
				mode: "player",
				img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
					await this._pGetBackgroundItem_pGetImagePath(bg, dataBuilderOpts.fluff),
				),
				fvttType: "feat",
				source: bg.source,
				actor,
				additionalData: await this._pGetFeatureAdditionalData(fauxEntry),
				additionalFlags: await this._pGetFeatureAdditionalFlags(fauxEntry),
			},
		);
	}

	static _getFauxBackgroundFeature (bg, entry) {
		return {
			source: bg.source,
			backgroundName: bg.name,
			backgroundSource: bg.source,
			srd: bg.srd || bg._baseSrd,
			...MiscUtil.copy(entry),
		};
	}

	static async _pGetFeatureAdditionalData (bgFeature) {
		return DataConverter.pGetAdditionalData_(
			bgFeature,
			this._SIDE_DATA_FEATURE_OPTS,
		);
	}

	static async _pGetFeatureAdditionalFlags (bgFeature) {
		return DataConverter.pGetAdditionalFlags_(
			bgFeature,
			this._SIDE_DATA_FEATURE_OPTS,
		);
	}

	static getBackgroundStub () {
		return MiscUtil.copy(DataConverterBackground.STUB_BACKGROUND);
	}

	static get _SIDE_DATA_FEATURE_OPTS () {
		return {
			propBrew: "foundryBackgroundFeature",
			fnLoadJson: Vetools.pGeBackgroundSideData,
			propJson: "backgroundFeature",
			fnMatch: (ent, entAdd) => entAdd.name === ent.name && entAdd.source === ent.source && entAdd.backgroundName === ent.backgroundName && entAdd.backgroundSource === ent.backgroundSource,
		};
	}
}

// region Fake data used in place of missing records when levelling up
//   (i.e. if the same set of sources have not been selected when re-opening the Charactermancer)
DataConverterBackground.STUB_BACKGROUND = {
	name: "Unknown Background",
	source: SRC_PHB,
	_isStub: true,
};
// endregion

export {DataConverterBackground};
