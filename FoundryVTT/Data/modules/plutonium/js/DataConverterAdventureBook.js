import {Config} from "./Config.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilApplications} from "./UtilApplications.js";
import {DataConverter} from "./DataConverter.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterAdventureBook {
	static pGetAdventureJournals (data, indexData, opts) {
		return this._pGetAdventureBookJournals(data, indexData, "adventure", opts);
	}

	static pGetBookJournals (data, indexData, opts) {
		return this._pGetAdventureBookJournals(data, indexData, "book", opts);
	}

	/**
	 * @param data Array of adventure/book data
	 * @param indexData The matching metadata data from the adventure/book index
	 * @param prop Either "adventure" or "book"
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 */
	static async _pGetAdventureBookJournals (data, indexData, prop, opts) {
		const configGroup = prop === "adventure" ? "importAdventure" : "importBook";
		const mode = Config.get(configGroup, "journalEntrySplitMode");

		const out = [];
		const contents = indexData.contents;

		const len = Math.min(contents.length, data.length);

		switch (mode) {
			case ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_CHAPTER: {
				for (let i = 0; i < len; ++i) {
					const content = contents[i];
					const chapter = data[i];

					await this._pGetAdventureBookJournals_byChapter({
						contentsItem: content,
						chapter,
						out,
						opts,
						configGroup,
						indexData,
						ixChapter: i,
						ixChapterMax: len,
						totalEntries: len,
					});
				}

				break;
			}
			case ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_CONTENTS: {
				// Not perfectly accurate, as we will reduce this down, but guaranteed to be >= the correct value
				const totalEntries = data.slice(0, len).map(it => Renderer.utils.getFlatEntries(it).length).sum();

				for (let i = 0; i < len; ++i) {
					const content = contents[i];
					const chapter = data[i];

					await this._pGetAdventureBookJournals_byContents({
						contentsItem: content,
						chapter,
						out,
						opts,
						configGroup,
						indexData,
						ixChapter: i,
						ixChapterMax: len,
						totalEntries,
					});
				}

				break;
			}
			case ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_HEADINGS: {
				const totalEntries = data.slice(0, len).map(it => Renderer.utils.getFlatEntries(it).length).sum();

				for (let i = 0; i < len; ++i) {
					const content = contents[i];
					const chapter = data[i];

					await this._pGetAdventureBookJournals_byHeader({
						contentsItem: content,
						chapter,
						out,
						opts,
						configGroup,
						indexData,
						ixChapter: i,
						ixChapterMax: len,
						totalEntries,
					});
				}

				break;
			}
			default: throw new Error(`Unhandled journal entry split mode "${mode}"`);
		}

		return out;
	}

	static async _pGetAdventureBookJournals_byChapter ({contentsItem, chapter, out, opts, configGroup, indexData, totalEntries, folderNames, isNested}) {
		const content = await UtilDataConverter.pGetWithDescriptionPlugins(() => {
			return `<div class="w-100 h-100 overflow-x-hidden">${Renderer.get().setFirstSection(true).render(chapter)}</div>`.replace(new RegExp(DataConverter.SYM_AT, "g"), "@");
		});

		const numEntry = out.length;

		const name = isNested
			? UtilApplications.getCleanEntityName(`${this._getAdventureBookJournalPrefix({configGroup, numEntry, totalEntries})}${contentsItem.name}`)
			: UtilApplications.getCleanEntityName(`${this._getAdventureBookJournalPrefix({configGroup, source: indexData.source, numEntry, totalEntries})}${Parser.bookOrdinalToAbv(contentsItem.ordinal)}${contentsItem.name}`);

		const journalEntryBuilder = {
			name,
			permission: {default: 0},
			entryTime: Date.now(),
			content,
			// Try to keep our entries together at all costs
			sort: CONFIG.JournalEntry.collection.instance.contents.length + (CONST.SORT_INTEGER_DENSITY * numEntry),
			flags: {
				[SharedConsts.MODULE_NAME_FAKE]: {
					source: indexData.source,
					entryIds: this._getEntryIds({entry: chapter}),
				},
			},
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) journalEntryBuilder.permission = {default: Config.get(configGroup, "permissions")};

		out.push(new DataConverterAdventureBook.FolderizedJournalEntryBuilder({journalEntry: journalEntryBuilder, folderNames}));
	}

	static async _pGetAdventureBookJournals_byContents ({contentsItem, chapter, out, opts, configGroup, indexData, ixChapter, ixChapterMax, totalEntries}) {
		// If there are no headers, treat as a basic chapter-level render
		// Ensure it's inside a folder, however, to avoid any sorting issues (directories are sorted to the top, above
		//   individual entries).
		if (!contentsItem.headers?.length) {
			const folderNames = this._getPerChapterFolderNames({configGroup, indexData, ixChapter, ixChapterMax, contentsItem});
			return this._pGetAdventureBookJournals_byChapter({contentsItem, chapter, out, opts, configGroup, indexData, totalEntries, folderNames, isNested: true});
		}

		let flatEntries = Renderer.utils.getFlatEntries(chapter);

		// region Tag flat entries as "discrete" or not
		const cntNames = {};
		flatEntries.forEach((flat, i) => {
			const name = flat.entry.name;

			if (cntNames[name] == null) cntNames[name] = -1;
			const ixName = ++cntNames[name];

			const isInTitle = i === 0 || contentsItem.headers.some(it => {
				const index = it.index ?? 0;
				const header = it.header ?? it;

				return index === ixName && UrlUtil.encodeForHash(header) === UrlUtil.encodeForHash(name);
			});

			if (isInTitle) flat.isDiscrete = true;
		});
		// endregion

		// region Collapse flat entries according to discrete-ness
		flatEntries.forEach(flat => {
			if (!flat.entry[flat.key]) return;

			flat.entry[flat.key] = flat.entry[flat.key].map(it => {
				if (!it.IX_FLAT_REF) return it;

				if (flatEntries[it.IX_FLAT_REF].isDiscrete) return it;

				return flatEntries[it.IX_FLAT_REF].entry;
			});
		});
		// endregion

		// region Remove all non-discrete entries
		flatEntries = flatEntries.filter(it => it.isDiscrete);
		// endregion

		await this._pGetFlatEntryJournalEntries({contentsItem, chapter, out, opts, configGroup, indexData, ixChapter, ixChapterMax, totalEntries, flatEntries});
	}

	static async _pGetAdventureBookJournals_byHeader ({contentsItem, chapter, out, opts, configGroup, indexData, ixChapter, ixChapterMax, totalEntries}) {
		const flatEntries = Renderer.utils.getFlatEntries(chapter);

		await this._pGetFlatEntryJournalEntries({contentsItem, chapter, out, opts, configGroup, indexData, ixChapter, ixChapterMax, totalEntries, flatEntries});
	}

	static async _pGetFlatEntryJournalEntries ({contentsItem, chapter, out, opts, configGroup, indexData, ixChapter, ixChapterMax, totalEntries, flatEntries}) {
		// region Convert remaining `IX_FLAT_REF`s to text we can find-replace later
		flatEntries = UtilDataConverter.WALKER_GENERIC.walk(
			flatEntries,
			{
				array: (arr) => {
					return arr.map(it => {
						if (it.IX_FLAT_REF == null) return it;
						return `%${SharedConsts.MODULE_NAME_FAKE}_${ixChapter}__${it.IX_FLAT_REF}_${SharedConsts.MODULE_NAME_FAKE}%`;
					});
				},
			},
		);
		// endregion

		await flatEntries.pSerialAwaitMap(async flat => {
			const contentRendered = await UtilDataConverter.pGetWithDescriptionPlugins(() => {
				return `<div class="w-100 h-100 overflow-x-hidden">${Renderer.get().setFirstSection(true).render(flat.entry)}</div>`.replace(new RegExp(DataConverter.SYM_AT, "g"), "@");
			});

			const folderNames = this._getPerChapterFolderNames({configGroup, indexData, ixChapter, ixChapterMax, contentsItem});

			const numEntry = out.length;
			const journalEntry = {
				name: UtilApplications.getCleanEntityName(`${this._getAdventureBookJournalPrefix({configGroup, numEntry, totalEntries})}${flat.name}`),
				permission: {default: 0},
				entryTime: Date.now(),
				content: contentRendered,
				// Try to keep our entries together at all costs
				sort: CONFIG.JournalEntry.collection.instance.contents.length + (CONST.SORT_INTEGER_DENSITY * numEntry),
				flags: {
					[SharedConsts.MODULE_NAME_FAKE]: {
						source: indexData.source,
						ixChapter,
						ixFlat: flat.ix,
						entryIds: this._getEntryIds({entry: flat.entry}),
					},
				},
			};

			if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
			else if (opts.isAddPermission) journalEntry.permission = {default: Config.get(configGroup, "permissions")};

			out.push(new DataConverterAdventureBook.FolderizedJournalEntryBuilder({journalEntry, folderNames}));
		});
	}

	static _getEntryIds ({entry}) {
		if (!entry) return [];

		const out = [];

		UtilDataConverter.WALKER_GENERIC.walk(
			entry,
			{
				object: (obj) => {
					if (obj.id) out.push(obj.id);
					return obj;
				},
			},
		);

		return out;
	}

	static _getAdventureBookJournalPrefix ({configGroup, source, numEntry, totalEntries}) {
		if (!Config.get(configGroup, "isOrderingPrefixJournalNames")) return "";
		const numPads = `${totalEntries}`.length;
		return `${source ? Parser.sourceJsonToAbv(source).slice(0, 3) : ""}${`${numEntry}`.padStart(numPads, "0")} `;
	}

	static _getPerChapterFolderNames ({configGroup, indexData, ixChapter, ixChapterMax, contentsItem}) {
		return [`${this._getAdventureBookJournalPrefix({configGroup, source: indexData.source, numEntry: ixChapter, totalEntries: ixChapterMax})}${Parser.bookOrdinalToAbv(contentsItem.ordinal)}${contentsItem.name}`];
	}
}

DataConverterAdventureBook.FolderizedJournalEntryBuilder = class {
	constructor ({journalEntry, folderNames = []} = {}) {
		this.journalEntry = journalEntry;
		this.folderNames = folderNames;
	}
};

export {DataConverterAdventureBook};
