import {Config} from "./Config.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilDocuments} from "./UtilDocuments.js";

class UtilActors {
	static init () {
		UtilActors.VALID_DAMAGE_TYPES = Object.keys(MiscUtil.get(CONFIG, "DND5E", "damageTypes") || {});
		UtilActors.VALID_CONDITIONS = Object.keys(MiscUtil.get(CONFIG, "DND5E", "conditionTypes") || {});
	}

	/**
	 * @param [actor]
	 * @param [isAllowAutoDetectPreparationMode]
	 */
	static async pGetActorSpellItemOpts ({actor, isAllowAutoDetectPreparationMode = false} = {}) {
		const opts = {
			isActorItem: true,
			isActorItemNpc: actor?.type === "npc",
			isPrepared: !!Config.get("importSpell", "prepareActorSpells"),
			preparationMode: Config.get("importSpell", "actorSpellPreparationMode"),
		};

		// Avoid setting these options from an in-progress actor import
		if (!actor || this.isImporterTempActor(actor)) return opts;

		const spellcastingAbility = MiscUtil.get(actor, "data", "data", "attributes", "spellcasting");
		if (spellcastingAbility) opts.abilityAbv = spellcastingAbility.value;

		if (actor && isAllowAutoDetectPreparationMode) {
			const autoPreparationMode = await this._pGetActorSpellItemOpts_getAutoPreparationMode({actor});
			if (autoPreparationMode != null) opts.preparationMode = autoPreparationMode;
		}

		return opts;
	}

	static isImporterTempActor (actor) { return !!MiscUtil.get(actor, "data", "flags", SharedConsts.MODULE_NAME_FAKE, "isImporterTempActor"); }

	static async _pGetActorSpellItemOpts_getAutoPreparationMode ({actor}) {
		if (!Config.get("importSpell", "isAutoDetectActorSpellPreparationMode")) return null;

		const classItems = actor.items.filter(it => it.type === "class" && it.data.data?.spellcasting?.progression !== "none");
		if (!classItems.length || classItems.length > 1) return null;

		const sheetItem = classItems[0];

		const spellProgression = sheetItem.data.data.spellcasting.progression;
		switch (spellProgression) {
			case "full":
			case "half":
			case "third":
			case "artificer": {
				const classSubclassMeta = await UtilDataConverter.pGetClassItemClassAndSubclass({sheetItem});
				if (classSubclassMeta.matchingClasses.length !== 1) return null;
				return classSubclassMeta.matchingClasses[0].preparedSpells ? "prepared" : "always";
			}
			case "pact": return "pact";
			default: return null;
		}
	}

	static getSpellItemItemOpts () {
		const opts = {};

		opts.isPrepared = !!Config.get("importSpell", "prepareSpellItems");
		opts.preparationMode = Config.get("importSpell", "spellItemPreparationMode");

		return opts;
	}

	static async pAddActorItems (actor, itemArray, {isTemporary = false} = {}, createEmbeddedDocOpts) {
		if (!itemArray?.length) return [];
		return UtilDocuments.pCreateEmbeddedDocuments(
			actor,
			itemArray,
			{
				isTemporary,
				propData: "items",
				ClsEmbed: Item,
			},
			createEmbeddedDocOpts,
		);
	}

	static async pAddActorEffects (actor, effectArray, {isTemporary = false} = {}, createEmbeddedDocOpts) {
		if (!effectArray?.length) return [];
		return UtilDocuments.pCreateEmbeddedDocuments(
			actor,
			effectArray,
			{
				isTemporary,
				propData: "effects",
				ClsEmbed: ActiveEffect,
			},
			createEmbeddedDocOpts,
		);
	}

	static getMappedTool (str) {
		str = str.toLowerCase().trim();
		return this.VALID_TOOL_PROFICIENCIES[str];
	}

	static getUnmappedTool (str) {
		if (!str) return null;
		return Parser._parse_bToA(this.VALID_TOOL_PROFICIENCIES, str, null);
	}

	static getMappedLanguage (str) {
		str = str.toLowerCase().trim();
		return this.VALID_LANGUAGES[str];
	}

	static getMappedCasterType (str) {
		if (!str) return str;
		return this._VET_CASTER_TYPE_TO_FVTT[str];
	}

	static getMappedArmorProficiency (str) {
		if (!str) return null;
		return Parser._parse_aToB(this.VALID_ARMOR_PROFICIENCIES, str, null);
	}

	static getUnmappedArmorProficiency (str) {
		if (!str) return null;
		return Parser._parse_bToA(this.VALID_ARMOR_PROFICIENCIES, str, null);
	}

	static getMappedWeaponProficiency (str) {
		if (!str) return null;
		return Parser._parse_aToB(this.VALID_WEAPON_PROFICIENCIES, str, null);
	}

	static getUnmappedWeaponProficiency (str) {
		if (!str) return null;
		return Parser._parse_bToA(this.VALID_WEAPON_PROFICIENCIES, str, null);
	}

	static getItemUIdFromWeaponProficiency (str) {
		if (!str) return null;
		str = str.trim();
		const tagItemUid = this._getItemUidFromTag(str);
		if (tagItemUid) return tagItemUid;
		return Parser._parse_aToB(this._WEAPON_PROFICIENCIES_TO_ITEM_UIDS, str, null);
	}

