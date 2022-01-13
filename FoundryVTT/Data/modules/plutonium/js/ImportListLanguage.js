import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterLanguage} from "./DataConverterLanguage.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListJournal} from "./ImportListJournal.js";

class ImportListLanguage extends ImportListJournal {
	static get FOLDER_TYPE () { return "JournalEntry"; }

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Languages"},
			externalData,
			{
				props: ["language"],
				dirsHomebrew: ["language"],
				titleSearch: "language",
				sidebarTab: "journal",
				gameProp: "journal",
				defaultFolderPath: ["Languages"],
				pageFilter: new PageFilterLanguages(),
				page: UrlUtil.PG_LANGUAGES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importLanguage",
			},
			{
				titleLog: "language",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_LANGUAGES,
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
					width: 5,
					field: "name",
				},
				{
					name: "Type",
					width: 2,
					field: "type",
					rowClassName: "text-center",
				},
				{
					name: "Script",
					width: 2,
					field: "script",
					rowClassName: "text-center",
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

				it._lType = (it.type || "\u2014").uppercaseFirst();
				it._lScript = (it.script || "\u2014").toTitleCase();

				return {
					name: it.name,
					source: it.source,
					type: it._lType,
					script: it._lScript,
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
					type: it._lType,
					script: it._lScript,
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
		return DataConverterLanguage.pGetLanguageJournal(it, getItemOpts);
	}
}

export {ImportListLanguage};
