import {DataConverter} from "./DataConverter.js";

class DataConverterActor {
	static getParsedActionEntryData (entity, action, dataBuilderOpts, {mode = "creature", summonSpellLevel = null} = {}) {
		if (!(action.entries && action.entries[0] && typeof action.entries[0] === "string")) return;

		let isProficient = true;
		const damageTuples = [];

		let offensiveAbility = "str"; // This is the default if "null" is specified anyway. Specify it here so we can compensate for it later.
		let attackBonus = 0;

		const str = action.entries[0];

		const {damageTupleMetas} = DataConverter.getDamageTupleMetas(str, {summonSpellLevel});
		const {damageParts, formula} = DataConverter.getDamagePartsAndOtherFormula(damageTupleMetas);

		damageTuples.push(...damageParts);

		const {rangeShort, rangeLong} = DataConverter.getAttackRange(str);

		const mHit = /{@hit ([^}]+)}/gi.exec(str);
		if (mHit) {
			const hitBonus = Number(mHit[1]);
			if (!isNaN(hitBonus)) {
				const enchantmentPart = /\+(\d)/.exec(action.name || "");
				const enchBonus = enchantmentPart ? Number(enchantmentPart[0]) : 0;
				const hitBonusFromAbil = hitBonus - enchBonus - (dataBuilderOpts.assumedPb || 0);

				// Check this against the damage bonus we might to have from the first damage number
				const dmg1 = damageTuples.length ? damageTuples[0][0] || "" : "";

				const mDamageBonus = /\d+\s*([-+]\s*\d+)$/.exec(dmg1.trim());
				let damageBonusFromAbil;
				if (mDamageBonus) damageBonusFromAbil = Number(mDamageBonus[1].replace(/\s+/g, "")) - enchBonus;

				// If we have a bonus from dmg1 and it doesn't match that from the +hit, use the one from damage
				//   instead when trying to work out the offensive ability score
				let assumedAbilMod = hitBonusFromAbil;
				if (damageBonusFromAbil != null && hitBonusFromAbil !== damageBonusFromAbil) {
					assumedAbilMod = damageBonusFromAbil;

					// Handles e.g. Ghast bite attack, which lacks proficiency
					if (hitBonusFromAbil < damageBonusFromAbil) {
						isProficient = false;
					} else {
						const bonus = hitBonusFromAbil - damageBonusFromAbil;

						if (dataBuilderOpts.pb === 0) {
							// Note that `opts.pb` can be 0 in a few rare cases, e.g. ERLW's "Steel Defender," which
							//   has no CR, but does appear to have a +2 proficiency bonus. Just assume whatever
							//   bonus we have left is the proficiency bonus, and ignore any potential errors this
							//   could cause.
							dataBuilderOpts.assumedPb = dataBuilderOpts.assumedPb || bonus;
						} else {
							// Handles e.g. Hobgoblin Warlord (double proficiency?) or oddly-enchanted weapons
							attackBonus = bonus;
						}
					}
				}

				// Loop through abilities until we find one that matches our bonus, or give up if there are none
				let isFoundOffensiveAbility = false;
				for (const k of Parser.ABIL_ABVS) {
					if (entity[k] == null) continue;

					const mod = Parser.getAbilityModNumber(entity[k]);
					if (mod === assumedAbilMod) {
						offensiveAbility = k;
						isFoundOffensiveAbility = true;
						break;
					}
				}

				if (mode === "creature") {
					// If we could not find an offensive ability, we're missing some amount of bonus. Try to calculate
					//   what that bonus should be. (Generally this is unnecessary, as enchantment bonuses should be
					//   pulled out above, but there are rare cases like Githyanki Knight Silver Greatswords).
					// Only attempt this for creatures if the proficiency bonus is known.
					if (!isFoundOffensiveAbility && dataBuilderOpts.assumedPb) {
						// This is the number we expect to see on the sheet if we import the item as-is. If it's wrong,
						//   we need to compensate.
						const curCalcBonus = dataBuilderOpts.assumedPb + Parser.getAbilityModNumber(entity[offensiveAbility]) + attackBonus;

						if (curCalcBonus !== hitBonus) {
							const delta = hitBonus - curCalcBonus;
							attackBonus += delta;
						}

					// If the numbers don't nicely line up, e.g. for Clay Golem's slam, add the missing offset as a
					//   generic bonus.
					} else if (!isProficient) {
						const curCalcBonus = Parser.getAbilityModNumber(entity[offensiveAbility]) + attackBonus;
						if (curCalcBonus !== hitBonus) {
							const delta = hitBonus - curCalcBonus;
							attackBonus += delta;
						}
					}
				}

				// For creatures, just give up and use the whole bonus as the final attack bonus, as it's probably an
				//   arbitrary number anyway.
				if (mode === "object") {
					attackBonus = hitBonus;
				}
			}
		}

		const mHitYourSpellAttack = /{@hitYourSpellAttack}/gi.exec(str);
		if (!mHit && mHitYourSpellAttack) {
			isProficient = true;
			offensiveAbility = null;
			// Negate the default bonuses; use the user's ranged spell attack (which we assume is the "primary" mode)
			attackBonus = "- @attributes.prof - @mod + @srd5e.userchar.spellAttackRanged";
		}

		const {isAttack, actionType} = DataConverter.getAttackActionType(str);

		return {
			damageTuples,
			formula,
			offensiveAbility,
			isAttack,
			rangeShort,
			rangeLong,
			actionType,
			isProficient,
			attackBonus,
		};
	}
}

export {DataConverterActor};
