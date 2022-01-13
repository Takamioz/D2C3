import { aboutTimeInstalled, timesUpInstalled, expireRealTime, DAEfromUuid, DAEfromActorUuid, replaceAtFields, simpleCalendarInstalled } from "./dae.js";
import { warn, debug, error } from "../dae.js";
export class GMActionMessage {
    constructor(action, sender, targetGM, data) {
        this.action = action;
        this.sender = sender;
        this.targetGM = targetGM;
        this.data = data;
    }
}
export var socketlibSocket = undefined;
export let setupSocket = () => {
    socketlibSocket = globalThis.socketlib.registerModule("dae");
    socketlibSocket.register("test", _testMessage);
    socketlibSocket.register("setTokenVisibility", _setTokenVisibility);
    socketlibSocket.register("setTileVisibility", _setTileVisibility);
    socketlibSocket.register("blindToken", _blindToken);
    socketlibSocket.register("restoreVision", _restoreVision);
    socketlibSocket.register("recreateToken", _recreateToken);
    socketlibSocket.register("createToken", _createToken);
    socketlibSocket.register("deleteToken", _deleteToken);
    socketlibSocket.register("renameToken", _renameToken);
    //  socketlibSocket.register("moveToken", _moveToken); TODO find out if this is used anywhere
    socketlibSocket.register("applyTokenMagic", _applyTokenMagic);
    socketlibSocket.register("applyActiveEffects", _applyActiveEffects);
    socketlibSocket.register("setTokenFlag", _setTokenFlag);
    socketlibSocket.register("setFlag", _setFlag);
    socketlibSocket.register("unsetFlag", _unsetFlag);
    socketlibSocket.register("deleteEffects", _deleteEffects);
    socketlibSocket.register("deleteUuid", _deleteUuid);
};
async function _deleteUuid(data) {
    const entity = await fromUuid(data.uuid);
    if (entity && entity instanceof Item && !data.uuid.startsWith("Compendium") && !data.uuid.startsWith("Item")) { // only allow deletion of owned items
        return await entity.delete();
    }
    if (entity && entity instanceof CONFIG.Token.documentClass && !data.uuid.startsWith("Compendium") && !data.uuid.startsWith("Item")) { // only allow deletion of owned items
        return await entity.delete();
    }
    if (entity && entity instanceof CONFIG.ActiveEffect.documentClass)
        return await entity.delete();
    return false;
}
function _testMessage(data) {
    console.log("DyamicEffects | test message received", data);
    return "Test message received and processed";
}
async function _setTokenVisibility(data) {
    await DAEfromUuid(data.tokenUuid)?.update({ hidden: data.hidden });
}
async function _setTileVisibility(data) {
    return await DAEfromUuid(data.tileUuid)?.update({ vlisible: data.hidden });
}
async function _applyActiveEffects(data) {
    return await applyActiveEffects(data.activate, data.targets, data.activeEffects, data.itemDuration, data.itemCardId);
}
async function _recreateToken(data) {
    await _createToken(data);
    return await DAEfromUuid(data.tokenUuid)?.delete();
}
async function _createToken(data) {
    let scenes = game.scenes;
    let targetScene = scenes.get(data.targetSceneId);
    //@ts-ignore
    return await targetScene.createEmbeddedDocuments('Token', [mergeObject(duplicate(data.tokenData), { "x": data.x, "y": data.y, hidden: false }, { overwrite: true, inplace: true })]);
}
async function _deleteToken(data) {
    return await DAEfromUuid(data.tokenUuid)?.delete();
}
async function _setTokenFlag(data) {
    const update = {};
    update[`flags.dae.${data.flagName}`] = data.flagValue;
    return await DAEfromUuid(data.tokenUuid)?.update(update);
}
async function _setFlag(data) {
    if (!data.actorUuid)
        return await game.actors.get(data.actorId)?.setFlag("dae", data.flagId, data.value);
    else
        return await DAEfromActorUuid(data.actorUuid)?.setFlag("dae", data.flagId, data.value);
}
async function _unsetFlag(data) {
    return await DAEfromActorUuid(data.actorUuid)?.unsetFlag("dae", data.flagId);
}
async function _blindToken(data) {
    return await DAEfromUuid(data.tokenUuid)?.update({ vision: false });
}
async function _restoreVision(data) {
    return await DAEfromUuid(data.tokenUuid)?.update({ vision: true });
}
async function _renameToken(data) {
    return await canvas.tokens.placeables.find(t => t.id === data.tokenData._id).update({ "name": data.newName });
}
async function _applyTokenMagic(data) {
    let token = DAEfromUuid(data.tokenUuid);
    let tokenMagic = globalThis.TokenMagic;
    if (tokenMagic && token) {
        return await tokenMagic.addFilters(token, data.effectId);
    }
}
async function _deleteEffects(data) {
    for (let idData of data.targets) {
        const entity = DAEfromUuid(idData.uuid);
        const actor = entity.actor ? entity.actor : entity;
        if (!actor) {
            error("could not find actor for ", idData);
        }
        const effectsToDelete = actor?.effects?.filter(ef => ef.data.origin === data.origin && !data.ignore.includes(ef.uuid));
        if (effectsToDelete?.length > 0) {
            try {
                return await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete.map(ef => ef.id));
            }
            catch (err) {
                warn("delete effects failed ", err);
                // TODO can get thrown since more than one thing tries to delete an effect
            }
            ;
        }
    }
    if (globalThis.Sequencer)
        globalThis.Sequencer.EffectManager.endEffects({ origin: data.origin });
}
export async function applyActiveEffects(activate, tokenList, activeEffects, itemDuration, itemCardId = null) {
    // debug("apply active effect ", activate, tokenList, duplicate(activeEffects), itemDuration)
    for (let tid of tokenList) {
        const token = DAEfromUuid(tid) || canvas.tokens.get(tid);
        const tokenUuid = token.document ? token.document.uuid : token.uuid;
        let actor = token.actor ? token.actor : token; // assume if we did not get a token it is an actor
        if (actor) {
            // Remove any existing effects that are not stackable or transfer from the same origin
            let actEffects = activeEffects;
            const origins = actEffects.map(aeData => aeData.origin);
            // find existing active effect that have same origin as one of our new effects            
            let currentStacks = 1;
            let removeList = actor.effects.filter(ae => origins.includes(ae.data.origin) && getProperty(ae.data, "flags.dae.transfer") === false && getProperty(ae.data, "flags.dae.stackable") !== "multi");
            if (removeList.length > 0) {
                currentStacks = removeList.filter(ae => getProperty(ae.data, "flags.dae.stackable") === "count").reduce((acc, ae) => acc + (getProperty(ae.data, "flags.dae.stacks") ?? 1), 1);
                removeList = removeList.map(ae => ae.data._id);
                const result = await actor.deleteEmbeddedDocuments("ActiveEffect", removeList);
            }
            if (activate) {
                let dupEffects = duplicate(actEffects);
                for (let ae of dupEffects) {
                    setProperty(ae, "flags.dae.token", tid);
                    if (getProperty(ae, "flags.dae.stackable") === "count") {
                        setProperty(ae, "flags.dae.stacks", currentStacks);
                        ae.label = `${ae.label} (${getProperty(ae, "flags.dae.stacks")})`;
                    }
                    // convert item duration to seconds/rounds/turns according to combat
                    if (ae.duration.seconds) {
                        ae.duration.startTime = game.time.worldTime;
                    }
                    else if (ae.duration.rounds || ae.duration.turns) {
                        ae.duration.startRound = game.combat?.round;
                        ae.duration.startTurn = game.combat?.turn;
                    }
                    else { // no specific duration on effect use spell duration
                        //@ts-ignore
                        const inCombat = (game.combat?.turns.some(turnData => turnData.token?.id === token.id));
                        const convertedDuration = convertDuration(itemDuration, inCombat);
                        debug("converted duration ", convertedDuration, inCombat, itemDuration);
                        if (convertedDuration.type === "seconds") {
                            ae.duration.seconds = convertedDuration.seconds;
                            ae.duration.startTime = game.time.worldTime;
                        }
                        else if (convertedDuration.type === "turns") {
                            ae.duration.rounds = convertedDuration.rounds;
                            ae.duration.turns = convertedDuration.turns;
                            ae.duration.startRound = game.combat?.round;
                            ae.duration.startTurn = game.combat?.turn;
                        }
                    }
                    warn("Apply active effects ", ae, itemCardId);
                    setProperty(ae.flags, "dae.transfer", false);
                    ae.changes.map(change => {
                        if (["macro.execute", "macro.itemMacro", "roll", "macro.actorUpdate"].includes(change.key)) {
                            if (typeof change.value === "number") {
                            }
                            else if (typeof change.value === "string") {
                                const context = { "target": token.id, "targetUuid": tokenUuid, "itemCardid": itemCardId, "@target": "target", "item": "@item", "itemData": "@itemData" };
                                change.value = replaceAtFields(duplicate(change.value), context);
                                change.value = change.value.replace("##", "@");
                            }
                            else {
                                change.value = duplicate(change.value).map(f => {
                                    if (f === "@itemCardId")
                                        return itemCardId;
                                    if (f === "@target")
                                        return tokenUuid;
                                    // if (typeof f === "string" && f.startsWith("@@")) return;
                                    return f;
                                });
                            }
                        }
                        return change;
                    });
                }
                if (dupEffects.length > 0) {
                    let timedRemoveList = await actor.createEmbeddedDocuments("ActiveEffect", dupEffects);
                    //TODO remove this when timesup is in the wild.
                    if (!timesUpInstalled) { // do the kludgey old form removal
                        let doRemoveEffect = async (tokenUuid, removeEffect) => {
                            const actor = globalThis.DAE.DAEfromActorUuid(tokenUuid);
                            let removeId = removeEffect._id;
                            if (removeId && actor?.effects.get(removeId)) {
                                await actor?.deleteEmbeddedDocuments("ActiveEffect", [removeId]);
                            }
                        };
                        if (!Array.isArray(timedRemoveList))
                            timedRemoveList = [timedRemoveList];
                        timedRemoveList.forEach(ae => {
                            // need to do separately as they might have different durations
                            let duration = ae.data.duration?.seconds || 0;
                            if (!duration) {
                                duration = ((ae.data.duration.rounds ?? 0) + ((ae.data.duration.turns > 0) ? 1 : 0)) * CONFIG.time.roundTime;
                            }
                            warn("removing effect ", ae.data, " in ", duration, " seconds ");
                            if (duration && aboutTimeInstalled) {
                                game.Gametime.doIn({ seconds: duration }, doRemoveEffect, tokenUuid, ae.data);
                            }
                            else if (duration && expireRealTime) { //TODO decide what to do for token magic vs macros
                                setTimeout(doRemoveEffect, duration * 1000 || 6000, tokenUuid, ae.data);
                            }
                        });
                    }
                }
            }
            ;
        }
        ;
    }
}
export function convertDuration(itemDuration, inCombat) {
    // TODO rewrite this abomination
    const useTurns = inCombat && timesUpInstalled;
    if (!itemDuration)
        return { type: "seconds", seconds: 0, rounds: 0, turns: 0 };
    if (!simpleCalendarInstalled) {
        switch (itemDuration.units) {
            case "turn":
            case "turns": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: itemDuration.value };
            case "round":
            case "rounds": return { type: useTurns ? "turns" : "seconds", seconds: itemDuration.value * CONFIG.time.roundTime, rounds: itemDuration.value, turns: 0 };
            case "second":
            case "seconds":
                return { type: useTurns ? "turns" : "seconds", seconds: itemDuration.value, rounds: itemDuration.value / CONFIG.time.roundTime, turns: 0 };
            case "minute":
            case "minutes":
                let durSeconds = itemDuration.value * 60;
                if (durSeconds / CONFIG.time.roundTime <= 10) {
                    return { type: useTurns ? "turns" : "seconds", seconds: durSeconds, rounds: durSeconds / CONFIG.time.roundTime, turns: 0 };
                }
                else {
                    return { type: "seconds", seconds: durSeconds, rounds: durSeconds / CONFIG.time.roundTime, turns: 0 };
                }
            case "hour":
            case "hours": return { type: "seconds", seconds: itemDuration.value * 60 * 60, rounds: 0, turns: 0 };
            case "day":
            case "days": return { type: "seconds", seconds: itemDuration.value * 60 * 60 * 24, rounds: 0, turns: 0 };
            case "week":
            case "weeks": return { type: "seconds", seconds: itemDuration.value * 60 * 60 * 24 * 7, rounds: 0, turns: 0 };
            case "month":
            case "months": return { type: "seconds", seconds: itemDuration.value * 60 * 60 * 24 * 30, rounds: 0, turns: 0 };
            case "year":
            case "years": return { type: "seconds", seconds: itemDuration.value * 60 * 60 * 24 * 30 * 365, rounds: 0, turns: 0 };
            case "inst": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: 1 };
            default:
                console.warn("dae | unknown time unit found", itemDuration.units);
                return { type: useTurns ? "none" : "seconds", seconds: undefined, rounds: undefined, turns: undefined };
        }
    }
    else {
        switch (itemDuration.units) {
            case "turn":
            case "turns": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: itemDuration.value };
            case "round":
            case "rounds": return { type: useTurns ? "turns" : "seconds", seconds: itemDuration.value * CONFIG.time.roundTime, rounds: itemDuration.value, turns: 0 };
            case "second": return { type: useTurns ? "turns" : "seconds", seconds: itemDuration.value, rounds: itemDuration.value / CONFIG.time.roundTime, turns: 0 };
            default:
                let interval = {};
                interval[itemDuration.units] = itemDuration.value;
                //@ts-ignore
                const durationSeconds = window.SimpleCalendar.api.timestampPlusInterval(game.time.worldTime, interval) - game.time.worldTime;
                if (durationSeconds / CONFIG.time.roundTime <= 10) {
                    return { type: useTurns ? "turns" : "seconds", seconds: durationSeconds, rounds: Math.floor(durationSeconds / CONFIG.time.roundTime), turns: 0 };
                }
                else {
                    return { type: "seconds", seconds: durationSeconds, rounds: Math.floor(durationSeconds / CONFIG.time.roundTime), turns: 0 };
                }
            //      default: return {type: combat ? "none" : "seconds", seconds: CONFIG.time.roundTime, rounds: 0, turns: 1};
        }
    }
}
