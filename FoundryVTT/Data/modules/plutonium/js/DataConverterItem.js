import {SharedConsts} from "../shared/SharedConsts.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {Config} from "./Config.js";
import {UtilApplications} from "./UtilApplications.js";
import {DataConverter} from "./DataConverter.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {UtilCompat} from "./UtilCompat.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterItem {
	static async pGetActionWeaponDetails ({size, action, damageParts, isSiegeWeapon, isMagical}) {
		await Renderer.item.populatePropertyAndTypeReference();

		await this._pGetActionWeaponDetails_initCaches();

		let damageVersatile = "";
		let damageCritical = "";
		let critThreshold = null;
		let weight = 0;
		let price = null;
		let img = null;
		let rarity = "";
		let weaponType = isSiegeWeapon ? "siege" : "natural";
		let weaponBaseItem = null;
		let itemProperties = {};
		let attuned = false;
		let attunement = 0;
		let identified = false;
		let attackBonus = 0;

		const weaponLookupName = (action.name || "")
			.replace(/\(.*\)$/, "") // remove parenthetical text (e.g. "(Humanoid or Hybrid Form Only)" off the end
			.toLowerCase()
		;

		const weapon = DataConverterItem._WEAPON_DETAIL_CACHE[weaponLookupName] ? MiscUtil.copy(DataConverterItem._WEAPON_DETAIL_CACHE[weaponLookupName]) : null;

		if (weapon) {
			const {weight: tmpWeight, price: tmpPrice} = DataConverterItem._pGetItemItem_getWeightPriceRange(weapon, size);
			weight = tmpWeight;
			price = tmpPrice;

			rarity = this._getItemItem_getRarity(weapon);

			const weaponTypeAndAbility = this._getWeaponTypeBaseAndAbility(weapon);
			weaponType = weaponTypeAndAbility.weaponType;
			weaponBaseItem = weaponTypeAndAbility.weaponBaseItem;

			itemProperties = this._getWeaponProperties(weapon);

			const {isAttuned, isIdentified, attunement: tmpAttunement} = await this._pGetItemItem_pGetAttunedIdentifiedEquipped(weapon);
			attuned = attuned || isAttuned;
			attunement = attunement || tmpAttunement;
			identified = identified || isIdentified;

			// Custom attribute applied by the cache loader--not saved locally until this point
			img = weapon._fvttImage || img;

			if (weapon.bonusWeapon && !isNaN(weapon.bonusWeapon)) attackBonus = Number(weapon.bonusWeapon);
			// This is more specific, so can override the generic "bonusWeapon" prop
			if (weapon.bonusWeaponAttack && !isNaN(weapon.bonusWeaponAttack)) attackBonus = Number(weapon.bonusWeapon);

			if (weapon.bonusWeaponCritDamage) damageCritical = weapon.bonusWeaponCritDamage;
			if (weapon.critThreshold != null) critThreshold = weapon.critThreshold;
		}

		// region Versatile
		if (damageParts.length > 1 && ((weapon && (weapon.property || []).includes("V")) || / (?:two|both) hands/i.test(JSON.stringify(action.entries || [])))) {
			// Find the first damage term that has the same type as the main (first) damage term
			const damageTypePrimary = damageParts[0][1];
			if (damageTypePrimary) {
				const ixDamagePartVersatile = damageParts.slice(1).findIndex(it => it[1] === damageTypePrimary);
				if (~ixDamagePartVersatile) {
					damageParts = MiscUtil.copy(damageParts);
					const [damagePartVersatile] = damageParts.splice(ixDamagePartVersatile + 1, 1);
					damageVersatile = damagePartVersatile[0];
				}
			}
		}
		// endregion

		// region Additional properties
		if (isMagical) itemProperties.mgc = true;
		// endregion

		return {
			damageParts,
			damageVersatile,
			damageCritical,
			critThreshold,
			weight,
			price,
			img,
			rarity,
			weaponType,
			weaponBaseItem,
			itemProperties,
			attuned,
			attunement,
			identified,
			attackBonus,
		};
	}

	static async _pGetActionWeaponDetails_initCaches () {
		if (DataConverterItem._WEAPON_DETAIL_CACHE_INIT) return;

		await DataConverterItem._WEAPON_DETAIL_CACHE_LOCK.pLock();
		try {
			if (DataConverterItem._WEAPON_DETAIL_CACHE_INIT) return;

			console.log(...LGT, "Pre-caching item lookup...");

			// Build a cache of all the items and their fluff
			const {item: items} = await Vetools.pGetItems();

			for (const item of items) {
				if (item.type === "GV") continue;

				const lowName = item.name.toLowerCase();
				// If there's e.g. a " +1" suffix on the end, make a copy with it as a prefix instead
				const prefixBonusKey = lowName.replace(/^(.*?)( \+\d+$)/, (...m) => `${m[2].trim()} ${m[1].trim()}`);

				const itemKeys = [
					lowName,
					prefixBonusKey === lowName ? null : prefixBonusKey,
				].filter(Boolean);

				const cpy = MiscUtil.copy(item);
				const procFluff = await Renderer.item.pGetFluff(cpy);
				cpy._fvttImage = await DataConverterItem._pGetItemItem_pGetImagePath(cpy, procFluff);

				itemKeys.forEach(k => {
					if (!DataConverterItem._WEAPON_DETAIL_CACHE[k]) {
						DataConverterItem._WEAPON_DETAIL_CACHE[k] = cpy;
						return;
					}

					// If there is already something in the cache, prefer DMG + PHB entries, then official sources
					const existing = DataConverterItem._WEAPON_DETAIL_CACHE[k];
					if (
						!(existing.source === SRC_DMG || existing.source === SRC_PHB)
						&& SourceUtil.isNonstandardSource(existing.source)
					) {
						DataConverterItem._WEAPON_DETAIL_CACHE[k] = cpy;
					}
				});
			}

			console.log(...LGT, "Pre-caching complete.");

			DataConverterItem._WEAPON_DETAIL_CACHE_INIT = true;
		} finally {
			DataConverterItem._WEAPON_DETAIL_CACHE_LOCK.unlock();
		}
	}

	/**
	 *
	 * @param item The item entry.
	 * @param [opts] Options object.
	 * @param [opts.fluff] Item fluff.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @param [opts.quantity]
	 * @param [opts.isEquipped]
	 * @param [opts.size] Creature this item is to be sized for.
	 * @param [opts.sheetItemsAmmo] Actor sheet items
	 * @param [opts.filterValues] Pre-baked filter values to be re-used when importing this from the item.
	 * @param [opts.dexMod] Pre-baked dexterity modifier to use in the place of a dynamic variable when creating active effects.
	 * @param [opts.isActorItem]
	 * @return {object}
	 */
	static async pGetItemItem (item, opts) {
		opts = opts || {};

		await Renderer.item.populatePropertyAndTypeReference();

		const entriesStr = item.entries ? JSON.stringify(item.entries) : "";

		// Treat item groups as "loot," which is a catch-all for "things with no specific properties"
		if (item._isItemGroup) return this._pGetItemItem_loot(item, opts, entriesStr);

		let out;
		if (await this._pIsInSrd(item)) {
			out = await this._pGetItemItem_fromSrd(item, opts, entriesStr);
		} else {
			const importType = await this._pGetItemImporterType(item);

			switch (importType) {
				case DataConverterItem._IMPORT_TYPE_WEAPON: out = await this._pGetItemItem_weapon(item, opts, entriesStr); break;
				case DataConverterItem._IMPORT_TYPE_TOOL: out = await this._pGetItemItem_tool(item, opts, entriesStr); break;
				case DataConverterItem._IMPORT_TYPE_CONSUMABLE: out = await this._pGetItemItem_consumable(item, opts, entriesStr); break;
				case DataConverterItem._IMPORT_TYPE_EQUIPMENT: out = await this._pGetItemItem_equipment(item, opts, entriesStr); break;
				case DataConverterItem._IMPORT_TYPE_CONTAINER: out = await this._pGetItemItem_container(item, opts, entriesStr); break;
				case DataConverterItem._IMPORT_TYPE_LOOT: out = await this._pGetItemItem_loot(item, opts, entriesStr); break;
				default: throw new Error(`Unhandled importer type "${importType}"`);
			}
		}

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importItem", "permissions")};

		return out;
	}

	static async _pGetItemImporterType (item) {
		const sideLoadedType = await this._pGetSideLoadedType(item);
		if (sideLoadedType != null) return sideLoadedType;

		// Anything with damage, treat as a weapon
		if (item.dmg1) return DataConverterItem._IMPORT_TYPE_WEAPON;

		if (
			item.type === "AT" // Artisan's Tool
			|| item.type === "T" // Tool
			|| item.type === "INS" // Instrument
			|| item.type === "GS" // Gaming Set
		) return DataConverterItem._IMPORT_TYPE_TOOL;

		if (
			item.type === "P" // Potion
			|| item.type === "SC" // Scroll
			|| (item.type === "WD" && item.charges) // Wand
			|| (item.type === "RD" && item.charges) // Rod
			|| (item.type === "G" && item.charges) // Adventuring gear
			|| item.poison
			|| item.type === "A" // Ammunition
			|| item.type === "AF" // Ammunition [futuristic]
			|| item.type === "EXP"
		) return DataConverterItem._IMPORT_TYPE_CONSUMABLE;

		if (
			item.type === "HA" // Heavy armor
			|| item.type === "MA" // Medium armor
			|| item.type === "LA" // Light armor
			|| item.type === "S" // Shield
			|| item.bardingType // Barding
		) return DataConverterItem._IMPORT_TYPE_EQUIPMENT;

		if (item.containerCapacity) return DataConverterItem._IMPORT_TYPE_CONTAINER;

		// Classify some "other" items as "trinket"-type equipment
		//  - Items with +AC/+Saving Throw/etc. bonuses (e.g. cloak of protection)
		//  - Ability score modifying items (e.g. belt of giant strength)
		//  - All other wondrous items, as there are few examples that couldn't in some way be seen as "equipment"
		if (
			item.bonusAc
			|| item.bonusSavingThrow
			|| item.bonusAbilityCheck
			|| item.bonusSpellAttack
			|| item.bonusSpellAttack
			|| item.bonusSpellSaveDc
			|| item.bonusProficiencyBonus
			|| item.ability
			|| item.wondrous
		) return DataConverterItem._IMPORT_TYPE_EQUIPMENT;

		// Try to process various equipment-sounding item names as equipment (e.g. rings, bracers)
		if (this._ITEM_EQUIPMENT_NAME_RES.some(it => it.test(item.name))) return DataConverterItem._IMPORT_TYPE_EQUIPMENT;

		// Treat everything else as loot
		return DataConverterItem._IMPORT_TYPE_LOOT;
	}

	static async _pIsInSrd (item) {
		const srdData = await UtilCompendium.getSrdCompendiumEntity("item", item, {fnGetAliases: this.getItemSrdAliases});
		return !!srdData;
	}

	static getItemSrdAliases (entity) {
		if (!entity.name) return [];

		const out = [];

		// Shitty pluralization--allows conversion of e.g. "Arrow" -> "Arrows" (the SRD name is plural, despite being
		//   a single arrow).
		out.push(`${entity.name}s`);

		if (entity.name.toLowerCase().includes("feet")) out.push(entity.name.replace(/feet/g, "ft."));

		// e.g. "Wand of the War Mage, +1" -> "Wand of the War Mage +1"
		// Note that this also "fixes" 5etools' "shield, +1" being a generic variant, whereas "shield +1" is the specific variant.
		//   If anybody ever decides the generic variant is what they wanted to import, they'll be in for a bad time, but
		//   that's an acceptable loss to reduce the very-reasonable support requests this generates.
		if (entity.name.includes(", ")) out.push(entity.name.replace(/, /g, " "));

		// "Holy Water (Flask)" -> "Flask of Holy Water"
		const mBrackets = /^([^(]+) \(([^)]+)\)$/.exec(entity.name.trim());
		if (mBrackets) out.push(`${mBrackets[2]} of ${mBrackets[1]}`);

		// "Oil (Flask)" -> "Oil Flask"
		if (mBrackets) out.push(`${mBrackets[1]} ${mBrackets[2]}`);

		// "Rations (1 day)" -> "Rations"
		if (mBrackets) out.push(mBrackets[1]);

		return out;
	}

	static _getItemFlags (item, opts) {
		opts = opts || {};

		const out = {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: UrlUtil.PG_ITEMS,
				source: item.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](item),
			},
		};

		if (opts.isAddDataFlags) {
			out[SharedConsts.MODULE_NAME_FAKE].propDroppable = "item";
			out[SharedConsts.MODULE_NAME_FAKE].filterValues = opts.filterValues;
		}

		return out;
	}

	static async _pGetItemItem_fromSrd (item, opts, entriesStr) {
		const rangeMeta = this._getWeaponRange(item);
		const {weight, price, rangeShort, rangeUnits, rangeLong} = this._pGetItemItem_getWeightPriceRange(item, opts.size, rangeMeta);
		const {isAttuned, isIdentified, isEquipped, attunement} = await this._pGetItemItem_pGetAttunedIdentifiedEquipped(item);
		const {consumeType, consumeTarget, consumeAmount} = this._pGetItemItem_getAmmoConsumeDetails(item, opts);

		const srdData = await UtilCompendium.getSrdCompendiumEntity("item", item, {fnGetAliases: this.getItemSrdAliases});

		const consume = {...(srdData.data.consume || {})};
		consume.type = consume.type || consumeType;
		consume.target = consume.target || consumeTarget;
		consume.amount = consume.amount || consumeAmount;

		const additionalData = await this._pGetAdditionalData(item);
		const additionalFlags = await this._pGetAdditionalFlags(item);

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await DataConverterItem._pGetItemItem_pGetImagePath(item, opts.fluff),
		);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(item, {isActorItem: opts.isActorItem})),
			type: srdData.type,
			data: {
				...srdData.data,

				source: UtilDataConverter.getSourceWithPagePart(item),
				description: {value: await DataConverterItem._getItemItem_pGetItemDescription(item), chat: "", unidentified: ""},

				proficient: true,
				quantity: opts.quantity != null ? opts.quantity : (item.quantity || 1),
				weight,
				price,
				attuned: isAttuned,
				identified: isIdentified,
				equipped: opts.isEquipped ?? isEquipped,
				rarity: this._getItemItem_getRarity(item),
				consume,
				range: {value: rangeShort, long: rangeLong, units: rangeUnits},

				attunement,

				...(additionalData || {}),
			},
			img,
			flags: {
				...this._getItemFlags(item, opts),
				...additionalFlags,
			},
			effects: [
				// Avoid adding the SRD effects (e.g. with `...MiscUtil.copy(srdData.effects || []),`) since we don't
				//   want e.g. Ring of Protection to import with two sets of "bonus AC" effects.
				...await this._pGetItemEffects(item, img, opts),
			],
		};
	}

	static _pGetItemItem_getWeightPriceRange (item, size, {rangeShort, rangeLong, rangeUnits} = {}) {
		let weight = null;
		let price = null;
		let tmpValue = null;

		if (size == null || size === SZ_MEDIUM) {
			return {
				weight: Config.getMetricNumber({configGroup: "importItem", originalValue: item.weight || 0, originalUnit: "lb"}),
				price: !isNaN(item.value) ? item.value / 100 : null,
				rangeShort: Config.getMetricNumber({configGroup: "importItem", originalValue: rangeShort || 0, originalUnit: "ft"}),
				rangeLong: Config.getMetricNumber({configGroup: "importItem", originalValue: rangeLong || 0, originalUnit: "ft"}),
				rangeUnits: Config.getMetricUnit({configGroup: "importItem", originalUnit: rangeUnits}),
			};
		}

		const weightValueScalingMode = Config.get("importCreature", "itemWeightAndValueSizeScaling");

		switch (weightValueScalingMode) {
			// No scaling
			case 1: {
				weight = item.weight || 0;
				tmpValue = item.value;
				break;
			}

			// Multiplicative ("barding") scaling
			case 2: {
				const weightMult = DataConverterItem._SIZE_TO_ITEM_WEIGHT_MULT[size] || 1;
				const valueMult = DataConverterItem._SIZE_TO_ITEM_VALUE_MULT[size] || 1;

				if (item.weight && !isNaN(item.weight)) {
					weight = Number(item.weight) * weightMult;
				}

				if (item.value && !isNaN(item.value)) {
					tmpValue = item.value * valueMult;
				}

				break;
			}

			// Exponential ("gurt's greataxe") scaling
			case 3: {
				const exponent = DataConverterItem._SIZE_TO_ITEM_WEIGHT_AND_VALUE_EXPONENT[size] || 1;

				if (item.weight && !isNaN(item.weight)) {
					weight = Math.floor(item.weight ** exponent);
				}

				if (item.value && !isNaN(item.value)) {
					const factor = item.value < 10 ? 1 : item.value < 100 ? 10 : 100;

					// Convert the value to it's output currency
					tmpValue = item.value / factor;

					// Run the exponentiation on the output currency value, to avoid ridiculous numbers
					tmpValue = Math.floor(tmpValue ** exponent);

					// Convert back to copper prior to running the parsing conversion
					tmpValue *= factor;
				}

				break;
			}
		}

		// Currently (2020-04-26), Foundry does not support units in this field, so convert everything to gold
		if (tmpValue) price = tmpValue / 100;

		return {
			weight: Config.getMetricNumber({configGroup: "importItem", originalValue: weight || 0, originalUnit: "lb"}),
			price,

			// Maintain range values regardless of size, as we don't have any data on how they scale
			rangeShort: Config.getMetricNumber({configGroup: "importItem", originalValue: rangeShort || 0, originalUnit: "ft"}),
			rangeLong: Config.getMetricNumber({configGroup: "importItem", originalValue: rangeLong || 0, originalUnit: "ft"}),
			rangeUnits: Config.getMetricUnit({configGroup: "importItem", originalUnit: rangeUnits}),
		};
	}

	static async _pGetItemItem_pGetAttunedIdentifiedEquipped (item) {
		// If it's a magic item, mark it as identified
		// If it's a magic item that requires attunement, mark it as attuned
		const isMundane = item.rarity === "none" || item.rarity === "unknown" || item._category === "basic";
		const isAttuned = !isMundane && !!item.reqAttune;

		let isEquipped;
		const importType = await this._pGetItemImporterType(item);
		switch (importType) {
			case DataConverterItem._IMPORT_TYPE_WEAPON: isEquipped = true; break;
			case DataConverterItem._IMPORT_TYPE_TOOL: isEquipped = false; break;
			case DataConverterItem._IMPORT_TYPE_CONSUMABLE: isEquipped = false; break;
			case DataConverterItem._IMPORT_TYPE_EQUIPMENT: isEquipped = true; break;
			case DataConverterItem._IMPORT_TYPE_CONTAINER: isEquipped = false; break;
			case DataConverterItem._IMPORT_TYPE_LOOT: isEquipped = false; break;
			default: throw new Error(`Unhandled importer type "${importType}"`);
		}

		return {
			isAttuned,
			// As of dnd5e v1.2.0, attunement cannot be e.g. "by <X class>", and instead is a numerical enum
			attunement: item.reqAttune ? Config.get("importItem", "attunementType") : CONFIG.DND5E.attunementTypes.NONE,
			isIdentified: !isMundane,
			isEquipped,
		};
	}

	static _getItemItem_pGetItemDescription (item) {
		if (!Config.get("importItem", "isImportDescription")) return "";

		return UtilDataConverter.pGetWithDescriptionPlugins(
			() => this._getItemItem_pGetItemDescription_(item),
		);
	}

	static _getItemItem_pGetItemDescription_ (item) {
		// Render everything in the header, as Foundry doesn't have support for e.g. rarity or attunement
		const [damage, damageType, propertiesTxt] = Renderer.item.getDamageAndPropertiesText(item);
		const [typeRarityText, subTypeText, tierText] = Renderer.item.getTypeRarityAndAttunementText(item);

		const headerPart = Config.get("importItem", "isImportDescriptionHeader") ? `<div>
			${Renderer.item.getTypeRarityAndAttunementHtml(typeRarityText, subTypeText, tierText)}
				<div class="ve-flex w-100">
					<div class="col-4">${[Parser.itemValueToFull(item), Parser.itemWeightToFull(item)].filter(Boolean).join(", ").uppercaseFirst()}</div>
					<div class="col-8 text-right">${damage} ${damageType} ${propertiesTxt}</div>
				</div>
			</div>
		<hr>` : "";

		const bodyPart = Renderer.item.getRenderedEntries(
			item,
			{
				isCompact: true,
				wrappedTypeWhitelist: Config.get("importItem", "isImportDescriptionHeader") ? null : new Set(["variant"]),
			},
		);

		return `${headerPart}
		${bodyPart}`;
	}

	static _getItemItem_getItemUses (item) {
		let charges = null;

		if (item.charges) {
			if (isNaN(item.charges)) {
				const mDice = /{@dice (\d)+d(\d+)\s*(?:[-+]\s*\d+)?}/i.exec(item.charges);
				if (mDice) {
					charges = (Number(mDice[1]) * Number(mDice[2])) + (mDice[3] ? Number(mDice[3].replace(/\s*/g, "")) : 0);
				}
			} else charges = item.charges;
		}

		const usesPer = UtilDataConverter.getFvttUsesPer(item.recharge);

		return {uses: charges, usesPer};
	}

	static _getItemItem_getRarity (item) {
		const rawRarity = `${(item.rarity || "unknown")}`.toLowerCase().trim();

		switch (rawRarity) {
			case "common": return "common";
			case "uncommon": return "uncommon";
			case "rare": return "rare";
			case "very rare": return "veryRare";
			case "legendary": return "legendary";
			case "artifact": return "artifact";
			default: return "";
		}
	}

	static _getWeaponTypeBaseAndAbility (item) {
		let weaponType = "";
		let weaponAbility = "str";

		if (item.type === "A" || item.type === "AF") {
			weaponType = "ammo";
			weaponAbility = "dex";
		} else if (item.type === "M" || item.type === "R") {
			if ((item.weaponCategory || "").toLowerCase() === "martial") weaponType = `martial${item.type}`;
			else if ((item.weaponCategory || "").toLowerCase() === "simple") weaponType = `simple${item.type}`;
		}

		if (item.type === "R") weaponAbility = "dex";
		else if (item.property && item.property.includes("F")) weaponAbility = "dex"; // Finesse

		const weaponBaseItem = this._getBaseItem({item, weaponType});

		return {weaponType, weaponAbility, weaponBaseItem};
	}

	static _getBaseItem ({item, weaponType = null, armorType = null, toolType = null}) {
		// N.B.: the accepted types are limited by e.g. `weaponType` (see e.g. `_getItemBaseTypes` in dnd5e).
		//   We ignore this, for simplicity's sake, but it may need to be implemented in the future.

		let baseNameLower;
		let baseSourceLower;

		if (item.baseItem && typeof item.baseItem === "string") {
			let [name, source] = item.baseItem.toLowerCase().trim().split("|").map(it => it.trim());
			source = source || SRC_DMG.toLowerCase();

			baseNameLower = name;
			baseSourceLower = source;
		}

		if (item._baseName && item._baseSource) {
			baseNameLower = item._baseName.toLowerCase();
			baseSourceLower = item._baseSource.toLowerCase();
		}

		// dnd5e supports a limited set of base types; map to one if we can
		if (baseSourceLower !== SRC_PHB.toLowerCase() && baseSourceLower !== SRC_DMG.toLowerCase()) return null;

		if (weaponType) {
			const key = this._getWeaponIdKey({nameLower: baseNameLower});
			if (CONFIG.DND5E.weaponIds?.[key]) return key;
		} else if (armorType) {
			const key = this._getArmorShieldIdKey({nameLower: baseNameLower});
			if (CONFIG.DND5E.shieldIds?.[key] || CONFIG.DND5E.armorIds?.[key]) return key;
		} else if (toolType) {
			const key = this._getToolIdKey({nameLower: baseNameLower});
			if (CONFIG.DND5E.toolIds?.[key]) return key;
		}

		return null;
	}

	static _getWeaponRange (item) {
		let rangeShort = 0;
		let rangeLong = 0;
		let rangeUnits = "ft";
		if (item.range) {
			const cleanRange = `${item.range}`.trim();
			const mRangeLong = /^(\d+)\/(\d+)$/i.exec(cleanRange);
			if (mRangeLong) {
				rangeShort = Number(mRangeLong[1]);
				rangeLong = Number(mRangeLong[2]);
			}

			const mRangeNum = /^(\d+)$/i.exec(cleanRange);
			if (mRangeNum) rangeShort = Number(mRangeNum[1]);
		} else if (item.property && item.property.includes("R")) { // Add a default 10 foot range for reach melee weapons
			rangeShort = 10;
		} else { // Add a default 5 foot range for melee weapons
			rangeShort = 5;
		}

		return {rangeShort, rangeLong, rangeUnits};
	}

	static _getWeaponProperties (item) {
		const out = item.property ? item.property.map(it => DataConverterItem._ITEM_PROP_MAP[it]).filter(Boolean).map(it => ({[it]: true})).reduce((a, b) => Object.assign(a, b), {}) : {};

		if (item._variantName === "Adamantine Weapon" || item._variantName === "Adamantine Armor" || item._variantName === "Adamantine Ammunition") out.ada = true; // Adamantine
		if (item.focus) out.foc = true; // Focus
		if (!Renderer.item.isMundane(item)) out.mgc = true; // Magical
		if (item._variantName === "Silvered Weapon" || item._variantName === "Silvered Ammunition") out.sil = true; // Silvered
		if (item.firearm) out.fir = true; // Firearm

		return out;
	}

	static async _pGetItemItem_weapon (item, opts, entriesStr) {
		const {weaponType, weaponAbility, weaponBaseItem} = this._getWeaponTypeBaseAndAbility(item);
		const rangeMeta = this._getWeaponRange(item);
		const {weight, price, rangeShort, rangeLong, rangeUnits} = this._pGetItemItem_getWeightPriceRange(item, opts.size, rangeMeta);
		const {isAttuned, isIdentified, isEquipped, attunement} = await this._pGetItemItem_pGetAttunedIdentifiedEquipped(item);
		const {consumeType, consumeTarget, consumeAmount} = this._pGetItemItem_getAmmoConsumeDetails(item, opts);

		// When the sheet renders, it splits this string by comma
		const itemProperties = this._getWeaponProperties(item);

		// Bonuses need to be manually applied to damage as well as the generic "bonus" field for on-hit
		let dmg1 = "";
		if (item.dmg1) {
			dmg1 = item.dmg1;
			if (item.bonusWeapon) dmg1 = `${dmg1}${item.bonusWeapon}`;
			else if (item.bonusWeaponDamage) dmg1 = `${dmg1}${item.bonusWeaponDamage}`;
			dmg1 = `${dmg1}+@mod`;
		}

		let dmg2 = "";
		if (item.dmg2) {
			dmg2 = item.dmg2;
			if (item.bonusWeapon) dmg2 = `${dmg2}${item.bonusWeapon}`;
			else if (item.bonusWeaponDamage) dmg2 = `${dmg2}${item.bonusWeaponDamage}`;
			dmg2 = `${dmg2}+@mod`;
		}

		const {uses, usesPer} = this._getItemItem_getItemUses(item);

		const additionalData = await this._pGetAdditionalData(item);
		const additionalFlags = await this._pGetAdditionalFlags(item);

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await DataConverterItem._pGetItemItem_pGetImagePath(item, opts.fluff),
		);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(item, {isActorItem: opts.isActorItem})),
			type: "weapon",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(item),
				description: {value: await DataConverterItem._getItemItem_pGetItemDescription(item), chat: "", unidentified: ""},

				proficient: true,
				quantity: opts.quantity || item.quantity || 1,
				weight,
				price,
				attuned: isAttuned,
				identified: isIdentified,
				equipped: opts.isEquipped ?? isEquipped,
				rarity: this._getItemItem_getRarity(item),

				damage: {
					parts: [
						[dmg1, item.dmgType ? Parser.dmgTypeToFull(item.dmgType) : ""],
					],
					versatile: dmg2,
				},
				range: {value: rangeShort, long: rangeLong, units: rangeUnits},
				weaponType: weaponType,
				baseItem: weaponBaseItem,
				ability: weaponAbility,
				properties: itemProperties,

				attunement,

				activation: {type: "action", cost: 1, condition: this._getItemItem_getActivationCondition({item, entriesStr})},
				duration: {value: 0, units: ""},
				target: {value: 0, units: "", type: ""},
				uses: {value: uses, max: uses, per: usesPer},
				actionType: item.type === "R" ? "rwak" : "mwak",
				attackBonus: item.bonusWeapon || item.bonusWeaponAttack || null,
				chatFlavor: "",
				critical: {
					damage: item.bonusWeaponCritDamage ?? "",
					threshold: item.critThreshold ?? null,
				},

				formula: "",
				save: {ability: "", dc: 0, scaling: "spell"},
				consume: {type: consumeType, target: consumeTarget, amount: consumeAmount},

				hp: {value: 0, max: 0, dt: null, conditions: ""},
				speed: {value: null, conditions: ""},

				...(additionalData || {}),
			},
			img,
			flags: {
				...this._getItemFlags(item, opts),
				...additionalFlags,
			},
			effects: await this._pGetItemEffects(item, img, opts),
		};
	}

	static async _pGetItemItem_equipment (item, opts, entriesStr) {
		const {weight, price} = this._pGetItemItem_getWeightPriceRange(item, opts.size);
		const {isAttuned, isIdentified, isEquipped, attunement} = await this._pGetItemItem_pGetAttunedIdentifiedEquipped(item);

		const {acValue, maxDexBonus} = this._getItemAcMeta(item);

		const {uses, usesPer} = this._getItemItem_getItemUses(item);
		const armorType = DataConverterItem._ITEM_TYPE_TO_ARMOR_TYPE[item.bardingType ?? item.type] || "trinket";
		const baseItem = this._getBaseItem({item, armorType});

		const activationCondition = this._getItemItem_getActivationCondition({item, entriesStr});

		const additionalData = await this._pGetAdditionalData(item);
		const additionalFlags = await this._pGetAdditionalFlags(item);

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await DataConverterItem._pGetItemItem_pGetImagePath(item, opts.fluff),
		);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(item, {isActorItem: opts.isActorItem})),
			type: "equipment",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(item),
				description: {value: await DataConverterItem._getItemItem_pGetItemDescription(item), chat: "", unidentified: ""},

				proficient: true,
				quantity: opts.quantity || item.quantity || 1,
				weight,
				price,
				attuned: isAttuned,
				identified: isIdentified,
				equipped: opts.isEquipped ?? isEquipped,
				rarity: this._getItemItem_getRarity(item),

				attunement,

				activation: {type: (activationCondition || uses || usesPer) ? "special" : "", cost: 0, condition: activationCondition},
				duration: {value: null, units: ""},
				target: {value: null, units: "", type: ""},
				range: {value: null, long: null, units: ""},
				uses: {value: uses, max: uses, per: usesPer},
				ability: "",
				actionType: "",
				attackBonus: null,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				damage: {parts: [], versatile: ""},
				formula: "",
				save: {ability: "", dc: null, scaling: "spell"},
				armor: {
					type: armorType,
					value: acValue,
					dex: maxDexBonus,
				},
				strength: item.strength || null,
				stealth: !!item.stealth,
				consume: {type: "", target: null, amount: null},

				hp: {value: 0, max: 0, dt: null, conditions: ""},
				speed: {value: null, conditions: ""},

				baseItem,

				...(additionalData || {}),
			},
			img,
			flags: {
				...this._getItemFlags(item, opts),
				...additionalFlags,
			},
			effects: await this._pGetItemEffects(item, img, opts),
		};
	}

	static async _pGetItemItem_container (item, opts, entriesStr) {
		const {weight, price} = this._pGetItemItem_getWeightPriceRange(item, opts.size);
		const {isAttuned, isIdentified, isEquipped, attunement} = await this._pGetItemItem_pGetAttunedIdentifiedEquipped(item);

		const capacityValue = !item.containerCapacity
			? 0
			: item.containerCapacity.weight
				? item.containerCapacity.weight.reduce((a, b) => a + b, 0)
				: Math.max(...item.containerCapacity.item.map(itemToCount => Math.max(...Object.values(itemToCount))));

		const additionalData = await this._pGetAdditionalData(item);
		const additionalFlags = await this._pGetAdditionalFlags(item);

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await DataConverterItem._pGetItemItem_pGetImagePath(item, opts.fluff),
		);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(item, {isActorItem: opts.isActorItem})),
			type: "backpack",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(item),
				description: {value: await DataConverterItem._getItemItem_pGetItemDescription(item), chat: "", unidentified: ""},

				quantity: opts.quantity || item.quantity || 1,
				weight,
				price,
				attuned: isAttuned,
				equipped: opts.isEquipped ?? isEquipped,
				identified: isIdentified,
				rarity: this._getItemItem_getRarity(item),
				capacity: {
					type: item.containerCapacity.weight ? "weight" : "items",
					value: capacityValue,
					weightless: !!item.containerCapacity.weightless,
				},

				attunement,

				damage: {parts: []},

				...(additionalData || {}),
			},
			img,
			flags: {
				...this._getItemFlags(item, opts),
				...additionalFlags,
			},
			effects: await this._pGetItemEffects(item, img, opts),
		};
	}

	static async _pGetItemItem_consumable (item, opts, entriesStr) {
		const {weight, price} = this._pGetItemItem_getWeightPriceRange(item, opts.size);
		const {isAttuned, isIdentified, isEquipped, attunement} = await this._pGetItemItem_pGetAttunedIdentifiedEquipped(item);

		const consType = (item.poison ? "poison" : DataConverterItem._ITEM_TYPE_TO_CONSUMABLE_TYPE[item.type]) || "";

		let rollOnCons = "";
		let autoDestroy = false;

		entriesStr.replace(/if you expend[^.]+last charge[^.]+roll[^.]+{@dice ([^}]+)}(?:[^.]+)?\.(?:[^.]+)on a[^.]+\d+[^.]+destroyed/ig, (...m) => {
			rollOnCons = m[1];
			autoDestroy = true;
		});
		if (item.type === "SC" || item.type === "P") autoDestroy = true;

		// region Ammo attack/damage is added to the weapon's roll if ammo is set up
		const actionType = ["A", "AF"].includes(item.type) ? "rwak" : null;
		let attackBonus = null;

		const dmgParts = [];
		if (["A", "AF"].includes(item.type) && (item.bonusWeapon || item.bonusWeaponDamage)) {
			attackBonus = Number(item.bonusWeapon || item.bonusWeaponAttack);

			dmgParts.push([
				Number(item.bonusWeapon || item.bonusWeaponDamage),
				null,
			]);
		}
		// endregion

		const {uses, usesPer} = this._getItemItem_getItemUses(item);

		const additionalData = await this._pGetAdditionalData(item);
		const additionalFlags = await this._pGetAdditionalFlags(item);

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await DataConverterItem._pGetItemItem_pGetImagePath(item, opts.fluff),
		);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(item, {isActorItem: opts.isActorItem})),
			type: "consumable",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(item),
				description: {value: await DataConverterItem._getItemItem_pGetItemDescription(item), chat: "", unidentified: ""},

				quantity: opts.quantity || item.quantity || 1,
				weight,
				price,
				attuned: isAttuned,
				equipped: opts.isEquipped ?? isEquipped,
				identified: isIdentified,
				rarity: this._getItemItem_getRarity(item),

				consumableType: consType,

				attunement,

				activation: {type: "action", cost: 1, condition: this._getItemItem_getActivationCondition({item, entriesStr})},
				duration: {value: null, units: ""},
				target: {value: null, units: "", type: ""},
				range: {value: null, long: null, units: ""},
				uses: {value: uses, max: uses, per: usesPer, autoUse: true, autoDestroy: autoDestroy},
				ability: "",
				actionType,
				attackBonus,
				chatFlavor: "",
				critical: {threshold: null, damage: ""},
				damage: {
					parts: dmgParts,
					versatile: "",
				},
				formula: rollOnCons, // unsure if this is the best place to put this
				save: {ability: "", dc: null, scaling: "spell"},
				consume: {type: "", target: null, amount: null},
				hp: {value: 0, max: 0, dt: null, conditions: ""},
				speed: {value: null, conditions: ""},

				...(additionalData || {}),
			},
			img,
			flags: {
				...this._getItemFlags(item, opts),
				...additionalFlags,
			},
			effects: await this._pGetItemEffects(item, img, opts),
		};
	}

	static async _pGetItemItem_tool (item, opts, entriesStr) {
		const {weight, price} = this._pGetItemItem_getWeightPriceRange(item, opts.size);
		const {isAttuned, isIdentified, isEquipped, attunement} = await this._pGetItemItem_pGetAttunedIdentifiedEquipped(item);

		let defaultAbil = DataConverterItem._ITEM_NAME_TO_DEFAULT_ABILITY[item.name] || "int";

		const toolType = DataConverterItem._ITEM_TYPE_TO_TOOL_TYPE[item.type] ?? "";
		const baseItem = this._getBaseItem({item, toolType});

		const additionalData = await this._pGetAdditionalData(item);
		const additionalFlags = await this._pGetAdditionalFlags(item);

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await DataConverterItem._pGetItemItem_pGetImagePath(item, opts.fluff),
		);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(item, {isActorItem: opts.isActorItem})),
			type: "tool",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(item),
				description: {value: await DataConverterItem._getItemItem_pGetItemDescription(item), chat: "", unidentified: ""},

				quantity: opts.quantity || item.quantity || 1,
				weight,
				price,
				attuned: isAttuned,
				equipped: opts.isEquipped ?? isEquipped,
				identified: isIdentified,
				rarity: this._getItemItem_getRarity(item),

				toolType,
				proficient: 1, // 0 = not, 1 = proficient, 2 = expert, 0.5 = jack of all trades
				ability: defaultAbil,

				attunement,

				chatFlavor: "",
				damage: {parts: []},

				baseItem,

				...(additionalData || {}),
			},
			img,
			flags: {
				...this._getItemFlags(item, opts),
				...additionalFlags,
			},
			effects: await this._pGetItemEffects(item, img, opts),
		};
	}

	static async _pGetItemItem_loot (item, opts, entriesStr) {
		const {weight, price} = this._pGetItemItem_getWeightPriceRange(item, opts.size);
		const {isAttuned, isIdentified, isEquipped, attunement} = await this._pGetItemItem_pGetAttunedIdentifiedEquipped(item);

		const additionalData = await this._pGetAdditionalData(item);
		const additionalFlags = await this._pGetAdditionalFlags(item);

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await DataConverterItem._pGetItemItem_pGetImagePath(item, opts.fluff),
		);

		return {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(item, {isActorItem: opts.isActorItem})),
			type: "loot",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(item),
				description: {value: await DataConverterItem._getItemItem_pGetItemDescription(item), chat: "", unidentified: ""},

				quantity: opts.quantity || item.quantity || 1,
				weight,
				price,
				attuned: isAttuned,
				equipped: opts.isEquipped ?? isEquipped,
				identified: isIdentified,
				rarity: this._getItemItem_getRarity(item),

				attunement,

				damage: {parts: []},

				...(additionalData || {}),
			},
			img,
			flags: {
				...this._getItemFlags(item, opts),
				...additionalFlags,
			},
			effects: await this._pGetItemEffects(item, img, opts),
		};
	}

	static async _pGetItemItem_pGetImagePath (item, fluff) {
		if (item.foundryImg) return item.foundryImg;

		const getters = [
			this._pGetItemItem_pGetImagePath_fromPlutonium.bind(this, item, fluff),
			this._pGetItemItem_pGetImagePath_fromFoundry.bind(this, item),
		];
		if (Config.get("import", "isPreferFoundryImages")) getters.reverse();

		for (const getter of getters) {
			const url = await getter();
			if (url) return url;
		}

		return `modules/${SharedConsts.MODULE_NAME}/media/icon/${DataConverterItem._ITEM_TYPE_TO_ICON[item.type] || "crossed-swords"}.svg`;
	}

	static async _pGetItemItem_pGetImagePath_fromFoundry (item) { return this._pGetCompendiumImage(item); }
	static async _pGetItemItem_pGetImagePath_fromPlutonium (item, fluff) { return Vetools.pGetImageUrlFromFluff(fluff); }

	static _pGetItemItem_getAmmoConsumeDetails (item, opts) {
		let consumeType = "";
		let consumeTarget = "";
		let consumeAmount = null;

		if (item.ammoType) {
			consumeType = "ammo";
			consumeAmount = 1;

			if (opts.sheetItemsAmmo) {
				const [ammoTypeName, ammoTypeSource] = item.ammoType.toLowerCase().split("|").map(it => it.trim()).filter(Boolean);
				const cleanAmmoTypeSource = (ammoTypeSource || SRC_DMG).toLowerCase();
				const cleanAmmoTypeName = ammoTypeName.replace(/s+$/g, ""); // Remove trailing "s"

				const ammoTypeItems = opts.sheetItemsAmmo.filter(sheetItem => {
					const cleanSheetItemName = sheetItem.name.toLowerCase().trim().replace(/s+$/g, ""); // Remove trailing "s"
					return cleanSheetItemName === cleanAmmoTypeName
						&& (
							!Config.get("import", "isStrictMatching")
							|| (UtilDataConverter.getItemSource(sheetItem) || "").toLowerCase() === cleanAmmoTypeSource
						);
				});

				if (ammoTypeItems.length) {
					// Arbitrarily use the first matching item we find
					consumeTarget = ammoTypeItems[0].id;
				}
			}
		}

		return {
			consumeType,
			consumeTarget,
			consumeAmount,
		};
	}

	static async _pGetCompendiumImage (item) {
		const out = await UtilCompendium.pGetCompendiumImage("item", item, {fnGetAliases: this.getItemSrdAliases});
		if (out) return out;

		// If the item has an SRD base, attempt to get the image from it
		if (item._baseName) {
			const out = await UtilCompendium.pGetCompendiumImage(
				"item",
				{
					name: item._baseName,
					source: item._baseSource || item.source,
					srd: item._baseSrd,
				},
				{
					fnGetAliases: this.getItemSrdAliases,
				},
			);
			if (out) return out;
		}

		// If the item has a base item, attempt to get the image from it
		if (item.baseItem && typeof item.baseItem === "string") {
			let [name, source] = item.baseItem.split("|");
			source = source || SRC_DMG;
			return UtilCompendium.pGetCompendiumImage(
				"item",
				{
					name: name,
					source: source,
					srd: true, // Always try to search for SRD
				},
				{
					fnGetAliases: this.getItemSrdAliases,
				},
			);
		}
	}

	static _getItemAcMeta (item) {
		let acBonus = item.bonusAc ? Number(item.bonusAc) : 0;
		if (isNaN(acBonus)) acBonus = 0;

		const itemType = item.bardingType || item.type;

		const isArmorOrShield = itemType === "HA"
			|| itemType === "MA"
			|| itemType === "LA"
			|| itemType === "S";

		return {
			acValue: isArmorOrShield
				? (item.ac || 10) + acBonus
				: (acBonus || null), // Treat `0` acBonus as `null`
			maxDexBonus: itemType === "MA"
				? item.dexterityMax !== undefined ? item.dexterityMax : 2
				: itemType === "HA" ? 0 : null,
			isTypeAutoCalculated: isArmorOrShield,
		};
	}

	static async _pGetItemEffects (item, img, opts) {
		opts = opts || {};

		if (!Config.get("importItem", "isAddActiveEffects")) return [];

		const importType = await this._pGetItemImporterType(item);
		const isDisabled = importType === DataConverterItem._IMPORT_TYPE_CONSUMABLE || (opts.isEquipped != null && !opts.isEquipped);

		const out = [];

		// region Additional custom effects
		if (await this.pHasItemSideLoadedEffects(null, item)) {
			out.push(...(await this.pGetItemItemEffects(null, item, null, {img})));
		}
		// endregion

		// region AC
		out.push(...this._pGetItemEffects_getAcEffects(item, img, opts, {isDisabled}));
		// endregion

		// region Saving throws
		if (item.bonusSavingThrow) {
			const effect = this._pGetItemEffects_getGenericBonus({
				item,
				img,
				label: "Saving Throw Bonus",
				key: "data.bonuses.abilities.save",
				prop: "bonusSavingThrow",
				isDisabled,
			});
			if (effect) out.push(effect);
		}
		// endregion

		// region Ability checks
		if (item.bonusAbilityCheck) {
			const effect = this._pGetItemEffects_getGenericBonus({
				item,
				img,
				label: "Ability Check Bonus",
				key: "data.bonuses.abilities.check",
				prop: "bonusAbilityCheck",
				isDisabled,
			});
			if (effect) out.push(effect);
		}
		// endregion

		// region Spell attack
		if (item.bonusSpellAttack) {
			const effectMelee = this._pGetItemEffects_getGenericBonus({
				item,
				img,
				label: "Spell Attack Bonus (Melee)",
				key: "data.bonuses.msak.attack",
				prop: "bonusSpellAttack",
				isDisabled,
			});
			if (effectMelee) out.push(effectMelee);

			const effectRanged = this._pGetItemEffects_getGenericBonus({
				item,
				img,
				label: "Spell Attack Bonus (Ranged)",
				key: "data.bonuses.rsak.attack",
				prop: "bonusSpellAttack",
				isDisabled,
			});
			if (effectRanged) out.push(effectRanged);
		}
		// endregion

		// region Spell damage
		if (item.bonusSpellAttack) {
			const effectMelee = this._pGetItemEffects_getGenericBonus({
				item,
				img,
				label: "Spell Damage Bonus (Melee)",
				key: "data.bonuses.msak.damage",
				prop: "bonusSpellDamage",
				isDisabled,
			});
			if (effectMelee) out.push(effectMelee);

			const effectRanged = this._pGetItemEffects_getGenericBonus({
				item,
				img,
				label: "Spell Damage Bonus (Ranged)",
				key: "data.bonuses.rsak.damage",
				prop: "bonusSpellDamage",
				isDisabled,
			});
			if (effectRanged) out.push(effectRanged);
		}
		// endregion

		// region Spell save DC
		if (item.bonusSpellSaveDc) {
			const effect = this._pGetItemEffects_getGenericBonus({
				item,
				img,
				label: "Spell Save DC Bonus",
				key: "data.bonuses.spell.dc",
				prop: "bonusSpellSaveDc",
				isDisabled,
			});
			if (effect) out.push(effect);
		}
		// endregion

		// region Proficiency bonus
		if (item.bonusProficiencyBonus) {
			const effect = this._pGetItemEffects_getGenericBonus({
				item,
				img,
				label: "Proficiency Bonus... Bonus?", // :^)
				key: "data.attributes.prof",
				prop: "bonusProficiencyBonus",
				isDisabled,
			});
			if (effect) out.push(effect);
		}
		// endregion

		// region Ability scores
		if (item.ability) {
			if (item.ability.static) {
				Parser.ABIL_ABVS.forEach(ab => {
					if (item.ability.static[ab] == null) return;

					out.push(UtilActiveEffects.getGenericEffect({
						key: `data.abilities.${ab}.value`,
						value: item.ability.static[ab],
						mode: CONST.ACTIVE_EFFECT_MODES.UPGRADE,
						label: `Base ${Parser.attAbvToFull(ab)}`,
						icon: img,
						disabled: isDisabled,
						priority: UtilActiveEffects.PRIORITY_BASE,
					}));
				});
			}

			Parser.ABIL_ABVS.forEach(ab => {
				if (item.ability[ab] == null) return;

				out.push(UtilActiveEffects.getGenericEffect({
					key: `data.abilities.${ab}.value`,
					value: item.ability[ab],
					mode: CONST.ACTIVE_EFFECT_MODES.ADD,
					label: `Bonus ${Parser.attAbvToFull(ab)}`,
					icon: img,
					disabled: isDisabled,
					priority: UtilActiveEffects.PRIORITY_BONUS,
				}));
			});
		}
		// endregion

		// region Damage resistance/immunity/vulnerability; condition immunity
		const actorDataDrDiDvCi = DataConverter.getActorDamageResImmVulnConditionImm(item);
		out.push(...this._pGetItemEffects_getDrDiDvCiEffects({img, label: "Damage Resistance", actProp: "dr", isDisabled, actorDataDrDiDvCi}));
		out.push(...this._pGetItemEffects_getDrDiDvCiEffects({img, label: "Damage Immunity", actProp: "di", isDisabled, actorDataDrDiDvCi}));
		out.push(...this._pGetItemEffects_getDrDiDvCiEffects({img, label: "Damage Vulnerability", actProp: "dv", isDisabled, actorDataDrDiDvCi}));
		out.push(...this._pGetItemEffects_getDrDiDvCiEffects({img, label: "Condition Immunity", actProp: "ci", isDisabled, actorDataDrDiDvCi}));
		// endregion

		// region Speed
		const speedChanges = [];
		if (item.modifySpeed?.multiply) {
			Object.entries(item.modifySpeed.multiply)
				.forEach(([speedMode, multiplier]) => {
					if (speedMode === "*") {
						Parser.SPEED_MODES.forEach(mode => {
							speedChanges.push(UtilActiveEffects.getGenericChange({
								key: `data.attributes.movement.${mode}`,
								value: multiplier,
								mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
								priority: UtilActiveEffects.PRIORITY_BONUS,
							}));
						});
						return;
					}

					speedChanges.push(UtilActiveEffects.getGenericChange({
						key: `data.attributes.movement.${speedMode}`,
						value: multiplier,
						mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
						priority: UtilActiveEffects.PRIORITY_BONUS,
					}));
				});
		}

		if (item.modifySpeed?.static) {
			Object.entries(item.modifySpeed.static)
				.forEach(([speedMode, value]) => {
					speedChanges.push(UtilActiveEffects.getGenericChange({
						key: `data.attributes.movement.${speedMode}`,
						value: value,
						mode: CONST.ACTIVE_EFFECT_MODES.UPGRADE,
						priority: UtilActiveEffects.PRIORITY_BASE,
					}));
				});
		}

		if (item.modifySpeed?.equal) {
			Object.entries(item.modifySpeed.equal)
				.forEach(([speedMode, otherSpeedMode]) => {
					speedChanges.push(UtilActiveEffects.getGenericChange({
						key: `data.attributes.movement.${speedMode}`,
						value: `@attributes.movement.${otherSpeedMode}`,
						mode: CONST.ACTIVE_EFFECT_MODES.UPGRADE,
						priority: UtilActiveEffects.PRIORITY_BASE,
					}));
				});
		}

		if (item.modifySpeed?.bonus) {
			Object.entries(item.modifySpeed.bonus)
				.forEach(([speedMode, bonus]) => {
					// FIXME(Future) remove this to-bonus conversion when https://gitlab.com/foundrynet/dnd5e/-/issues/1233 if fixed, or, keep it if the bonuses are made to show up correctly on the sheet
					bonus = UiUtil.intToBonus(bonus);

					if (speedMode === "*") {
						Parser.SPEED_MODES.forEach(mode => {
							speedChanges.push(UtilActiveEffects.getGenericChange({
								key: `data.attributes.movement.${mode}`,
								value: bonus,
								mode: CONST.ACTIVE_EFFECT_MODES.ADD,
								priority: UtilActiveEffects.PRIORITY_BONUS,
							}));
						});
						return;
					}

					speedChanges.push(UtilActiveEffects.getGenericChange({
						key: `data.attributes.movement.${speedMode}`,
						value: bonus,
						mode: CONST.ACTIVE_EFFECT_MODES.ADD,
						priority: UtilActiveEffects.PRIORITY_BONUS,
					}));
				});
		}

		if (speedChanges.length) {
			out.push(UtilActiveEffects.getGenericEffect({
				label: `Speed Adjustment`,
				icon: img,
				disabled: isDisabled,
				changes: speedChanges,
			}));
		}
		// endregion

		// TODO(Future)
		//  - language proficiencies
		//  - save proficiencies?

		return out;
	}

	static _pGetItemEffects_getAcEffects (item, img, opts, {isDisabled}) {
		if (UtilCompat.isDaeGeneratingArmorEffects()) return [];

		const out = [];

		const acMeta = this._getItemAcMeta(item);
		if (acMeta.acValue != null && !acMeta.isTypeAutoCalculated) {
			out.push(UtilActiveEffects.getGenericEffect({
				key: "data.attributes.ac.bonus",
				value: acMeta.acValue,
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				label: `Bonus AC`,
				icon: img,
				disabled: isDisabled,
				priority: UtilActiveEffects.PRIORITY_BONUS,
			}));
		}

		return out;
	}

	static _pGetItemEffects_getGenericBonus ({item, img, label, key, prop, isDisabled}) {
		const bonus = !isNaN(item[prop]) ? Number(item[prop]) : 0;
		if (!bonus) return null;

		return UtilActiveEffects.getGenericEffect({
			key,
			// FIXME(Future) remove this to-bonus conversion when https://gitlab.com/foundrynet/dnd5e/-/issues/1233 if fixed, or, keep it if the bonuses are made to show up correctly on the sheet
			value: UiUtil.intToBonus(bonus),
			mode: CONST.ACTIVE_EFFECT_MODES.ADD,
			label,
			icon: img,
			disabled: isDisabled,
			priority: UtilActiveEffects.PRIORITY_BONUS,
		});
	}

	static _pGetItemEffects_getDrDiDvCiEffects ({img, label, actProp, isDisabled, actorDataDrDiDvCi}) {
		if (!actorDataDrDiDvCi[actProp]) return [];

		const out = [];

		if (actorDataDrDiDvCi[actProp].value) {
			actorDataDrDiDvCi[actProp].value.forEach(it => {
				out.push(UtilActiveEffects.getGenericEffect({
					key: `data.traits.${actProp}.value`,
					value: it,
					mode: CONST.ACTIVE_EFFECT_MODES.ADD,
					label: label,
					icon: img,
					disabled: isDisabled,
					priority: UtilActiveEffects.PRIORITY_BONUS,
				}));
			});
		}

		if (actorDataDrDiDvCi[actProp].custom?.length) {
			out.push(UtilActiveEffects.getGenericEffect({
				key: `data.traits.${actProp}.custom`,
				value: actorDataDrDiDvCi[actProp].custom,
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				label: label,
				icon: img,
				disabled: isDisabled,
				priority: UtilActiveEffects.PRIORITY_BONUS,
			}));
		}

		return out;
	}

	static async _pGetAdditionalData (item) {
		return DataConverter.pGetAdditionalData_(item, this._SIDE_DATA_OPTS);
	}

	static async _pGetAdditionalFlags (item) {
		return DataConverter.pGetAdditionalFlags_(item, this._SIDE_DATA_OPTS);
	}

	static async _pGetSideLoadedType (item) {
		return DataConverter.pGetSideLoadedType_(item, {...this._SIDE_DATA_OPTS, validTypes: new Set(DataConverterItem.VALID_FOUNDRY_ITEM_TYPES_IMPORT)});
	}

	static async pHasItemSideLoadedEffects (actor, item) {
		if ((await DataConverter.pGetAdditionalEffectsRaw_(item, this._SIDE_DATA_OPTS))?.length > 0) return true;

		if (!item._variantName) return false;
		const fauxGeneric = {name: item._variantName, source: item.source};

		return (await DataConverter.pGetAdditionalEffectsRaw_(fauxGeneric, {propBrew: "foundryVariant", fnLoadJson: Vetools.pGetItemSideData, propJson: "variant"}))?.length > 0;
	}

	static async pGetItemItemEffects (actor, item, sheetItem, {additionalData, img} = {}) {
		const effectsRaw = await DataConverter.pGetAdditionalEffectsRaw_(item, this._SIDE_DATA_OPTS);
		const effects = UtilActiveEffects.getExpandedEffects(effectsRaw || [], {actor, sheetItem, parentName: item.name, additionalData, img});

		if (!item._variantName) return effects;
		const fauxGeneric = {name: item._variantName, source: item.source};

		const effectsRawVariant = await DataConverter.pGetAdditionalEffectsRaw_(fauxGeneric, {propBrew: "foundryVariant", fnLoadJson: Vetools.pGetItemSideData, propJson: "variant"});
		const effectsVariant = UtilActiveEffects.getExpandedEffects(effectsRawVariant || [], {actor, sheetItem, parentName: fauxGeneric.name, additionalData, img});

		return [...effects, ...effectsVariant];
	}

	static get _SIDE_DATA_OPTS () {
		return {propBrew: "foundryItem", fnLoadJson: Vetools.pGetItemSideData, propJson: "item"};
	}

	static _getGenericIdKey ({nameLower}) { return nameLower.replace(/[^a-z]+/g, ""); }
	static _getWeaponIdKey ({nameLower}) { return this._getGenericIdKey({nameLower}); }
	static _getArmorShieldIdKey ({nameLower}) { return DataConverterItem._ITEM_NAME_TO_ARMOR_ID_KEY[nameLower] || this._getGenericIdKey({nameLower}); }
	static _getToolIdKey ({nameLower}) { return DataConverterItem._ITEM_NAME_TO_TOOL_ID_KEY[nameLower] || this._getGenericIdKey({nameLower}); }

	static _getItemItem_getActivationCondition ({item, entriesStr}) {
		entriesStr = entriesStr || JSON.stringify(item.entries || "");

		let out = "";

		entriesStr.replace(/command word|command phrase/gi, (...m) => {
			out = m[0];
		});

		return out.uppercaseFirst();
	}

	// region Currency import
	/**
	 * @param currency The item entry.
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 * @return {object}
	 */
	static async pGetCurrencyItem (currency, opts) {
		opts = opts || {};

		const weight = Config.getMetricNumber({configGroup: "importItem", originalValue: this._getCurrencyWeight(currency), originalUnit: "lb"});
		const price = CurrencyUtil.getAsCopper(currency) / 100;

		const out = {
			name: "Currency",
			type: "loot",
			data: {
				description: {
					value: `<p>This collection of currency is made up of: ${Parser.getDisplayCurrency(currency)}</p>
						<hr class="hr-2">
						<p class="ve-muted italic">Drag-and-drop this item to an actor's sheet to add the currency to that actor.</p>`,
					chat: "",
					unidentified: "",
				},

				quantity: 1,
				weight,
				price,
			},
			img: "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp",
			flags: {
				[SharedConsts.MODULE_NAME_FAKE]: {
					type: DataConverterItem.FLAG_TYPE__CURRENCY,
					currency: MiscUtil.copy(currency),
				},
			},
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importItem", "permissions")};

		return out;
	}

	/** N.b. all 5e currencies weigh the same, surprisingly. */
	static _getCurrencyWeight (currency) {
		return Object.entries(currency)
			.map(([coin, amount]) => 0.02 * (amount || 0))
			.reduce((a, b) => a + b, 0);
	}
	// endregion
}

