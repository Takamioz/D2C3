import {ImportCustomizer, ImportedDocument, ImportList, ImportSummary} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {UtilActors} from "./UtilActors.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterSpell} from "./DataConverterSpell.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class ImportListSpell extends ImportList {
	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Spells"},
			externalData,
			{
				props: ["spell"],
				dirsHomebrew: ["spell"],
				titleSearch: "spells",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Spells"],
				fnListSort: PageFilterSpells.sortSpells,
				pageFilter: new PageFilterSpells(),
				page: UrlUtil.PG_SPELLS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importSpell",
			},
		);
	}

	async pPreRender (...args) {
		await super.pPreRender(...args);

		// FIXME(Future) this doesn't apply to directly-imported entries, i.e. the details will be missing from spell
		//   items created outside of the main importer flow.
		Renderer.spell.populateHomebrewLookup(BrewUtil.homebrew, {isForce: true});
		this._content.forEach(sp => {
			Renderer.spell.uninitClasses(sp);
			Renderer.spell.initClasses(sp);
		});
	}

	async pGetSources () {
		const spellIndex = await Vetools.pGetSpellIndex();

		return [
			new UtilDataSource.DataSourceSpecial(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				async () => (await Vetools.pGetAllSpells()).spell,
				{
					cacheKey: `5etools-spells`,
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
			...Object.entries(spellIndex).map(([src, filename]) => new UtilDataSource.DataSourceUrl(
				Parser.sourceJsonToFull(src),
				Vetools.getSpellUrl(filename),
				{
					source: src,
					filterTypes: SourceUtil.isNonstandardSource(src) ? [UtilDataSource.SOURCE_TYP_ARCANA] : [UtilDataSource.SOURCE_TYP_OFFICIAL_SINGLE],
					abbreviations: [Parser.sourceJsonToAbv(src)],
				},
			)),
			...(await this._pGetSourcesHomebrew()),
		];
	}

	getFolderPathMeta () {
		return {
			...super.getFolderPathMeta(),
			level: {
				label: "Level",
				getter: it => `${Parser.spLevelToFull(it.level)}${it.level ? " level" : ""}`,
			},
			spellPoints: {
				label: "Spell Points",
				getter: it => {
					const sp = (() => {
						switch (it.level) {
							case 1: return 2;
							case 2: return 3;
							case 3: return 5;
							case 4: return 6;
							case 5: return 7;
							case 6: return 8;
							case 7: return 10;
							case 8: return 11;
							case 9: return 13;
							case 0:
							default: return 0;
						}
					})();
					return `${sp} Spell Points`;
				},
			},
		};
	}

	async _pPostRenderOrShow () {
		if (!this._actor) return;

		if (!Config.get("importSpell", "isFilterOnOpen")) return;

		const currentValues = this._pageFilter.filterBox.getValues();
		const classNameLookup = Object.keys(currentValues.Class).mergeMap(it => ({[it.toLowerCase()]: it}));

		const cacheClassSubclassData = {};
		const classMetas = (await this._actor.items
			.filter(it => it.type === "class")
			.filter(it => classNameLookup[it.name.toLowerCase().trim()])
			.pSerialAwaitMap(sheetItem => UtilDataConverter.pGetClassItemClassAndSubclass({sheetItem, cache: cacheClassSubclassData})))
			.filter(it => it.matchingClasses?.length);

		if (!classMetas.length) {
			this._pageFilter.filterBox.setFromValues({
				"Class": {},
				"Subclass": {},
			});
			return;
		}

		if (classMetas.some(it => it.matchingSubclasses?.length)) {
			this._pageFilter.filterBox.setFromValues({
				"Class": classMetas.map(it => it.matchingClasses.map(it => it.name)).flat().mergeMap(it => ({[it]: 1})),
				"Subclass": classMetas.map(it => it.matchingSubclasses.map(it => `${it.className}: ${it.shortName}`)).flat().mergeMap(it => ({[it]: 1})),
			});
			return;
		}

		this._pageFilter.filterBox.setFromValues({
			"Class": classMetas.map(it => it.matchingClasses.map(it => it.name)).flat().mergeMap(it => ({[it]: 1})),
			"Subclass": {},
		});
	}

	getData () {
		return {
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			buttonsAdditional: [
				{
					name: "btn-run-mods",
					text: "Import as Spell Scroll(s)/With Custom Preparation",
				},
			],
			cols: [
				{
					name: "Name",
					width: "3-2",
					field: "name",
				},
				{
					name: "Level",
					width: 1,
					field: "level",
					rowClassName: "text-center",
				},
				{
					name: "Time",
					width: 2,
					field: "time",
					rowClassName: "text-center",
				},
				{
					name: "School",
					width: 1,
					field: "school",
					titleProp: "schoolLong",
					displayProp: "schoolShort",
					classNameProp: "schoolClassName",
					rowClassName: "text-center",
				},
				{
					name: "C.",
					width: "0-3",
					field: "concentration",
					rowClassName: "text-center",
					title: "Concentration",
				},
				{
					name: "Range",
					width: "2-5",
					field: "range",
					rowClassName: "text-right",
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
				it._l_time = PageFilterSpells.getTblTimeStr(it.time[0]);
				it._l_school = Parser.spSchoolAbvToFull(it.school, it.subschools);

				return {
					name: it.name,
					level: this.constructor.getListDisplayLevel(it),
					time: it._l_time,
					range: Parser.spRangeToFull(it.range),

					source: it.source,
					sourceShort: Parser.sourceJsonToAbv(it.source),
					sourceLong: Parser.sourceJsonToFull(it.source),
					sourceClassName: Parser.sourceJsonToColor(it.source),
					sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),

					school: it.school,
					schoolShort: Parser.spSchoolAndSubschoolsAbvsShort(it.school, it.subschools),
					schoolLong: it._l_school,
					schoolClassName: `sp__school-${it.school}`,

					concentration: it._isConc ? "×" : "",
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
					level: it.level,
					time: it._l_time,
					normalisedTime: it._normalisedTime,
					normalisedRange: it._normalisedRange,
					school: it._l_school,
					concentration: it._isConc,

					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	_activateListeners_initRunButtonsAdditional () { this._activateListeners_initRunButtonsAdditional_genericMods(); }

	_pFnPostProcessEntries (entries, {isUseMods = false} = {}) {
		if (!isUseMods) return entries;

		return new Promise(resolve => {
			const detailer = new ImportListSpell.DetailPreparation(entries, resolve, {titleSearch: this._titleSearch, isActor: !!this._actor});
			detailer.render(true);
		});
	}

	/**
	 * @param spell
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.opts_pGetSpellItem] if the item should be temporary, and displayed.
	 * @param [importOpts.isSpellScroll] if the spell should be imported as a spell scroll
	 * @param [importOpts.folderId] The folder ID to import to.
	 */
	async _pImportEntry (spell, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing spell "${spell.name}" (from "${Parser.sourceJsonToAbv(spell.source)}")`);

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(spell, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(spell, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(spell, importOpts);
	}

	async _pImportEntry_pImportToActor (spell, importOpts) {
		const isScrollImport = this.constructor._isSpellScrollImport(spell, importOpts);
		const spellPointsItemId = this._isAllowSpellPoints({spell, importOpts, isScrollImport}) ? await this._pGetActorSpellPointsItemId() : null;

		const spellData = await DataConverterSpell.pGetSpellItem(
			spell,
			{
				actor: this._actor,
				...(importOpts.opts_pGetSpellItem
					|| (await UtilActors.pGetActorSpellItemOpts({actor: this._actor, isAllowAutoDetectPreparationMode: true}))),
				spellPointsItemId,
			},
		);

		let embeddedDocument;
		if (isScrollImport) {
			const scrollData = await CONFIG.Item.documentClass.createScrollFromSpell(spellData);
			const importedMetas = await UtilActors.pAddActorItems(
				this._actor,
				[scrollData.toObject()],
			);
			embeddedDocument = importedMetas[0]?.document;
		} else {
			const importedMetas = await UtilActors.pAddActorItems(
				this._actor,
				[spellData],
			);
			embeddedDocument = importedMetas[0]?.document;
		}

		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: spell.name,
					actor: this._actor,
					embeddedDocument,
				}),
			],
		});
	}

	_isAllowSpellPoints ({spell, importOpts, isScrollImport}) {
		if (isScrollImport) return false;
		return DataConverterSpell.isAllowSpellPoints(spell, {...importOpts?.opts_pGetSpellItem || {}});
	}

	async _pGetActorSpellPointsItemId () {
		if (!this._actor) throw new Error(`Only applicable when importing to an actor!`);
		const spellPointsItem = await UtilActors.pGetCreateActorSpellPointsItem({actor: this._actor});
		return spellPointsItem?.id;
	}

	async _pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts, importOpts) {
		const spellData = await DataConverterSpell.pGetSpellItem(it, {...UtilActors.getSpellItemItemOpts(), ...getItemOpts});

		if (this.constructor._isSpellScrollImport(it, importOpts)) {
			const scrollData = await CONFIG.Item.documentClass.createScrollFromSpell(spellData);
			return scrollData.toObject();
		}
		return spellData;
	}

	static getListDisplayLevel (it) { return `${Parser.spLevelToFull(it.level)}${it.meta && it.meta.ritual ? " (rit.)" : ""}${it.meta && it.meta.technomagic ? " (tec.)" : ""}`; }

	static _isSpellScrollImport (spell, importOpts) { return spell._foundryIsSpellScroll || importOpts.isSpellScroll; }
}

ImportListSpell.DetailPreparation = class extends ImportCustomizer {
	/**
	 * @param dataList
	 * @param resolve
	 * @param opts Options object.
	 * @param opts.titleSearch Used in prompt text in the search bar.
	 * @param opts.isActor
	 */
	constructor (dataList, resolve, opts) {
		super(
			dataList,
			resolve,
			{
				...opts,
				title: "Set Preparation Details",
				template: `${SharedConsts.MODULE_LOCATION}/template/ImportListSpellScrollOrPreparation.hbs`,
			},
		);
	}

	getData () {
		return {
			...super.getData(),
			rows: this._dataList.map((it, ix) => ({
				name: it.name,
				level: ImportListSpell.getListDisplayLevel(it),
				source: it.source,
				sourceShort: Parser.sourceJsonToAbv(it.source),
				sourceLong: Parser.sourceJsonToFull(it.source),
				sourceClassName: Parser.sourceJsonToColor(it.source),
				sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),
				ix,
			})),
		};
	}

	_activateListeners_initList ({$html}) {
		// Init list library
		this._list = new List({
			$iptSearch: $html.find(`.search`),
			$wrpList: $html.find(`.veapp__list`),
			valueNames: ["name", "source", "level", "ix"],
		});
		this._list.doAbsorbItems(
			this._dataList,
			{
				fnGetName: it => it.name,
				fnGetValues: it => ({source: it.source, level: it.level}),
				fnGetData: it => {
					const $e = $(it.ele);
					return {
						$cbScroll: $e.find(`[name="cb-is-scroll"]`),
						$selIsPrepared: $e.find(`[name="sel-is-prepared"]`),
						$selPreparationMode: $e.find(`[name="sel-preparation-mode"]`),
					};
				},
			},
		);
		this._list.init();
	}

	_activateListeners_bindControls ({$html, $wrpBtnsSort}) {
		const $cbScrollAll = $wrpBtnsSort.find(`[name="cb-is-scroll-all"]`)
			.change(() => {
				const val = $cbScrollAll.prop("checked");
				this._list.items.forEach(li => li.data.$cbScroll.prop("checked", val));
			});

		this._$btnReset = $html.find(`[name="btn-reset"]`).click(() => {
			$html.find(`.search`).val("");
			if (this._list) this._list.reset();
		});

		$html.find(`[name="btn-run"]`).click(async () => {
			const enhancedSpells = this._list.items.map(it => {
				const isSpellScroll = it.data.$cbScroll.prop("checked");
				const isPrepVal = it.data.$selIsPrepared.val();
				const prepModeVal = it.data.$selPreparationMode.val();

				const hasIsPrep = isPrepVal && isPrepVal !== "-1";
				const hasPrepMode = prepModeVal && prepModeVal !== "-1";

				if (!isSpellScroll && !hasIsPrep && !hasPrepMode) return this._dataList[it.ix];

				const out = MiscUtil.copy(this._dataList[it.ix]);

				if (isSpellScroll) out._foundryIsSpellScroll = true;

				if (hasIsPrep || hasPrepMode) {
					out.foundryData = {};
					if (hasIsPrep) out.foundryData["preparation.prepared"] = !!Number(isPrepVal);
					if (hasPrepMode) out.foundryData["preparation.mode"] = prepModeVal;
				}

				return out;
			});

			this._resolve(enhancedSpells);
			this.close();
		});
	}
};

export {ImportListSpell};
