import {DataConverter} from "./DataConverter.js";
import {UtilActors} from "./UtilActors.js";
import {LGT} from "./Util.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {DataConverterActor} from "./DataConverterActor.js";

class DataConverterCreature {
	static async pGetParsedAction (mon, action, monOpts) {
		const {
			damageTuples,
			formula,
			offensiveAbility,
			isAttack,
			rangeShort,
			rangeLong,
			actionType,
			isProficient,
			attackBonus,
		} = DataConverterActor.getParsedActionEntryData(mon, action, monOpts, {mode: "creature", summonSpellLevel: mon._summonedBySpell_level ?? mon._summonedBySpell_levelBase});

		const img = await this._pGetParsedAction_getImg(mon, action, monOpts, {isAttack});

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
			_foundryData: action._foundryData,
			foundryData: action.foundryData,
			_foundryFlags: action._foundryFlags,
			foundryFlags: action.foundryFlags,
			img,
		};
	}

	/**
	 * @param mon
	 * @param action
	 * @param monOpts
	 * @param [opts]
	 * @param [opts.isAttack]
	 * @param [opts.isLegendary]
	 */
	static async _pGetParsedAction_getImg (mon, action, monOpts, opts) {
		opts = opts || {};

		const imgFeature = await this._getFeatureImage(mon, action, monOpts, opts);
		if (imgFeature) return imgFeature;

		if (action.name) {
			if (action.name.toLowerCase().startsWith("breath weapons")) return `modules/${SharedConsts.MODULE_NAME}/media/icon/dragon-breath.svg`;

			if (/^eye ray/i.test(action.name)) return `modules/${SharedConsts.MODULE_NAME}/media/icon/eyestalk.svg`;
		}

		return `modules/${SharedConsts.MODULE_NAME}/media/icon/mailed-fist.svg`;
	}

	/**
	 * @param mon
	 * @param entFeature
	 * @param monOpts
	 * @param [opts]
	 * @param [opts.isAttack]
	 * @param [opts.isLegendary]
	 */
	static async _getFeatureImage (mon, entFeature, monOpts, opts) {
		opts = opts || {};

		const imgCustomIcon = await DataConverter.pGetIconImage("monsterFeature", entFeature);
		if (imgCustomIcon) return imgCustomIcon;

		const img = await UtilCompendium.pGetCompendiumImage(
			"monsterFeature",
			entFeature,
			{
				fnGetAliases: this._getFeatureSrdAliases.bind(this, {isAttack: opts.isAttack, isLegendary: opts.isLegendary}),
				isIgnoreSrd: true,
			},
		);
		if (img) return img;

		const imgDeep = await UtilCompendium.pGetActorItemCompendiumImage(
			"monsterFeature",
			entFeature,
			{
				fnGetAliases: this._getFeatureSrdAliases.bind(this, {isAttack: opts.isAttack, isLegendary: opts.isLegendary}),
			},
		);
		if (imgDeep) return imgDeep;

		return null;
	}

	/**
	 * @param mon
	 * @param ent
	 * @param monOpts
	 * @param [opts]
	 * @param [opts.isAttack]
	 * @param [opts.isLegendary]
	 */
	static async pGetTraitReactionLegendaryImage (mon, ent, monOpts, opts) {
		opts = opts || {};

		const imgFeature = await this._getFeatureImage(mon, ent, monOpts, opts);
		if (imgFeature) return imgFeature;

		return `modules/${SharedConsts.MODULE_NAME}/media/icon/mighty-force.svg`;
	}

	static async pGetLairActionImage (mon, ent, monOpts) {
		const imgFeature = await this._getFeatureImage(mon, ent, monOpts);
		if (imgFeature) return imgFeature;

		return `modules/${SharedConsts.MODULE_NAME}/media/icon/mountain-cave.svg`;
	}

	static async pGetSpellcastingImage (mon, ent, monOpts) {
		const imgFeature = await this._getFeatureImage(mon, ent, monOpts);
		if (imgFeature) return imgFeature;

		return `modules/${SharedConsts.MODULE_NAME}/media/icon/spell-book.svg`;
	}

	static async pGetVariantImage (mon, ent, monOpts) {
		const imgFeature = await this._getFeatureImage(mon, ent, monOpts);
		if (imgFeature) return imgFeature;

		return `modules/${SharedConsts.MODULE_NAME}/media/icon/archive-research.svg`;
	}

	/**
	 * @param options
	 * @param [options.isLegendary] If the incoming entry is a legendary action. SRD legendary actions are suffixed.
	 * @param [options.isAttack]
	 * @param entry
	 */
	static _getFeatureSrdAliases (options, entry) {
		if (!entry.name) return [];

		const out = [];

		const noBrackets = entry.name
			.replace(/\([^)]+\)/g, "")
			.replace(/\s+/g, " ")
			.trim();
		if (noBrackets !== entry.name) out.push(noBrackets);

		const noTags = entry.name
			.replace(/{@[^}]+}/g, "")
			.replace(/\s+/g, " ")
			.trim();
		if (noTags !== entry.name) out.push(noTags);

		if (options.isLegendary) out.push(`${entry.name} (Legendary)`);
		if (options.isAttack) out.push(`${entry.name} Attack`);

		const noAttack = entry.name.replace(/ Attack$/, "");
		if (noAttack !== entry.name) out.push(noAttack);

		return out;
	}

	static getDataSkills (mon, data, dataBuilderOpts) {
		const out = {};

		Object.entries(UtilActors.SKILL_ABV_TO_FULL).forEach(([abv, full]) => {
			const ab = Parser.skillToAbilityAbv(full);

			const {profType, bonusCheck} = this._getDataSkills_getSkillMeta({mon, dataBuilderOpts, full, ab});

			out[abv] = {
				value: profType,
				ability: ab,
				bonuses: {
					check: bonusCheck,
					passive: "",
				},
			};
		});

		return out;
	}

	static _getDataSkills_getSkillMeta ({mon, dataBuilderOpts, full, ab}) {
		if (!mon.skill?.[full]) return {};

		const mSkill = /^\s*(?<number>[-+]?\s*\d+)\s*(?:[-+]|$)/.exec(`${mon.skill[full]}`);
		if (!mSkill) return {};

		const skillNum = Number(mSkill.groups.number.replace(/\s+/g, ""));

		const abMod = Parser.getAbilityModNumber(mon[ab] || 0);

		// If the bonus matches the expected ability mod number exactly, it's not really a bonus, so bail out
		if (skillNum === abMod) return {};

		const profValue = abMod + dataBuilderOpts.assumedPb;
		const expertValue = abMod + (2 * dataBuilderOpts.assumedPb);

		if (profValue === skillNum) return {profType: 1};
		if (expertValue === skillNum) return {profType: 2};

		// region If no proficiency matches exactly with our expected output, fill in the gap with a bonus
		// Default to the closest value, and fill the missing difference with a bonus
		const profType = skillNum >= expertValue ? 2 : skillNum >= profValue ? 1 : 0;
		return {
			profType,
			bonusType: profType === 0 ? skillNum : profType === 1 ? skillNum - profValue : skillNum - expertValue,
		};
		// endregion
	}

	static getDataSpells (mon, data, monOpts) {
		const out = {};

		out.spell0 = {value: 0, max: 0};

		if (mon.spellcasting && mon.spellcasting.some(it => it.spells)) {
			for (let i = 1; i < 10; ++i) {
				const kSpell = `spell${i}`;

				out[kSpell] = out[kSpell] || {
					value: 0,
					max: 0,
				};

				// Total up all spell slots
				mon.spellcasting
					.filter(it => it.spells && it.spells[i] && it.spells[i].slots)
					.forEach(it => {
						const lvl = it.spells[i];

						// Pact magic
						if (lvl.lower) {
							out.pact = out.pact || {
								value: 0,
								max: 0, // Doesn't have any effect
								level: monOpts.spellLevel, // Doesn't have any effect (and isn't saved?)
								override: 0, // The real "max" slots
							};
							out.pact.value += lvl.slots;
							out.pact.max += lvl.slots;
							out.pact.override += lvl.slots;
							return;
						}

						out[kSpell].value += lvl.slots;
						out[kSpell].max += lvl.slots;
					});
			}
		} else {
			for (let i = 1; i < 10; ++i) {
				out[`spell${i}`] = {
					value: 0,
					max: 0,
				};
			}
		}

		return out;
	}
}

export {DataConverterCreature};