DataConverterItem._WEAPON_DETAIL_CACHE_INIT = false;
DataConverterItem._WEAPON_DETAIL_CACHE = {};
DataConverterItem._WEAPON_DETAIL_CACHE_LOCK = new VeLock();

DataConverterItem._IMPORT_TYPE_WEAPON = "weapon";
DataConverterItem._IMPORT_TYPE_TOOL = "tool";
DataConverterItem._IMPORT_TYPE_CONSUMABLE = "consumable";
DataConverterItem._IMPORT_TYPE_EQUIPMENT = "equipment";
DataConverterItem._IMPORT_TYPE_CONTAINER = "container";
DataConverterItem._IMPORT_TYPE_LOOT = "loot";

DataConverterItem.VALID_FOUNDRY_ITEM_TYPES_IMPORT = [
	DataConverterItem._IMPORT_TYPE_WEAPON,
	DataConverterItem._IMPORT_TYPE_TOOL,
	DataConverterItem._IMPORT_TYPE_CONSUMABLE,
	DataConverterItem._IMPORT_TYPE_EQUIPMENT,
	DataConverterItem._IMPORT_TYPE_CONTAINER,
	DataConverterItem._IMPORT_TYPE_LOOT,
];

DataConverterItem.STACKABLE_FOUNDRY_ITEM_TYPES_IMPORT = [
	DataConverterItem._IMPORT_TYPE_CONSUMABLE,
	DataConverterItem._IMPORT_TYPE_LOOT,
];

