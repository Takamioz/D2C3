import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterCharCreationOption} from "./DataConverterCharCreationOption.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListFeature} from "./ImportListFeature.js";
import {MixinUserChooseImporter} from "./ImportList.js";

class ImportListCharCreationOption extends ImportListFeature {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "charoption",
			importerName: "Character Creation Option",
		});
	}
	// endregion

	constructor (externalData = {}, applicationOptsOverride = {}, subclassOptsOverride = {}) {
		super(
			{
				title: "Import Other Character Creation Options",
				...applicationOptsOverride,
			},
			externalData,
			{
				props: ["charoption"],
				dirsHomebrew: ["charoption"],
				titleSearch: "character creation options",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Character Creation Options"],
				pageFilter: new PageFilterCharCreationOptions(),
				page: UrlUtil.PG_CHAR_CREATION_OPTIONS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importCharCreationOption",
				...subclassOptsOverride,
			},
			{
				titleLog: "character creation option",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_CHAR_CREATION_OPTIONS,
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
					width: 6,
					field: "name",
				},
				{
					name: "Type",
					width: 4,
					field: "type",
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

				return {
					name: it.name,
					type: it._fOptionType,
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
					type: it._fOptionType,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	static async _pGetEntityItem (actor, feature) { return DataConverterCharCreationOption.pGetCharCreationOptionItem(feature, {actor}); }

	static async _pGetSideData (actor, feature) {
		return DataConverterCharCreationOption.pGetSideData(feature);
	}

	static async _pHasSideLoadedEffects (actor, feature) { return DataConverterCharCreationOption.pHasCharCreationOptionSideLoadedEffects(actor, feature); }

	static async _pGetItemEffects (actor, feature, importedEmbed, dataBuilderOpts) {
		return DataConverterCharCreationOption.pGetCharCreationOptionItemEffects(
			actor,
			feature,
			importedEmbed,
		);
	}

	async _pMutActorUpdateFeature (feature, actUpdate, dataBuilderOpts) {
		await DataConverterCharCreationOption.pMutActorUpdateCharCreationOption(this._actor, actUpdate, feature, dataBuilderOpts);
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterCharCreationOption.pGetCharCreationOptionItem(it, getItemOpts);
	}

	static async _pGetDereferencedFeatureItem (feature) {
		return DataConverterCharCreationOption.pGetDereferencedCharCreationOptionFeatureItem(feature);
	}

	static async _pGetInitFeatureLoadeds (feature) {
		return DataConverterCharCreationOption.pGetInitCharCreationOptionFeatureLoadeds(feature);
	}
}

ImportListCharCreationOption.UserChoose = class extends MiscUtil.mix(ImportListCharCreationOption).with(MixinUserChooseImporter) {
	constructor (externalData) {
		super(
			externalData,
			{
				title: "Select Other Character Creation Option",
			},
			{
				titleButtonRun: "Select",
			},
		);
	}
};

export {ImportListCharCreationOption};
