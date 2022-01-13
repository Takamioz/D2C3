import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListJournal} from "./ImportListJournal.js";
import {DataConverterRecipe} from "./DataConverterRecipe.js";

class ImportListRecipe extends ImportListJournal {
	static get FOLDER_TYPE () { return "JournalEntry"; }

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Recipes"},
			externalData,
			{
				props: ["recipe"],
				dirsHomebrew: ["recipe"],
				titleSearch: "recipe",
				sidebarTab: "journal",
				gameProp: "journal",
				defaultFolderPath: ["Recipes"],
				pageFilter: new PageFilterRecipes(),
				page: UrlUtil.PG_RECIPES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importRecipe",
			},
			{
				titleLog: "recipe",
			},
		);
	}

	async _pPostLoad (recipeList, fileData) {
		DataUtil.recipe.postProcessData(fileData);
		return fileData.recipe || [];
	}

	async pGetSources () {
		const nxtOpts = {pPostLoad: this._pPostLoad.bind(this)};

		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_RECIPES,
				{
					...nxtOpts,
					filterTypes: [UtilDataSource.SOURCE_TYP_OFFICIAL_ALL],
					isDefault: true,
				},
			),
			new UtilDataSource.DataSourceUrl(
				"Custom URL",
				"",
				{
					...nxtOpts,
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			new UtilDataSource.DataSourceFile(
				"Upload File",
				{
					...nxtOpts,
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			...(await this._pGetSourcesHomebrew(nxtOpts)),
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
					width: 5,
					field: "name",
				},
				{
					name: "Type",
					width: 4,
					field: "type",
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

				it._lType = it.type || "\u2014";

				return {
					name: it.name,
					type: it._lType = it.type || "\u2014",
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
					type: it._lType,
					source: it.source,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterRecipe.pGetRecipeJournal(it, getItemOpts);
	}
}

export {ImportListRecipe};
