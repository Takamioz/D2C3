// Import TypeScript modules
import { registerSettings } from "./module/settings.js";
import { preloadTemplates } from "./module/preloadTemplates.js";
import { daeSetupActions, doEffects, daeInitActions, ValidSpec, fetchParams, daeMacro, DAEfromUuid, DAEfromActorUuid } from "./module/dae.js";
import { daeReadyActions } from "./module/dae.js";
import { convertDuration, setupSocket } from "./module/GMAction.js";
import { checkArmorDisabled, checkLibWrapperVersion, cleanArmorWorld, cleanEffectOrigins, fixDeprecatedChanges, fixDeprecatedChangesActor, fixDeprecatedChangesItem, fixTransferEffects, fixupDDBAC, migrateActorDAESRD, migrateAllActorsDAESRD, migrateAllNPCDAESRD, removeActorArmorEffects, removeActorEffectsArmorEffects, removeAllActorArmorEffects, removeAllItemsArmorEffects, removeAllTokenArmorEffects, removeItemArmorEffects, tobMapper } from "./module/migration.js";
import { ActiveEffects } from "./module/apps/ActiveEffects.js";
import { patchingSetup, patchingInitSetup, patchSpecialTraits } from "./module/patching.js";
import { addAutoFields, DAEActiveEffectConfig } from "./module/apps/DAEActiveEffectConfig.js";
import { teleportToToken, blindToken, restoreVision, setTokenVisibility, setTileVisibility, moveToken, renameToken, getTokenFlag, setTokenFlag, setFlag, unsetFlag, getFlag, deleteActiveEffect, createToken } from "./module/daeMacros.js";
export let setDebugLevel = (debugText) => {
    debugEnabled = { "none": 0, "warn": 1, "debug": 2, "all": 3 }[debugText] || 0;
    // 0 = none, warnings = 1, debug = 2, all = 3
    if (debugEnabled >= 3)
        CONFIG.debug.hooks = true;
};
export var debugEnabled;
// 0 = none, warnings = 1, debug = 2, all = 3
export let debug = (...args) => { if (debugEnabled > 1)
    console.log("DEBUG: dae | ", ...args); };
export let log = (...args) => console.log("dae | ", ...args);
export let warn = (...args) => { if (debugEnabled > 0)
    console.warn("dae | ", ...args); };
