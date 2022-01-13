import { applyActiveEffects, socketlibSocket } from "./GMAction.js";
import { warn, error, debug, setDebugLevel, i18n } from "../dae.js";
import { ActiveEffects } from "./apps/ActiveEffects.js";
import { DAEActiveEffectConfig } from "./apps/DAEActiveEffectConfig.js";
import { patchPrepareArmorClassAttribution, updatePatches } from "./patching.js";
import { macroActorUpdate } from "./daeMacros.js";
export let _characterSpec = { data: {}, flags: {} };
let templates = {};
export var aboutTimeInstalled = false;
export var timesUpInstalled = false;
export var simpleCalendarInstalled = false;
export var requireItemTarget = true;
export var cubActive;
export var ceActive;
export var atlActive;
export var furnaceActive;
export var itemacroActive;
export var conditionalVisibilityActive;
export var midiActive;
export var debugEnabled;
// export var useAbilitySave;
export var activeConditions;
export var confirmDelete;
export var ehnanceStatusEffects;
export var expireRealTime;
export var daeActionTypeKeys;
export var displayTraits;
export var noDupDamageMacro;
export var disableEffects;
export var daeTitleBar;
export var libWrapper;
// export var showDeprecation = true;
export var showInline = false;
let debugLog = true;
export class ValidSpec {
    constructor(fs, sv, forcedMode = -1) {
        this._fieldSpec = fs;
        this._sampleValue = sv;
        this._label = fs;
        this._forcedMode = forcedMode;
    }
    get fieldSpec() { return this._fieldSpec; }
    ;
    set fieldSpec(spec) { this._fieldSpec = spec; }
    get sampleValue() { return this._sampleValue; }
    set sampleValue(value) { this._sampleValue = value; }
    get label() { return this._label; }
    set label(label) { this._label = label; }
    get forcedMode() { return this._forcedMode; }
    set forcedMode(mode) { this._forcedMode = mode; }
    static createValidMods(characterSpec = game.system.model.Actor.character) {
        _characterSpec["data"] = duplicate(characterSpec);
        let baseValues = flattenObject(_characterSpec);
        // data.attributes.prof/data.details.level and data.attributes.hd are all calced in prepareBaseData
        baseValues["data.attributes.prof"] = [0];
        baseValues["data.details.level"] = [0];
        baseValues["data.attributes.hd"] = 0;
        baseValues["data.attributes.ac.bonus"] = 0;
        baseValues["data.attributes.ac.base"] = 0;
        baseValues["data.attributes.ac.cover"] = 0;
        baseValues["data.bonuses.All-Attacks"] = "";
        baseValues["data.bonuses.weapon.attack"] = "";
        baseValues["data.bonuses.spell.attack"] = "";
        baseValues["data.bonuses.All-Damage"] = "";
        baseValues["data.bonuses.weapon.damage"] = "";
        baseValues["data.bonuses.spell.damage"] = "";
        baseValues["data.bonuses.heal.damage"] = "";
        baseValues["data.bonuses.heal.attack"] = "";
        baseValues["data.bonuses.save.damage"] = "";
        baseValues["data.bonuses.abil.damage"] = "";
        // baseValues["items"] = ""; // TODO one day work this out.
        //@ts-ignore
        if (game.modules.get("gm-notes")?.active) {
            baseValues["flags.gm-notes.notes"] = "";
        }
        if (game.modules.get("skill-customization-5e")?.active && game.system.id === "dnd5e") {
            Object.keys(CONFIG.DND5E.skills).forEach(skl => {
                baseValues[`flags.skill-customization-5e.${skl}.skill-bonus`] = "";
            });
        }
        //@ts-ignore
        const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
        if (["dnd5e", "sw5e"].includes(game.system.id)) {
            var specials = {
                //@ts-ignore - come back to this
                "data.attributes.ac.value": [0, -1],
                "data.attributes.ac.min": [0, -1],
                "data.attributes.hp.max": [0, -1],
                "data.attributes.hp.tempmax": [0, -1],
                "data.attributes.hp.min": [0, -1],
                // This does not work look at CONFIG.Comabt.initiative.formula
                "data.attributes.init.total": [0, -1],
                "data.attributes.init.bonus": [0, -1],
                "data.attributes.hd": [0, -1],
                "data.abilities.str.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.abilities.dex.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.abilities.int.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.abilities.wis.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.abilities.cha.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.abilities.con.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.attributes.encumbrance.max": [0, -1],
                // "skills.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "macro.execute": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "macro.itemMacro": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "macro.actorUpdate": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.languages.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.languages.value": ["", -1],
                "data.traits.languages.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.di.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.di.value": ["", -1],
                "data.traits.di.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.dr.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.dr.value": ["", -1],
                "data.traits.dr.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.dv.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.dv.value": ["", -1],
                "data.traits.dv.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.ci.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.ci.value": ["", -1],
                "data.traits.ci.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.toolProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.toolProf.value": ["", -1],
                "data.traits.toolProf.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.armorProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.armorProf.value": ["", -1],
                "data.traits.armorProf.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.weaponProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.weaponProf.value": ["", -1],
                "data.traits.weaponProf.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.traits.size": ["", ACTIVE_EFFECT_MODES.OVERRIDE],
                "data.resources.primary.max": [0, -1],
                "data.resources.primary.label": ["", ACTIVE_EFFECT_MODES.OVERRIDE],
                "data.resources.secondary.max": [0, -1],
                "data.resources.secondary.label": ["", ACTIVE_EFFECT_MODES.OVERRIDE],
                "data.resources.tertiary.max": [0, -1],
                "data.resources.tertiary.label": ["", ACTIVE_EFFECT_MODES.OVERRIDE],
                "data.resources.legact.max": [0, -1],
                "data.resources.legres.max": [0, -1],
                "data.spells.pact.level": [0, -1],
                "flags.dae": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.attributes.movement.all": ["", ACTIVE_EFFECT_MODES.CUSTOM],
                "data.attributes.movement.hover": [0, ACTIVE_EFFECT_MODES.CUSTOM]
            };
            // change movement effects to be after prepareDerivedData
            for (let key of Object.keys(CONFIG.DND5E.movementTypes)) {
                specials[`data.attributes.movement.${key}`] = [0, -1];
            }
            specials["macro.CUB"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
            specials["macro.CE"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
            specials["StatusEffect"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
            if (game.modules.get("ATL")?.active) {
                // support new version of ATL
                if (isNewerVersion("0.3.04", game.modules.get("ATL").data.version)) {
                    for (let label of ["dimLight", "brightLight", "dimSight", "brightSight", "sightAngle", "lightColor", "lightAnimation", "lightAlpha", "lightAngle"]) {
                        specials[`ATL.${label}`] = [0, -1];
                    }
                }
                else {
                    for (let label of ["light.dim", "light.bright", "dimSight", "brightSight", "sightAngle", "light.color", "light.animation", "light.alpha", "light.angle"]) {
                        specials[`ATL.${label}`] = [0, -1];
                    }
                }
                specials["ATL.preset"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
            }
            // TODO reactivate when cond vis is 0.8.6 ready
            // specials["macro.ConditionalVisibility"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
            // specials["macro.ConditionalVisibilityVision"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
            specials[`flags.${game.system.id}.initiativeHalfProf`] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
            specials[`flags.${game.system.id}.DamageBonusMacro`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
            specials[`flags.${game.system.id}.initiativeDisadv`] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
            if (game.system.id === "sw5e") {
                specials["data.attributes.powerForceLightDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
                specials["data.attributes.powerForceDarkDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
                specials["data.attributes.powerForceUnivDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
                specials["data.attributes.powerTechDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
            }
            // move all the characteer flags to specials so that the can be custom effects only
            let charFlagKeys = (game.system.id === "dnd5e") ? Object.keys(CONFIG.DND5E.characterFlags) : Object.keys(CONFIG.SW5E.characterFlags);
            charFlagKeys.forEach(key => {
                let theKey = `flags.${game.system.id}.${key}`;
                if ([`flags.${game.system.id}.weaponCriticalThreshold`,
                    `flags.${game.system.id}.powerCriticalThreshold`,
                    `flags.${game.system.id}.meleeCriticalDamageDice`,
                    `flags.${game.system.id}.spellCriticalThreshold`].includes(theKey)) {
                    specials[theKey] = [0, -1];
                    delete baseValues[theKey];
                }
                else
                    baseValues[theKey] = false;
            });
            //TODO work out how to evaluate this to a number in prepare data - it looks like this is wrong
            baseValues["data.bonuses.spell.dc"] = 0;
            Object.keys(baseValues).forEach(key => {
                // can't modify all spell details.
                if (key.includes("data.spells")) {
                    delete baseValues[key];
                }
                if (key.includes("data.spells") && key.includes("override")) {
                    baseValues[key] = 0;
                }
            });
            Object.keys(specials).forEach(key => {
                delete baseValues[key];
            });
            delete baseValues["data.attributes.init.total"];
            delete baseValues["data.attributes.init.mod"];
            delete baseValues["data.attributes.init.bonus"];
            delete baseValues["flags"];
        }
        // baseSpecs are all those fields defined in template.json game.system.model and are things the user can directly change
        this.baseSpecs = Object.keys(baseValues).map(spec => {
            let validSpec = new ValidSpec(spec, baseValues[spec], -1);
            if (spec.includes("data.skills") && spec.includes("ability")) {
                validSpec.forcedMode = ACTIVE_EFFECT_MODES.OVERRIDE;
            }
            if (spec.includes("data.bonuses.abilities")) {
                validSpec.forcedMode = -1;
            }
            if (spec.includes(`flags.${game.system.id}`))
                validSpec.forcedMode = ACTIVE_EFFECT_MODES.CUSTOM;
            this.baseSpecsObj[spec] = validSpec;
            return validSpec;
        });
        //@ts-ignore
        if (game.modules.get("tokenmagic")?.active) {
            specials["macro.tokenMagic"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
        }
        // Do the system specific part
        if (["dnd5e", "sw5e"].includes(game.system.id)) {
            // 1. abilities add mod and save to each;
            Object.keys(_characterSpec.data.abilities).forEach(ablKey => {
                let abl = _characterSpec.data.abilities[ablKey];
                this.derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.mod`, 0));
                this.derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.save`, 0));
                this.derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.min`, 0));
            });
            // adjust specs for bonuses - these are strings, @fields are looked up but dice are not rolled.
            // Skills add mod, passive and bonus fields
            Object.keys(_characterSpec.data.skills).forEach(sklKey => {
                let skl = _characterSpec.data.skills[sklKey];
                this.derivedSpecs.push(new ValidSpec(`data.skills.${sklKey}.mod`, 0));
                this.derivedSpecs.push(new ValidSpec(`data.skills.${sklKey}.passive`, 0));
            });
            Object.entries(specials).forEach(special => {
                let validSpec = new ValidSpec(special[0], special[1][0], special[1][1]);
                this.derivedSpecs.push(validSpec);
            });
        }
        this.allSpecs = this.baseSpecs.concat(this.derivedSpecs);
        if (["dnd5e", "sw5e"].includes(game.system.id)) {
            // Special case for armor/hp which can depend on derived attributes - like dexterity mod or constituion mod
            // and initiative bonus depends on advantage on initiative
            this.allSpecs.forEach(m => {
                if (["attributes.hp", "attributes.ac"].includes(m._fieldSpec)) {
                    m._sampleValue = 0;
                }
            });
        }
        this.allSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1; });
        this.baseSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1; });
        this.derivedSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1; });
        this.allSpecs.forEach(ms => this.allSpecsObj[ms._fieldSpec] = ms);
        this.baseSpecs.forEach(ms => this.baseSpecsObj[ms._fieldSpec] = ms);
        this.derivedSpecs.forEach(ms => this.derivedSpecsObj[ms._fieldSpec] = ms);
    }
    static localizeSpecs() {
        const fieldStart = `flags.${game.system.id}.`;
        this.allSpecs = this.allSpecs.map(m => {
            m._label = m._label.replace("data.", "").replace(`{game.system.id}.`, "").replace(".value", "").split(".").map(str => game.i18n.localize(`dae.${str}`)).join(" ");
            if (m.fieldSpec.includes(`flags.${game.system.id}`)) {
                const fieldId = m.fieldSpec.replace(fieldStart, "");
                const characterFlags = (game.system.id === "dnd5e") ? CONFIG.DND5E.characterFlags : CONFIG.SW5E.characterFlags;
                const localizedString = i18n(characterFlags[fieldId]?.name) ?? i18n(`dae.${fieldId}`);
                m._label = `Flags ${localizedString}`;
            }
            if (isNewerVersion(game.system.data.version, "1.4.9")) {
                const saveBonus = m._fieldSpec.match(/data.abilities.(\w\w\w).save/);
                const checkBonus = m._fieldSpec.match(/data.abilities.(\w\w\w).mod/);
                const skillMod = m._fieldSpec.match(/data.skills.(\w\w\w).mod/);
                const skillPassive = m._fieldSpec.match(/data.skills.(\w\w\w).passive/);
                if (saveBonus)
                    m._label = `${m._label} (Deprecated)`;
                else if (checkBonus)
                    m._label = `${m._label} (Deprecated)`;
                else if (skillMod)
                    m._label = `${m._label} (Deprecated)`;
                else if (skillPassive)
                    m._label = `${m._label} (Deprecated)`;
                else if (m._fieldSpec === "data.attributes.ac.value")
                    m._label = `${m._label} (Deprecated)`;
                else if (this.derivedSpecsObj[m._fieldSpec])
                    m._label = `${m._label} (*)`;
            }
            else {
                if (this.derivedSpecsObj[m._fieldSpec])
                    m._label = `${m._label} (*)`;
            }
            return m;
        });
    }
}
ValidSpec.allSpecs = [];
ValidSpec.allSpecsObj = {};
ValidSpec.baseSpecs = [];
ValidSpec.derivedSpecsObj = {};
ValidSpec.baseSpecsObj = {};
ValidSpec.derivedSpecs = [];
function effectDisabled(actor, efData, itemData = null) {
    let disabled = efData.disabled;
    const ci = actor.data.data.traits?.ci?.value;
    const statusId = (efData.flags?.core?.statusId ?? "no effect").toLocaleLowerCase();
    disabled = disabled || efData.isSuppressed || (ci.length && ci.find(c => statusId.endsWith(c)));
    // TODO need to match this up for cub/CE
    if (isNewerVersion("1.4.3", game.system.data.version) && !isNewerVersion(game.version, "9.200")) {
        // transfer effects depend on the item to disable/enable (if there is one)
        if (efData.flags?.dae?.transfer || efData.transfer) {
            if (!itemData && (efData.origin ?? "").includes("Item.")) { // itemData not passed, see if we have the item
                let itemId = efData.origin.split("Item.")[1];
                itemData = actor.data._source.items.find(i => i._id === itemId);
            }
            // Non eequip items
            let nonEquipItems = ["feat", "spell", "class"];
            if (game.system.id === "sw5e") {
                nonEquipItems = ["archetype", "background", "class", "classfeature", "feat",
                    "fightingmastery", "fightingstyle", "lightsaberform", "power", "species"];
            }
            if (itemData && !nonEquipItems.includes(itemData.type)) {
                // item is disabled if it is not equipped
                // OR item is equipped but attunment === requires attunement
                disabled = !itemData.data.equipped || itemData.data.attunement === CONFIG.DND5E.attunementTypes.REQUIRED;
                efData.disabled = disabled;
            }
        }
    }
    return disabled;
}
function flagChangeKeys(actor, change) {
    // if (!showDeprecation) return false; - removed as of 0.8.74
    const hasSaveBonus = change.key.startsWith("data.abilities.") && change.key.endsWith(".save") && !change.key.endsWith(".bonuses.save");
    // const saveBonus = change.key.match(/data.abilities.(\w\w\w).save/);
    if (hasSaveBonus) {
        const saveBonus = change.key.match(/data.abilities.(\w\w\w).save/);
        const abl = saveBonus[1];
        console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use data.abilities.${abl}.bonuses.save instead`);
        // change.key = `data.abilities.${abl}.bonuses.save`;
        return;
    }
    const hasCheckBonus = change.key.startsWith("data.abilities.") && change.key.endsWith(".mod");
    if (hasCheckBonus) {
        const checkBonus = change.key.match(/data.abilities.(\w\w\w).mod/);
        const abl = checkBonus[1];
        console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use data.abilities.${abl}.bonuses.check instead`);
        // change.key = `data.abilities.${abl}.bonuses.check`;
        return;
    }
    const hasSkillMod = change.key.startsWith("data.skills") && change.key.endsWith(".mod");
    if (hasSkillMod) {
        const skillMod = change.key.match(/data.skills.(\w\w\w).mod/);
        const abl = skillMod[1];
        console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use data.skills.${abl}.bonuses.check instead`);
        // change.key = `data.skills.${abl}.bonuses.check`;
        return;
    }
    const hasSkillPassive = change.key.startsWith("data.skills.") && !change.key.endsWith(".bonuses.passive") && change.key.endsWith(".passive");
    if (hasSkillPassive) {
        const skillPassive = change.key.match(/data.skills.(\w\w\w).passive/);
        const abl = skillPassive[1];
        console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use data.skills.${abl}.bonuses.passive instead`);
        // change.key = `data.dkills.${abl}.bonuses.passive`;
        return;
    }
    const hasSkillBonus = change.key.startsWith("flags.skill-customization-5e");
    if (hasSkillBonus) {
        const skillPassive = change.key.match(/lags.skill-customization-5e.(\w\w\w).skill-bonus/);
        const abl = skillPassive[1];
        console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use data.skills.${abl}.bonuses.check instead`);
        // change.key = `data.dkills.${abl}.bonuses.passive`;
        return;
    }
}
// this function replaces applyActiveEffects in Actor
function applyBaseActiveEffects() {
    applyDaeEffects.bind(this)(ValidSpec.baseSpecsObj, {}, false);
}
/*
 * Replace default appplyAffects to do value lookups
 */
function applyDaeEffects(specList, completedSpecs, allowAllSpecs) {
    if (disableEffects)
        return;
    const overrides = {};
    if (!this.effects || this.effects.size === 0)
        return this.overrides || {};
    // Organize non-disabled effects by their application priority
    const changes = this.effects.reduce((changes, effect) => {
        if (isNewerVersion("1.4.3", game.system.data.version) && !isNewerVersion(game.version, "9.200")) {
            effect.data.disabled = effectDisabled(this, effect.data);
            effect.isSuppressed = false;
        }
        else
            effect.determineSuppression();
        if (effectDisabled(this, effect.data) || effect.isSuppressed)
            return changes; //TODO check this for 0.9.2
        // TODO find a solution for flags.? perhaps just a generic speclist
        return changes.concat(expandEffectChanges(effect.data.changes)
            .filter(c => {
            return !completedSpecs[c.key] && (allowAllSpecs || specList[c.key] !== undefined) && !c.key.startsWith("ATL.");
        })
            .map(c => {
            c = duplicate(c);
            if (isNewerVersion(game.system.data.version, "1.4.9")) {
                flagChangeKeys(this, c);
            }
            if (c.key === "flags.midi-qol.OverTime")
                c.key = `flags.midi-qol.OverTime.${randomID()}`;
            c.effect = effect;
            c.priority = c.priority ?? (c.mode * 10);
            return c;
        }));
    }, []);
    changes.sort((a, b) => a.priority - b.priority);
    if (changes.length > 0)
        debug("Applying change ", this.name, changes);
    // Apply all changes
    for (let c of changes) {
        //TODO remove @data sometime
        if (typeof c.value === "string" && c.value.includes("@data.")) {
            console.warn("dae | @data.key is deprecated, use @key instead", c.value);
            c.value = c.value.replace(/@data./g, "@");
        }
        //@ts-ignore
        if (c.mode !== CONST.ACTIVE_EFFECT_MODES.CUSTOM) {
            if (typeof specList[c.key]?.sampleValue === "number" && typeof c.value === "string") {
                debug("appplyDaeEffects: Doing eval of ", c, c.value);
                let value = replaceAtFields(c.value, this.getRollData(), { blankValue: 0, maxIterations: 3 });
                try { // Roll parser no longer accepts some expressions it used to so we will try and avoid using it
                    //@ts-ignore - this will throw an error if there are roll expressions
                    c.value = Roll.safeEval(value);
                }
                catch (err) { // safeEval failed try a roll
                    try {
                        console.warn("dae | you are using dice expressions in a numeric field this will be disabled after foundry 9.x is released");
                        console.warn(`Actor ${this.name} ${this.uuid} Change is ${c.key}: ${c.value}`);
                        //@ts-ignore evaluate - TODO work out how to do this async
                        c.value = new Roll(value).evaluate({ async: false }).total;
                    }
                    catch (err) {
                        console.warn("change value calculation failed for", this, c);
                        console.warn(err);
                    }
                }
            }
        }
        const result = c.effect.apply(this, c);
        if (result !== null)
            overrides[c.key] = result;
    }
    // Expand the set of final overrides
    this.overrides = mergeObject(this.overrides || {}, expandObject(overrides) || {}, { inplace: true, overwrite: true });
}
function expandEffectChanges(changes) {
    let returnChanges = changes.reduce((list, change) => {
        if (!bonusSelectors[change.key]) {
            list.push(change);
        }
        else {
            const attacks = bonusSelectors[change.key].attacks;
            const selector = bonusSelectors[change.key].selector;
            attacks.forEach(at => {
                const c = duplicate(change);
                c.key = `data.bonuses.${at}.${selector}`;
                list.push(c);
            });
        }
        return list;
    }, []);
    return returnChanges;
}
/*
 * do custom effefct applications
 * damage resistance/immunity/vulnerabilities
 * languages
 */
function daeCustomEffect(actor, change) {
    const current = getProperty(actor.data, change.key);
    var validValues;
    var value;
    if (typeof change?.key !== "string")
        return true;
    const damageBonusMacroFlag = `flags.${game.system.id}.DamageBonusMacro`;
    if (change.key === damageBonusMacroFlag) {
        let current = getProperty(actor.data, change.key);
        // includes wont work for macro names that are subsets of other macro names
        if (noDupDamageMacro && current?.split(",").some(macro => macro === change.value))
            return true;
        setProperty(actor.data, change.key, current ? `${current},${change.value}` : change.value);
        return true;
    }
    if (change.key.includes(`flags.${game.system.id}`)) {
        const value = ["1", "true"].includes(change.value);
        setProperty(actor.data, change.key, value);
        return true;
    }
    if (change.key.startsWith("data.skills.") && change.key.endsWith(".value")) {
        const currentProf = getProperty(actor.data, change.key) || 0;
        const profValues = { "0.5": 0.5, "1": 1, "2": 2 };
        const upgrade = profValues[change.value];
        if (upgrade === undefined)
            return;
        let newProf = currentProf + upgrade;
        if (newProf > 1 && newProf < 2)
            newProf = 1;
        if (newProf > 2)
            newProf = 2;
        return setProperty(actor.data, change.key, newProf);
    }
    /*
    if (change.key.startsWith("items.")) {
      let originalKey = duplicate(change.key);
      const fields = change.key.split("."); // items.data.contents.index......
      const index = fields[2];
      const itemKey = fields.slice(3).join(".")
      const item = actor.data.items.contents[index];
      let value = getProperty(item, itemKey);
      if (value === undefined) value = change.value;
      else if (value instanceof Array) {
        const newEntry = eval(change.value)
        value = value.concat([newEntry]);
      } else if (typeof value === "string") value = `${value} + ${change.value}`;
      //@ts-ignore
      else if (typeof value === "boolean") value = Roll.safeEval(change.value);
      //@ts-ignore
      else value = Roll.safeEval(value + change.value);
      setProperty(item, itemKey, value)
      return true;
    }
    */
    switch (change.key) {
        case "data.attributes.movement.hover":
            setProperty(actor.data, change.key, change.value ? true : false);
            return true;
        case "data.traits.di.all":
        case "data.traits.dr.all":
        case "data.traits.dv.all":
            const key = change.key.replace(".all", ".value");
            if (game.system.id === "dnd5e")
                setProperty(actor.data, key, Object.keys(CONFIG.DND5E.damageResistanceTypes));
            else
                setProperty(actor.data, key, Object.keys(CONFIG.SW5E.damageResistanceTypes));
            return true;
        case "data.traits.di.value":
        case "data.traits.dr.value":
        case "data.traits.dv.value":
            if (game.system.id === "dnd5e")
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.damageResistanceTypes));
            else
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.damageResistanceTypes));
        case "data.traits.di.custom":
        case "data.traits.dr.custom":
        case "data.traits.dv.custom":
        case "data.traits.ci.custom":
        case "data.traits.languages.custom":
        case "data.traits.toolProf.custom":
        case "data.traits.armorProf.custom":
        case "data.traits.weaponProf.custom":
            value = (current ?? "").length > 0 ? current.trim().split(";").map(s => s.trim()) : [];
            const setValue = new Set(value);
            setValue.add(change.value);
            value = Array.from(setValue).join("; ");
            setProperty(actor.data, change.key, value);
            return true;
        case "data.traits.languages.all":
            if (game.system.id === "dnd5e")
                setProperty(actor.data, "data.traits.languages.value", Object.keys(CONFIG.DND5E.languages));
            else
                setProperty(actor.data, "data.traits.languages.value", Object.keys(CONFIG.SW5E.languages));
            return true;
        case "data.traits.languages.value":
            if (game.system.id === "dnd5e")
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.languages));
            else
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.languages));
        case "data.traits.ci.all":
            if (game.system.id === "dnd5e")
                setProperty(actor.data, "data.traits.ci.value", Object.keys(CONFIG.DND5E.conditionTypes));
            else
                setProperty(actor.data, "data.traits.ci.value", Object.keys(CONFIG.SW5E.conditionTypes));
            return true;
        case "data.traits.ci.value":
            if (game.system.id === "dnd5e")
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.conditionTypes));
            else
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.conditionTypes));
        case "data.traits.toolProf.value":
            if (game.system.id === "dnd5e")
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.toolProficiencies));
            else
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.toolProficiencies));
        case "data.traits.toolProf.all":
            if (game.system.id === "dnd5e")
                setProperty(actor.data, "data.traits.toolProf.value", Object.keys(CONFIG.DND5E.toolProficiencies));
            else
                setProperty(actor.data, "data.traits.toolProf.value", Object.keys(CONFIG.SW5E.toolProficiencies));
            return true;
        case "data.traits.armorProf.value":
            if (game.system.id === "dnd5e")
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.armorProficiencies));
            else
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.armorProficiencies));
        case "data.traits.armorProf.all":
            if (game.system.id === "dnd5e")
                setProperty(actor.data, "data.traits.armorProf.value", Object.keys(CONFIG.DND5E.armorProficiencies));
            else
                setProperty(actor.data, "data.traits.armorProf.value", Object.keys(CONFIG.SW5E.armorProficiencies));
            return true;
        case "data.traits.weaponProf.value":
            if (game.system.id === "dnd5e")
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.weaponProficiencies));
            else
                return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.weaponProficiencies));
        case "data.traits.weaponProf.all":
            if (game.system.id === "dnd5e")
                setProperty(actor.data, "data.traits.weaponProf.value", Object.keys(CONFIG.DND5E.weaponProficiencies));
            else
                setProperty(actor.data, "data.traits.weaponProf.value", Object.keys(CONFIG.SW5E.weaponProficiencies));
            return true;
        case "data.bonuses.weapon.damage":
            value = attackDamageBonusEval(change.value, actor);
            // value = replaceAtFields(value, actor.getRollData());
            if (current)
                value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
            weaponAttacks.forEach(atType => actor.data.data.bonuses[atType].damage += value);
            return true;
        case "data.bonuses.spell.damage":
            value = attackDamageBonusEval(change.value, actor);
            //value = replaceAtFields(value, actor.getRollData());
            if (current)
                value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
            spellAttacks.forEach(atType => actor.data.data.bonuses[atType].damage += value);
            return true;
        case "data.bonuses.mwak.attack":
        case "data.bonuses.mwak.damage":
        case "data.bonuses.rwak.attack":
        case "data.bonuses.rwak.damage":
        case "data.bonuses.msak.attack":
        case "data.bonuses.msak.damage":
        case "data.bonuses.mpak.attack":
        case "data.bonuses.mpak.damage":
        case "data.bonuses.rpak.attack":
        case "data.bonuses.rpak.damage":
        case "data.bonuses.rsak.attack":
        case "data.bonuses.rsak.damage":
        case "data.bonuses.heal.attack":
        case "data.bonuses.heal.damage":
        case "data.bonuses.abilities.save":
        case "data.bonuses.abilities.check":
        case "data.bonuses.abilities.skill":
        case "data.bonuses.power.forceLightDC":
        case "data.bonuses.power.forceDarkDC":
        case "data.bonuses.power.forceUnivDC":
        case "data.bonuses.power.techDC":
            // TODO: remove if fixed in core
            let result = attackDamageBonusEval(change.value, actor);
            value = result; // replaceAtFields(result, dactor.getRollData()));
            if (current)
                value = (result.startsWith("+") || result.startsWith("-")) ? result : "+" + result;
            setProperty(actor.data, change.key, (current || "") + value);
            return true;
        case "data.attributes.movement.all":
            const movement = actor.data.data.attributes.movement;
            let op = "";
            if (typeof change.value === "string") {
                change.value = change.value.trim();
                if (["+", "-", "/", "*"].includes(change.value[0])) {
                    op = change.value[0];
                    change.value = change.value.slice(1);
                }
            }
            value = Number(change.value);
            Object.keys(movement).forEach(key => {
                if (typeof movement[key] === "number") {
                    switch (op) {
                        case "+":
                            movement[key] += value;
                            break;
                        case "-":
                            movement[key] = Math.max(0, movement[key] - value);
                            break;
                        case "/":
                            movement[key] = Math.floor(movement[key] / value);
                            break;
                        case "*":
                            movement[key] *= value;
                            break;
                        default:
                            movement[key] = value;
                            break;
                    }
                }
            });
            return true;
        //TODO review this for 1.5
        case "data.abilities.str.dc":
        case "data.abilities.dex.dc":
        case "data.abilities.int.dc":
        case "data.abilities.wis.dc":
        case "data.abilities.cha.dc":
        case "data.abilities.con.dc":
        case "data.bonuses.spell.dc":
        case "data.attributes.powerForceLightDC":
        case "data.attributes.powerForceDarkDC":
        case "data.attributes.powerForceUnivDC":
        case "data.attributes.powerTechDC":
            //@ts-ignore
            if (Number.isNumeric(change.value)) {
                value = parseInt(change.value);
            }
            else {
                try {
                    //@ts-ignore
                    value = (new Roll(change.value, actor.getRollData())).evaluate({ async: false }).total;
                }
                catch (err) { }
                ;
            }
            if (value !== undefined) {
                setProperty(actor.data, change.key, Number(current) + value);
            }
            else
                return;
            // Spellcasting DC
            const ad = actor.data.data;
            const spellcastingAbility = ad.abilities[ad.attributes.spellcasting];
            ad.attributes.spelldc = spellcastingAbility ? spellcastingAbility.dc : 8 + ad.attributes.prof;
            if (actor.items) {
                actor.items.forEach(item => {
                    item.getSaveDC();
                    item.getAttackToHit();
                });
            }
            ;
            return true;
        case "flags.dae":
            let list = change.value.split(" ");
            const flagName = list[0];
            let formula = list.splice(1).join(" ");
            const rollData = actor.getRollData();
            const flagValue = getProperty(rollData.flags, `dae.${flagName}`) || 0;
            // ensure the flag is not undefined when doing the roll, supports flagName @flags.dae.flagName + 1
            setProperty(rollData, `flags.dae.${flagName}`, flagValue);
            //@ts-ignore evaluate TODO work out async
            value = new Roll(formula, rollData).evaluate({ async: false }).total;
            setProperty(actor.data, `flags.dae.${flagName}`, value);
            return true;
    }
}
export function replaceAtFields(value, context, options = { blankValue: "", maxIterations: 4 }) {
    if (typeof value !== "string")
        return value;
    let count = 0;
    if (!value.includes("@"))
        return value;
    // let re = /@(\w|\.|\-)+/g
    let re = /@(\w|\.|(\-(?=([A-Za-z-_]))))+/g;
    let result = duplicate(value);
    result = result.replace("@item.level", "@itemLevel"); // fix for outdated item.level
    // Remove @data references allow a little bit of recursive lookup
    do {
        count += 1;
        for (let match of result.match(re) || []) {
            result = result.replace(match.replace("@data.", "@"), getProperty(context, match.slice(1)) ?? options.blankValue);
        }
    } while (count < options.maxIterations && result.includes("@"));
    return result;
}
// Special case handling of (expr)dX
function attackDamageBonusEval(bonusString, actor) {
    return bonusString;
    if (typeof bonusString === "string") {
        const special = bonusString.match(/\((.+)\)\s*d([0-9]+)(.*)/);
        // const special = bonusString.match(/\(([\s\S]+)\)\s+d([0-9]*)\)([\s\S]+)/);
        if (special && special.length >= 3) {
            try {
                return new Roll(special[1].replace(/ /g, ""), actor.getRollData()).roll().total + "d" + special[2] + (special[3] ?? "");
            }
            catch (err) {
                console?.warn(`DAE eval error for: ${special[1].replace(/ /g, "")} in actor ${actor.name}`, err);
                return bonusString;
            }
        }
    }
    return `${bonusString || ""}`;
}
function doCustomValue(actor, current, change, validValues) {
    if ((current || []).includes(change.value))
        return true;
    if (!validValues.includes(change.value))
        return true;
    setProperty(actor.data, change.key, current.concat([change.value]));
    return true;
}
function doCustomArrayValue(actor, current, change, validValues) {
    if (getType(change.value) === "string" && change.value[0] === "-") {
        const checkValue = change.value.slice(1);
        const currentIndex = (current ?? []).indexOf(checkValue);
        if (currentIndex === -1)
            return true;
        if (!validValues.includes(checkValue))
            return true;
        const returnValue = duplicate(current);
        returnValue.splice(currentIndex, 1);
        setProperty(actor.data, change.key, returnValue);
    }
    else {
        if ((current ?? []).includes(change.value))
            return true;
        if (!validValues.includes(change.value))
            return true;
        setProperty(actor.data, change.key, current.concat([change.value]));
    }
    return true;
}
/*
* replace the default actor prepareData
* call applyDaeEffects
* add an additional pass after derivfed data
*/
function prepareData(wrapped) {
    debug("prepare data: before passes", this.name, this.data._source);
    this.overrides = {};
    wrapped();
    applyDaeEffects.bind(this)(ValidSpec.derivedSpecsObj, ValidSpec.baseSpecsObj, true);
    //TODO find another way to tdo this
    // this._prepareOwnedItems(this.data.items)
    preparePassiveSkills.bind(this)();
    debug("prepare data: after passes", this.data);
}
async function preparePassiveSkills() {
    const skills = this.data.data.skills;
    if (!skills)
        return;
    for (let skillId of Object.keys(skills)) {
        const skill = this.data.data.skills[skillId];
        const abilityId = skill.ability;
        const advdisadv = procAdvantageSkill(this, abilityId, skillId);
        skill.passive = skill.passive + 5 * advdisadv;
    }
}
function procAdvantageSkill(actor, abilityId, skillId) {
    const midiFlags = actor.data.flags["midi-qol"] ?? {};
    const advantage = midiFlags.advantage ?? {};
    const disadvantage = midiFlags.disadvantage ?? {};
    let withAdvantage = advantage.all ?? false;
    let withDisadvantage = disadvantage.all ?? false;
    if (advantage.ability) {
        withAdvantage = withAdvantage || advantage.ability.all || advantage.ability.check?.all;
    }
    if (advantage.ability?.check) {
        withAdvantage = withAdvantage || advantage.ability.check[abilityId];
    }
    if (advantage.skill) {
        withAdvantage = withAdvantage || advantage.skill.all || advantage.skill[skillId];
    }
    if (disadvantage.ability) {
        withDisadvantage = withDisadvantage || disadvantage.all || disadvantage.ability.all || disadvantage.ability.check?.all;
    }
    if (disadvantage.ability?.check) {
        withDisadvantage = withDisadvantage || disadvantage.ability.check[abilityId];
    }
    if (disadvantage.skill) {
        withDisadvantage = withDisadvantage || disadvantage.skill.all || disadvantage.skill[skillId];
    }
    if ((withAdvantage && withDisadvantage) || (!withAdvantage && !withDisadvantage))
        return 0;
    else if (withAdvantage)
        return 1;
    else
        return -1;
}
async function addTokenMagicChange(actor, change, tokens, tokenMagic) {
    for (let token of tokens) {
        if (token.object)
            token = token.object; // in case we have a token document
        await tokenMagic.addFilters(token, change.value);
    }
}
async function removeTokenMagicChange(actor, change, tokens, tokenMagic) {
    for (let token of tokens) {
        if (token.object)
            token = token.object; // in case we have a token document
        await tokenMagic.deleteFilters(token, change.value);
    }
}
async function removeCVChange(actor, change, tokenDocuments, CV) {
    const tokens = tokenDocuments.map(t => t.object ? t.object : t);
    if (change.key === "macro.ConditionalVisibility") {
        if (change.value === "hidden")
            await CV?.unHide(tokens);
        else
            await CV?.setCondition(tokens, change.value, false);
    }
    else if (change.key === "macro.ConditionalVisibilityVision") {
        for (let t of tokens) {
            await t.setFlag("conditional-visibility", change.value, false);
        }
    }
}
async function addCVChange(actor, change, tokenDocuments, CV) {
    const tokens = tokenDocuments.map(t => t.object ? t.object : t);
    if (change.key === "macro.ConditionalVisibility") {
        if (change.value === "hidden")
            await CV?.hide(tokens);
        else
            await CV?.setCondition(tokens, change.value, true);
    }
    else if (change.key === "macro.ConditionalVisibilityVision") {
        for (let t of tokens) {
            await t.setFlag("conditional-visibility", change.value, true);
        }
    }
}
function _onCreateActiveEffect(...args) {
    let [effect, options, userId] = args;
    if (userId !== game.user.id)
        return true;
    const parent = effect.parent;
    //@ts-ignore documentClass TODO
    if (!parent || !(parent instanceof CONFIG.Actor.documentClass))
        return true;
    const actor = parent;
    const token = parent.isToken ? parent.token.object : parent.getActiveTokens()[0];
    if (token && effect.data.changes && !effect.disabled && !effect.isSuppressed) {
        let changeLoop = async () => {
            try {
                for (let change of effect.data.changes) {
                    if (cubActive && change.key === "macro.CUB") {
                        await game.cub.addCondition(change.value, [token]);
                    }
                    if (ceActive && change.key === "macro.CE") {
                        if (game.dfreds.effectInterface) {
                            await game.dfreds.effectInterface.addEffect(change.value, parent.uuid, effect.data.origin);
                        }
                        else {
                            await game.dfreds.effectHandler.addEffect({ effectName: change.value, parent, origin: effect.data.origin });
                        }
                    }
                    const CV = globalThis.ConditionalVisibility;
                    if (CV)
                        await addCVChange(parent, change, [token], CV);
                    const tokenMagic = globalThis.TokenMagic;
                    if (tokenMagic && change.key === "macro.tokenMagic")
                        await addTokenMagicChange(parent, change, [token], tokenMagic); //TODO check disabled
                }
            }
            catch (err) {
                console.warn("dae | create effect error", err);
            }
            finally {
                return true;
            }
        };
        changeLoop();
    }
    return true;
}
async function _preCreateActiveEffect(wrapped, ...args) {
    const parent = this.parent;
    //@ts-ignore documentClass TODO
    if (!parent || !(parent instanceof CONFIG.Actor.documentClass))
        return wrapped(...args);
    let updates = {};
    updates = { "flags.dae.transfer": this.data.transfer };
    let changesChanged = false;
    let newChanges = [];
    for (let change of this.data.changes) {
        let inline = typeof change.value === "string" && change.value.startsWith("[[");
        if (change.key === "StatusEffect") {
            const statusEffect = CONFIG.statusEffects.find(se => se.id === change.value);
            if (statusEffect) {
                newChanges = newChanges.concat(statusEffect.changes);
                updates["icon"] = statusEffect.icon;
                updates["label"] = statusEffect.label;
                changesChanged = true;
            }
        }
        else if (inline) {
            const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
            inline = change.value.matchAll(rgx).next();
            if (inline.value) {
                changesChanged = true;
                const newChange = duplicate(change);
                newChange.value = await evaInline(inline.value[2], this.parent, this);
                newChanges.push(newChange);
            }
            else
                newChanges.push(change);
        }
        else
            newChanges.push(change);
    }
    if (changesChanged)
        updates["changes"] = newChanges;
    this.data.update(updates);
    try {
        const effectData = await daeMacro("on", parent, this.data, {});
    }
    catch (err) {
        console.warn("dae | create effect error", err);
    }
    finally {
        let result = wrapped(...args);
        return result;
    }
}
async function evaInline(expression, actor, effect) {
    try {
        //@ts-ignore
        expression = expression.replaceAll("@data.", "@");
        const roll = await (new Roll(expression, actor?.getRollData())).roll();
        if (showInline) {
            roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${effect.data.label} ${expression}`, chatMessage: true });
        }
        return `${roll.total}`;
    }
    catch (err) {
        console.warn(`dae | evaluate args error: rolling ${expression} failed`);
        return "0";
    }
}
export function _onUpdateActiveEffect(...args) {
    let [effect, changes, options, userId] = args;
    if (userId !== game.user.id)
        return true;
    const parent = effect.parent;
    //@ts-ignore documentClass TODO
    if (!parent || !(parent instanceof CONFIG.Actor.documentClass))
        return true;
    let changeLoop = async () => {
        try {
            const token = parent.isToken ? parent.token.object : parent.getActiveTokens()[0];
            if (changes.disabled !== undefined) {
                if (isNewerVersion("1.4.3", game.system.data.version) && !isNewerVersion(game.version, "9.200")) { // XXX
                    let item = DAEfromUuid(effect.data.origin);
                    if (effect.data.flags?.dae?.transfer && item.data.data.equipped !== undefined) {
                        const newEquipped = !changes.disabled;
                        if (item.data.data.equipped !== undefined && item.data.data.equipped !== newEquipped) {
                            item.update({ data: { equipped: newEquipped } });
                        }
                    }
                }
            }
            // Just deal with equipped etc
            warn("add active effect actions", parent, changes);
            if (token && effect.data.changes) {
                const CV = globalThis.ConditionalVisibility;
                const tokenMagic = globalThis.TokenMagic;
                if (changes.disabled) {
                    for (let change of effect.data.changes) {
                        if (cubActive && change.key === "macro.CUB") {
                            // game.cub.removeCondition(change.value, [token], { warn: false });
                            await game.cub.removeCondition(change.value, [token], { warn: false });
                        }
                        if (ceActive && change.key === "macro.CE") {
                            if (game.dfreds.effectInterface) {
                                await game.dfreds.effectInterface.removeEffect(change.value, parent.uuid);
                            }
                            else {
                                await game.dfreds.effectHandler.removeEffect(change.value, parent);
                            }
                        }
                        if (CV)
                            await removeCVChange(parent, change, [token], CV);
                        if (tokenMagic && change.key === "macro.tokenMagic")
                            await removeTokenMagicChange(parent, change, [token], tokenMagic);
                    }
                }
                else {
                    for (let change of effect.data.changes) {
                        if (cubActive && change.key === "macro.CUB") {
                            await game.cub.addCondition(change.value, [token]);
                        }
                        if (ceActive && change.key === "macro.CE") {
                            if (game.dfreds.effectInterface) {
                                await game.dfreds.effectInterface.addEffect(change.value, parent.uuid, effect.data.origin);
                            }
                            else {
                                await game.dfreds.effectHandler.addEffect({ effectName: change.value, actor: parent, origin: effect.data.origin });
                            }
                            if (CV)
                                await addCVChange(parent, change, [token], CV);
                            if (tokenMagic && change.key === "macro.tokenMagic")
                                await addTokenMagicChange(parent, change, [token], tokenMagic);
                        }
                    }
                }
            }
        }
        catch (err) {
            console.warn("dae | updating active effect error", err);
        }
        finally {
            return true;
        }
    };
    changeLoop();
    return true;
}
export async function _preUpdateActiveEffect(wrapped, changes, options, user) {
    const parent = this.parent;
    //@ts-ignore documentClass TODO
    if (!parent || !(parent instanceof CONFIG.Actor.documentClass)) {
        return wrapped(changes, options, user);
    }
    for (let change of changes.changes ?? []) {
        const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
        const inline = change.value.matchAll(rgx).next();
        if (inline.value) {
            change.value = await evaInline(inline.value[2], this.parent, this);
        }
    }
    return wrapped(changes, options, user);
}
export function _onDeleteActiveEffect(...args) {
    let [effect, option, userId] = args;
    if (game.user.id !== userId)
        return true;
    //@ts-ignore documentClass
    if (!(effect.parent instanceof CONFIG.Actor.documentClass))
        return true;
    const actor = effect.parent;
    const token = actor.token ? actor.token : actor.getActiveTokens()[0];
    const tokenMagic = globalThis.TokenMagic;
    const CV = globalThis.ConditionalVisibility;
    let changesLoop = async () => {
        try {
            let entityToDelete;
            if (token && effect.data.changes) {
                for (let change of effect.data.changes) {
                    if (tokenMagic && change.key === "macro.tokenMagic")
                        await removeTokenMagicChange(actor, change, [token], tokenMagic);
                    if (CV)
                        await removeCVChange(actor, change, [token], CV);
                    if (ceActive && change.key === "macro.CE") {
                        if (game.dfreds.effectInterface) {
                            await game.dfreds.effectInterface.removeEffect(change.value, token.actor.uuid);
                        }
                        else {
                            await game.dfreds.effectHandler.removeEffect(change.value, token.actor);
                        }
                    }
                    if (cubActive && change.key === "macro.CUB") {
                        await game.cub.removeCondition(change.value, [token], { warn: false });
                    }
                    if (change.key === "flags.dae.deleteUuid" && change.value) {
                        socketlibSocket.executeAsGM("deleteUuid", { uuid: change.value });
                    }
                    if (change.key === "flags.dae.deleteOrigin")
                        entityToDelete = effect.data.origin;
                }
                await daeMacro("off", actor, effect.data, {});
                if (entityToDelete)
                    socketlibSocket.executeAsGM("deleteUuid", { uuid: entityToDelete });
            }
        }
        catch (err) {
            console.warn("dae | error deleting active effect ", err);
        }
    };
    changesLoop();
    return true;
}
export async function _preDeleteActiveEffect(wrapped, ...args) {
    //@ts-ignore documentClass
    return wrapped(...args);
}
export function getSelfTarget(actor) {
    if (actor.token)
        return actor.token;
    const speaker = ChatMessage.getSpeaker({ actor });
    if (speaker.token)
        return canvas.tokens.get(speaker.token);
    //@ts-ignore this is a token document not a token ??
    return new CONFIG.Token.documentClass(actor.getTokenData(), { actor });
}
export async function daeMacro(action, actor, effectData, lastArgOptions = {}) {
    let result;
    let effects;
    // Work out what itemdata should be
    warn("Dae macro ", action, actor, effectData, lastArgOptions);
    if (!effectData.changes)
        return effectData;
    let tokenUuid;
    if (actor.token)
        tokenUuid = actor.token.uuid;
    else {
        const selfTarget = getSelfTarget(actor);
        if (selfTarget.document)
            tokenUuid = selfTarget.document.uuid;
        else
            tokenUuid = selfTarget.uuid;
    }
    let lastArg = mergeObject(lastArgOptions, {
        //@ts-ignore - undefined fields
        effectId: effectData._id,
        origin: effectData.origin,
        efData: effectData,
        actorId: actor.id,
        actorUuid: actor.uuid,
        tokenId: actor.token ? actor.token.id : getSelfTarget(actor)?.id,
        tokenUuid,
    }, { overwrite: false, insertKeys: true, insertValues: true, inplace: false });
    for (let change of effectData.changes) {
        try {
            if (!["macro.execute", "macro.itemMacro", "macro.actorUpdate"].includes(change.key))
                continue;
            //@ts-ignore 
            const theChange = await evalArgs({ itemData: null, effectData, context: actor.getRollData(), actor, change, doRolls: true });
            let args = [];
            if (typeof theChange.value === "string") {
                tokenizer.tokenize(theChange.value, (token) => args.push(token));
                args = args.map(arg => {
                    if (["@item", "@itemData"].includes(arg))
                        return effectData.flags.dae.itemData;
                    return arg;
                });
            }
            else
                args = change.value;
            if (theChange.key === "macro.execute" || theChange.key.includes("macro.itemMacro")) {
                const macro = await getMacro({ change, name: args[0] }, null, effectData);
                if (!macro) {
                    //TODO localize this
                    if (action !== "off") {
                        ui.notifications.warn(`macro.execute/macro.itemMacro | No macro ${theChange.value[0]} found`);
                        error(`macro.execute/macro.itemMacro | No macro ${theChange.value[0]} found`);
                        continue;
                    }
                }
                // insert item data
                if (furnaceActive) {
                    if (theChange.key === "macro.execute")
                        //@ts-ignore
                        result = await macro.execute(action, ...args.slice(1), lastArg);
                    else
                        //@ts-ignore
                        result = await macro.execute(action, ...args, lastArg);
                }
                else {
                    console.warn("Furnace not active - so no macro arguments supported");
                    //@ts-ignore
                    result = macro.execute({ actor });
                }
            }
            else if (theChange.key === "macro.actorUpdate") {
                result = await macroActorUpdate(action, ...args, lastArg);
            }
        }
        catch (err) {
            console.warn(err);
        }
    }
    ;
    return effectData;
}
export async function evalArgs({ effectData = null, itemData = null, context, actor, change, spellLevel = 0, damageTotal = 0, doRolls = false, critical = false, fumble = false, whisper = false, itemCardId = null }) {
    // change so that this is item.data, rather than item.
    if (itemData) {
        if (itemData._source)
            itemData = itemData.toObject(false);
        setProperty(effectData.flags, "dae.itemData", itemData);
    }
    let itemId = getProperty(effectData.flags, "dae.itemData._id");
    if (typeof change.value !== 'string')
        return change; // nothing to do
    const returnChange = duplicate(change);
    const contextToUse = mergeObject({
        scene: canvas.scene.id,
        token: ChatMessage.getSpeaker({ actor }).token,
        target: "@target",
        targetUuid: "@targetUuid",
        itemData: "@itemData",
        item: "@item",
        spellLevel: spellLevel,
        itemLevel: spellLevel,
        damage: damageTotal,
        itemCardId: itemCardId,
        unique: randomID(),
        actor: actor.id,
        actorUuid: actor.uuid,
        critical: critical,
        fumble: fumble,
        whisper: whisper,
        change: JSON.stringify(change.toJSON),
        itemId: itemId
    }, context, { overwrite: false });
    returnChange.value = replaceAtFields(returnChange.value, contextToUse, { blankValue: 0, maxIterations: 2 }); // limit to a couple of lookups - since @token -> @token
    returnChange.value = returnChange.value.replaceAll("##", "@");
    if (typeof returnChange.value === "string" && !returnChange.value.includes("[[")) {
        switch (change.key) {
            case "macro.itemMacro":
            case "macro.execute": // for macros we want to tokenize the arguments
            case "macro.actorUpdate":
                break;
            case "macro.CUB":
            case "macro.ConditionalVisibility":
            case "macro.ConditionalVisibilityVision":
            case "macro.tokenMagic":
                break;
            default:
                if (doRolls && typeof ValidSpec.allSpecsObj[change.key]?.sampleValue === "number") {
                    //@ts-ignore evaluate - probably need to make this a saveEval
                    returnChange.value = new Roll(returnChange.value, context).evaluate({ async: false }).total;
                }
                ;
                break;
        }
        ;
        debug("evalargs: change is ", returnChange);
    }
    return returnChange;
}
export async function getMacro({ change, name }, itemData, effectData) {
    if (change.key === "macro.execute") {
        // the first argument conatins the macro name
        return game.macros.getName(name);
    }
    else if (change.key.startsWith("macro.itemMacro")) {
        // Get the macro command for the macro TODO look at using an item name as well?
        let macroCommand;
        if (change.macro)
            macroCommand = change.macro.macroCommand;
        // 1. Try and get item dat to look for the command in.
        if (!itemData)
            itemData = getProperty(effectData.flags, "dae.itemData");
        macroCommand = getProperty(effectData.flags, "dae.itemData.flags.itemacro.macro.data.command");
        // Could not get the macro from the itemData or we had not Itemdata
        if (!macroCommand && !itemData) { // we never got an item do a last ditch attempt
            warn("eval args: fetching item from effectData/origin ", effectData.origin);
            itemData = DAEfromUuid(effectData?.origin)?.data.toObject(false); // Try and get it from the effectData
            //@ts-ignore
            macroCommand = itemData?.flags.itemacro?.macro.data.command;
        }
        if (effectData && itemData)
            setProperty(effectData.flags, "dae.itemData", itemData);
        if (!macroCommand) {
            macroCommand = `if (!args || args[0] === "on") {ui.notifications.warn("macro.itemMacro | No macro found for item ${itemData?.name}");}`;
            error(`No macro found for item ${itemData?.name}`);
        }
        return CONFIG.Macro.documentClass.create({
            name: "DAE-Item-Macro",
            type: "script",
            img: null,
            command: macroCommand,
            // TODO see if this should change.
            flags: { "dnd5e.itemMacro": true }
        }, { displaySheet: false, temporary: true });
    }
    else if (change.key === "actorUpdate") {
        console.error("Should not be trying to lookup the macro for actorUpdate");
    }
}
/*
 * appply non-transfer effects to target tokens - provided for backwards compat
 */
export async function doEffects(item, activate, targets = undefined, { whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false }) {
    return await applyNonTransferEffects.bind(item)(activate, targets, { whisper, spellLevel, damageTotal, itemCardId, critical, fumble });
}
// Apply non-transfer effects to targets.
// macro arguments are evaluated in the context of the actor applying to the targets
// @target is left unevaluated.
// request is passed to a GM client if the token is not owned
export async function applyNonTransferEffects(activate, targets, { whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false, tokenId: tokenId }) {
    if (!targets)
        return;
    let appliedEffects = duplicate(this.data.effects.filter(ae => ae.data.transfer === false));
    if (appliedEffects.length === 0)
        return;
    const rollData = this.actor.getRollData(); //TODO if not caster eval move to evalArgs call
    // appliedEffects.map(activeEffectData => {
    for (let [aeIndex, activeEffectData] of appliedEffects.entries()) {
        for (let [changeIndex, change] of activeEffectData.changes.entries()) {
            //activeEffectData.changes.map(async change => {
            let doRolls = (["macro.execute", "macro.itemMacro", "macro.actorUpdate"].includes(change.key));
            // eval args before calling GMAction so macro arguments are evaled in the casting context.
            // Any @fields for macros are looked up in actor context and left unchanged otherwise
            let newChange = await evalArgs({ itemData: this.data, effectData: activeEffectData, context: rollData, actor: this.actor, change, spellLevel, damageTotal, doRolls, critical, fumble, itemCardId, whisper });
            activeEffectData.changes[changeIndex] = newChange;
        }
        ;
        activeEffectData.origin = this.uuid;
        activeEffectData.duration.startTime = game.time.worldTime;
        activeEffectData.transfer = false;
        appliedEffects[aeIndex] = activeEffectData;
    }
    // Split up targets according to whether they are owned on not. Owned targets have effects applied locally, only unowned are passed ot the GM
    const targetList = Array.from(targets);
    const stringTokens = targetList.filter(t => typeof t === "string");
    if (stringTokens.length)
        console.warn("String tokens in apply non transfer are ", stringTokens);
    //@ts-ignore
    let ownedTargets = targetList.filter(t => t.isOwner).map(
    //@ts-ignore
    t => {
        if (typeof t === "string")
            return t;
        //@ts-ignore t.document
        if (t.document)
            return t.document.uuid; // means we have a token
        //@ts-ignore
        if (t instanceof CONFIG.Actor.documentClass)
            return t.uuid;
        //@ts-ignore
        if (t instanceof CONFIG.Token.documentClass)
            return t.actor?.uuid;
        //@ts-ignore .uuid
        return t.uuid;
    });
    //@ts-ignore
    let unOwnedTargets = targetList.filter(t => !t.isOwner).map(
    //@ts-ignore
    t => typeof t === "string" ? t : t.document ? t.document.uuid : t.uuid);
    debug("apply non-transfer effects: About to call gmaction ", activate, appliedEffects, targets, ownedTargets, unOwnedTargets);
    if (unOwnedTargets.length > 0)
        await socketlibSocket.executeAsGM("applyActiveEffects", { userId: game.user.id, activate, activeEffects: appliedEffects, targets: unOwnedTargets, itemDuration: this.data.data.duration, itemCardId });
    // requestGMAction(GMAction.actions.applyActiveEffects, { activate, activeEffects: appliedEffects, targets: unOwnedTargets, itemDuration: this.data.data.duration, itemCardId })
    if (ownedTargets.length > 0) {
        const result = await applyActiveEffects(activate, ownedTargets, appliedEffects, this.data.data.duration, itemCardId);
    }
}
function preUpdateItem(candidate, updates, options, user) {
    return true;
}
// Update the actor active effects when editing an owned item
// TODO change this to on update item
function updateItem(candidate, updates, options, user) {
    if (!candidate.isOwned)
        return true;
    if (user !== game.user.id)
        return true;
    if (updates.effects) { // item effects have changed - update transferred effects
        const itemUuid = candidate.uuid;
        // delete all actor effects for the given item
        let deletions = [];
        for (let aef of candidate.parent.effects) { // remove all transferred effects for the item
            const isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
            if (isTransfer && (aef.data.origin === itemUuid))
                deletions.push(aef.id);
        }
        ;
        // Now get all the itemm transfer effects
        let additions = candidate.effects.filter(aef => {
            const isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
            return isTransfer;
        });
        additions = additions.map(ef => ef.toJSON());
        additions.forEach(efData => {
            efData.origin = itemUuid;
            if (isNewerVersion("1.4.3", game.system.data.version) && !isNewerVersion(game.version, "9.200")) {
                efData.disabled = effectDisabled(candidate.parent, efData, candidate.data);
            }
        });
        if (deletions.length > 0) {
            candidate.parent.deleteEmbeddedDocuments("ActiveEffect", deletions).then(() => {
                if (additions.length > 0)
                    candidate.parent.createEmbeddedDocuments("ActiveEffect", additions);
            });
        }
        else if (additions.length > 0) {
            candidate.parent.createEmbeddedDocuments("ActiveEffect", additions);
        }
    }
    if (isNewerVersion("1.4.3", game.system.data.version) && !isNewerVersion(game.version, "9.200")) {
        if (updates.data?.attunement !== undefined || updates.data?.attuned !== undefined || updates.data?.equipped !== undefined) {
            const existingEffects = candidate.parent.effects
                ?.filter(ef => ef.data.flags?.dae?.transfer && ef.data.origin === candidate.uuid);
            if (existingEffects.length === 0)
                return true;
            existingEffects.forEach(ef => {
                const newDisabled = effectDisabled(candidate.parent, ef.data, candidate.data);
                ef.isSuppressed = false;
                ef.data.disabled = newDisabled;
                ef.data._source.disabled = newDisabled;
                Hooks.callAll("updateActiveEffect", ef, { disabled: newDisabled }, options, user);
            });
        }
    }
    return true;
}
export function preCreateItem(candidate, data, options, user) {
    if (!candidate.isOwned)
        return;
    data.effects?.forEach(efData => {
        if (efData.transfer) {
            if (isNewerVersion("1.4.3", game.system.data.version) && !isNewerVersion(game.version, "9.200"))
                efData.disabled = effectDisabled(candidate.parent, efData, candidate.data);
        }
    });
    if (data.effects) {
        delete candidate.data.effects;
        candidate.data.update({ "effects": data.effects });
    }
    return true;
}
export function daeReadyActions() {
    ValidSpec.localizeSpecs();
    // initSheetTab();
    //@ts-ignore
    if (game.settings.get("dae", "disableEffects")) {
        ui?.notifications?.warn("DAE effects disabled no DAE effect processing");
        console.warn("dae disabled - no active effects");
    }
    aboutTimeInstalled = game.modules.get("about-time")?.active;
    simpleCalendarInstalled = game.modules.get("foundryvtt-simple-calendar")?.active;
    timesUpInstalled = game.modules.get("times-up")?.active;
    patchPrepareArmorClassAttribution();
}
export function localDeleteFilters(tokenId, filterName) {
    let tokenMagic = globalThis.TokenMagic;
    let token = canvas.tokens.get(tokenId);
    tokenMagic.deleteFilters(token, filterName);
}
export var tokenizer;
function daeApply(wrapped, actor, change) {
    //TODO revisit this for item changes, requires setProperty(map, "index", value) to work.
    if (change.key?.startsWith("items")) {
        const fields = change.key.split(".");
        const name = fields[1];
        let indices;
        if (false || daeActionTypeKeys.includes(name)) { //TODO multiple changes are a problem
            const items = actor.items.contents.map((item, index) => item.data.data.actionType === name ? index : -1);
            indices = items.filter(index => index !== -1);
        }
        else {
            indices = [actor.data.items.contents.findIndex(i => i.name === name)];
        }
        if (indices.length > 0) { // Only works for a single effect because of overrides
            for (let index of indices) {
                fields[1] = `contents.${index}.data`;
                if (fields[1] !== -1) {
                    change.key = fields.join(".");
                    var rval = wrapped(actor, change);
                }
            }
            // change.key = originalKey;
            return rval;
        }
    }
    return wrapped(actor, change);
}
var spellAttacks, weaponAttacks, attackTypes, bonusSelectors;
function getRollData(wrapped) {
    const data = wrapped();
    data.flags = this.data.flags;
    return data;
}
export function daeInitActions() {
    libWrapper = globalThis.libWrapper;
    // Setup attack types and expansion change mappings
    spellAttacks = ["msak", "rsak"];
    weaponAttacks = ["mwak", "rwak"];
    if (game.system.id === "sw5e")
        spellAttacks = ["mpak", "rpak"];
    attackTypes = weaponAttacks.concat(spellAttacks);
    bonusSelectors = {
        "data.bonuses.All-Attacks": { attacks: attackTypes, selector: "attack" },
        "data.bonuses.weapon.attack": { attacks: weaponAttacks, selector: "attack" },
        "data.bonuses.spell.attack": { attacks: spellAttacks, selector: "attack" },
        "data.bonuses.All-Damage": { attacks: attackTypes, selector: "damage" },
        "data.bonuses.weapon.damage": { attacks: weaponAttacks, selector: "damage" },
        "data.bonuses.spell.damage": { attacks: spellAttacks, selector: "damage" }
    };
    ValidSpec.createValidMods();
    if (game.settings.get("dae", "disableEffects")) {
        ui?.notifications?.warn("DAE effects disabled no DAE effect processing");
        console.warn("DAE active effects disabled.");
        return;
    }
    // We will call this in prepareData
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", applyBaseActiveEffects, "OVERRIDE");
    // Add flags to roll data so they can be referenced in effects
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.getRollData", getRollData, "WRAPPER");
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.prepareData", prepareData, "WRAPPER");
    // TODO put this back when doing item effects.
    // libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.apply", daeApply, "WRAPPER");
    // libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", applyBaseActiveEffects, "OVERRIDE");
    if (game.system.id === "dnd5e")
        daeActionTypeKeys = Object.keys(CONFIG.DND5E.itemActionTypes);
    else
        daeActionTypeKeys = Object.keys(CONFIG.SW5E.itemActionTypes);
    // This supplies DAE custom effects
    Hooks.on("applyActiveEffect", daeCustomEffect);
    // If updating effects recreate actor effects for updated item.
    // Toggle equip active as well
    // libWrapper.register("dae", "CONFIG.Item.documentClass.prototype._preUpdate", _preDeleteActiveEffect, "WRAPPER");
    Hooks.on("updateItem", updateItem);
    Hooks.on("preUpdateItem", preUpdateItem);
    Hooks.on("preCreateItem", preCreateItem);
    // macros are called on active effect creationg and deletion
    CONFIG.ActiveEffect.documentClass;
    // libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype._preDelete", _preDeleteActiveEffect, "WRAPPER");
    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype._preCreate", _preCreateActiveEffect, "WRAPPER");
    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype._preUpdate", _preUpdateActiveEffect, "WRAPPER");
    Hooks.on("createActiveEffect", _onCreateActiveEffect);
    Hooks.on("deleteActiveEffect", _onDeleteActiveEffect);
    Hooks.on("updateActiveEffect", _onUpdateActiveEffect);
    // Add the active effects title bar actions
    Hooks.on('renderActorSheet', initActorSheetHook);
    Hooks.on('renderItemSheet', initItemSheetHook);
    //@ts-ignore
    tokenizer = new DETokenizeThis({
        shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '=', '!=', '!', '<', '> ', '<=', '>=', '^']
    });
}
function initActorSheetHook(app, html, data) {
    if (!daeTitleBar)
        return;
    let title = game.i18n.localize('dae.ActiveEffectName');
    let openBtn = $(`<a class="open-actor-effect" title="${title}"><i class="fas fa-clipboard"></i>${title}</a>`);
    openBtn.click(ev => {
        new ActiveEffects(app.document, {}).render(true);
    });
    html.closest('.app').find('.open-actor-effect').remove();
    let titleElement = html.closest('.app').find('.window-title');
    if (!app._minimized)
        openBtn.insertAfter(titleElement);
}
function initItemSheetHook(app, html, data) {
    if (!daeTitleBar)
        return true;
    let title = game.i18n.localize('dae.ActiveEffectName');
    let openBtn = $(`<a class="open-item-effect" title="${title}"><i class="fas fa-clipboard"></i>${title}</a>`);
    openBtn.click(ev => {
        new ActiveEffects(app.document, {}).render(true);
    });
    html.closest('.app').find('.open-item-effect').remove();
    let titleElement = html.closest('.app').find('.window-title');
    openBtn.insertAfter(titleElement);
    return true;
}
export function daeSetupActions() {
    cubActive = game.modules.get("combat-utility-belt")?.active;
    ceActive = game.modules.get("dfreds-convenient-effects")?.active && isNewerVersion(game.modules.get("dfreds-convenient-effects").data.version, "1.6.2");
    debug("Combat utility belt active ", cubActive, " and cub version is ", game.modules.get("combat-utility-belt")?.data.version);
    atlActive = game.modules.get("ATL")?.active;
    if (cubActive && !isNewerVersion(game.modules.get("combat-utility-belt")?.data.version, "1.1.2")) {
        ui.notifications.warn("Combat Utility Belt needs to be version 1.1.3 or later - conditions disabled");
        console.warn("Combat Utility Belt needs to be version 1.1.3 or later - conditions disabled");
        cubActive = false;
    }
    else if (cubActive) {
        debug("dae | Combat Utility Belt active and conditions enabled");
    }
    itemacroActive = game.modules.get("itemacro")?.active;
    furnaceActive = game.modules.get("furnace")?.active || game.modules.get("advanced-macros")?.active;
    conditionalVisibilityActive = game.modules.get("conditional-visibility")?.active;
    midiActive = game.modules.get("midi-qol")?.active;
}
export function fetchParams(doUpdatePatches = true) {
    requireItemTarget = game.settings.get("dae", "requireItemTarget");
    debugEnabled = setDebugLevel(game.settings.get("dae", "ZZDebug"));
    // useAbilitySave = game.settings.get("dae", "useAbilitySave") disabled as of 0.8.74
    confirmDelete = game.settings.get("dae", "confirmDelete");
    noDupDamageMacro = game.settings.get("dae", "noDupDamageMacro");
    disableEffects = game.settings.get("dae", "disableEffects");
    daeTitleBar = game.settings.get("dae", "DAETitleBar");
    /* TODO decide what to do about enhancing status effects or not
    ehnanceStatusEffects = game.settings.get("dae", "ehnanceStatusEffects");
    procStatusEffects(ehnanceStatusEffects);
    */
    let useDAESheet = game.settings.get("dae", "useDAESheet");
    if (useDAESheet) {
        CONFIG.ActiveEffect.sheetClass = DAEActiveEffectConfig;
    }
    else {
        CONFIG.ActiveEffect.sheetClass = ActiveEffectConfig;
    }
    expireRealTime = game.settings.get("dae", "expireRealTime");
    displayTraits = game.settings.get("dae", "displayTraits");
    // showDeprecation = game.settings.get("dae", "showDeprecation") ?? true;
    showInline = game.settings.get("dae", "showInline") ?? false;
    updatePatches();
}
export function DAEfromUuid(uuid) {
    let doc;
    try {
        let parts = uuid.split(".");
        const [docName, docId] = parts.slice(0, 2);
        parts = parts.slice(2);
        const collection = CONFIG[docName].collection.instance;
        doc = collection.get(docId);
        // Embedded Documents
        while (parts.length > 1) {
            const [embeddedName, embeddedId] = parts.slice(0, 2);
            doc = doc.getEmbeddedDocument(embeddedName, embeddedId);
            parts = parts.slice(2);
        }
    } /*catch (err) {
      error(`dae | could not fetch ${uuid} ${err}`)
    } */
    finally {
        return doc || null;
    }
}
export function DAEfromActorUuid(uuid) {
    let doc = DAEfromUuid(uuid);
    if (doc instanceof CONFIG.Token.documentClass)
        doc = doc.actor;
    return doc || null;
}
