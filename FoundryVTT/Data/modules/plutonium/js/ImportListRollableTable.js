import {ImportedDocument, ImportList, ImportSummary} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterTable} from "./DataConverterTable.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilDataSource} from "./UtilDataSource.js";

class ImportListRollableTable extends ImportList {
	static get FOLDER_TYPE () { return "RollTable"; }

	constructor (externalData, applicationOptsOverride, subclassOptsOverride) {
		externalData = externalData || {};
		applicationOptsOverride = applicationOptsOverride || {};
		subclassOptsOverride = subclassOptsOverride || {};
		super(
			{
				title: "Import Rollable Tables",
				...applicationOptsOverride,
			},
			externalData,
			{
				props: ["table", "tableGroup"],
				dirsHomebrew: ["table"],
				titleSearch: "table",
				sidebarTab: "tables",
				gameProp: "tables",
				defaultFolderPath: ["Tables"],
				pageFilter: new PageFilterTables(),
				page: UrlUtil.PG_TABLES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importTable",
				...subclassOptsOverride,
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceSpecial(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.pGetRollableTables.bind(Vetools),
				{
					cacheKey: `5etools-rollable-tables`,
					isUseProps: true,
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
			buttonsAdditional: [
				{
					name: "btn-run-journal-entries",
					text: "Import as Journal Entries",
				},
			],
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

	_activateListeners_initRunButtonsAdditional () {
		this._$btnsRunAdditional["btn-run-journal-entries"].click(() => {
			return this._pHandleClickRunButton({
				gameProp: "journal",
				sidebarTab: "journal",
				optsImportEntry: {
					isImportAsJournalEntry: true,
				},
			});
		});
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

	_pImportEntry_getTablesFromGroup (tbl) {
		const tg = MiscUtil.copy(tbl);

		tg.tables.forEach((t, i) => {
			if (tg.name) t.name = t.name || `${tg.name}, Table ${i + 1}`;
			t.source = t.source || tg.source;
		});

		return tg.tables;
	}

	async _pImportTableGroup (tg, importOpts) {
		if (tg.__prop !== "tableGroup") return null;

		console.log(...LGT, `Importing table group "${tg.name || tg.caption}" (from "${Parser.sourceJsonToAbv(tg.source)}")`);

		const tables = this._pImportEntry_getTablesFromGroup(tg);
		const rollableTables = [];

		let cntSkipped = 0;
		for (const tbl of tables) {
			const importSummary = await this.pImportEntry(tbl, importOpts);
			if (importSummary.imported) rollableTables.push(...importSummary.imported.map(it => it.document).filter(Boolean));
			else if (importSummary.existing) cntSkipped++;
		}

		if (!rollableTables.length && cntSkipped) {
			return new ImportSummary({status: UtilApplications.TASK_EXIT_SKIPPED_DUPLICATE});
		}

		const journalData = DataConverterTable.getTableGroupJournal(tg, rollableTables, {isAddPermission: true});

		// Look for a duplicate journal item
		const duplicateMetaJournal = this._getDuplicateMeta({name: journalData.name, gameProp: "journal", importOpts});
		if (duplicateMetaJournal.isSkip) return new ImportSummary({status: UtilApplications.TASK_EXIT_SKIPPED_DUPLICATE});

		// As we can't import the journal entry to the pack, treat any compendium imports as temp
		const isTemp = importOpts.isTemp || !!this._pack;

		if (isTemp) {
			const imported = await JournalEntry.create(journalData, {renderSheet: true, temporary: true});

			return new ImportSummary({
				status: UtilApplications.TASK_EXIT_COMPLETE,
				imported: [
					new ImportedDocument({
						document: imported,
					}),
				],
			});
		}

		if (duplicateMetaJournal.isOverwrite) return this._pImportEntry_pDoUpdateExistingDirectoryEntity(duplicateMetaJournal, journalData);

		const folderId = await this._pImportEntry_pGetFolderId(tg);
		if (folderId) journalData.folder = folderId;

		const journalItem = await JournalEntry.create(journalData, {renderSheet: false, temporary: false});

		await game.journal.set(journalItem.id, journalItem);

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					document: journalItem,
				}),
			],
		});
	}

	/**
	 * @param tbl
	 * @param [importOpts] Options object.
	 * @param [importOpts.isTemp] if the table should be temporary, and displayed.
	 * @param [importOpts.isImportAsJournalEntry] if the table should be imported as a journal entry.
	 */
	async _pImportEntry (tbl, importOpts) {
		importOpts = importOpts || {};

		const importSummaryGroup = await this._pImportTableGroup(tbl, importOpts);
		if (importSummaryGroup != null) return importSummaryGroup;

		console.log(...LGT, `Importing table "${tbl.name || tbl.caption}" (from "${Parser.sourceJsonToAbv(tbl.source)}")`);

		if (this._actor) throw new Error(`Cannot import table to actor!`);

		if (importOpts.isImportAsJournalEntry) {
			const importListJournal = new ImportListRollableTableJournal();
			await importListJournal.pInit();
			const nxtImportOpts = MiscUtil.copy(importOpts);
			delete nxtImportOpts.isImportAsJournalEntry;
			return importListJournal._pImportEntry(tbl, nxtImportOpts);
		}

		return this._pImportEntry_pImportToDirectoryGeneric(tbl, importOpts);
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterTable.pGetTableRollableTable(it, getItemOpts);
	}
}

/**
 * Table importer which imports to journal entries.
 */
class ImportListRollableTableJournal extends ImportListRollableTable {
	static get FOLDER_TYPE () { return "JournalEntry"; }

	constructor (externalData) {
		externalData = externalData || {};
		super(
			externalData,
			{},
			{
				sidebarTab: "journal",
				gameProp: "journal",
			},
		);
	}

	/** Use the base importer's folder path. */
	get _folderPathSpecKeyConstructorName () { return "ImportListRollableTable"; }

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterTable.pGetTableRollableTable(it, {isImportAsJournalEntry: true, ...getItemOpts});
	}
}

export {ImportListRollableTable};
