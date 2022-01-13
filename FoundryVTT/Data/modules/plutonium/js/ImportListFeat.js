import {MixinUserChooseImporter} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {DataConverterFeat} from "./DataConverterFeat.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListFeature} from "./ImportListFeature.js";

class ImportListFeat extends ImportListFeature {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "feat",
			importerName: "Feat",
		});
	}
	// endregion

	constructor (externalData, applicationOptsOverride, subclassOptsOverride) {
		applicationOptsOverride = applicationOptsOverride || {};
		subclassOptsOverride = subclassOptsOverride || {};
		super(
			{
				title: "Import Feats",
				...applicationOptsOverride,
			},
			externalData,
			{
				props: ["feat"],
				dirsHomebrew: ["feat"],
				titleSearch: "feats",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Feats"],
				pageFilter: new PageFilterFeats(),
				page: UrlUtil.PG_FEATS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importFeat",
				...subclassOptsOverride,
			},
			{
				titleLog: "feat",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_FEATS,
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
			isRadio: this._isRadio,
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			cols: [
				{
					name: "Name",
					width: 4,
					field: "name",
				},
				{
					name: "Ability",
					width: 3,
					field: "ability",
				},
				{
					name: "Prerequisite",
					width: 3,
					field: "prerequisite",
				},
				{
					name: "Source",
					width: 1,
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
					ability: it._slAbility,
					prerequisite: it._slPrereq,
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
					ability: it._slAbility,
					prerequisite: it._slPrereq,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	static async _pGetEntityItem (actor, feat) { return DataConverterFeat.pGetFeatItem(feat); }

	static async _pGetSideData (actor, feature) {
		return DataConverterFeat.pGetSideData(feature);
	}

	static async _pHasSideLoadedEffects (actor, feat) { return DataConverterFeat.pHasFeatSideLoadedEffects(actor, feat); }

	static async _pGetItemEffects (actor, feat, importedEmbed, dataBuilderOpts) {
		return DataConverterFeat.pGetFeatItemEffects(
			actor,
			feat,
			importedEmbed,
			{
				additionalData: {
					import: {chosenAbilityScoreIncrease: dataBuilderOpts.chosenAbilityScoreIncrease},
				},
			},
		);
	}

	_doPopulateFlags ({feature: feat, actor, importOpts, flags, flagsDnd5e}) {
		// (Note that these are now instead handled, generally, by active effects)
	}

	async _pMutActorUpdateFeature (feature, actUpdate, dataBuilderOpts) {
		await DataConverterFeat.pMutActorUpdateFeat(this._actor, actUpdate, feature, dataBuilderOpts);
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterFeat.pGetFeatItem(it, getItemOpts);
	}

	static async _pGetDereferencedFeatureItem (feature) {
		return DataConverterFeat.pGetDereferencedFeatFeatureItem(feature);
	}

	static async _pGetInitFeatureLoadeds (feature) {
		return DataConverterFeat.pGetInitFeatFeatureLoadeds(feature);
	}
}

ImportListFeat.UserChoose = class extends MiscUtil.mix(ImportListFeat).with(MixinUserChooseImporter) {
	constructor (externalData) {
		super(
			externalData,
			{
				title: "Select Feat",
			},
			{
				titleButtonRun: "Select",
			},
		);
	}
};

export {ImportListFeat};
