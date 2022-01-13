import {ImportedDocument, ImportList, ImportSummary} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilApplications} from "./UtilApplications.js";
import {DataConverterAction} from "./DataConverterAction.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {UtilActors} from "./UtilActors.js";

class ImportListAction extends ImportList {
	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Actions"},
			externalData,
			{
				props: ["action"],
				dirsHomebrew: ["action"],
				titleSearch: "action",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Actions"],
				pageFilter: new PageFilterActions(),
				page: UrlUtil.PG_ACTIONS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importAction",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_ACTIONS,
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
					name: "Time",
					width: 3,
					field: "time",
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

				it._lTime = it.time ? it.time.map(tm => PageFilterActions.getTimeText(tm)).join("/") : "\u2014";

				return {
					name: it.name,
					time: it._lTime,
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
					time: it._lTime,
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
				label: "Time",
				getter: it => it._lTime,
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

		console.log(...LGT, `Importing action "${ent.name}" (from "${Parser.sourceJsonToAbv(ent.source)}")`);

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(ent, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(ent, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(ent, importOpts);
	}

	async _pImportEntry_pImportToActor (action, importOpts) {
		await UtilActors.pAddActorItems(
			this._actor,
			[await DataConverterAction.pGetActionItem(action, {isActorItem: true})],
		);

		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: action.name,
					actor: this._actor,
				}),
			],
		});
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterAction.pGetActionItem(it, getItemOpts);
	}
}

export {ImportListAction};
