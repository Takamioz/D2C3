import { displayTraits, libWrapper } from "./dae.js";
//@ts-ignore
// import {d20Roll} from "../../../systems/dnd5e/module/dice.js";
import { log, error, warn, } from "../dae.js";
/* removed in 0.8.74
function rollAbilitySave(abilityId, options = { event, fastForward: null, advantage: null, disadvantage: null }) {
  const label = CONFIG.DND5E.abilities[abilityId];
  const abl = this.data.data.abilities[abilityId];

  // Construct parts
  const parts = ["@mod"];
  const data = this.getRollData();
  data.mod = abl.save;
  // Don't include proficiency bonus since it is already in abl.save.

  // Include a global actor ability save bonus
  const bonuses = getProperty(this.data.data, "bonuses.abilities") || {};
  //@ts-ignore
  if (bonuses.save && !Number.isNumeric(bonuses.save)) {
    parts.push("@saveBonus");
    //@ts-ignore
    data.saveBonus = bonuses.save;
  }

  // Add provided extra roll parts now because they will get clobbered by mergeObject below
  //@ts-ignore
  if (options.parts?.length > 0) {
    //@ts-ignore
    parts.push(...options.parts);
  }

  // Roll and return
  //@ts-ignore
  const rollData = foundry.utils.mergeObject(options, {
    parts: parts,
    data: data,
    title: game.i18n.format("DND5E.SavePromptTitle", { ability: label }),
    halflingLucky: game.system.id === "dnd5e" ? this.getFlag("dnd5e", "halflingLucky") : undefined,
    messageData: {
      //@ts-ignore
      speaker: options.speaker || ChatMessage.getSpeaker({ actor: this }),
      "flags.dnd5e.roll": { type: "save", abilityId }
    }
  });
  if (game.system.id === "sw5e") setProperty(rollData, "flags.sw5e.roll", { type: "save", abilityId });
  return d20Roll(rollData);
}
*/
var d20Roll;
var dice;
export function patchingInitSetup() {
    warn("system is ", game.system);
    dice = game[game.system.id].dice;
    if (!dice)
        error("Dice not defined! Many things won't work");
    else
        d20Roll = dice?.d20Roll;
}
function _prepareArmorClassAttribution(wrapped, data) {
    const attributions = wrapped(data);
    if (!this.object.data.effects)
        return attributions;
    for (let effect of this.object.data.effects) {
        for (let change of effect.data.changes) {
            if (change.key === "data.attributes.ac.value" && !effect.data.disabled && !effect.isSuppressed) {
                attributions.push({
                    label: `${effect.data.label} (dae)`,
                    mode: change.mode,
                    value: change.value
                });
            }
        }
    }
    return attributions;
}
export function patchPrepareArmorClassAttribution() {
    if (game.system.id === "dnd5e" && isNewerVersion(game.system.data.version, "1.4.0")) {
        if (!isNewerVersion("1.8.0", game.modules.get("lib-wrapper").data.version)) {
            libWrapper.register("dae", "CONFIG.Actor.sheetClasses.character['dnd5e.ActorSheet5eCharacter'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
            libWrapper.register("dae", "CONFIG.Actor.sheetClasses.npc['dnd5e.ActorSheet5eNPC'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
            libWrapper.register("dae", "CONFIG.Actor.sheetClasses.vehicle['dnd5e.ActorSheet5eVehicle'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
        }
        else if (game.system.id === "sw5e" && isNewerVersion(game.system.data.version, "1.4.0")) {
            // TODO come back and implement for sw5e when available.
        }
    }
}
// Allow limited recursion of the formula replace function for things like
// bonuses.heal.damage in spell formulas.
export function replaceFormulaData(wrapped, formula, data, { missing, warn = false } = { missing: undefined, warn: false }) {
    let result = formula;
    const maxIterations = 3;
    if (typeof formula !== "string")
        return formula;
    for (let i = 0; i < maxIterations; i++) {
        if (!result.includes("@"))
            break;
        try {
            result = wrapped(result, data, { missing, warn });
        }
        catch (err) {
            error(err, formula, data, missing, warn);
        }
    }
    return result;
}
export function updatePatches() {
    // patchAbilitySave(); removed in 0.8.74
    patchSpecialTraits();
}
;
var abilitySavePatched = false;
/*
function patchAbilitySave() {
  return;
 deactivated as of 0.8.74
  if (!d20Roll)
    return;
  //@ts-ignore for dnd5e don't do any patching of ability save
  if (["dnd5e", "sw5e"].includes(game.system.id) && !isNewerVersion(game.system.data.version, "1.5.1")) {
    log(`Patching CONFIG.Actor.documentClass.prototype.rollAbilitySave (override=${useAbilitySave})`);
    if (!useAbilitySave) {
      if (abilitySavePatched) {
        libWrapper.unregister("dae", "CONFIG.Actor.documentClass.prototype.rollAbilitySave");
      }
    } else {
      if (!abilitySavePatched) {
        libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.rollAbilitySave", rollAbilitySave, "OVERRIDE");
      }
    }
    abilitySavePatched = useAbilitySave;
  }
};
*/
export function patchingSetup() {
    // patchAbilitySave(); removed in 0.8.74
    log("Patching Roll.replaceFormulaData");
    libWrapper.register("dae", "Roll.replaceFormulaData", replaceFormulaData, "MIXED");
}
;
var specialTraitsPatched = false;
// Patch for actor-flags app to display settings including active effects
export function patchSpecialTraits() {
    //@ts-ignore
    if ("dnd5e" === game.system.id && isNewerVersion(game.system.data.version, "1.1.0") ||
        "sw5e" === game.system.id) {
        log(`Patching game.${game.system.id}.applications.ActorSheetFlags.prototype._updateObject (override=${displayTraits})`);
        log(`Patching game.${game.system.id}.applications.ActorSheetFlags.prototype._getFlags (override=${displayTraits})`);
        log(`Patching game.${game.system.id}.applications.ActorSheetFlags.prototype._getBonuses (override=${displayTraits})`);
        if (!displayTraits) {
            if (specialTraitsPatched) {
                libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._updateObject`);
                libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getFlags`);
                libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getBonuses`);
            }
        }
        else {
            if (!specialTraitsPatched) {
                libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._updateObject`, _updateObject, "OVERRIDE");
                libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getFlags`, _getFlags[game.system.id], "OVERRIDE");
                libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getBonuses`, _getBonuses[game.system.id], "OVERRIDE");
            }
        }
        specialTraitsPatched = displayTraits;
    }
}
const _getBonuses = { "dnd5e": _getBonusesdnd5e, "sw5e": _getBonusessw5e };
const _getFlags = { "dnd5e": _getFlagsdnd5e, "sw5e": _getFlagssw5e };
function _getFlagsdnd5e() {
    const flags = {};
    const baseData = this.document.data;
    for (let [k, v] of Object.entries(CONFIG.DND5E.characterFlags)) {
        //@ts-ignore
        if (!flags.hasOwnProperty(v.section))
            flags[v.section] = {};
        let flag = duplicate(v);
        //@ts-ignore
        flag.type = v.type.name;
        //@ts-ignore
        flag.isCheckbox = v.type === Boolean;
        //@ts-ignore
        flag.isSelect = v.hasOwnProperty('choices');
        //@ts-ignore
        flag.value = getProperty(baseData.flags, `dnd5e.${k}`);
        //@ts-ignore
        flags[v.section][`flags.dnd5e.${k}`] = flag;
    }
    return flags;
}
function _getFlagssw5e() {
    const flags = {};
    const baseData = this.document.data;
    for (let [k, v] of Object.entries(CONFIG.DND5E.characterFlags)) {
        //@ts-ignore
        if (!flags.hasOwnProperty(v.section))
            flags[v.section] = {};
        let flag = duplicate(v);
        //@ts-ignore
        flag.type = v.type.name;
        //@ts-ignore
        flag.isCheckbox = v.type === Boolean;
        //@ts-ignore
        flag.isSelect = v.hasOwnProperty('choices');
        //@ts-ignore
        flag.value = getProperty(baseData.flags, `sw5e.${k}`);
        //@ts-ignore
        flags[v.section][`flags.sw5e.${k}`] = flag;
    }
    return flags;
}
function _getBonusesdnd5e() {
    const bonuses = [
        { name: "data.bonuses.mwak.attack", label: "DND5E.BonusMWAttack" },
        { name: "data.bonuses.mwak.damage", label: "DND5E.BonusMWDamage" },
        { name: "data.bonuses.rwak.attack", label: "DND5E.BonusRWAttack" },
        { name: "data.bonuses.rwak.damage", label: "DND5E.BonusRWDamage" },
        { name: "data.bonuses.msak.attack", label: "DND5E.BonusMSAttack" },
        { name: "data.bonuses.msak.damage", label: "DND5E.BonusMSDamage" },
        { name: "data.bonuses.rsak.attack", label: "DND5E.BonusRSAttack" },
        { name: "data.bonuses.rsak.damage", label: "DND5E.BonusRSDamage" },
        { name: "data.bonuses.abilities.check", label: "DND5E.BonusAbilityCheck" },
        { name: "data.bonuses.abilities.save", label: "DND5E.BonusAbilitySave" },
        { name: "data.bonuses.abilities.skill", label: "DND5E.BonusAbilitySkill" },
        { name: "data.bonuses.spell.dc", label: "DND5E.BonusSpellDC" }
    ];
    for (let b of bonuses) {
        //@ts-ignore
        b.value = getProperty(this.object.data, b.name) || "";
    }
    return bonuses;
}
function _getBonusessw5e() {
    const bonuses = [
        { name: "data.bonuses.mwak.attack", label: "SW5E.BonusMWAttack" },
        { name: "data.bonuses.mwak.damage", label: "SW5E.BonusMWDamage" },
        { name: "data.bonuses.rwak.attack", label: "SW5E.BonusRWAttack" },
        { name: "data.bonuses.rwak.damage", label: "SW5E.BonusRWDamage" },
        { name: "data.bonuses.mpak.attack", label: "SW5E.BonusMPAttack" },
        { name: "data.bonuses.mpak.damage", label: "SW5E.BonusMPDamage" },
        { name: "data.bonuses.rpak.attack", label: "SW5E.BonusRPAttack" },
        { name: "data.bonuses.rpak.damage", label: "SW5E.BonusRPDamage" },
        { name: "data.bonuses.abilities.check", label: "SW5E.BonusAbilityCheck" },
        { name: "data.bonuses.abilities.save", label: "SW5E.BonusAbilitySave" },
        { name: "data.bonuses.abilities.skill", label: "SW5E.BonusAbilitySkill" },
        { name: "data.bonuses.spell.dc", label: "SW5E.BonusPowerlDC" }
    ];
    for (let b of bonuses) {
        //@ts-ignore
        b.value = getProperty(this.object.data, b.name) || "";
    }
    return bonuses;
}
async function _updateObject(event, formData) {
    const actor = this.object;
    let updateData = expandObject(formData);
    // Unset any flags which are "false"
    let unset = false;
    const flags = updateData.flags[game.system.id];
    for (let [k, v] of Object.entries(flags)) {
        //@ts-ignore
        if ([undefined, null, "", false, 0].includes(v)) {
            delete flags[k];
            if (hasProperty(actor.data.flags, `${game.system.id}.${k}`)) {
                unset = true;
                flags[`-=${k}`] = null;
            }
        }
    }
    // Clear any bonuses which are whitespace only
    for (let b of Object.values(updateData.data.bonuses)) {
        for (let [k, v] of Object.entries(b)) {
            b[k] = v.trim();
        }
    }
    // Diff the data against any applied overrides and apply
    await actor.update(diffObject(actor.overrides || {}, updateData), { diff: false });
}