	static getItemUIdFromToolProficiency (str) {
		if (!str) return null;
		str = str.trim();
		const tagItemUid = this._getItemUidFromTag(str);
		if (tagItemUid) return tagItemUid;
		return Parser._parse_aToB(this._TOOL_PROFICIENCIES_TO_ITEM_UIDS, str, null);
	}

	static _getItemUidFromTag (str) {
		const mItem = /^{@item ([^}]+)}$/.exec(str);
		if (!mItem) return null;
		const {name, source} = DataUtil.generic.unpackUid(mItem[1], "item", {isLower: true});
		return `${name}|${source}`;
	}

	/**
	 * Loop over a data model and collect all the possible attributes which could be used in token bars. This is (currently
	 * as of 2020-01-26) what Foundry does to generate the available bar list.
	 *
	 * Based on Foundry's `_getBarAttributes`
	 */
	static getModelBarAttributes (model) {
		if (!model) return [];

		function _searchBarAttributes (stack, data, path) {
			for (let [k, v] of Object.entries(data)) {
				const nxtPath = [...path, k];

				if (v instanceof Object) {
					const isBar = Number.isFinite(parseFloat(v.value)) && Number.isFinite(parseFloat(v.max));

					if (isBar) stack.push(nxtPath);
					else _searchBarAttributes(stack, data[k], nxtPath);
				} else if (Number.isFinite(v)) {
					stack.push(nxtPath);
				}
			}
		}

		const stack = [];
		_searchBarAttributes(stack, model, []);
		return stack.map(v => v.join("."));
	}

	/**
	 * Based on the Foundry token editor method `getBarAttributeChoices`
	 * @param actor An actor, although a wrapped model works equally well.
	 */
	static getActorBarAttributes (actor) {
		if (!actor) return [];
		const attributes = TokenDocument.getTrackedAttributes(actor.data.data, []);
		attributes.bar = attributes.bar.map(v => v.join("."));
		attributes.bar.sort((a, b) => a.localeCompare(b));
		attributes.value = attributes.value.map(v => v.join("."));
		attributes.value.sort((a, b) => a.localeCompare(b));
		return {
			[game.i18n.localize("TOKEN.BarAttributes")]: attributes.bar,
			[game.i18n.localize("TOKEN.BarValues")]: attributes.value,
		};
	}

	static getTotalClassLevels (actor) {
		return actor.items
			.filter(it => it.type === "class")
			.map(it => it.data.data.levels || 0)
			.reduce((a, b) => a + b, 0);
	}

	static isLevelUp (actor) {
		let xpCur = Number(actor?.data?.data?.details?.xp?.value);
		if (isNaN(xpCur)) xpCur = 0;

		const lvlTarget = actor.items.filter(it => it.type === "class").map(it => it.data.data.levels || 0).sum();
		let xpMax = Parser.LEVEL_XP_REQUIRED[lvlTarget];
		if (isNaN(xpMax)) xpMax = Number.MAX_SAFE_INTEGER;

		return xpCur >= xpMax;
	}

	static async pAddCurrencyToActor ({currency, actor}) {
		if (!currency || !actor) return;

		const totals = this.getActorCurrency({actor});
		Parser.COIN_ABVS.forEach(k => totals[k] += currency[k] || 0);

		const actorUpdate = {
			data: {
				currency: totals,
			},
		};
		await UtilDocuments.pUpdateDocument(actor, actorUpdate);
	}

	static getActorCurrency ({actor}) {
		const currency = {};
		const actorCurrency = MiscUtil.get(actor, "data", "data", "currency") || {};
		Parser.COIN_ABVS.forEach(k => currency[k] = actorCurrency[k] || 0);
		return currency;
	}

	static async pGetCreateActorSpellPointsItem ({actor, totalSpellcastingLevels = null}) {
		return SpellPointsItemBuilder.pGetCreateItem({actor, totalLevels: totalSpellcastingLevels});
	}

	static async pGetCreateActorPsiPointsItem ({actor, totalMysticLevels = null}) {
		return PsiPointsItemBuilder.pGetCreateItem({actor, totalLevels: totalMysticLevels});
	}

	static getActorSpellcastingInfo (
		{
			actor,
			sheetItems,
			// Note that this only applies when multiclassing as _multiple spellcasting classes_.
			// "Once you have the Spellcasting feature from more than one class, use the rules below. If you multiclass
			//   but have the Spellcasting feature from only one class, you follow the rules as described in that class."
			//  - PHB p163
			isForceSpellcastingMulticlass = false,
		} = {},
	) {
		if (actor && sheetItems) throw new Error(`Only one of "actor" or "sheetItems" may be specified!`);

		const spellcastingClassItems = (actor?.items || sheetItems).filter(it => it.type === "class")
			.filter(it => it.data?.data?.spellcasting);

		if (!spellcastingClassItems.length) {
			return {
				totalSpellcastingLevels: 0,
				casterClassCount: 0,
				maxPactCasterLevel: 0,
				isSpellcastingMulticlass: isForceSpellcastingMulticlass,
			};
		}

		let totalSpellcastingLevels = 0; // sum up the total caster levels as defined in Multiclassing rules
		let maxPactCasterLevel = 0;

		const isSpellcastingMulticlass = isForceSpellcastingMulticlass || spellcastingClassItems.length > 1;

		const getSpellcastingLevel = (lvl, type) => {
			switch (type) {
				case "half": return Math.ceil(lvl / 2);
				case "third": return Math.ceil(lvl / 3);
				// Artificer behaves like a half-caster, except for the first level
				case "artificer": return lvl === 1 ? 1 : getSpellcastingLevel(lvl, "half");
				default: throw new Error(`Unhandled spellcaster type "${type}"`);
			}
		};

		const getSpellcastingLevelMulticlass = (lvl, type) => {
			switch (type) {
				case "half": return Math.floor(lvl / 2);
				case "third": return Math.floor(lvl / 3);
				// Artificer always uses `ceil` when multiclassing
				// "Spell Slots. Add half your levels (rounded up) in the artificer class to the appropriate levels
				//   from other classes to determine your available spell slots." - ERLW p54
				case "artificer": return Math.ceil(lvl / 2);
				default: throw new Error(`Unhandled spellcaster type "${type}"`);
			}
		};

		const fnGetSpellcastingLevelHalfThird = isSpellcastingMulticlass ? getSpellcastingLevelMulticlass : getSpellcastingLevel;

		spellcastingClassItems
			.forEach(it => {
				const lvl = it.data.data.levels || 0;

				switch (it.data.data.spellcasting.progression) {
					case "full": totalSpellcastingLevels += lvl; break;
					case "half": totalSpellcastingLevels += fnGetSpellcastingLevelHalfThird(lvl, it.data.data.spellcasting.progression); break;
					case "third": totalSpellcastingLevels += fnGetSpellcastingLevelHalfThird(lvl, it.data.data.spellcasting.progression); break;
					case "pact": Math.max(maxPactCasterLevel, lvl); break;
					case "artificer": totalSpellcastingLevels += fnGetSpellcastingLevelHalfThird(lvl, it.data.data.spellcasting.progression); break;
				}
			});

		return {totalSpellcastingLevels, casterClassCount: spellcastingClassItems.length, maxPactCasterLevel, isSpellcastingMulticlass};
	}
}
UtilActors.SKILL_ABV_TO_FULL = {
	acr: "acrobatics",
	ani: "animal handling",
	arc: "arcana",
	ath: "athletics",
	dec: "deception",
	his: "history",
	ins: "insight",
	itm: "intimidation",
	inv: "investigation",
	med: "medicine",
	nat: "nature",
	prc: "perception",
	prf: "performance",
	per: "persuasion",
	rel: "religion",
	slt: "sleight of hand",
	ste: "stealth",
	sur: "survival",
};
UtilActors.PROF_TO_ICON_CLASS = {
	"1": "fa-check",
	"2": "fa-check-double",
	"0.5": "fa-adjust",
};
UtilActors.PROF_TO_TEXT = {
	"1": "Proficient",
	"2": "Proficient with Expertise",
	"0.5": "Half-Proficient",
	"0": "",
};
UtilActors.VET_SIZE_TO_ABV = {
	[SZ_TINY]: "tiny",
	[SZ_SMALL]: "sm",
	[SZ_MEDIUM]: "med",
	[SZ_LARGE]: "lg",
	[SZ_HUGE]: "huge",
	[SZ_GARGANTUAN]: "grg",
};
UtilActors.VET_SPELL_SCHOOL_TO_ABV = {
	A: "abj",
	C: "con",
	D: "div",
	E: "enc",
	V: "evo",
	I: "ill",
	N: "nec",
	T: "trs",
};
UtilActors.CASTER_TYPE_TO_PROGRESSION = {
	"full": [
		[2, 0, 0, 0, 0, 0, 0, 0, 0],
		[3, 0, 0, 0, 0, 0, 0, 0, 0],
		[4, 2, 0, 0, 0, 0, 0, 0, 0],
		[4, 3, 0, 0, 0, 0, 0, 0, 0],
		[4, 3, 2, 0, 0, 0, 0, 0, 0],
		[4, 3, 3, 0, 0, 0, 0, 0, 0],
		[4, 3, 3, 1, 0, 0, 0, 0, 0],
		[4, 3, 3, 2, 0, 0, 0, 0, 0],
		[4, 3, 3, 3, 1, 0, 0, 0, 0],
		[4, 3, 3, 3, 2, 0, 0, 0, 0],
		[4, 3, 3, 3, 2, 1, 0, 0, 0],
		[4, 3, 3, 3, 2, 1, 0, 0, 0],
		[4, 3, 3, 3, 2, 1, 1, 0, 0],
		[4, 3, 3, 3, 2, 1, 1, 0, 0],
		[4, 3, 3, 3, 2, 1, 1, 1, 0],
		[4, 3, 3, 3, 2, 1, 1, 1, 0],
		[4, 3, 3, 3, 2, 1, 1, 1, 1],
		[4, 3, 3, 3, 3, 1, 1, 1, 1],
		[4, 3, 3, 3, 3, 2, 1, 1, 1],
		[4, 3, 3, 3, 3, 2, 2, 1, 1],
	],
	"artificer": [
		[2, 0, 0, 0, 0],
		[2, 0, 0, 0, 0],
		[3, 0, 0, 0, 0],
		[3, 0, 0, 0, 0],
		[4, 2, 0, 0, 0],
		[4, 2, 0, 0, 0],
		[4, 3, 0, 0, 0],
		[4, 3, 0, 0, 0],
		[4, 3, 2, 0, 0],
		[4, 3, 2, 0, 0],
		[4, 3, 3, 0, 0],
		[4, 3, 3, 0, 0],
		[4, 3, 3, 1, 0],
		[4, 3, 3, 1, 0],
		[4, 3, 3, 2, 0],
		[4, 3, 3, 2, 0],
		[4, 3, 3, 3, 1],
		[4, 3, 3, 3, 1],
		[4, 3, 3, 3, 2],
		[4, 3, 3, 3, 2],
	],
	"1/2": [
		[0, 0, 0, 0, 0],
		[2, 0, 0, 0, 0],
		[3, 0, 0, 0, 0],
		[3, 0, 0, 0, 0],
		[4, 2, 0, 0, 0],
		[4, 2, 0, 0, 0],
		[4, 3, 0, 0, 0],
		[4, 3, 0, 0, 0],
		[4, 3, 2, 0, 0],
		[4, 3, 2, 0, 0],
		[4, 3, 3, 0, 0],
		[4, 3, 3, 0, 0],
		[4, 3, 3, 1, 0],
		[4, 3, 3, 1, 0],
		[4, 3, 3, 2, 0],
		[4, 3, 3, 2, 0],
		[4, 3, 3, 3, 1],
		[4, 3, 3, 3, 1],
		[4, 3, 3, 3, 2],
		[4, 3, 3, 3, 2],
	],
	"1/3": [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[2, 0, 0, 0],
		[3, 0, 0, 0],
		[3, 0, 0, 0],
		[3, 0, 0, 0],
		[4, 2, 0, 0],
		[4, 2, 0, 0],
		[4, 2, 0, 0],
		[4, 3, 0, 0],
		[4, 3, 0, 0],
		[4, 3, 0, 0],
		[4, 3, 2, 0],
		[4, 3, 2, 0],
		[4, 3, 2, 0],
		[4, 3, 3, 0],
		[4, 3, 3, 0],
		[4, 3, 3, 0],
		[4, 3, 3, 1],
		[4, 3, 3, 1],
	],
	"pact": [
		[1, 0, 0, 0, 0],
		[2, 0, 0, 0, 0],
		[0, 2, 0, 0, 0],
		[0, 2, 0, 0, 0],
		[0, 0, 2, 0, 0],
		[0, 0, 2, 0, 0],
		[0, 0, 0, 2, 0],
		[0, 0, 0, 2, 0],
		[0, 0, 0, 0, 2],
		[0, 0, 0, 0, 2],
		[0, 0, 0, 0, 3],
		[0, 0, 0, 0, 3],
		[0, 0, 0, 0, 3],
		[0, 0, 0, 0, 3],
		[0, 0, 0, 0, 3],
		[0, 0, 0, 0, 3],
		[0, 0, 0, 0, 4],
		[0, 0, 0, 0, 4],
		[0, 0, 0, 0, 4],
		[0, 0, 0, 0, 4],
	],
};