DataConverterItem._ITEM_TYPE_TO_ARMOR_TYPE = {
	"HA": "heavy",
	"MA": "medium",
	"LA": "light",
	"S": "shield",
};
DataConverterItem._ITEM_TYPE_TO_CONSUMABLE_TYPE = {
	A: "ammo",
	AF: "ammo",
	P: "potion",
	SC: "scroll",
	WD: "wand",
	RD: "rod",
};
DataConverterItem._ITEM_TYPE_TO_TOOL_TYPE = {
	AT: "art",
	INS: "music",
	GS: "game",
};
// NOTE: Unofficial data, loosely based on the skills shown in XGE's expanded "Tool Proficiencies" section
DataConverterItem._ITEM_NAME_TO_DEFAULT_ABILITY = {
	"Alchemist's Supplies": "int",
	"Brewer's Supplies": "int",
	"Calligrapher's Supplies": "int",
	"Carpenter's Tools": "int",
	"Cartographer's Tools": "int",
	"Cobbler's Tools": "int",
	"Cook's Utensils": "wis",
	"Disguise Kit": "cha",
	"Forgery Kit": "int",
	"Glassblower's Tools": "int",
	"Herbalism Kit": "wis",
	"Jeweler's Tools": "int",
	"Leatherworker's Tools": "int",
	"Mason's Tools": "int",
	"Navigator's Tools": "wis",
	"Painter's Supplies": "int",
	"Poisoner's Kit": "wis",
	"Potter's Tools": "int",
	"Smith's Tools": "int",
	"Thieves' Tools": "dex",
	"Tinker's Tools": "int",
	"Weaver's Tools": "int",
	"Woodcarver's Tools": "int",
};
DataConverterItem._ITEM_TYPE_TO_ICON = {
	$: "cash", // Currency/gems/art objects
	A: "quiver", // Ammunition
	AF: "quiver", // Ammunition
	AT: "toolbox", // Artisan Tool
	EM: "", // Eldritch Machine
	EXP: "unlit-bomb", // Explosive
	G: "backpack", // Adventuring Gear
	GS: "rolling-dices", // Gaming Set
	HA: "breastplate", // Heavy Armor
	INS: "guitar", // Instrument
	LA: "leather-armor", // Light Armor
	M: "crossed-swords", // Melee Weapon
	MA: "scale-mail", // Medium Armor
	MNT: "horse-head", // Mount
	GV: "", // Generic Variant
	P: "potion-ball", // Potion
	R: "pocket-bow", // Ranged Weapon
	RD: "crystal-wand", // Rod
	RG: "ring", // Ring
	S: "checked-shield", // Shield
	SC: "tied-scroll", // Scroll
	SCF: "orb-wand", // Spellcasting Focus
	OTH: "battle-gear", // Other
	T: "toolbox", // Tool
	TAH: "saddle", // Tack and Harness
	TG: "barrel", // Trade Good
	VEH: "old-wagon", // Vehicle (land)
	SHP: "galleon", // Vehicle (water)
	AIR: "air-balloon", // Vehicle (air)
	WD: "fairy-wand", // Wand
};

