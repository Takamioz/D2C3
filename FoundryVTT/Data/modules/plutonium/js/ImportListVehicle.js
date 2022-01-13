import {ImportListActor} from "./ImportListActor.js";
import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {DataConverter} from "./DataConverter.js";
import {UtilActors} from "./UtilActors.js";
import {ImportListCreature} from "./ImportListCreature.js";
import {DataConverterVehicle} from "./DataConverterVehicle.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListObject} from "./ImportListObject.js";
import {LGT} from "./Util.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class ImportListVehicle extends ImportListActor {
	constructor (externalData) {
		externalData = externalData || {};
		super(
			{
				title: "Import Vehicles",
			},
			externalData,
			{
				props: ["vehicle"],
				dirsHomebrew: ["vehicle"],
				propsBrewAdditionalData: ["foundryVehicle"],
				fnLoadSideData: Vetools.pGetVehicleSideData,
				titleSearch: "vehicles",
				sidebarTab: "actors",
				gameProp: "actors",
				defaultFolderPath: ["Vehicles"],
				pageFilter: new PageFilterVehicles(),
				page: UrlUtil.PG_VEHICLES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importVehicle",
			},
			{
				actorType: "vehicle",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_VEHICLES,
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

	async _pImportEntry_pGetImportMetadata (actor, veh, importOpts) {
		const act = {};

		const fluff = await Renderer.vehicle.pGetFluff(veh);

		const vehOpts = new ImportListVehicle.ImportEntryOpts({actor, fluff});

		await this._pImportEntry_pFillBase(veh, act, vehOpts.fluff, {isUseTokenImageAsPortrait: Config.get(this._configGroup, "isUseTokenImageAsPortrait")});

		act.data = {};

		await this._pImportEntry_pFillFolder(veh, act, importOpts);

		if (importOpts.defaultPermission != null) act.permission = {default: importOpts.defaultPermission};
		else act.permission = {default: Config.get(this._configGroup, "permissions")};

		act.data.vehicleType = this._pImportEntry_getVehicleType(veh);

		this._pImportEntry_fillData_Abilities(veh, act.data, vehOpts);
		this._pImportEntry_fillData_Attributes(veh, act.data, vehOpts);
		await this._pImportEntry_pFillData_Details(veh, act.data, vehOpts);
		this._pImportEntry_fillData_Traits(veh, act.data, vehOpts);
		this._pImportEntry_fillData_Currency(veh, act.data, vehOpts);
		this._pImportEntry_fillData_Cargo(veh, act.data, vehOpts);

		await this._pImportEntry_pFillToken({importable: veh, actor: act});

		return {dataBuilderOpts: vehOpts, actorData: act};
	}

	_pImportEntry_getVehicleType (veh) {
		if (veh.terrain?.length) {
			const terr = veh.terrain[0];
			switch (terr) {
				case "land": return "land";
				case "sea": return "water";
				case "air": return "air";
				default: console.warn(...LGT, `Unknown vehicle terrain type "${terr}"`);
			}
		}

		switch (veh.vehicleType) {
			case "INFWAR": return "land";
			case "SHIP": return "sea";
			default: throw new Error(`Unhandled vehicle type "${veh.vehicleType}"`);
		}
	}

	/**
	 * If we're importing a creature-type vehicle, delegate to the creature importer.
	 * For object-type vehicles, delegate to the object importer.
	 */
	async _pImportEntry (veh, importOpts) {
		importOpts = importOpts || {};

		if (veh.vehicleType === "CREATURE") {
			const importerCreature = new ImportListCreature({});
			await importerCreature.pInit();
			await importerCreature.pSyncStateFrom(this);
			// Override the token URL
			// TODO(future) override fluff, too, if this is ever required
			veh = MiscUtil.copy(veh);
			veh.tokenUrl = await Vetools.pGetTokenUrl("vehicle", veh);
			return importerCreature._pImportEntry(veh, importOpts);
		} else if (veh.vehicleType === "OBJECT") {
			const objectImporter = new ImportListObject({});
			await objectImporter.pInit();
			await objectImporter.pSyncStateFrom(this);
			// Override the token URL
			// TODO(future) override fluff, too, if this is ever required
			veh = MiscUtil.copy(veh);
			veh.tokenUrl = await Vetools.pGetTokenUrl("object", veh);
			return objectImporter._pImportEntry(veh, importOpts);
		}

		return super._pImportEntry(veh, importOpts);
	}

	_pImportEntry_fillData_Attributes (veh, data) {
		const out = {};

		out.init = {
			value: 0,
			bonus: 0,
			mod: 0,
			prof: 0,
			total: 0,
		};

		out.spelldc = null;

		out.movement = DataConverterVehicle.getShipMovement(veh);
		out.speed = DataConverterVehicle.getVehicleSpeed(veh);

		switch (veh.vehicleType) {
			case "INFWAR": {
				const dexMod = Parser.getAbilityModNumber(veh.dex);
				out.ac = {
					flat: 19 + dexMod,
					motionless: "19",
				};

				out.hp = {
					value: MiscUtil.get(veh, "hp", "hp") || 0,
					min: 0,
					max: MiscUtil.get(veh, "hp", "hp") || 0,
					temp: 0,
					tempmax: 0,
					dt: MiscUtil.get(veh, "hp", "dt") || 0,
					mt: MiscUtil.get(veh, "hp", "mt") || 0,
				};

				out.actions = {
					stations: true,
					value: 0,
					thresholds: {
						0: 0,
						1: 0,
						2: 0,
					},
				};

				out.capacity = {
					creature: Renderer.vehicle.getInfwarCreatureCapacity(veh),
					cargo: typeof veh.capCargo === "string" ? 0 : veh.capCargo,
				};

				break;
			}

			case "SHIP": {
				out.ac = {
					flat: MiscUtil.get(veh, "hull", "ac") || null,
					motionless: "",
				};

				out.hp = {
					value: MiscUtil.get(veh, "hull", "hp") || null,
					min: null,
					max: MiscUtil.get(veh, "hull", "hp") || null,
					temp: null,
					tempmax: null,
					dt: MiscUtil.get(veh, "hull", "dt") || null,
					mt: null,
				};

				let actionsValue = 0;
				const actionThresholds = {
					0: 0,
					1: 0,
					2: 0,
				};
				if (veh.actionThresholds) {
					Object.entries(veh.actionThresholds)
						.sort(([ka], [kb]) => SortUtil.ascSort(Number(kb), Number(ka)))
						.slice(0, 3) // FVTT supports a max of 3, so take the highest
						.forEach(([actions, crew], i) => {
							actionThresholds[i] = crew;
						});
				}

				out.actions = {
					stations: false,
					value: actionsValue,
					thresholds: actionThresholds,
				};

				out.capacity = {
					creature: Renderer.vehicle.getShipCreatureCapacity(veh),
					cargo: typeof veh.capCargo === "string" ? 0 : veh.capCargo,
				};

				break;
			}

			default: throw new Error(`Unhandled vehicle type "${veh.vehicleType}"`);
		}

		data.attributes = out;
	}

	async _pImportEntry_pFillData_Details (veh, data, vehOpts) {
		const out = {};

		out.biography = {
			value: await this._pGetBiographyValue(veh, vehOpts.fluff, {isImportText: Config.get(this._configGroup, "isImportBio"), isImportImages: Config.get(this._configGroup, "isImportBioImages")}),
		};

		out.source = UtilDataConverter.getSourceWithPagePart(veh);

		data.details = out;
	}

	_pImportEntry_fillData_Traits (veh, data) {
		const out = {};

		out.size = UtilActors.VET_SIZE_TO_ABV[veh.size] || "med";

		switch (veh.vehicleType) {
			case "INFWAR": {
				out.dimensions = `${veh.weight.toLocaleString()} lb.`;
				break;
			}

			case "SHIP": {
				out.dimensions = veh.dimensions ? veh.dimensions.join(" by ") : "";
				break;
			}

			default: throw new Error(`Unhandled vehicle type "${veh.vehicleType}"`);
		}

		this._pImportEntry_fillConditionsDamage(veh, out);

		data.traits = out;
	}

	_pImportEntry_fillData_Currency (veh, data) {
		// Dummy data
		data.currency = {
			pp: 0,
			gp: 0,
			ep: 0,
			sp: 0,
			cp: 0,
		};
	}

	async _pImportEntry_pFillItems (veh, act, vehOpts, importOpts) {
		await this._pImportEntry_pFillItems_ship(veh, act, vehOpts, importOpts);
		await this._pImportEntry_pFillItems_infWar(veh, act, vehOpts, importOpts);

		const isTemporary = importOpts.isTemp || this._pack != null;
		await UtilActors.pAddActorItems(vehOpts.actor, vehOpts.items, {isTemporary});
	}

	async _pImportEntry_pFillItems_ship (veh, act, vehOpts, importOpts) {
		if (veh.control) { // e.g. "Battle Balloon"
			await veh.control.pSerialAwaitMap(it => this._pAddShipEquipment(veh, act, vehOpts, importOpts, it, "control"));
		}

		if (veh.movement) { // e.g. "Battle Balloon"
			await veh.movement.pSerialAwaitMap(it => this._pAddShipEquipment(veh, act, vehOpts, importOpts, it, "movement"));
		}

		if (veh.weapon) { // e.g. "Battle Balloon"
			await veh.weapon.pSerialAwaitMap(it => this._pAddShipWeapon(veh, act, vehOpts, importOpts, it));
		}

		if (veh.other) { // e.g. "Airship" (UAOfShipsAndSea)
			await veh.other.pSerialAwaitMap(it => this._pAddShipOther(veh, act, vehOpts, importOpts, it));
		}

		if (veh.action) { // e.g. "Battle Balloon"
			await this._pAddShipAction(veh, act, vehOpts, importOpts, veh.action);
		}
	}

	async _pAddShipEquipment (veh, act, vehOpts, importOpts, equipment, prop) {
		const equipmentItem = await DataConverterVehicle.pGetShipEquipmentItem(veh, equipment, prop);
		if (!equipmentItem) return;
		vehOpts.items.push(equipmentItem);
	}

	async _pAddShipWeapon (veh, act, vehOpts, importOpts, weap) {
		const weaponItem = await DataConverterVehicle.pGetShipWeaponItem(veh, weap);
		if (!weaponItem) return;
		vehOpts.items.push(weaponItem);
	}

	async _pAddShipOther (veh, act, vehOpts, importOpts, ent) {
		const otherItem = await DataConverterVehicle.pGetShipOtherItem(veh, ent);
		if (!otherItem) return;
		vehOpts.items.push(otherItem);
	}

	async _pAddShipAction (veh, act, vehOpts, importOpts, actionEnts) {
		const actionItems = await DataConverterVehicle.pGetShipActionItems(veh, actionEnts);
		if (!actionItems || !actionItems.length) return;
		vehOpts.items.push(...actionItems);
	}

	async _pImportEntry_pFillItems_infWar (veh, act, vehOpts, importOpts) {
		if (veh.trait) { // e.g. "Demon Grinder"
			await veh.trait.pSerialAwaitMap(it => this._pAddInfWarTrait(veh, act, vehOpts, importOpts, it));
		}

		if (veh.actionStation) { // e.g. "Demon Grinder"
			await veh.actionStation.pSerialAwaitMap(it => this._pAddInfWarActionStation(veh, act, vehOpts, importOpts, it));
		}

		if (veh.reaction) { // e.g. "Devil's Ride"
			await veh.reaction.pSerialAwaitMap(it => this._pAddInfWarReaction(veh, act, vehOpts, importOpts, it));
		}
	}

	async _pAddInfWarTrait (veh, act, vehOpts, importOpts, trait) {
		const traitItem = await DataConverter.pGetItemActorPassive(
			trait,
			{
				fvttType: "feat",
				mode: "vehicle",
				entity: veh,
				source: veh.source,
				actor: {data: act}, // wrap our update data to give the appearance of a real actor
				img: `modules/${SharedConsts.MODULE_NAME}/media/icon/gears.svg`,
			},
		);
		vehOpts.items.push(traitItem);
	}

	async _pAddInfWarActionStation (veh, act, vehOpts, importOpts, action) {
		const actionStationItem = await DataConverterVehicle.pGetInfWarActionItem(veh, action);
		if (!actionStationItem) return;
		vehOpts.items.push(actionStationItem);
	}

	async _pAddInfWarReaction (veh, act, vehOpts, importOpts, reaction) {
		const reactionItem = await DataConverter.pGetItemActorPassive(
			reaction,
			{
				activationType: "reaction",
				activationCost: 1,
				fvttType: "feat",
				mode: "vehicle",
				entity: veh,
				source: veh.source,
				actor: {data: act}, // wrap our update data to give the appearance of a real actor
				img: `modules/${SharedConsts.MODULE_NAME}/media/icon/gears.svg`,
			},
		);
		vehOpts.items.push(reactionItem);
	}

	_pImportEntry_fillData_Cargo (veh, data) {
		// Dummy data
		data.cargo = {
			crew: [],
			passengers: [],
		};
	}
}

ImportListVehicle.ImportEntryOpts = class extends ImportListActor.ImportEntryOpts {};

export {ImportListVehicle};