UtilActors.PACT_CASTER_MAX_SPELL_LEVEL = 5;

UtilActors.VALID_DAMAGE_TYPES = null;
UtilActors.VALID_CONDITIONS = null;

// Taken from 5etools' JSON schema
UtilActors.TOOL_PROFICIENCIES_ARTISANS = [
	"alchemist's supplies",
	"brewer's supplies",
	"calligrapher's supplies",
	"carpenter's tools",
	"cartographer's tools",
	"cobbler's tools",
	"cook's utensils",
	"glassblower's tools",
	"jeweler's tools",
	"leatherworker's tools",
	"mason's tools",
	"painter's supplies",
	"potter's tools",
	"smith's tools",
	"tinker's tools",
	"weaver's tools",
	"woodcarver's tools",
];
UtilActors.TOOL_PROFICIENCIES = [
	"artisan's tools",

	...UtilActors.TOOL_PROFICIENCIES_ARTISANS,

	"disguise kit",
	"forgery kit",
	"gaming set",
	"herbalism kit",
	"musical instrument",
	"navigator's tools",
	"thieves' tools",
	"poisoner's kit",
	"vehicles (land)",
	"vehicles (water)",
];
UtilActors.TOOL_PROFICIENCIES_TO_UID = {
	"alchemist's supplies": "alchemist's supplies|phb",
	"brewer's supplies": "brewer's supplies|phb",
	"calligrapher's supplies": "calligrapher's supplies|phb",
	"carpenter's tools": "carpenter's tools|phb",
	"cartographer's tools": "cartographer's tools|phb",
	"cobbler's tools": "cobbler's tools|phb",
	"cook's utensils": "cook's utensils|phb",
	"glassblower's tools": "glassblower's tools|phb",
	"jeweler's tools": "jeweler's tools|phb",
	"leatherworker's tools": "leatherworker's tools|phb",
	"mason's tools": "mason's tools|phb",
	"painter's supplies": "painter's supplies|phb",
	"potter's tools": "potter's tools|phb",
	"smith's tools": "smith's tools|phb",
	"tinker's tools": "tinker's tools|phb",
	"weaver's tools": "weaver's tools|phb",
	"woodcarver's tools": "woodcarver's tools|phb",
	"disguise kit": "disguise kit|phb",
	"forgery kit": "forgery kit|phb",
	"gaming set": "gaming set|phb",
	"herbalism kit": "herbalism kit|phb",
	"musical instrument": "musical instrument|phb",
	"navigator's tools": "navigator's tools|phb",
	"thieves' tools": "thieves' tools|phb",
	"poisoner's kit": "poisoner's kit|phb",
};
UtilActors.VALID_TOOL_PROFICIENCIES = {
	"artisan's tools": "art",
	"alchemist's supplies": "alchemist",
	"brewer's supplies": "brewer",
	"calligrapher's supplies": "calligrapher",
	"carpenter's tools": "carpenter",
	"cartographer's tools": "cartographer",
	"cobbler's tools": "cobbler",
	"cook's utensils": "cook",
	"glassblower's tools": "glassblower",
	"jeweler's tools": "jeweler",
	"leatherworker's tools": "leatherworker",
	"mason's tools": "mason",
	"painter's supplies": "painter",
	"potter's tools": "potter",
	"smith's tools": "smith",
	"tinker's tools": "tinker",
	"weaver's tools": "weaver",
	"woodcarver's tools": "woodcarver",

	"disguise kit": "disg",

	"forgery kit": "forg",

	"gaming set": "game",
	"dice set": "dice",
	"dragonchess set": "chess",
	"playing card set": "card",
	"three-dragon ante set": "card",

	"herbalism kit": "herb",

	"musical instrument": "music",
	"bagpipes": "bagpipes",
	"drum": "drum",
	"dulcimer": "dulcimer",
	"flute": "flute",
	"lute": "lute",
	"lyre": "lyre",
	"horn": "horn",
	"pan flute": "panflute",
	"shawm": "shawm",
	"viol": "viol",

	"navigator's tools": "navg",

	"poisoner's kit": "pois",

	"thieves' tools": "thief",

	"vehicle (land or water)": "vehicle",
	"vehicle (air)": "air",
	"vehicle (land)": "land",
	"vehicle (water)": "water",
};
UtilActors.VALID_LANGUAGES = {
	"common": "common",
	"aarakocra": "aarakocra",
	"abyssal": "abyssal",
	"aquan": "aquan",
	"auran": "auran",
	"celestial": "celestial",
	"deep speech": "deep",
	"draconic": "draconic",
	"druidic": "druidic",
	"dwarvish": "dwarvish",
	"elvish": "elvish",
	"giant": "giant",
	"gith": "gith",
	"gnomish": "gnomish",
	"goblin": "goblin",
	"gnoll": "gnoll",
	"halfling": "halfling",
	"ignan": "ignan",
	"infernal": "infernal",
	"orc": "orc",
	"primordial": "primordial",
	"sylvan": "sylvan",
	"terran": "terran",
	"thieves' cant": "cant",
	"undercommon": "undercommon",
};
UtilActors.LANGUAGES_PRIMORDIAL = [
	"aquan",
	"auran",
	"ignan",
	"terran",
];
UtilActors._VET_CASTER_TYPE_TO_FVTT = {
	"full": "full",
	"1/2": "half",
	"1/3": "third",
	"pact": "pact",
};
// Taken from 5etools' JSON schema
UtilActors.ARMOR_PROFICIENCIES = [
	"light",
	"medium",
	"heavy",
	"shield|phb",
];
UtilActors.VALID_ARMOR_PROFICIENCIES = {
	"light": "lgt",
	"medium": "med",
	"heavy": "hvy",
	"shield|phb": "shl",
};
UtilActors.WEAPON_PROFICIENCIES = [
	"battleaxe|phb",
	"club|phb",
	"dagger|phb",
	"flail|phb",
	"glaive|phb",
	"greataxe|phb",
	"greatclub|phb",
	"greatsword|phb",
	"halberd|phb",
	"handaxe|phb",
	"javelin|phb",
	"lance|phb",
	"light hammer|phb",
	"longsword|phb",
	"mace|phb",
	"maul|phb",
	"morningstar|phb",
	"pike|phb",
	"quarterstaff|phb",
	"rapier|phb",
	"scimitar|phb",
	"shortsword|phb",
	"sickle|phb",
	"spear|phb",
	"staff|phb",
	"trident|phb",
	"war pick|phb",
	"warhammer|phb",
	"whip|phb",
	"blowgun|phb",
	"dart|phb",
	"hand crossbow|phb",
	"heavy crossbow|phb",
	"light crossbow|phb",
	"longbow|phb",
	"net|phb",
	"shortbow|phb",
	"sling|phb",
];
UtilActors.VALID_WEAPON_PROFICIENCIES = {
	"simple": "sim",
	"martial": "mar",

	"club|phb": "club",
	"dagger|phb": "dagger",
	"dart|phb": "dart",
	"greatclub|phb": "greatclub",
	"handaxe|phb": "handaxe",
	"javelin|phb": "javelin",
	"light crossbow|phb": "lightcrossbow",
	"light hammer|phb": "lighthammer",
	"mace|phb": "mace",
	"quarterstaff|phb": "quarterstaff",
	"shortbow|phb": "shortbow",
	"sickle|phb": "sickle",
	"sling|phb": "sling",
	"spear|phb": "spear",

	"battleaxe|phb": "battleaxe",
	"blowgun|phb": "blowgun",
	"flail|phb": "flail",
	"glaive|phb": "glaive",
	"greataxe|phb": "greataxe",
	"greatsword|phb": "greatsword",
	"halberd|phb": "halberd",
	"hand crossbow|phb": "handcrossbow",
	"heavy crossbow|phb": "heavycrossbow",
	"lance|phb": "lance",
	"longbow|phb": "longbow",
	"longsword|phb": "longsword",
	"maul|phb": "maul",
	"morningstar|phb": "morningstar",
	"net|phb": "net",
	"pike|phb": "pike",
	"rapier|phb": "rapier",
	"scimitar|phb": "scimitar",
	"shortsword|phb": "shortsword",
	"trident|phb": "trident",
	"war pick|phb": "warpick",
	"warhammer|phb": "warhammer",
	"whip|phb": "whip",
};
UtilActors._WEAPON_PROFICIENCIES_TO_ITEM_UIDS = {
	// region Plural
	"battleaxes": "battleaxe|phb",
	"clubs": "club|phb",
	"daggers": "dagger|phb",
	"flails": "flail|phb",
	"glaives": "glaive|phb",
	"greataxes": "greataxe|phb",
	"greatclubs": "greatclub|phb",
	"greatswords": "greatsword|phb",
	"halberds": "halberd|phb",
	"handaxes": "handaxe|phb",
	"javelins": "javelin|phb",
	"lances": "lance|phb",
	"light hammers": "light hammer|phb",
	"longswords": "longsword|phb",
	"maces": "mace|phb",
	"mauls": "maul|phb",
	"morningstars": "morningstar|phb",
	"pikes": "pike|phb",
	"quarterstaffs": "quarterstaff|phb",
	"rapiers": "rapier|phb",
	"scimitars": "scimitar|phb",
	"shortswords": "shortsword|phb",
	"sickles": "sickle|phb",
	"spears": "spear|phb",
	"staffs": "staff|phb",
	"tridents": "trident|phb",
	"war picks": "war pick|phb",
	"warhammers": "warhammer|phb",
	"whips": "whip|phb",

	"blowguns": "blowgun|phb",
	"darts": "dart|phb",
	"hand crossbows": "hand crossbow|phb",
	"heavy crossbows": "heavy crossbow|phb",
	"light crossbows": "light crossbow|phb",
	"longbows": "longbow|phb",
	"nets": "net|phb",
	"shortbows": "shortbow|phb",
	"slings": "sling|phb",
	// endregion

	// region Single
	"battleaxe": "battleaxe|phb",
	"club": "club|phb",
	"dagger": "dagger|phb",
	"flail": "flail|phb",
	"glaive": "glaive|phb",
	"greataxe": "greataxe|phb",
	"greatclub": "greatclub|phb",
	"greatsword": "greatsword|phb",
	"halberd": "halberd|phb",
	"handaxe": "handaxe|phb",
	"javelin": "javelin|phb",
	"lance": "lance|phb",
	"light hammer": "light hammer|phb",
	"longsword": "longsword|phb",
	"mace": "mace|phb",
	"maul": "maul|phb",
	"morningstar": "morningstar|phb",
	"pike": "pike|phb",
	"quarterstaff": "quarterstaff|phb",
	"rapier": "rapier|phb",
	"scimitar": "scimitar|phb",
	"shortsword": "shortsword|phb",
	"sickle": "sickle|phb",
	"spear": "spear|phb",
	"staff": "staff|phb",
	"trident": "trident|phb",
	"war pick": "war pick|phb",
	"warhammer": "warhammer|phb",
	"whip": "whip|phb",

	"blowgun": "blowgun|phb",
	"dart": "dart|phb",
	"hand crossbow": "hand crossbow|phb",
	"heavy crossbow": "heavy crossbow|phb",
	"light crossbow": "light crossbow|phb",
	"longbow": "longbow|phb",
	"net": "net|phb",
	"shortbow": "shortbow|phb",
	"sling": "sling|phb",
	// endregion
};
UtilActors.WEAPONS_MARTIAL = [
	"battleaxe|phb",
	"blowgun|phb",
	"flail|phb",
	"glaive|phb",
	"greataxe|phb",
	"greatsword|phb",
	"halberd|phb",
	"hand crossbow|phb",
	"heavy crossbow|phb",
	"lance|phb",
	"longbow|phb",
	"longsword|phb",
	"maul|phb",
	"morningstar|phb",
	"net|phb",
	"pike|phb",
	"rapier|phb",
	"scimitar|phb",
	"shortsword|phb",
	"trident|phb",
	"war pick|phb",
	"warhammer|phb",
	"whip|phb",
];
UtilActors.WEAPONS_SIMPLE = [
	"club|phb",
	"dagger|phb",
	"dart|phb",
	"greatclub|phb",
	"handaxe|phb",
	"javelin|phb",
	"light crossbow|phb",
	"light hammer|phb",
	"mace|phb",
	"quarterstaff|phb",
	"shortbow|phb",
	"sickle|phb",
	"sling|phb",
	"spear|phb",
];
UtilActors._TOOL_PROFICIENCIES_TO_ITEM_UIDS = {
	"alchemist's supplies": "alchemist's supplies|phb",
	"artisan's tools": "artisan's tools|phb",
	"bagpipes": "bagpipes|phb",
	"brewer's supplies": "brewer's supplies|phb",
	"calligrapher's supplies": "calligrapher's supplies|phb",
	"carpenter's tools": "carpenter's tools|phb",
	"cartographer's tools": "cartographer's tools|phb",
	"cobbler's tools": "cobbler's tools|phb",
	"cook's utensils": "cook's utensils|phb",
	"disguise kit": "disguise kit|phb",
	"drum": "drum|phb",
	"dulcimer": "dulcimer|phb",
	"flute": "flute|phb",
	"forgery kit": "forgery kit|phb",
	"glassblower's tools": "glassblower's tools|phb",
	"herbalism kit": "herbalism kit|phb",
	"horn": "horn|phb",
	"jeweler's tools": "jeweler's tools|phb",
	"leatherworker's tools": "leatherworker's tools|phb",
	"lute": "lute|phb",
	"lyre": "lyre|phb",
	"mason's tools": "mason's tools|phb",
	"musical instrument": "musical instrument|phb",
	"navigator's tools": "navigator's tools|phb",
	"painter's supplies": "painter's supplies|phb",
	"pan flute": "pan flute|phb",
	"poisoner's kit": "poisoner's kit|phb",
	"potter's tools": "potter's tools|phb",
	"shawm": "shawm|phb",
	"smith's tools": "smith's tools|phb",
	"thieves' tools": "thieves' tools|phb",
	"tinker's tools": "tinker's tools|phb",
	"viol": "viol|phb",
	"weaver's tools": "weaver's tools|phb",
	"woodcarver's tools": "woodcarver's tools|phb",
};

