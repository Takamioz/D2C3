import {DataConverter} from "./DataConverter.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";

class DataConverterVehicle {
	// region Speed
	static getVehicleSpeed (veh) {
		switch (veh.vehicleType) {
			case "SHIP": return this._getVehicleSpeed_ship(veh);
			case "INFWAR": return this._getVehicleSpeed_infwar(veh);
			default: throw new Error(`Unhandled vehicle type "${veh.vehicleType}"`);
		}
	}

	static _getVehicleSpeed_ship (veh) {
		if (!veh.pace) return "";

		const perHour = Config.getMetricNumber({configGroup: "importVehicle", originalValue: veh.pace, originalUnit: UNT_MILES});
		const perDay = Config.getMetricNumber({configGroup: "importVehicle", originalValue: veh.pace * 24, originalUnit: UNT_MILES});

		const unit = Config.getMetricUnit({configGroup: "importVehicle", originalUnit: UNT_MILES, isShortForm: false, isPlural: veh.pace !== 1});

		return `${perHour} ${unit} per hour (${perDay} ${unit} per day)`;
	}

	static _getVehicleSpeed_infwar (veh) {
		const speed = Config.getMetricNumber({configGroup: "importVehicle", originalValue: veh.speed, originalUnit: "ft."});
		const unit = Config.getMetricUnit({configGroup: "importVehicle", originalUnit: "ft."});
		return `${speed} ${unit}`;
	}
	// endregion

	// region Movement
	static getShipMovement (veh) {
		switch (veh.vehicleType) {
			case "SHIP": return this._getShipMovement_ship(veh);
			case "INFWAR": return this._getShipMovement_infwar(veh);
			default: throw new Error(`Unhandled vehicle type "${veh.vehicleType}"`);
		}
	}

	static _getShipMovement_ship (veh) {
		const out = {};

		(veh.movement || []).forEach(move => {
			this._doPopulateMovementToSpeedMap(move, "locomotion", out);
			this._doPopulateMovementToSpeedMap(move, "speed", out);
		});

		if (!Object.keys(out).length && veh.pace && veh.terrain?.length) {
			veh.terrain.forEach(ter => {
				const speedProp = this._getMovementTypeFromTerrain(ter);
				out[speedProp] = Config.getMetricNumber({configGroup: "importVehicle", originalUnit: UNT_MILES, originalValue: veh.pace});
			});
			out.units = Config.getMetricUnit({configGroup: "importVehicle", originalUnit: "mi"});
		}

		// Replace the default "30 foot walking speed" if we have no walking speed
		if (!out.walk) out.walk = 0;

		return out;
	}

	static _getMovementTypeFromTerrain (ter) {
		switch (ter) {
			case "air": return "fly";
			case "land": return "walk";
			case "sea": return "swim";
			default: throw new Error(`Unhandled terrain type "${ter}"`);
		}
	}

	static _doPopulateMovementToSpeedMap (move, prop, out) {
		if (!move[prop]) return;

		move[prop].forEach(spd => {
			if (!spd.entries || !spd.entries.length) return;

			const speedProp = this._getSpeedTypeFromMovementMode(spd.mode);

			// If the speed prop comes back as "null", we should try to parse the string manually
			if (speedProp == null) {
				UtilDataConverter.WALKER_READONLY_GENERIC.walk(
					spd.entries,
					{
						string: (str) => {
							str.split(",").map(it => it.trim()).filter(Boolean).forEach(pt => {
								pt.replace(/^(?:(burrow|climb|swim|fly) )?(\d+) ft\./g, (...m) => {
									const speedType = m[1].toLowerCase().trim();
									const speed = Config.getMetricNumber({configGroup: "importVehicle", originalUnit: UNT_FEET, originalValue: Number(m[2])});
									out[speedType] = Math.max(speed, out[speedType] || 0);
								});
							});

							if (str.toLowerCase().includes("(hover)")) out.hover = true;
						},
					},
				);

				return;
			}

			UtilDataConverter.WALKER_READONLY_GENERIC.walk(
				spd.entries,
				{
					string: (str) => {
						str.replace(/speed (\d+) ft\./g, (...m) => {
							const speed = Config.getMetricNumber({configGroup: "importVehicle", originalUnit: UNT_FEET, originalValue: Number(m[1])});
							out[speedProp] = Math.max(speed, out[speedProp] || 0);
						});

						if (str.toLowerCase().includes("(hover)")) out.hover = true;
					},
				},
			);
		});
	}

	static _getSpeedTypeFromMovementMode (mode) {
		switch (mode) {
			case "air": return "fly";
			case "water": return "swim";
			case "magical": return null;
			default: throw new Error(`Unhandled locomotion mode "${mode}"`);
		}
	}