DataConverterItem._ITEM_PROP_MAP = {
	"A": "amm",
	"AF": "amm",
	"BF": "", // Burst Fire has no mapping
	"F": "fin",
	"H": "hvy",
	"L": "lgt",
	"LD": "lod",
	"R": "rch",
	"RLD": "rel",
	"S": "spc",
	"T": "thr",
	"2H": "two",
	"V": "ver",
};
DataConverterItem._ITEM_EQUIPMENT_NAME_RES = [
	"amulet of",
	"badge of",
	"band of",
	"belt of",
	"boots of",
	"bracelet of",
	"bracer of",
	"bracers of",
	"brooch of",
	"cape of",
	"circlet of",
	"clothes of",
	"crown of",
	"eyes of",
	"gauntlets of",
	"gloves of",
	"goggles of",
	"hat of",
	"headband of",
	"helm of",
	"mantle of",
	"mask of",
	"necklace of",
	"periapt of",
	"ring of",
	"rings of",
	"robe of",
	"slippers of",
].map(it => new RegExp(`(?:[ (]|^)${it}`, "i"));
// Based on "Barding" from the PHB
DataConverterItem._SIZE_TO_ITEM_WEIGHT_MULT = {
	[SZ_FINE]: 0.5,
	[SZ_DIMINUTIVE]: 0.5,
	[SZ_TINY]: 0.5,
	[SZ_SMALL]: 1,
	[SZ_MEDIUM]: 1,
	[SZ_LARGE]: 2,
	[SZ_HUGE]: 4,
	[SZ_GARGANTUAN]: 8,
	[SZ_COLOSSAL]: 16,
	[SZ_VARIES]: 1,
};
DataConverterItem._SIZE_TO_ITEM_VALUE_MULT = {
	[SZ_FINE]: 0.25,
	[SZ_DIMINUTIVE]: 0.25,
	[SZ_TINY]: 0.25,
	[SZ_SMALL]: 1,
	[SZ_MEDIUM]: 1,
	[SZ_LARGE]: 4,
	[SZ_HUGE]: 16,
	[SZ_GARGANTUAN]: 64,
	[SZ_COLOSSAL]: 256,
	[SZ_VARIES]: 1,
};
// Based on "Gurt's Greataxe" from SKT
DataConverterItem._SIZE_TO_ITEM_WEIGHT_AND_VALUE_EXPONENT = {
	[SZ_FINE]: 0.5,
	[SZ_DIMINUTIVE]: 0.5,
	[SZ_TINY]: 0.5,
	[SZ_SMALL]: 1,
	[SZ_MEDIUM]: 1,
	[SZ_LARGE]: 2,
	[SZ_HUGE]: 3,
	[SZ_GARGANTUAN]: 4,
	[SZ_COLOSSAL]: 5,
	[SZ_VARIES]: 1,
};