UtilActors.BG_SKILL_PROFS_CUSTOMIZE = [
	{
		choose: {
			from: Object.keys(Parser.SKILL_TO_ATB_ABV),
			count: 2,
		},
	},
];

UtilActors.LANG_TOOL_PROFS_CUSTOMIZE = [
	{
		anyStandardLanguage: 2,
	},
	{
		anyStandardLanguage: 1,
		anyTool: 1,
	},
	{
		anyTool: 2,
	},
];

class SpellPsiPointsItemBuilder {
	static _ITEM_NAME = "";
	static _ITEM_IMG = "";
	static _FLAG_TYPE = "";

	static async pGetCreateItem ({actor, totalLevels = null}) {
		if (!this._isEnabled({actor})) return null;

		// region If we have an existing item, return the ID (and update the item if appropriate)
		const existingItem = actor.items.contents.find(it => it.data?.flags?.[SharedConsts.MODULE_NAME_FAKE]?.type === this._FLAG_TYPE);
		if (existingItem) {
			if (totalLevels == null) return existingItem;

			const curPointsVal = (existingItem.data._source || existingItem.data)?.data?.uses?.value || 0;
			const curPointsMax = (existingItem.data._source || existingItem.data)?.data?.uses?.max || 0;

			const points = await this._pGetPoints({totalLevels});
			if (points > curPointsMax) {
				const deltaCur = (points - curPointsMax);
				await UtilDocuments.pUpdateEmbeddedDocuments(
					actor,
					[
						{
							_id: existingItem.id,
							data: {
								uses: {value: curPointsVal + deltaCur, max: points},
							},
						},
					],
					{
						propData: "items",
						ClsEmbed: Item,
					},
				);
			}

			return existingItem;
		}
		// endregion

		// region Otherwise, create a "<X> Points" item, and return the ID
		if (totalLevels == null) totalLevels = await this._pGetTotalLevelsIfNull({actor});

		const points = await this._pGetPoints({totalLevels});
		const iemData = {
			name: this._ITEM_NAME,
			type: "feat",
			data: {
				description: {
					value: await UtilDataConverter.pGetWithDescriptionPlugins(() => this._pGetItemDescription()),
				},
				source: this._getItemSource(),
				activation: {cost: 0, type: "none"},
				uses: {
					value: points,
					max: Math.max(points, 1), // At least one point is required by Foundry to have the item be selectable as a source of charges
					per: "lr",
				},
			},
			img: this._ITEM_IMG,
			flags: {
				[SharedConsts.MODULE_NAME_FAKE]: {
					type: this._FLAG_TYPE,
				},
			},
		};

		const importedEmbeds = await UtilActors.pAddActorItems(
			actor,
			[iemData],
		);
		return importedEmbeds[0].document;
		// endregion
	}

