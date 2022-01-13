import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterVariantRule} from "./DataConverterVariantRule.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListJournal} from "./ImportListJournal.js";

class ImportListVariantRule extends ImportListJournal {
	static get FOLDER_TYPE () { return "JournalEntry"; }

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Variant & Optional Rules"},
			externalData,
			{
				props: ["variantrule"],
				dirsHomebrew: ["variantrule"],
				titleSearch: "variant or optional rule",
				sidebarTab: "journal",
				gameProp: "journal",
				defaultFolderPath: ["Variant & Optional Rules"],
				pageFilter: new PageFilterVariantRules(),
				page: UrlUtil.PG_VARIANTRULES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importRule",
			},
			{
				titleLog: "variant rule",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_VARIANTRULES,
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
					width: 9,
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
		return DataConverterVariantRule.pGetVariantRuleJournal(it, getItemOpts);
	}
}

export {ImportListVariantRule};