DataConverterItem._ITEM_NAME_TO_ARMOR_ID_KEY = {
	"half plate armor": "halfplate",
	"hide armor": "hide",
	"leather armor": "leather",
	"padded armor": "padded",
	"plate armor": "plate",
	"splint armor": "splint",
	"studded leather armor": "studded",
};
DataConverterItem._ITEM_NAME_TO_TOOL_ID_KEY = {
	"alchemist's supplies": "alchemist",
	"brewer's supplies": "brewer",
	"calligrapher's supples": "calligrapher",
	"playing card set": "card",
	"carpenter's tools": "carpenter",
	"cartographer's tools": "cartographer",
	"dragonchess set": "chess",
	"cobbler's tools": "cobbler",
	"cook's utensils": "cook",
	"dice set": "dice",
	"disguise kit": "disg",
	"forgery kit": "forg",
	"glassblower's tools": "glassblower",
	"herbalism kit": "herb",
	"jeweler's tools": "jeweler",
	"leatherworker's tools": "leatherworker",
	"mason's tools": "mason",
	"navigator's tools": "navg",
	"painter's supplies": "painter",
	"poisoner's kit": "pois",
	"potter's tools": "potter",
	"smith's tools": "smith",
	"thieves' tools": "thief",
	"tinker's tools": "tinker",
	"weaver's tools": "weaver",
	"woodcarver's tools": "woodcarver",
};

DataConverterItem.FLAG_TYPE__CURRENCY = "currency";

export {DataConverterItem};