	/** @returns {*} */
	static _isEnabled () { throw new Error("Unimplemented!"); }

	/** @returns {*} */
	static async _pGetTotalLevelsIfNull () { throw new Error("Unimplemented!"); }

	/** @returns {*} */
	static async _pGetPoints () { throw new Error("Unimplemented!"); }

	/** @returns {*} */
	static async _pGetItemDescription () { throw new Error("Unimplemented!"); }

	/** @returns {*} */
	static _getItemSource () { throw new Error("Unimplemented!"); }
}

class SpellPointsItemBuilder extends SpellPsiPointsItemBuilder {
	static _ITEM_NAME = "Spell Points";
	static _ITEM_IMG = `icons/magic/light/explosion-star-glow-silhouette.webp`;
	static _FLAG_TYPE = "spellPointsTracker";

	static _isEnabled ({actor}) {
		const configKeySpellPoints = actor?.type === "npc" ? "isSpellPointsNpc" : "isSpellPoints";

		if (!Config.get("importSpell", configKeySpellPoints)) return false;
		if (Config.get("importSpell", "spellPointsResource") !== ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM) return false;

		return true;
	}

	static async _pGetTotalLevelsIfNull ({actor}) {
		return UtilActors.getActorSpellcastingInfo({actor: actor})?.totalSpellcastingLevels;
	}

