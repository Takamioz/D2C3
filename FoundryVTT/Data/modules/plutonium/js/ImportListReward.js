import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {DataConverterReward} from "./DataConverterReward.js";
import {ImportListFeature} from "./ImportListFeature.js";
import {MixinUserChooseImporter} from "./ImportList.js";

class ImportListReward extends ImportListFeature {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "reward",
			importerName: "Reward",
		});
	}
	// endregion

	constructor (externalData = {}, applicationOptsOverride = {}, subclassOptsOverride = {}) {
		super(
			{
				title: "Import Supernatural Gifts and Rewards",
				...applicationOptsOverride,
			},
			externalData,
			{
				props: ["reward"],
				dirsHomebrew: ["reward"],
				titleSearch: "supernatural gifts and rewards",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Supernatural Gifts and Rewards"],
				pageFilter: new PageFilterRewards(),
				page: UrlUtil.PG_REWARDS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importReward",
				...subclassOptsOverride,
			},
			{
				titleLog: "supernatural gift/reward",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_REWARDS,
				{
					filterTypes: [UtilDataSource.SOURCE_TYP_OFFICIAL_ALL],
					isDefault: true,
				},
			),
			new UtilDataSource.DataSourceUrl(
				"Custom URL",
				"",
				{
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			new UtilDataSource.DataSourceFile(
				"Upload File",
				{
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			...(await this._pGetSourcesHomebrew()),
		];
	}

	getData () {
		return {
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			cols: [
				{
					name: "Type",
					width: 2,
					field: "type",
					rowClassName: "text-center",
				},
				{
					name: "Name",
					width: 7,
					field: "name",
				},
				{
					name: "Source",
					width: 2,
					field: "source",
					titleProp: "sourceLong",
					displayProp: "sourceShort",
					classNameProp: "sourceClassName",
					styleProp: "sourceStyle",
					rowClassName: "text-center",
				},
			],
			rows: this._content.map((it, ix) => {
				this._pageFilter.constructor.mutateForFilters(it);

				return {
					name: it.name,
					type: it.type,
					source: it.source,
					sourceShort: Parser.sourceJsonToAbv(it.source),
					sourceLong: Parser.sourceJsonToFull(it.source),
					sourceClassName: Parser.sourceJsonToColor(it.source),
					sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),
					ix,
				};
			}),
		};
	}

	_activateListeners_absorbListItems () {
		this._list.doAbsorbItems(
			this._content,
			{
				fnGetName: it => it.name,
				// values used for sorting/search
				fnGetValues: it => ({
					source: it.source,
					type: it.type,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	static async _pGetEntityItem (actor, feature) { return DataConverterReward.pGetRewardItem(feature, {actor}); }

	static async _pGetSideData (actor, feature) {
		return DataConverterReward.pGetSideData(feature);
	}

	static async _pHasSideLoadedEffects (actor, feature) { return DataConverterReward.pHasRewardSideLoadedEffects(actor, feature); }

	static async _pGetItemEffects (actor, feature, importedEmbed, dataBuilderOpts) {
		return DataConverterReward.pGetRewardItemEffects(
			actor,
			feature,
			importedEmbed,
		);
	}

	async _pMutActorUpdateFeature (it, actUpdate, dataBuilderOpts) {
		await DataConverterReward.pMutActorUpdateReward(this._actor, actUpdate, it, dataBuilderOpts);
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterReward.pGetRewardItem(it, getItemOpts);
	}

	static async _pGetDereferencedFeatureItem (feature) {
		return DataConverterReward.pGetDereferencedRewardFeatureItem(feature);
	}

	static async _pGetInitFeatureLoadeds (feature) {
		return DataConverterReward.pGetInitRewardFeatureLoadeds(feature);
	}
}

ImportListReward.UserChoose = class extends MiscUtil.mix(ImportListReward).with(MixinUserChooseImporter) {
	constructor (externalData) {
		super(
			externalData,
			{
				title: "Select Supernatural Gift or Reward",
			},
			{
				titleButtonRun: "Select",
			},
		);
	}
};

export {ImportListReward};
