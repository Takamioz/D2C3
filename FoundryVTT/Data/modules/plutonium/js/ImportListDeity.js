import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListJournal} from "./ImportListJournal.js";
import {DataConverterDeity} from "./DataConverterDeity.js";

class ImportListDeity extends ImportListJournal {
	static get FOLDER_TYPE () { return "JournalEntry"; }

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Deities"},
			externalData,
			{
				props: ["deity"],
				dirsHomebrew: ["deity"],
				titleSearch: "deity",
				sidebarTab: "journal",
				gameProp: "journal",
				defaultFolderPath: ["Deities"],
				pageFilter: new PageFilterDeities(),
				page: UrlUtil.PG_DEITIES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importDeity",
			},
			{
				titleLog: "deity",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_DEITIES,
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
					width: 3,
					field: "name",
				},
				{
					name: "Pantheon",
					width: 2,
					field: "pantheon",
					rowClassName: "text-center",
				},
				{
					name: "Alignment",
					width: 1,
					field: "alignment",
					rowClassName: "text-center",
				},
				{
					name: "Domains",
					width: 3,
					field: "domains",
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

				it._lAlignment = it.alignment ? it.alignment.join("") : "\u2014";
				it._lDomains = it.domains ? it.domains.join(", ") : "";

				return {
					name: it.name,
					pantheon: it.pantheon,
					alignment: it._lAlignment,
					domains: it._lDomains,
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
					pantheon: it.pantheon,
					alignment: it._lAlignment,
					domains: it._lDomains,
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
		return DataConverterDeity.pGetDeityJournal(it, getItemOpts);
	}
}

export {ImportListDeity};
