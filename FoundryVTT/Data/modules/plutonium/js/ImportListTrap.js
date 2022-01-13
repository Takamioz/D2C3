import {ImportListActor} from "./ImportListActor.js";
import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {UtilActors} from "./UtilActors.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class ImportListTrap extends ImportListActor {
	constructor (externalData) {
		externalData = externalData || {};
		super(
			{
				title: "Import Traps",
			},
			externalData,
			{
				props: ["trap"],
				dirsHomebrew: ["trap"],
				propsBrewAdditionalData: ["foundryTrap"],
				fnLoadSideData: Vetools.pGetTrapHazardSideData,
				titleSearch: "traps",
				sidebarTab: "actors",
				gameProp: "actors",
				defaultFolderPath: ["Traps"],
				pageFilter: new PageFilterTrapsHazards(),
				page: UrlUtil.PG_TRAPS_HAZARDS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importTrap",
			},
			{
				actorType: "npc",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_TRAPS_HAZARDS,
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
			...super.getData(),
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

				it._lTrapType = Parser.trapHazTypeToFull(it.trapHazType);

				return {
					name: it.name,
					trapType: it._lTrapType,
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

	/**
	 * If we're importing a hazard, delegate to the hazard importer.
	 */
	async _pImportEntry (trap, importOpts) {
		importOpts = importOpts || {};

		if (trap.__prop === "hazard" || ImportListTrap._TRAP_HAZ_TYPES_HAZARD.has(trap.trapHazType)) {
			const {ImportListHazard} = await import("./ImportListHazard.js");
			const importListHazard = new ImportListHazard({});
			await importListHazard.pInit();
			await importListHazard.pSyncStateFrom(this);
			return importListHazard._pImportEntry(trap, importOpts);
		}

		return super._pImportEntry(trap, importOpts);
	}

	async _pImportEntry_pGetImportMetadata (actor, trap, importOpts) {
		const act = {};

		const dataBuilderOpts = new ImportListTrap.ImportEntryOpts({actor});

		await this._pImportEntry_pFillBase(trap, act, dataBuilderOpts.fluff, {img: ImportListTrap._IMG_TRAP});

		act.data = {};

		await this._pImportEntry_pFillFolder(trap, act, importOpts);

		if (importOpts.defaultPermission != null) act.permission = {default: importOpts.defaultPermission};
		else act.permission = {default: Config.get(this._configGroup, "permissions")};

		this._pImportEntry_fillData_Abilities(trap, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Attributes(trap, act.data, dataBuilderOpts);
		await this._pImportEntry_pFillData_Details(trap, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Traits(trap, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Currency(trap, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Skills(trap, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Spells(trap, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Bonuses(trap, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Resources(trap, act.data, dataBuilderOpts);

		await this._pImportEntry_pFillToken({importable: trap, actor: act, img: ImportListTrap._IMG_TRAP});

		return {dataBuilderOpts: dataBuilderOpts, actorData: act};
	}

	_pImportEntry_fillData_Attributes (trap, data) {
		const out = {};

		out.ac = {calc: "custom", formula: "0"};
		out.hp = {value: 0, max: 0};
		out.movement = {walk: 0};
		out.spellcasting = null;

		data.attributes = out;
	}

	async _pImportEntry_pFillData_Details (trap, data, dataBuilderOpts) {
		const out = {};

		out.cr = 0;
		out.xp = {value: 0};

		out.alignment = (trap.tier ? Parser.tierToFullLevel(trap.tier) : Renderer.traphazard.getTrapLevelPart(trap)) || "";

		out.type = {
			value: "custom",
			subtype: "",
			swarm: "",
			custom: trap.trapHazType ? Parser.trapHazTypeToFull(trap.trapHazType) : "",
		};

		out.source = UtilDataConverter.getSourceWithPagePart(trap);

		data.details = out;
	}

	_pImportEntry_fillData_Traits (trap, data) {
		const out = {};

		out.size = UtilActors.VET_SIZE_TO_ABV[trap.size] || "med";

		data.traits = out;
	}

	_pImportEntry_fillData_Currency (trap, data) {
		data.currency = {pp: 0, gp: 0, ep: 0, sp: 0, cp: 0}; // Dummy data
	}

	_pImportEntry_fillData_Skills (trap, data) { /* No-op */ }

	_pImportEntry_fillData_Spells (trap, data) { /* No-op */ }

	_pImportEntry_fillData_Bonuses (trap, data) { /* No-op */ }

	_pImportEntry_fillData_Resources (trap, data) { /* No-op */ }

	async _pImportEntry_pFillItems (trap, act, dataBuilderOpts, importOpts) {
		if (trap.entries) {
			dataBuilderOpts.items.push(await DataConverter.pGetItemActorPassive(
				{name: "Description", entries: trap.entries},
				{
					mode: "object",
					fvttType: "feat",
					entity: trap,
					source: trap.source,
					img: ImportListTrap._IMG_TRAP,
				},
			));
		}

		if (trap.trigger) {
			dataBuilderOpts.items.push(await DataConverter.pGetItemActorPassive(
				{name: "Trigger", entries: trap.trigger},
				{
					mode: "object",
					fvttType: "feat",
					activationType: "special",
					entity: trap,
					source: trap.source,
					img: ImportListTrap._IMG_TRAP,
				},
			));
		}

		// region Effects
		if (trap.effect) {
			const fauxEntry = {name: "Effect", entries: trap.effect};

			const {
				damageTupleMetas,
				rangeShort,
				rangeLong,
				actionType,
				attackBonus,
				attackTypes,
			} = DataConverter.getParsedWeaponEntryData(trap, fauxEntry);

			const {damageParts, formula} = DataConverter.getDamagePartsAndOtherFormula(damageTupleMetas);

			dataBuilderOpts.items.push(await DataConverter.pGetItemActorPassive(
				fauxEntry,
				{
					mode: "object",
					fvttType: "feat",
					activationType: "special",
					entity: trap,
					source: trap.source,
					img: ImportListTrap._IMG_TRAP,

					damageParts,
					formula,
					rangeShort: rangeShort || (attackTypes.includes("m") ? 5 : null),
					rangeLong,
					attackBonus,
					actionType,
				},
			));
		}

		const complexEffectMetas = [
			{prop: "eActive", name: "Active Elements"},
			{prop: "eDynamic", name: "Dynamic Elements"},
			{prop: "eConstant", name: "Constant Elements"},
		];
		for (const {prop, name} of complexEffectMetas) {
			if (!trap[prop]) continue;

			// TODO(Future) break these down into their sub-actions? Refactor creature actions code?
			dataBuilderOpts.items.push(await DataConverter.pGetItemActorPassive(
				{name, entries: trap[prop]},
				{
					mode: "object",
					fvttType: "feat",
					activationType: "special",
					entity: trap,
					source: trap.source,
					img: ImportListTrap._IMG_TRAP,
				},
			));
		}
		// endregion

		if (trap.initiative) {
			dataBuilderOpts.items.push(await DataConverter.pGetItemActorPassive(
				{name: "Initiative", entries: Renderer.traphazard.getTrapInitiativeEntries(trap)},
				{
					mode: "object",
					fvttType: "feat",
					entity: trap,
					source: trap.source,
					img: ImportListTrap._IMG_TRAP,
				},
			));
		}

		if (trap.countermeasures) {
			dataBuilderOpts.items.push(await DataConverter.pGetItemActorPassive(
				{name: "Countermeasures", entries: trap.countermeasures},
				{
					mode: "object",
					fvttType: "feat",
					entity: trap,
					source: trap.source,
					img: ImportListTrap._IMG_TRAP,
				},
			));
		}

		const isTemporary = importOpts.isTemp || this._pack != null;
		await UtilActors.pAddActorItems(dataBuilderOpts.actor, dataBuilderOpts.items, {isTemporary});
	}
}
ImportListTrap._TRAP_HAZ_TYPES_HAZARD = new Set(["HAZ", "WTH", "ENV", "WLD", "GEN"]);
ImportListTrap._IMG_TRAP = "icons/svg/trap.svg";

ImportListTrap.ImportEntryOpts = class extends ImportListActor.ImportEntryOpts {};

export {ImportListTrap};