	static _getShipMovement_infwar (veh) {
		const out = {};

		if (veh.speed) {
			out.walk = Config.getMetricNumber({configGroup: "importVehicle", originalUnit: UNT_FEET, originalValue: veh.speed});
			out.units = Config.getMetricUnit({configGroup: "importVehicle", originalUnit: "ft"});
		}

		return out;
	}
	// endregion

	static async pGetShipEquipmentItem (veh, equi, prop) {
		let description = await DataConverter.pGetEntryDescription(equi);

		if (prop === "movement") {
			if (equi.speed) {
				const parts = equi.speed
					.map(it => Renderer.vehicle.ship.getSpeedEntries(it))
					.map(ents => `<div>${Renderer.get().setFirstSection(true).render(ents)}</div>`);
				description += parts.join("");
			}

			if (equi.locomotion) {
				const parts = equi.locomotion
					.map(loc => Renderer.vehicle.ship.getLocomotionEntries(loc))
					.map(ents => `<div>${Renderer.get().setFirstSection(true).render(ents)}</div>`);
				description += parts.join("");
			}
		}

		const out = {
			name: equi.name,
			type: "equipment",
			data: {
				description: {value: description, chat: "", unidentified: ""},
				source: UtilDataConverter.getSourceWithPagePart(veh),
				quantity: 1,
				weight: 0,
				price: 0,
				attuned: false,
				equipped: true,
				rarity: "",
				identified: true,
				activation: {type: "", cost: 0, condition: ""},
				duration: {value: null, units: ""},
				target: {value: null, width: null, units: "", type: ""},
				range: {value: null, long: null, units: ""},
				uses: {value: 0, max: 0, per: null},
				consume: {type: "", target: null, amount: null},
				ability: null,
				actionType: "",
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				damage: {parts: [], versatile: ""},
				formula: "",
				save: {ability: "", dc: null, scaling: "spell"},
				armor: {value: equi.ac || 0, type: "vehicle", dex: null},
				hp: {value: equi.hp || 0, max: equi.hp || 0, dt: equi.dt, conditions: equi.hpNote || ""},
				speed: {value: null, conditions: ""},
				strength: 0,
				stealth: false,
				proficient: true,
			},
			flags: {},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				`modules/${SharedConsts.MODULE_NAME}/media/icon/ship-wheel.svg`,
			),
		};

		// If we have movement info, use the first one available to set our speed. We _could_ instead opt to map each
		//   piece of movement info to its own sheet item, but this would be more confusing than helpful (e.g. showing
		//   multiple entries for "Sails" on the sheet). Just present the information textually, and let the user figure
		//   it out.
		// FIXME(Future) as of 2021-11-03, these do not support units
		if (prop === "movement") {
			if (equi.speed) {
				const metas = this._getSpeedMetas(equi);
				if (metas.length) {
					const primaryMeta = metas[0];
					out.data.speed.value = primaryMeta.speed;
					out.data.speed.conditions = primaryMeta.condition;
				}
			}

			if (equi.locomotion) {
				const metas = this._getLocomotionMetas(equi);
				if (metas.length) {
					const primaryMeta = metas[0];
					out.data.speed.value = primaryMeta.speed;
					out.data.speed.conditions = primaryMeta.condition;
				}
			}
		}

