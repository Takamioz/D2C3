import {ImportedDocument, ImportList, ImportSummary} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilApplications} from "./UtilApplications.js";
import {DataConverterConditionDisease} from "./DataConverterConditionDisease.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {UtilActors} from "./UtilActors.js";

class ImportListConditionDisease extends ImportList {
	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Conditions & Diseases"},
			externalData,
			{
				props: ["condition", "disease"],
				dirsHomebrew: ["condition", "disease"],
				titleSearch: "condition or disease",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Conditions & Diseases"],
				pageFilter: new PageFilterConditionsDiseases(),
				page: UrlUtil.PG_CONDITIONS_DISEASES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importConditionDisease",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_CONDITIONSDISEASES,
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

				it._lType = it.__prop.toTitleCase();

				return {
					name: it.name,
					type: it._lType,
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
		};
	}

	/**
	 * @param conDis
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 */
	async _pImportEntry (conDis, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing condition/disease "${conDis.name}" (from "${Parser.sourceJsonToAbv(conDis.source)}")`);

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(conDis, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(conDis, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(conDis, importOpts);
	}

	async _pImportEntry_pImportToActor (conDis, importOpts) {
		await UtilActors.pAddActorItems(
			this._actor,
			[await DataConverterConditionDisease.pGetConditionDiseaseItem(conDis, {isActorItem: true})],
		);

		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: conDis.name,
					actor: this._actor,
				}),
			],
		});
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterConditionDisease.pGetConditionDiseaseItem(it, getItemOpts);
	}
}

export {ImportListConditionDisease};
