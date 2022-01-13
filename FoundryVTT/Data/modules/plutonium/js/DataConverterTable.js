import {UtilApplications} from "./UtilApplications.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {SharedConsts} from "../shared/SharedConsts.js";

class DataConverterTable {
	/**
	 * @param tg
	 * @param rollableTables Foundry entities.
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 */
	static getTableGroupJournal (tg, rollableTables, opts) {
		opts = opts || {};

		const entry = {
			type: "list",
			items: rollableTables.map(it => `${DataConverter.SYM_AT}RollTable[${it.id}]{${it.caption || it.name}}`),
		};

		const out = {
			name: UtilApplications.getCleanEntityName(tg.name),
			permission: {default: 0},
			entryTime: Date.now(),
			content: `<div>
				<p>The following tables belong to this group:</p>
				${Renderer.get().setFirstSection(true).render(entry).replace(new RegExp(DataConverter.SYM_AT, "g"), "@")}
				</div>`,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importTable", "permissions")};

		return out;
	}

	/**
	 * @param tbl
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.isImportAsJournalEntry]
	 */
	static pGetTableRollableTable (tbl, opts) {
		opts = opts || {};

		if (opts.isImportAsJournalEntry) return this.pGetTableJournal(tbl, opts);

		if (this._isRollableTable(tbl)) return this._pGetTableRollableTable_pRollTable(tbl, opts);
		else return this._pGetTableRollableTable_pOtherTable(tbl, opts);
	}

	static _isRollableTable (tbl) {
		return this._isRollableTable_getEntriesTableRollMode(tbl) || Renderer.getAutoConvertedTableRollMode(tbl);
	}

	static _isRollableTable_getEntriesTableRollMode (tbl) {
		if (!tbl.colLabels || tbl.colLabels.length < 2) return RollerUtil.ROLL_COL_NONE;

		const rollColMode = RollerUtil.getColRollType(tbl.colLabels[0]);
		if (!rollColMode) return RollerUtil.ROLL_COL_NONE;

		// scan the first column to ensure all rollable
		if (tbl.rows.some(r => r[0]?.type !== "cell" || r[0].roll == null || (r[0].roll.exact == null && r[0].roll.min == null && r[0].roll.max == null))) return RollerUtil.ROLL_COL_NONE;

		return rollColMode;
	}

	static _getTableDescription (tbl) {
		return tbl.colLabels?.length ? `Table columns: ${tbl.colLabels.map(it => Renderer.stripTags(it)).join(" | ")}` : "";
	}

	static async _pGetTableRollableTable_pRollTable (tbl, opts) {
		opts = opts || {};

		const toRoll = (tbl.colLabels[0] || "").trim().replace(/{@dice ([^}]+)}/, "$1");

		const out = {
			name: UtilApplications.getCleanEntityName(tbl.name),
			formula: toRoll,
			description: this._getTableDescription(tbl),
			results: await tbl.rows.pSerialAwaitMap(async (r, i) => {
				const {rangeLow, rangeHigh} = this._getRollRange(toRoll, r[0]);

				return this.pGetTableResult({
					type: CONST.TABLE_RESULT_TYPES.TEXT,
					text: await this._pGetResultText(r.slice(1)),
					rangeLow,
					rangeHigh,
				});
			}),
			replacement: true,
			displayRoll: true,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importTable", "permissions")};

		return out;
	}

	static _getRollRange (toRoll, cell) {
		if (cell.type === "cell" && cell.roll != null) {
			if (cell.roll.exact != null) {
				return {rangeLow: cell.roll.exact, rangeHigh: cell.roll.exact};
			} else {
				return {rangeLow: cell.roll.min, rangeHigh: cell.roll.max};
			}
		}

		let rangeLow;
		let rangeHigh;

		const cellClean = String(cell).trim();

		// format: "95-00" or "12"
		const mBasic = /^(\d+)([-\u2013](\d+))?$/.exec(cellClean);
		if (mBasic) {
			if (mBasic[1] && !mBasic[2]) {
				rangeLow = Number(mBasic[1]);
				// Convert "00" to "100"
				if (rangeLow === 0) rangeLow = this._getHighestRoll(toRoll);
				rangeHigh = rangeLow;
			} else {
				rangeLow = Number(mBasic[1]);
				rangeHigh = Number(mBasic[3]);

				// Convert "95-00" to "95-100"
				if (rangeHigh < rangeLow) {
					rangeHigh = this._getHighestRoll(toRoll);
				}
			}

			return {rangeLow, rangeHigh};
		}

		// format "3 or less"
		const mOrLess = /^(\d+) or less$/i.exec(cellClean);
		if (mOrLess) {
			rangeLow = 1;
			rangeHigh = Number(mOrLess[1]);

			return {rangeLow, rangeHigh};
		}

		// format: "12+"
		const mPlus = /^(\d+)\+$/.exec(cellClean);
		rangeLow = Number(mPlus[1]);
		rangeHigh = rangeLow;

		return {rangeLow, rangeHigh};
	}

	static async _pGetResultText (cells) {
		const walker = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST});

