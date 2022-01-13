import {ImportedDocument, ImportList, ImportSummary} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilApplications} from "./UtilApplications.js";
import {DataConverterCultBoon} from "./DataConverterCultBoon.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {UtilActors} from "./UtilActors.js";

class ImportListCultBoon extends ImportList {
	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Cults & Supernatural Boons"},
			externalData,
			{
				props: ["cult", "boon"],
				dirsHomebrew: ["condition", "disease"],
				titleSearch: "cult or supernatural boon",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Cults & Supernatural Boons"],
				pageFilter: new PageFilterCultsBoons(),
				page: UrlUtil.PG_CULTS_BOONS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importCultBoon",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_CULTSBOONS,
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
					name: "Subtype",
					width: 2,
					field: "subtype",
					rowClassName: "text-center",
				},
				{
					name: "Name",
					width: 5,
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

				it._lType = it.__prop.toTitleCase();
				it._lSubType = it.type || "\u2014";

				return {
					name: it.name,
					type: it._lType,
					subtype: it._lSubType,
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
					type: it.__prop,
					subtype: it.type,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	getFolderPathMeta () {
		return {
			...super.getFolderPathMeta(),
			type: {
				label: "Type",
				getter: it => it._lType,
			},
			subtype: {
				label: "Subtype",
				getter: it => it._lSubType,
			},
		};
	}

	/**
	 * @param ent
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 */
	async _pImportEntry (ent, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing cult/boon "${ent.name}" (from "${Parser.sourceJsonToAbv(ent.source)}")`);

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(ent, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(ent, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(ent, importOpts);
	}

	async _pImportEntry_pImportToActor (ent, importOpts) {
		await UtilActors.pAddActorItems(
			this._actor,
			[await DataConverterCultBoon.pGetCultBoonItem(ent, {isActorItem: true})],
		);

		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: ent.name,
					actor: this._actor,
				}),
			],
		});
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterCultBoon.pGetCultBoonItem(it, getItemOpts);
	}
}

export {ImportListCultBoon};
