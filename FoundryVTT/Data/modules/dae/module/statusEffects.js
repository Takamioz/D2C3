import { cubActive } from "./dae.js";
//@ts-ignore ACTIVE_EFFECT_MODES
const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
const OVERRIDE = ACTIVE_EFFECT_MODES.OVERRIDE;
var dnd5eStatusEffects = null;
export function procStatusEffects(enable) {
    // Don't fiddle if cub is enabled - leave it to CUB.
    if (cubActive)
        return;
    /*
    if (!dnd5eStatusEffects) dnd5eStatusEffects = duplicate(CONFIG.statusEffects);
    CONFIG.statusEffects = duplicate(dnd5eStatusEffects);
    */
    if (enable) {
        DAEStatusEffects.forEach(se => {
            let cse = CONFIG.statusEffects.find(cse => cse?.id === se.id);
            if (cse)
                mergeObject(cse, se, { inplace: true, overwrite: true, insertKeys: true });
            else {
                CONFIG.statusEffects.push(se);
            }
        });
    }
}
export let DAEStatusEffects = [
    {
        id: "dead",
        changes: [
            { key: "data.attributes.movement.fly", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.swim", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.walk", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.burrow", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.climb", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "flags.midi-qol.fail.ability.all", value: 1, mode: OVERRIDE, priority: 50 },
            { key: "flags.midi-qol.fail.attack.all", value: 1, mode: OVERRIDE, priority: 50 },
            { key: "flags.midi-qol.fail.spell.all", value: 1, mode: OVERRIDE, priority: 50 },
        ],
        flags: { dae: { statusId: "death" } }
    },
    {
        id: "unconscious",
        flags: { dae: { statusId: "unconscious" } },
        changes: [
            { key: "data.attributes.movement.fly", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.swim", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.walk", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.burrow", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.climb", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "flags.midi-qol.fail.ability.save.dex", value: 1, mode: OVERRIDE, priority: 50 },
            { key: "flags.midi-qol.fail.ability.save.str", value: 1, mode: OVERRIDE, priority: 50 },
            { key: "flags.midi-qol.grants.advantage.attack.all", value: 1, mode: OVERRIDE, priority: 50 }
        ],
    },
    {
        id: "sleep",
        flags: { dae: { statusId: "sleep" } }
    },
    {
        id: "stun",
        flags: { dae: { statusId: "stunned" } }
    },
    {
        id: "prone",
        flags: { dae: { statusId: "prone" } }
    },
    {
        id: "restrain",
        flags: { dae: { statusId: "restrained" } }
    },
    {
        id: "grappled",
        flags: { dae: { statusId: "grappled" } },
        label: "Grappled",
        icon: "icons/svg/padlock.svg",
        changes: [
            { key: "data.attributes.movement.fly", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.swim", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.walk", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.burrow", mode: OVERRIDE, priority: 50, value: 0 },
            { key: "data.attributes.movement.climb", mode: OVERRIDE, priority: 50, value: 0 },
        ],
    },
    {
        id: "paralysis",
        flags: { dae: { statusId: "paralyzed" } }
    },
    {
        id: "fly",
        flags: { dae: { statusId: "flying" } }
    },
    {
        id: "blind",
        flags: { dae: { statusId: "blinded" } },
        changes: [
            { key: "flags.midi-qol.disadvantage.attack.all", value: 1, mode: OVERRIDE, priority: 50 },
            { key: "flags.midi-qol.grants.advantage.attack.all", value: 1, mode: OVERRIDE, priority: 50 },
        ],
    },
    {
        id: "deaf",
        flags: { dae: { statusId: "deafened" } }
    },
    {
        id: "silence",
        flags: { dae: { statusId: "silenced" } },
        changes: [
            { key: "flags.midi-qol.fail.spell.verbal", value: 1, mode: OVERRIDE, priority: 50 },
        ],
    },
    {
        id: "fear",
        flags: { dae: { statusId: "frightened" } },
        changes: [
            { key: "flags.midi-qol.disadvantage.attack.all", value: 1, mode: OVERRIDE, priority: 50 },
            { key: "flags.midi-qol.disadvantage.ability.check.all", value: 1, mode: OVERRIDE, priority: 50 },
        ],
    },
    {
        id: "burning",
    },
    {
        id: "frozen",
    },
    {
        id: "shock",
    },
    {
        id: "corrode",
    },
    {
        id: "bleeding",
    },
    {
        id: "disease",
        flags: { dae: { statusId: "diseased" } }
    },
    {
        id: "poison",
        flags: { dae: { statusId: "poisoned" } }
    },
    {
        id: "eye",
        icon: "icons/svg/eye.svg"
    },
    {
        id: "curse",
        label: "EFFECT.StatusCursed",
        icon: "icons/svg/sun.svg"
    },
    {
        id: "invisible",
        label: "Invisible",
        icon: "icons/svg/explosion.svg",
        flags: { dae: { statusId: "invisible" } },
        changes: [
            { key: "flags.midi-qol.advantage.attack.all", value: 1, mode: OVERRIDE, priority: 50 },
            { key: "flags.midi-qol.grants.disadvantage.attack.all", value: 1, mode: OVERRIDE, priority: 50 },
        ],
    },
];