		let cpyCells = UtilDataConverter.getConvertedTagLinkEntries(MiscUtil.copy(cells));

		cpyCells = walker.walk(
			cpyCells,
			{
				string: str => {
					return Renderer.stripTags(this._getFoundryDiceTagged(str));
				},
			},
		);

		return cpyCells
			.map(it => Renderer.get().setFirstSection(true).render(it))
			.join(" | ");
	}

	static _getHighestRoll (toRoll) {
		const mFirstNum = /\d+/.exec(toRoll); // catch e.g. d1000's
		if (mFirstNum) return Number(mFirstNum[0]);
		return 100; // Fall back on d100, as this is the most common cause
	}

	static async _pGetTableRollableTable_pOtherTable (tbl, opts) {
		opts = opts || {};

		const out = {
			name: UtilApplications.getCleanEntityName(tbl.name),
			formula: `1d${tbl.rows ? tbl.rows.length : "1"}`,
			description: this._getTableDescription(tbl),
			results: await tbl.rows.pSerialAwaitMap(async (r, i) => {
				r = r.row || r;
				return this.pGetTableResult({
					type: CONST.TABLE_RESULT_TYPES.TEXT,
					text: await this._pGetResultText(r),
					rangeExact: i + 1,
				});
			}),
			replacement: true,
			displayRoll: true,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importTable", "permissions")};

		return out;
	}

	/**
	 * @param type `0` for "Text", `1` for "Entity", `2` for "Compendium"
	 * @param text
	 * @param [resultId] The ID of an entity, if this result is in "Entity" or "Compendium" mode. `text` and `resultId`
	 *   are combined/converted to form the final result by `TableResult.getChatText`, which does:
	 *   `@${collection}[${resultId}]{${text}}`.
	 * @param [collection] Compendium ID, e.g. `world.my-compendium`.
	 * @param rangeLow
	 * @param rangeHigh
	 * @param rangeExact
	 * @param [img]
	 * @param [flags]
	 */
	static async pGetTableResult (
		{
			type,
			text,
			resultId,
			collection,
			rangeLow,
			rangeHigh,
			rangeExact,
			img = "icons/svg/d20-black.svg",
			flags = {},
		},
	) {
		if (rangeExact != null && (rangeLow != null || rangeHigh != null)) throw new Error(`Only one of "rangeExact" and "rangeLow/rangeHigh" may be specified!`);

		return {
			id: foundry.utils.randomID(),
			resultId,
			collection,
			flags,
			type,
			text,
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(img),
			weight: 1,
			range: [
				rangeLow ?? rangeExact,
				rangeHigh ?? rangeExact,
			],
			drawn: false,
		};
	}

	static getMaxTableRange (table) { return Math.max(0, ...table.results.map(it => it.data.range).flat()); }

	static _getFoundryDiceTagged (str) {
		return str.replace(/{@(?:dice|damage) ([^}]+)}/gi, (...m) => {
			const [rollText, displayText] = Renderer.splitTagByPipe(m[1]);
			const rollTextClean = Vetools.getCleanDiceString(rollText);
			return `[[/r ${rollTextClean}]]${displayText && rollTextClean.toLowerCase().trim() !== displayText.toLowerCase().trim() ? ` (${displayText})` : ""}`;
		});
	}

	/**
	 * @param tbl
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 */
	static async pGetTableJournal (tbl, opts) {
		opts = opts || {};

		const cpy = MiscUtil.copy(tbl);
		delete cpy.name;
		cpy.type = cpy.type || "table";

		const content = await UtilDataConverter.pGetWithDescriptionPlugins(() => {
			return `<div>${Renderer.get().setFirstSection(true).render(cpy)}</div>`;
		});

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await DataConverterTable._pGetImagePath(tbl),
		);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(tbl)),
			permission: {default: 0},
			entryTime: Date.now(),
			content,
			img,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importTable", "permissions")};

		return out;
	}

	static async _pGetImagePath (tbl) {
		if (tbl.foundryImg) return tbl.foundryImg;
		return `modules/${SharedConsts.MODULE_NAME}/media/icon/hamburger-menu.svg`;
	}
}

export {DataConverterTable};