	static _pGetPoints ({totalLevels}) { return UtilDataConverter.getSpellPointTotal({totalSpellcastingLevels: totalLevels}); }

	static async _pGetItemDescription () {
		const entSpellPointVariant = await Renderer.hover.pCacheAndGet(UrlUtil.PG_VARIANTRULES, SRC_DMG, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VARIANTRULES]({name: "Spell Points", source: SRC_DMG}), {isCopy: true});
		delete entSpellPointVariant?.name;
		delete entSpellPointVariant?.page;
		delete entSpellPointVariant?.source;
		return `<div>${Renderer.get().render(`{@note This item was automatically generated to track your spell points. It can be freely modified.}`)}</div>
		<hr class="hr-2">
		<div>${Renderer.get().setFirstSection(true).render(entSpellPointVariant || "")}</div>`;
	}

	/** @returns {*} */
	static _getItemSource () { return UtilDataConverter.getSourceWithPagePart({source: SRC_DMG, page: 288}); }
}

class PsiPointsItemBuilder extends SpellPsiPointsItemBuilder {
	static _ITEM_NAME = "Psi Points";
	static _ITEM_IMG = `icons/magic/perception/third-eye-blue-red.webp`;
	static _FLAG_TYPE = "psiPointsTracker";

	static _isEnabled () { return Config.get("importPsionic", "psiPointsResource") === ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM; }

