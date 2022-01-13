import {MixinUserChooseImporter} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {PageFilterClassFeatures} from "./PageFilterClassFeatures.js";
import {DataConverterClassSubclassFeature} from "./DataConverterClassSubclassFeature.js";
import {ImportListFeature} from "./ImportListFeature.js";

class ImportListClassFeature extends ImportListFeature {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "classFeature",
			importerName: "Class Feature",
		});
		this._initCreateSheetItemHook({
			prop: "subclassFeature",
			importerName: "Subclass Feature",
		});
	}
	// endregion

	constructor (externalData, applicationOptsOverride, subclassOptsOverride) {
		applicationOptsOverride = applicationOptsOverride || {};
		subclassOptsOverride = subclassOptsOverride || {};
		super(
			{
				title: "Import Class & Subclass Features",
				...applicationOptsOverride,
			},
			externalData,
			{
				props: ["classFeature", "subclassFeature"],
				dirsHomebrew: ["classFeature", "subclassFeature"],
				titleSearch: "class and subclass features",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Class & Subclass Features"],
				fnListSort: PageFilterClassFeatures.sortClassFeatures,
				listInitialSortBy: "className",
				pageFilter: new PageFilterClassFeatures(),
				page: UrlUtil.PG_CLASS_SUBCLASS_FEATURES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importClassSubclassFeature",
				...subclassOptsOverride,
			},
			{
				titleLog: "class/subclass feature",
			},
		);

		this._contentDereferenced = null;
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceSpecial(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.pGetClassSubclassFeatures,
				{
					cacheKey: `5etools-class-subclass-features`,
					filterTypes: [UtilDataSource.SOURCE_TYP_OFFICIAL_ALL],
					isUseProps: true,
					isDefault: true,
					pPostLoad: loadedData => this.constructor._pPostLoad(loadedData),
				},
			),
			new UtilDataSource.DataSourceUrl(
				"Custom URL",
				"",
				{
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
					pPostLoad: loadedData => this.constructor._pPostLoad(loadedData),
				},
			),
			new UtilDataSource.DataSourceFile(
				"Upload File",
				{
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
					pPostLoad: loadedData => this.constructor._pPostLoad(loadedData),
				},
			),
			...(await this._pGetSourcesHomebrew({pPostLoad: loadedData => this.constructor._pPostLoad(loadedData)})),
		];
	}

	static async _pPostLoad (loadedData) {
		loadedData = loadedData.filter(it => it.name.toLowerCase() !== "ability score improvement");

		// (N.b.: this is a performance hog)
		const out = [];
		for (const feature of loadedData) {
			const loaded = await this._pGetInitFeatureLoadeds(feature);
			if (!loaded || loaded.isIgnored) continue;
			out.push(feature);
		}

		return out;
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
					width: 5,
					field: "name",
				},
				{
					name: "Class",
					width: 2,
					field: "className",
				},
				{
					name: "Subclass",
					width: 2,
					field: "subclassShortName",
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

				return {
					name: it.name,
					className: it.className,
					subclassShortName: it.subclassShortName,
					level: it.level,
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
					className: it.className,
					subclassShortName: it.subclassShortName || "",
					level: it.level,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	async pSetContent (val) {
		await super.pSetContent(val);
		this._contentDereferenced = await Promise.all(val.map(feature => DataConverterClassSubclassFeature.pGetDereferencedClassSubclassFeatureItem(feature)));
	}

	_activateListeners_initPreviewButton (item, btnShowHidePreview) {
		ListUiUtil.bindPreviewButton(this._page, this._contentDereferenced, item, btnShowHidePreview);
	}

	static async _pGetEntityItem (actor, feature) {
		return DataConverterClassSubclassFeature.pGetClassSubclassFeatureItem(feature, {actor});
	}

	static async _pGetSideData (actor, feature) {
		return DataConverterClassSubclassFeature.pGetSideData(feature);
	}

	static async _pHasSideLoadedEffects (actor, feature) {
		return DataConverterClassSubclassFeature.pHasClassSubclassSideLoadedEffects(actor, feature);
	}

	static async _pGetItemEffects (actor, feature, importedEmbed, dataBuilderOpts) {
		return DataConverterClassSubclassFeature.pGetClassSubclassFeatureItemEffects(
			actor,
			feature,
			importedEmbed,
			{
				additionalData: {
					import: {chosenAbilityScoreIncrease: dataBuilderOpts.chosenAbilityScoreIncrease},
				},
			},
		);
	}

	async _pMutActorUpdateFeature (feature, actUpdate, dataBuilderOpts) {
		await DataConverterClassSubclassFeature.pMutActorUpdateClassSubclassFeatureItem(this._actor, actUpdate, feature, dataBuilderOpts);
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterClassSubclassFeature.pGetClassSubclassFeatureItem(it, {actor: this._actor, ...getItemOpts});
	}

	static async _pGetDereferencedFeatureItem (feature) {
		return DataConverterClassSubclassFeature.pGetDereferencedClassSubclassFeatureItem(feature);
	}

	static async _pGetInitFeatureLoadeds (feature) {
		return DataConverterClassSubclassFeature.pGetInitClassSubclassFeatureLoadeds(feature);
	}
}

ImportListClassFeature.UserChoose = class extends MiscUtil.mix(ImportListClassFeature).with(MixinUserChooseImporter) {
	constructor (externalData) {
		super(
			externalData,
			{
				title: "Select Class or Subclass Feature",
			},
			{
				titleButtonRun: "Select",
			},
		);
	}
};

export {ImportListClassFeature};