		return out;
	}

	static _getSpeedMetas (equi) {
		if (!equi.speed || !equi.speed.length) return [];

		return equi.speed
			.map(spd => {
				if (!spd.entries || !spd.entries.length || typeof spd.entries[0] !== "string") return null;

				const parts = spd.entries[0].split(";").map(it => it.trim()).filter(Boolean);
				return parts.map(it => {
					const mSpeed = /^((?:fly|swim|burrow|climb) )?(\d+)\s*ft\.(.*?)$/.exec(it);
					if (!mSpeed) return null;
					const out = {speed: Config.getMetricNumber({configGroup: "importVehicle", originalUnit: UNT_FEET, originalValue: Number(mSpeed[2])})};
					if (mSpeed[3]) {
						const conditionClean = mSpeed[3].trim().replace(/^,\s*/, "");
						if (conditionClean) out.condition = conditionClean;
					}
					return out;
				});
			})
			.filter(Boolean)
			.flat();
	}

	static _getLocomotionMetas (equi) {
		if (!equi.locomotion || !equi.locomotion.length) return [];

		return equi.locomotion
			.map(loc => {
				if (!loc.entries || !loc.entries.length || typeof loc.entries[0] !== "string") return null;

				const mSpeed = /^(.*?), speed (\d+)\s*ft\.(.*?)$/i.exec(loc.entries[0]);
				if (!mSpeed) return null;

				let [_, subMode, baseSpeed, conditionOrOtherSpeeds] = mSpeed;
				subMode = subMode.trim(); // This appears to be a repetition of the name; ignore it
				baseSpeed = baseSpeed.trim();
				conditionOrOtherSpeeds = conditionOrOtherSpeeds.trim();

				const otherPartsRaw = conditionOrOtherSpeeds.split(";").map(it => it.trim()).filter(Boolean);
				const [conditionPart, ...otherParts] = conditionOrOtherSpeeds.includes(";")
					? ["", ...otherPartsRaw]
					: otherPartsRaw;

				const outPrimary = {
					speed: Config.getMetricNumber({configGroup: "importVehicle", originalUnit: UNT_FEET, originalValue: Number(baseSpeed)}),
				};
				if (conditionPart) outPrimary.condition = conditionPart;

				const outSecondaries = [];
				otherParts.forEach(part => {
					const mSpeed = /^(\d+)\s*ft\.(.*?)$/.exec(part);
					if (!mSpeed) return;
					outSecondaries.push({
						speed: Config.getMetricNumber({configGroup: "importVehicle", originalUnit: UNT_FEET, originalValue: Number(mSpeed[1])}),
						condition: mSpeed[2],
					});
				});

				return [outPrimary, ...outSecondaries];
			})
			.filter(Boolean)
			.flat();
	}

	static async pGetShipWeaponItem (veh, weap) {
		const description = await DataConverter.pGetEntryDescription(weap);

		const {
			damageTupleMetas,
			isAttack,
			rangeShort,
			rangeLong,
			actionType,
			attackBonus,
		} = DataConverter.getParsedWeaponEntryData(veh, weap);

		const {damageParts, formula} = DataConverter.getDamagePartsAndOtherFormula(damageTupleMetas);

		return {
			name: weap.name,
			type: "weapon",
			data: {
				description: {value: description, chat: "", unidentified: ""},
				source: UtilDataConverter.getSourceWithPagePart(veh),
				quantity: weap.count || 1,
				weight: 0,
				price: 0,
				attuned: false,
				equipped: true,
				rarity: "",
				identified: true,
				activation: {type: isAttack ? "action" : "", cost: isAttack ? 1 : 0, condition: ""},
				duration: {value: null, units: ""},
				target: {value: null, width: null, units: "", type: ""},
				range: {value: rangeShort || 0, long: rangeLong || 0, units: "ft"},
				uses: {value: 0, max: 0, per: null},
				consume: {type: "", target: null, amount: null},
				ability: "",
				actionType: actionType || "other",
				attackBonus: attackBonus || null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				damage: {parts: damageParts || [], versatile: ""},
				formula,
				save: {ability: "", dc: null, scaling: "spell"},
				armor: {value: weap.ac || 0},
				hp: {value: weap.hp || 0, max: weap.hp || 0, dt: weap.dt, conditions: ""},
				weaponType: "siege",
				properties: {},
				proficient: true,
			},
			flags: {},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				`modules/${SharedConsts.MODULE_NAME}/media/icon/pirate-cannon.svg`,
			),
			effects: [],
		};
	}

	static async pGetShipOtherItem (veh, ent) {
		const description = await DataConverter.pGetEntryDescription(ent);

		if (/^Actions?$/i.test(ent.name || "")) {
			return {
				name: ent.name,
				type: "feat",
				data: {
					description: {value: description, chat: "", unidentified: ""},
					source: UtilDataConverter.getSourceWithPagePart(veh),
					activation: {type: "crew", cost: 1, condition: ""},
					duration: {value: null, units: ""},
					target: {value: null, width: null, units: "", type: ""},
					range: {value: null, long: null, units: ""},
					uses: {value: 0, max: 0, per: ""},
					consume: {type: "", target: "", amount: null},
					ability: null,
					actionType: "",
					attackBonus: null,
					chatFlavor: "",
					critical: {threshold: null, damage: ""},
					damage: {parts: [], versatile: ""},
					formula: "",
					save: {ability: "", dc: null, scaling: "spell"},
					requirements: "",
					recharge: {value: null, charged: false},
					cover: null,
				},
				flags: {},
				img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
					`modules/${SharedConsts.MODULE_NAME}/media/icon/ship-wheel.svg`,
				),
			};
		}

		return {
			name: ent.name,
			type: "feat",
			data: {
				description: {value: description, chat: "", unidentified: ""},
				source: UtilDataConverter.getSourceWithPagePart(veh),
				activation: {type: "", cost: 0, condition: ""},
				duration: {value: null, units: ""},
				target: {value: null, width: null, units: "", type: ""},
				range: {value: null, long: null, units: ""},
				uses: {value: 0, max: 0, per: null},
				consume: {type: "", target: null, amount: null},
				ability: null,
				actionType: "",
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				damage: {parts: [], versatile: ""},
				formula: "",
				save: {ability: "", dc: null, scaling: "spell"},
				requirements: "",
				recharge: {value: null, charged: false},
			},
			flags: {},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				`modules/${SharedConsts.MODULE_NAME}/media/icon/ship-wheel.svg`,
			),
		};
	}

	static async pGetShipActionItems (veh, actionEnts) {
		const ixActionList = actionEnts.findIndex(it => it.type === "list" && it.items.every(it => it.type === "item"));

		const templateOut = {
			name: "",
			type: "feat",
			data: {
				description: {value: "", chat: "", unidentified: ""},
				source: UtilDataConverter.getSourceWithPagePart(veh),
				activation: {type: "crew", cost: 1, condition: ""},
				duration: {value: null, units: ""},
				target: {value: null, width: null, units: "", type: ""},
				range: {value: null, long: null, units: ""},
				uses: {value: 0, max: 0, per: ""},
				consume: {type: "", target: "", amount: null},
				ability: null,
				actionType: "",
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				damage: {parts: [], versatile: ""},
				formula: "",
				save: {ability: "", dc: null, scaling: "spell"},
				requirements: "",
				recharge: {value: null, charged: false},
				cover: null,
			},
			flags: {},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				`modules/${SharedConsts.MODULE_NAME}/media/icon/ship-wheel.svg`,
			),
		};

		if (!~ixActionList) {
			templateOut.name = "Actions";
			templateOut.data.description.value = await DataConverter.pGetEntryDescription({entries: actionEnts});
			return [templateOut];
		}

		actionEnts = MiscUtil.copy(actionEnts);
		const actionList = actionEnts[ixActionList];
		actionEnts.splice(ixActionList, 1);

		return actionList.items.pSerialAwaitMap(async li => {
			const subName = li.name.replace(/\.$/i, "");

			const fauxEntries = MiscUtil.copy(actionEnts);
			if (typeof fauxEntries[0] === "string") fauxEntries[0] = fauxEntries[0].replace(/, choosing from the options below[.:]/ig, ".");
			fauxEntries.unshift({type: "entries", name: subName, entries: li.entries || [li.entry]});

			const description = await DataConverter.pGetEntryDescription({entries: fauxEntries});

			const subOut = MiscUtil.copy(templateOut);
			subOut.name = subName;
			subOut.data.description.value = description;
			return subOut;
		});
	}

	static async pGetInfWarActionItem (veh, action) {
		const description = await DataConverter.pGetEntryDescription(action);

		const {
			damageTupleMetas,
			isAttack,
			rangeShort,
			rangeLong,
			actionType,
			attackBonus,
		} = DataConverter.getParsedWeaponEntryData(veh, action);

		const {damageParts, formula} = DataConverter.getDamagePartsAndOtherFormula(damageTupleMetas);

		let coverType = 0;
		(action.name || "").replace(/(Grants Half Cover|Grants Three-Quarters Cover|Grants Total Cover)/ig, (...m) => {
			const low = m[1].toLowerCase().trim();
			switch (low) {
				case "grants half cover": coverType = 0.5; break;
				case "grants three-quarters cover": coverType = 0.75; break;
				case "grants total cover": coverType = 1; break;
				default: throw new Error(`Unknown cover type ""${low}`);
			}
		});

		return {
			name: action.name,
			type: "feat",
			data: {
				description: {value: description, chat: "", unidentified: ""},
				source: UtilDataConverter.getSourceWithPagePart(veh),
				activation: {type: "crew", cost: 1, condition: ""},
				duration: {value: null, units: ""},
				target: {value: null, width: null, units: "", type: ""},
				range: {value: rangeShort, long: rangeLong, units: "ft"},
				uses: {value: 0, max: 0, per: ""},
				consume: {type: "", target: "", amount: null},
				ability: "",
				actionType: actionType || "other",
				attackBonus: attackBonus || null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				damage: {parts: damageParts || [], versatile: ""},
				formula,
				save: {ability: "", dc: null, scaling: "spell"},
				requirements: "",
				recharge: {value: null, charged: false},
				cover: coverType,
			},
			flags: {},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				`modules/${SharedConsts.MODULE_NAME}/media/icon/gears.svg`,
			),
		};
	}
}

export {DataConverterVehicle};