export let error = (...args) => console.error("dae | ", ...args);
export let timelog = (...args) => warn("dae | ", Date.now(), ...args);
export let i18n = key => {
    return game.i18n.localize(key);
};
export let daeAlternateStatus;
export let changesQueue;
/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
    // Register custom module settings
    registerSettings();
    debug('Init setup actions');
    daeInitActions();
    patchingInitSetup();
    fetchParams(false);
    // Assign custom classes and constants here
    // Preload Handlebars templates
    await preloadTemplates();
    //@ts-ignore Semaphore
    changesQueue = new window.Semaphore(1);
});
export let daeSpecialDurations;
export let daeMacroRepeats;
Hooks.once('ready', async function () {
    if (!["dnd5e", "sw5e"].includes(game.system.id))
        return;
    fetchParams();
    debug("ready setup actions");
    daeReadyActions();
    // setupDAEMacros();
    daeSpecialDurations = { "None": "" };
    if (game.modules.get("times-up")?.active && isNewerVersion(game.modules.get("times-up").data.version, "0.0.9")) {
        daeSpecialDurations["turnStart"] = i18n("dae.turnStart");
        daeSpecialDurations["turnEnd"] = i18n("dae.turnEnd");
        daeSpecialDurations["turnStartSource"] = i18n("dae.turnStartSource");
        daeSpecialDurations["turnEndSource"] = i18n("dae.turnEndSource");
        daeMacroRepeats = {
            "none": "",
            "startEveryTurn": i18n("dae.startEveryTurn"),
            "endEveryTurn": i18n("dae.endEveryTurn")
        };
    }
    if (game.modules.get("midi-qol")?.active) {
        daeSpecialDurations["1Action"] = i18n("dae.1Action");
        daeSpecialDurations["1Spell"] = i18n("dae.1Spell");
        //@ts-ignore
        daeSpecialDurations["1Attack"] = game.i18n.format("dae.1Attack", { type: `${i18n("dae.spell")}/${i18n("dae.weapon")} ${i18n("dae.attack")}` });
        daeSpecialDurations["1Hit"] = game.i18n.format("dae.1Hit", { type: `${i18n("dae.spell")}/${i18n("dae.weapon")}` });
        //    daeSpecialDurations["1Hit"] = i18n("dae.1Hit");
        daeSpecialDurations["1Reaction"] = i18n("dae.1Reaction");
        let attackTypes = ["mwak", "rwak", "msak", "rsak"];
        if (game.system.id === "sw5e")
            attackTypes = ["mwak", "rwak", "mpak", "rpak"];
        attackTypes.forEach(at => {
            //@ts-ignore
            daeSpecialDurations[`1Attack:${at}`] = `${CONFIG.DND5E.itemActionTypes[at]}: ${game.i18n.format("dae.1Attack", { type: CONFIG.DND5E.itemActionTypes[at] })}`;
            daeSpecialDurations[`1Hit:${at}`] = `${CONFIG.DND5E.itemActionTypes[at]}: ${game.i18n.format("dae.1Hit", { type: CONFIG.DND5E.itemActionTypes[at] })}`;
        });
        daeSpecialDurations["DamageDealt"] = i18n("dae.DamageDealt");
        daeSpecialDurations["isAttacked"] = i18n("dae.isAttacked");
        daeSpecialDurations["isDamaged"] = i18n("dae.isDamaged");
        daeSpecialDurations["isHit"] = i18n("dae.isHit");
        daeSpecialDurations["isSave"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}`;
        daeSpecialDurations["isSaveSuccess"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}: ${i18n("dae.success")}`;
        daeSpecialDurations["isSaveFailure"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}: ${i18n("dae.failure")}`;
        daeSpecialDurations["isCheck"] = `${i18n("dae.isRollBase")} ${i18n("dae.isCheckDetail")}`;
        daeSpecialDurations["isSkill"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSkillDetail")}`;
        daeSpecialDurations["isMoved"] = i18n("dae.isMoved");
        daeSpecialDurations["longRest"] = i18n("DND5E.LongRest");
        daeSpecialDurations["shortRest"] = i18n("DND5E.ShortRest");
        daeSpecialDurations["newDay"] = `${i18n("DND5E.NewDay")}`;
        Object.keys(CONFIG.DND5E.abilities).forEach(abl => {
            daeSpecialDurations[`isSave.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isSaveDetail")}`;
            daeSpecialDurations[`isSaveSuccess.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isSaveDetail")}: ${i18n("dae.success")}`;
            daeSpecialDurations[`isSaveFailure.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isSaveDetail")}: ${i18n("dae.failure")}`;
            daeSpecialDurations[`isCheck.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isCheckDetail")}`;
        });
        Object.keys(CONFIG.DND5E.damageTypes).forEach(dt => {
            daeSpecialDurations[`isDamaged.${dt}`] = `${i18n("dae.isDamaged")}: ${CONFIG.DND5E.damageTypes[dt]}`;
        });
        Object.keys(CONFIG.DND5E.skills).forEach(skillId => {
            daeSpecialDurations[`isSkill.${skillId}`] = `${i18n("dae.isRollBase")} ${i18n("dae.isSkillDetail")} ${CONFIG.DND5E.skills[skillId]}`;
        });
    }
    patchSpecialTraits();
});
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function () {
    if (!["dnd5e", "sw5e"].includes(game.system.id))
        return;
    // Do anything after initialization but before
    // ready
    debug("setup actions");
    daeSetupActions();
    patchingSetup();
    //@ts-ignore
    window.DAE = {
        ValidSpec,
        doEffects,
        daeMacro: daeMacro,
        ActiveEffects: ActiveEffects,
        DAEActiveEffectConfig: DAEActiveEffectConfig,
        teleportToToken: teleportToToken,
        blindToken: blindToken,
        restoreVision: restoreVision,
        setTokenVisibility: setTokenVisibility,
        setTileVisibility: setTileVisibility,
        moveToken: moveToken,
        renameToken: renameToken,
        getTokenFlag: getTokenFlag,
        setTokenFlag: setTokenFlag,
        setFlag: setFlag,
        unsetFlag: unsetFlag,
        getFlag: getFlag,
        deleteActiveEffect: deleteActiveEffect,
        migrateActorDAESRD: migrateActorDAESRD,
        migrateAllActorsDAESRD: migrateAllActorsDAESRD,
        migrateAllNPCDAESRD: migrateAllNPCDAESRD,
        convertDuration,
        confirmAction,
        DAEfromUuid: DAEfromUuid,
        DAEfromActorUuid: DAEfromActorUuid,
        removeItemArmorEffects: removeItemArmorEffects,
        removeActorEffectsArmorEffects: removeActorEffectsArmorEffects,
        removeActorArmorEffects: removeActorArmorEffects,
        removeAllActorArmorEffects: removeAllActorArmorEffects,
        removeAllTokenArmorEffects: removeAllTokenArmorEffects,
        removeAllItemsArmorEffects: removeAllItemsArmorEffects,
        cleanArmorWorld: cleanArmorWorld,
        addAutoFields: addAutoFields,
        createToken: createToken,
        fixupDDBAC: fixupDDBAC,
        cleanEffectOrigins: cleanEffectOrigins,
        tobMapper: tobMapper,
        fixTransferEffects: fixTransferEffects,
        fixDeprecatedChanges: fixDeprecatedChanges,
        fixDeprecatedChangesActor: fixDeprecatedChangesActor,
        fixDeprecatedChangesItem: fixDeprecatedChangesItem,
        daeSpecialDurations: () => { return daeSpecialDurations; }
    };
    setupSocket();
});
/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once("ready", () => {
    if (!["dnd5e", "sw5e"].includes(game.system.id))
        return;
    checkLibWrapperVersion();
    checkArmorDisabled();
    /* removed as of 0.8.74
    if (useAbilitySave && isNewerVersion(game.system.data.version, "1.4.9") && game.user.isGM)
      ui.notifications.warn(`DAE | rollAbilitySave replacement is deprecated and will be removed from version ${game.system.id} 1.5.3`)
   */
});
export function confirmAction(toCheck, confirmFunction, title = i18n("dae.confirm")) {
    if (toCheck) {
        let d = new Dialog({
            // localize this text
            title,
            content: `<p>${i18n("dae.sure")}</p>`,
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Confirm",
                    callback: confirmFunction
                },
                two: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel",
                    callback: () => { }
                }
            },
            default: "two"
        });
        d.render(true);
    }
    else
        return confirmFunction();
}
Hooks.once('libChangelogsReady', function () {
    //@ts-ignore
    const libch = libChangelogs;
});
