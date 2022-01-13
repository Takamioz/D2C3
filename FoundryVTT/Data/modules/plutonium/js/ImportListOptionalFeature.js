import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterOptionalfeature} from "./DataConverterOptionalfeature.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListFeature} from "./ImportListFeature.js";
import {MixinUserChooseImporter} from "./ImportList.js";

class ImportListOptionalFeature extends ImportListFeature {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "optionalfeature",
			importerName: "Other Option or Feature",
		});
	}
	// endregion

	constructor (externalData = {}, applicationOptsOverride = {}, subclassOptsOverride = {}) {
		super(
			{
				title: "Import Other Options and Features",
				...applicationOptsOverride,
			},
			externalData,
			{
				props: ["optionalfeature"],
				dirsHomebrew: ["optionalfeature"],
				titleSearch: "options and features",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Other Options and Features"],
				pageFilter: new PageFilterOptionalFeatures(),
				page: UrlUtil.PG_OPT_FEATURES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importOptionalFeature",
				...subclassOptsOverride,
			},
			{
				titleLog: "other option/feature",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_OPTIONALFEATURES,
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
					name: "Name",
					width: 4,
					field: "name",
				},
				{
					name: "Type",
					width: 2,
					field: "type",
					rowClassName: "text-center",
				},
				{
					name: "Prerequisite",
					width: 3,
					field: "prerequisite",
					rowClassName: "text-center",
				},
				{
					name: "Level",
					width: 1,
					field: "level",
					rowClassName: "text-center",
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

				// region Re-used in fnGetValues
				it._vPrerequisite = Renderer.utils.getPrerequisiteHtml(it.prerequisite, {isListMode: true, blacklistKeys: new Set(["level"])});
				it._vLevel = Renderer.optionalfeature.getListPrerequisiteLevelText(it.prerequisite);
				// endregion

				return {
					name: it.name,
					type: it._lFeatureType,
					prerequisite: it._vPrerequisite,
					level: it._vLevel,
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
					prerequisite: it._vPrerequisite,
					level: it._vLevel,
					type: it._lFeatureType,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	static async _pGetEntityItem (actor, feature) { return DataConverterOptionalfeature.pGetOptionalFeatureItem(feature, {actor}); }

	static async _pGetSideData (actor, feature) {
		return DataConverterOptionalfeature.pGetSideData(feature);
	}

	static async _pHasSideLoadedEffects (actor, feature) { return DataConverterOptionalfeature.pHasOptionalFeatureSideLoadedEffects(actor, feature); }

	static async _pGetItemEffects (actor, feature, importedEmbed, dataBuilderOpts) {
		return DataConverterOptionalfeature.pGetOptionalFeatureItemEffects(
			actor,
			feature,
			importedEmbed,
		);
	}

	async _pMutActorUpdateFeature (feature, actUpdate, dataBuilderOpts) {
		await DataConverterOptionalfeature.pMutActorUpdateOptionalFeature(this._actor, actUpdate, feature, dataBuilderOpts);
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterOptionalfeature.pGetOptionalFeatureItem(it, getItemOpts);
	}

	static async _pGetDereferencedFeatureItem (feature) {
		return DataConverterOptionalfeature.pGetDereferencedOptionalFeatureFeatureItem(feature);
	}

	static async _pGetInitFeatureLoadeds (feature) {
		return DataConverterOptionalfeature.pGetInitOptionalFeatureFeatureLoadeds(feature);
	}
}

ImportListOptionalFeature.UserChoose = class extends MiscUtil.mix(ImportListOptionalFeature).with(MixinUserChooseImporter) {
	constructor (externalData) {
		super(
			externalData,
			{
				title: "Select Other Option or Feature",
			},
			{
				titleButtonRun: "Select",
			},
		);
	}
};

export {ImportListOptionalFeature};