	static async _pGetTotalLevelsIfNull ({actor}) {
		const {Charactermancer_Class_Util} = await import("./UtilCharactermancerClass.js");
		return Charactermancer_Class_Util.getMysticProgression({otherExistingClassItems: actor.items.contents.filter(it => it.type === "class")}).totalMysticLevels;
	}

	static _pGetPoints ({totalLevels}) { return UtilDataConverter.getPsiPointTotal({totalMysticLevels: totalLevels}); }

	static async _pGetItemDescription () {
		const entries = {
			type: "entries",
			entries: [
				{
					"type": "entries",
					"name": "Psi Points",
					"entries": [
						"You have an internal reservoir of energy that can be devoted to psionic disciplines you know. This energy is represented by psi points. Each psionic discipline describes effects you can create with it by spending a certain number of psi points. A psionic talent requires no psi points.",
						"The number of psi points you have is based on your mystic level, as shown in the Psi Points column of the Mystic table. The number shown for your level is your psi point maximum. Your psi point total returns to its maximum when you finish a long rest. The number of psi points you have can't go below 0 or over your maximum.",
					],
				},
				{
					"type": "entries",
					"name": "Psi Limit",
					"entries": [
						"Though you have access to a potent amount of psionic energy, it takes training and practice to channel that energy. There is a limit on the number of psi points you can spend to activate a psionic discipline. The limit is based on your mystic level, as shown in the Psi Limit column of the Mystic table. For example, as a 3rd-level mystic, you can spend no more than 3 psi points on a discipline each time you use it, no matter how many psi points you have.",
					],
				},
				{
					"type": "table",
					"caption": "Mystic",
					"colLabels": ["Level", "Psi Points", "Psi Limit"],
					"colStyles": ["col-4 text-center", "col-4 text-center", "col-4 text-center"],
					"rows": [
						["1st", 4, 2],
						["2nd", 6, 2],
						["3rd", 14, 3],
						["4th", 17, 3],
						["5th", 27, 5],
						["6th", 32, 5],
						["7th", 38, 6],
						["8th", 44, 6],
						["9th", 57, 7],
						["10th", 64, 7],
						["11th", 64, 7],
						["12th", 64, 7],
						["13th", 64, 7],
						["14th", 64, 7],
						["15th", 64, 7],
						["16th", 64, 7],
						["17th", 64, 7],
						["18th", 71, 7],
						["19th", 71, 7],
						["20th", 71, 7],
					],
				},
			],
		};
		return `<div>${Renderer.get().render(`{@note This item was automatically generated to track your psi points. It can be freely modified.}`)}</div>
		<hr class="hr-2">
		<div>${Renderer.get().setFirstSection(true).render(entries)}</div>`;
	}

	/** @returns {*} */
	static _getItemSource () { return UtilDataConverter.getSourceWithPagePart({source: SRC_UATMC, page: 3}); }
}

export {UtilActors};
