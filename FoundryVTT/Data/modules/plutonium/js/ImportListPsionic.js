import {ImportedDocument, ImportList, ImportSummary} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterPsionic} from "./DataConverterPsionic.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {UtilActors} from "./UtilActors.js";

class ImportListPsionic extends ImportList {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "psionic",
			importerName: "Psionic",
		});
	}
	// endregion

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Psionics"},
			externalData,
			{
				props: ["psionic"],
				dirsHomebrew: ["psionic"],
				titleSearch: "psionics",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Psionics"],
				pageFilter: new PageFilterPsionics(),
				page: UrlUtil.PG_PSIONICS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importPsionic",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_PSIONICS,
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
					width: 3,
					field: "type",
				},
				{
					name: "Order",
					width: 3,
					field: "order",
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
					type: Parser.psiTypeToMeta(it.type).short,
					order: it._fOrder,
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
					type: Parser.psiTypeToMeta(it.type).full,
					order: it._fOrder,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	/**
	 * @param psi
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.filterValues] Saved filter values to be used instead of our own.
	 */
	async _pImportEntry (psi, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing psionic "${psi.name}" (from "${Parser.sourceJsonToAbv(psi.source)}")`);

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(psi, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(psi, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(psi, importOpts);
	}

	async _pImportEntry_pImportToActor (psi, importOpts) {
		const psiPointsItemId = await this._pGetActorPsiPointsItemId();

		const allItems = await DataConverterPsionic.pGetPsionicItems(psi, {filterValues: importOpts.filterValues, psiPointsItemId});
		await UtilActors.pAddActorItems(this._actor, allItems);
		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: psi.name,
					actor: this._actor,
				}),
			],
		});
	}

	async _pGetActorPsiPointsItemId () {
		if (!this._actor) throw new Error(`Only applicable when importing to an actor!`);
		const psiPointsItem = await UtilActors.pGetCreateActorPsiPointsItem({actor: this._actor});
		return psiPointsItem?.id;
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterPsionic.pGetPsionicItem(it, getItemOpts);
	}
}

export {ImportListPsionic};
