import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilApplications} from "./UtilApplications.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {UtilActors} from "./UtilActors.js";
import {Consts} from "./Consts.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {DataConverterClassSubclassFeature} from "./DataConverterClassSubclassFeature.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterClass {
	static _getDoNotUseNote () {
		return UtilDataConverter.pGetWithDescriptionPlugins(() => `<p>${Renderer.get().render(`{@note Note: importing a class as an item is provided for display purposes only. If you wish to import a class to a character sheet, please use the importer on the sheet instead.}`)}</p>`);
	}

	static _getCntSkills (cls) {
		return (MiscUtil.get(cls, "startingProficiencies", "skills") || [])
			.map(it => MiscUtil.get(it.choose, "count") || 0)
			.reduce((a, b) => a + b, 0);
	}

	static getDataHitDice (cls) { return `d${(cls.hd || {}).faces || 6}`; }

	static getDataSaves (cls) {
		return (cls.proficiency || [])
			.filter(it => Parser.ATB_ABV_TO_FULL[it]);
	}

	/**
	 * @param cls The class entry.
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.filterValues] Pre-baked filter values to be re-used when importing this class from the item.
	 * @return {object}
	 * TODO(Future) expand this as Foundry allows
	 */
	static async pGetClassItem (cls, opts) {
		opts = opts || {};

		const originalData = DataConverter.getCleanOriginalData(cls);

		const tblPart = await UtilDataConverter.pGetWithDescriptionPlugins(() => this.pGetRenderedClassTable(cls));

		// Dereference features and render as a simple entity array
		cls = MiscUtil.copy(cls);
		cls = await DataUtil.class.pGetDereferencedClassData(cls);
		const clsDescription = await UtilDataConverter.pGetWithDescriptionPlugins(() => Renderer.get().setFirstSection(true).render({type: "section", entries: cls.classFeatures.flat()}));

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			(await UtilCompendium.pGetCompendiumImage("class", cls)) || `modules/${SharedConsts.MODULE_NAME}/media/icon/laurels.svg`,
		);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(cls)),
			type: "class",
			data: {
				description: {
					value: Config.get("importClass", "isImportDescription") ? `<div class="mb-2">${await this._getDoNotUseNote()}${tblPart}${clsDescription}</div>` : "",
					chat: "",
					unidentified: "",
				},
				source: UtilDataConverter.getSourceWithPagePart(cls),
				levels: Consts.CHAR_MAX_LEVEL,
				subclass: "",
				damage: {parts: []},
				hitDice: DataConverterClass.getDataHitDice(cls),
				hitDiceUsed: 0,
				saves: this.getDataSaves(cls),
				skills: {
					number: this._getCntSkills(cls),
					choices: DataConverterClass.getAllSkillChoices((MiscUtil.get(cls, "startingProficiencies", "skills") || [])),
				},
				spellcasting: UtilActors.getMappedCasterType(cls.casterProgression),
			},
			flags: {
				[SharedConsts.MODULE_NAME_FAKE]: {
					page: UrlUtil.PG_CLASSES,
					source: cls.source,
					hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](cls),
					data: {
						class: originalData,
					},
					filterValues: opts.filterValues,
				},
			},
			effects: [],
			img,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importClass", "permissions")};

		return out;
	}

	static getAllSkillChoices (skillProfs) {
		const allSkills = new Set();

		skillProfs.forEach(skillProfGroup => {
			Object.keys(Parser.SKILL_TO_ATB_ABV)
				.filter(skill => skillProfGroup[skill])
				.forEach(skill => allSkills.add(skill));

			if (skillProfGroup.choose?.from?.length) {
				skillProfGroup.choose.from
					.filter(skill => Parser.SKILL_TO_ATB_ABV[skill])
					.forEach(skill => allSkills.add(skill));
			}
		});

		return Object.entries(UtilActors.SKILL_ABV_TO_FULL)
			.filter(([, vetKey]) => allSkills.has(vetKey))
			.map(([fvttKey]) => fvttKey);
	}

	/**
	 * @param cls The class entry.
	 * @param sc The subclass entry.
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.filterValues] Pre-baked filter values to be re-used when importing this subclass from the item.
	 * @return {object}
	 * TODO(Future) expand this as Foundry allows
	 */
	static async pGetSubclassItem (cls, sc, opts) {
		opts = opts || {};

		const originalDataClass = DataConverter.getCleanOriginalData(cls);
		const originalDataSubclass = DataConverter.getCleanOriginalData(sc);

		// Dereference features and render as a simple entity array
		sc = MiscUtil.copy(sc);
		sc = await DataUtil.class.pGetDereferencedSubclassData(sc);
		const scDescription = await UtilDataConverter.pGetWithDescriptionPlugins(() => Renderer.get().setFirstSection(true).render({type: "section", entries: sc.subclassFeatures.flat()}));

		// Use the image of the parent class
		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			(await UtilCompendium.pGetCompendiumImage("class", cls)) || `modules/${SharedConsts.MODULE_NAME}/media/icon/laurels.svg`,
		);

		sc.source = sc.source || cls.source;

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(cls, {displayName: `${sc.name} ${cls.name}`})),
			type: "class",
			data: {
				description: {
					value: Config.get("importClass", "isImportDescription") ? `<div>${await this._getDoNotUseNote()}${scDescription}</div>` : "",
					chat: "",
					unidentified: "",
				},
				source: UtilDataConverter.getSourceWithPagePart(sc),
				levels: Consts.CHAR_MAX_LEVEL,
				subclass: sc.name,
				damage: {parts: []},
				hitDice: DataConverterClass.getDataHitDice(cls),
				hitDiceUsed: 0,
				saves: this.getDataSaves(cls),
				skills: {
					number: this._getCntSkills(cls),
					choices: DataConverterClass.getAllSkillChoices((MiscUtil.get(cls, "startingProficiencies", "skills") || [])),
				},
				spellcasting: UtilActors.getMappedCasterType(DataConverter.getMaxCasterProgression(cls.casterProgression, sc.casterProgression)),
			},
			flags: {
				[SharedConsts.MODULE_NAME_FAKE]: {
					page: "subclass",
					source: sc.source,
					hash: UrlUtil.URL_TO_HASH_BUILDER["subclass"](sc),
					data: {
						class: originalDataClass,
						subclass: originalDataSubclass,
					},
					filterValues: opts.filterValues,
				},
			},
			effects: [],
			img,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importClass", "permissions")};

		return out;
	}

	static async pGetClassSubclassFeatureItem (loaded, actor) {
	// "type" is either "classFeature" or "subclassFeature"
		const {entity, type} = loaded;
		return DataConverterClassSubclassFeature.pGetClassSubclassFeatureItem(entity, {type, actor});
	}

	// region Effects, generally defined in side-loaded data
	static getItemEffects (actor, effectRaw, sheetItem) {
		return this._getClassSubclassItemEffects(actor, sheetItem, [effectRaw]);
	}

	static async pHasClassSubclassSideLoadedEffects (actor, cls, sc) {
		const allEffects = await this._pGetClassSubclassItemEffectsRaw({cls, sc});
		return !!allEffects.length;
	}

	static async pGetClassSubclassItemEffects (actor, cls, sc, sheetItem) {
		const allEffects = await this._pGetClassSubclassItemEffectsRaw({cls, sc});
		return this._getClassSubclassItemEffects(actor, sheetItem, allEffects, {parentName: cls.name});
	}

	static async _pGetClassSubclassItemEffectsRaw ({cls, sc}) {
		const sideDataCls = await this.pGetSideData(cls, "class");
		const sideDataSc = sc ? await this.pGetSideData(sc, "subclass") : {};

		const additionalEffectsRawCls = await DataConverter.pGetAdditionalStarFromFound_(cls, {propFromEntity: "foundryEffects", propFromSideLoaded: "effects", found: sideDataCls});
		const additionalEffectsRawSc = sc ? await DataConverter.pGetAdditionalStarFromFound_(sc, {propFromEntity: "foundryEffects", propFromSideLoaded: "effects", found: sideDataSc}) : null;

		return [...(additionalEffectsRawCls || []), ...(additionalEffectsRawSc || [])];
	}

	static _getClassSubclassItemEffects (actor, sheetItem, effects, {parentName = ""} = {}) {
		return UtilActiveEffects.getExpandedEffects(effects, {actor, sheetItem, parentName});
	}
	// endregion

	static async pPreloadSideData () {
		DataConverterClass._SIDE_DATA = await Vetools.pGetClassSubclassSideData();
	}

	static async pGetSideData (entity, type) {
		if (!entity) return null;

		switch (type) {
			case "class": {
				let found = (MiscUtil.get(BrewUtil, "homebrew", "foundryClass") || []).find(it => it.name === entity.name && it.source === entity.source);

				if (!found) {
					const additionalData = DataConverterClass._SIDE_DATA || await Vetools.pGetClassSubclassSideData();
					found = (additionalData.class || []).find(it => it.name === entity.name && it.source === entity.source);
				}

				if (!found) return null;
				return found;
			}

			case "subclass": {
				let found = (MiscUtil.get(BrewUtil, "homebrew", "foundrySubclass") || []).find(it => it.name === entity.name && it.source === entity.source && it.className === entity.className && it.classSource === entity.classSource);

				if (!found) {
					const additionalData = DataConverterClass._SIDE_DATA || await Vetools.pGetClassSubclassSideData();
					found = (additionalData.subclass || []).find(it => it.name === entity.name && it.source === entity.source && it.className === entity.className && it.classSource === entity.classSource);
				}

				if (!found) return null;
				return found;
			}

			default: throw new Error(`Unhandled type "${type}"`);
		}
	}

	/** Ported from `_render_renderClassTable` */
	static async pGetRenderedClassTable (cls, sc, opts = {}) {
		if (!Config.get("importClass", "isImportClassTable")) return "";

		return UtilDataConverter.pGetWithDescriptionPlugins(async () => {
			// region Get dereferenced class data, so that the features are available
			cls = MiscUtil.copy(cls);
			cls = await DataUtil.class.pGetDereferencedClassData(cls);

			if (sc) {
				sc = MiscUtil.copy(sc);
				sc = await DataUtil.class.pGetDereferencedSubclassData(sc);
			}
			// endregion

			return this.getRenderedClassTableFromDereferenced(cls, sc, opts);
		});
	}

	static getRenderedClassTableFromDereferenced (cls, sc, {isAddHeader = false, isSpellsOnly = false} = {}) {
		if (!cls) return "";

		Renderer.get().setFirstSection(true);

		const tblGroupHeaders = [];
		const tblHeaders = [];

		const renderTableGroupHeader = (tableGroup) => {
			// Render titles (top section)
			let thGroupHeader;
			if (tableGroup.title) {
				thGroupHeader = `<th class="cls-tbl__col-group" colspan="${tableGroup.colLabels.length}">${tableGroup.title}</th>`;
			} else {
				// if there's no title, add a spacer
				thGroupHeader = `<th colspan="${tableGroup.colLabels.length}"></th>`;
			}
			tblGroupHeaders.push(thGroupHeader);

			// Render column headers (bottom section)
			tableGroup.colLabels.forEach(lbl => {
				tblHeaders.push(`<th class="cls-tbl__col-generic-center"><div class="cls__squash_header">${Renderer.get().render(lbl)}</div></th>`);
			});
		};

		if (cls.classTableGroups) {
			cls.classTableGroups.forEach(tableGroup => {
				if (isSpellsOnly) tableGroup = this._getRenderedClassTableFromDereferenced_getSpellsOnlyTableGroup(tableGroup);
				if (!tableGroup) return;
				renderTableGroupHeader(tableGroup);
			});
		}

		if (sc?.subclassTableGroups) {
			sc.subclassTableGroups.forEach(tableGroup => {
				if (isSpellsOnly) tableGroup = this._getRenderedClassTableFromDereferenced_getSpellsOnlyTableGroup(tableGroup);
				if (!tableGroup) return;
				renderTableGroupHeader(tableGroup);
			});
		}

		const tblRows = cls.classFeatures.map((lvlFeatures, ixLvl) => {
			const pb = Math.ceil((ixLvl + 1) / 4) + 1;

			const lvlFeaturesFilt = lvlFeatures
				.filter(it => it.name && it.type !== "inset"); // don't add inset entry names to class table

			const dispsFeatures = lvlFeaturesFilt
				.map((it, ixFeature) => `<div class="inline-block">${it.name}${ixFeature === lvlFeaturesFilt.length - 1 ? "" : `<span class="mr-1">,</span>`}</div>`);

			const ptTableGroups = [];

			const renderTableGroupRow = (tableGroup) => {
				const row = (tableGroup.rowsSpellProgression || tableGroup.rows)[ixLvl] || [];
				const cells = row.map(cell => `<td class="cls-tbl__col-generic-center">${cell === 0 ? "\u2014" : Renderer.get().render(cell)}</td>`);
				ptTableGroups.push(...cells);
			};

			if (cls.classTableGroups) {
				cls.classTableGroups.forEach(tableGroup => {
					if (isSpellsOnly) tableGroup = this._getRenderedClassTableFromDereferenced_getSpellsOnlyTableGroup(tableGroup);
					if (!tableGroup) return;
					renderTableGroupRow(tableGroup);
				});
			}

			if (sc?.subclassTableGroups) {
				sc.subclassTableGroups.forEach(tableGroup => {
					if (isSpellsOnly) tableGroup = this._getRenderedClassTableFromDereferenced_getSpellsOnlyTableGroup(tableGroup);
					if (!tableGroup) return;
					renderTableGroupRow(tableGroup);
				});
			}

			return `<tr class="cls-tbl__stripe-odd">
				<td class="cls-tbl__col-level">${Parser.getOrdinalForm(ixLvl + 1)}</td>
				${isSpellsOnly ? "" : `<td class="cls-tbl__col-prof-bonus">+${pb}</td>`}
				${isSpellsOnly ? "" : `<td>${dispsFeatures.join("") || `\u2014`}</td>`}
				${ptTableGroups.join("")}
			</tr>`;
		});

		// Don't add a class name header, as we assume this will be embedded in some UI that already has one.
		return `<table class="cls-tbl shadow-big w-100 mb-3">
			<tbody>
			<tr><th class="border" colspan="15"></th></tr>
			${isAddHeader ? `<tr><th class="cls-tbl__disp-name" colspan="15">${cls.name}</th></tr>` : ""}
			<tr>
				<th colspan="${isSpellsOnly ? "1" : "3"}"></th>
				${tblGroupHeaders.join("")}
			</tr>
			<tr>
				<th class="cls-tbl__col-level">Level</th>
				${isSpellsOnly ? "" : `<th class="cls-tbl__col-prof-bonus">Proficiency Bonus</th>`}
				${isSpellsOnly ? "" : `<th>Features</th>`}
				${tblHeaders.join("")}
			</tr>
			${tblRows.join("")}
			<tr><th class="border" colspan="15"></th></tr>
			</tbody>
		</table>`;
	}

	static _getRenderedClassTableFromDereferenced_getSpellsOnlyTableGroup (tableGroup) {
		tableGroup = MiscUtil.copy(tableGroup);

		if (/spell/i.test(`${tableGroup.title || ""}`)) return tableGroup;

		if (!tableGroup.colLabels) return null;

		const ixsSpellLabels = new Set(tableGroup.colLabels
			.map((it, ix) => {
				const stripped = Renderer.stripTags(`${it || ""}`);
				return /cantrip|spell|slot level/i.test(stripped) ? ix : null;
			})
			.filter(ix => ix != null));

		if (!ixsSpellLabels.size) return null;

		tableGroup.colLabels = tableGroup.colLabels.filter((_, ix) => ixsSpellLabels.has(ix));
		if (tableGroup.rowsSpellProgression) tableGroup.rowsSpellProgression = tableGroup.rowsSpellProgression.map(row => row.filter((_, ix) => ixsSpellLabels.has(ix)));
		if (tableGroup.rows) tableGroup.rows = tableGroup.rows.map(row => row.filter((_, ix) => ixsSpellLabels.has(ix)));

		return tableGroup;
	}

	static isStubClass (cls) {
		if (!cls) return false;
		return cls.name === DataConverterClass.STUB_CLASS.name && cls.source === DataConverterClass.STUB_CLASS.source;
	}

	static isStubSubclass (sc) {
		if (!sc) return false;
		return sc.name === DataConverterClass.STUB_SUBCLASS.name && sc.source === DataConverterClass.STUB_SUBCLASS.source;
	}

	static getClassStub () {
		const out = MiscUtil.copy(DataConverterClass.STUB_CLASS);
		out.subclasses = [
			{
				...MiscUtil.copy(DataConverterClass.STUB_SUBCLASS),
				className: out.name,
				classSource: out.source,
			},
		];
		return out;
	}

	static getSubclassStub ({cls}) {
		const out = MiscUtil.copy(DataConverterClass.STUB_SUBCLASS);
		out.className = cls.name;
		out.classSource = cls.source;
		return out;
	}
}
DataConverterClass._SIDE_DATA = null;

// region Fake data used in place of missing records when levelling up
//   (i.e. if the same set of sources have not been selected when re-opening the Charactermancer)
DataConverterClass.STUB_CLASS = {
	name: "Unknown Class",
	source: SRC_PHB,
	classFeatures: [...new Array(Consts.CHAR_MAX_LEVEL)].map(() => []),
	_isStub: true,
};
DataConverterClass.STUB_SUBCLASS = {
	name: "Unknown Subclass",
	source: SRC_PHB,
	subclassFeatures: [],
	_isStub: true,
};
// endregion

export {DataConverterClass};
