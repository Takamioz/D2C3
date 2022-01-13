import { i18n, error } from "../dae.js";
//@ts-ignore
const EFFECTMODES = CONST.ACTIVE_EFFECT_MODES;
export async function removeItemArmorEffects(items, name = "") {
    let promises = [];
    for (let item of items) {
        let toDelete = [];
        if (!item.effects)
            continue;
        for (let effect of item.effects) {
            if (effect.data.flags?.dae?.armorEffect)
                toDelete.push(effect.id);
        }
        if (toDelete.length > 0) {
            if (item.parent) {
                let itemData = duplicate(item.data._source);
                for (let effectId of toDelete) {
                    // a bit kludgy but there will only be a single item to delete
                    itemData.effects = itemData.effects.filter(effectData => effectData._id !== effectId);
                }
                console.warn(`deleting ${name}: Ownded Item effects ${item.name}`, itemData.effects);
                await item.parent.deleteEmbeddedDocuments("Item", [itemData._id]);
                await item.parent.createEmbeddedDocuments("Item", [itemData]);
            }
            else {
                console.warn(`deleting ${name}: Item effects ${item.name}`);
                await item.deleteEmbeddedDocuments("ActiveEffect", toDelete);
            }
        }
    }
}
export async function removeActorEffectsArmorEffects(actor, name = "") {
    let promises = [];
    let toDelete = [];
    if (!actor.effects)
        return [];
    ;
    for (let effect of actor.effects) {
        if (effect.data.flags?.dae?.armorEffect)
            toDelete.push(effect.id);
    }
    if (toDelete.length > 0) {
        console.warn(`deleting ${name}: Actor effects ${actor.name}`, toDelete);
        await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    }
}
export async function removeActorArmorEffects(actor) {
    if (!(actor instanceof Actor)) {
        console.warn(actor, " is not an actor");
        return;
    }
    await removeItemArmorEffects(actor.items, actor.name);
    await removeActorEffectsArmorEffects(actor, actor.name);
}
export async function removeAllActorArmorEffects() {
    let promises = [];
    for (let actor of game.actors) {
        promises.push(removeActorArmorEffects(actor));
    }
    return Promise.all(promises);
}
export async function removeAllTokenArmorEffects() {
    let promises = [];
    for (let scene of game.scenes) {
        //@ts-ignore
        for (let tokenDocument of scene.tokens) {
            if (!tokenDocument.isLinked && tokenDocument.actor) {
                promises.push(removeActorArmorEffects(tokenDocument.actor));
            }
        }
    }
    return Promise.all(promises);
}
export async function removeAllItemsArmorEffects() {
    return removeItemArmorEffects(game.items, "World");
}
export async function cleanArmorWorld() {
    Promise.all([removeAllItemsArmorEffects(), removeAllActorArmorEffects(), removeAllTokenArmorEffects()]);
}
function findDAEItem(itemData, packs) {
    for (let pack of packs) {
        let matchItem = pack?.find(pd => pd.name === itemData.name && pd.type === itemData.type);
        if (matchItem)
            return matchItem;
    }
    return undefined;
}
var packsLoaded = false;
var daeItemPack;
var midiItemPack;
var daeSpellPack;
var midiSpellPack;
var daeFeatsPack;
var midiFeatsPack;
var magicItemsPack;
var dndSRDItemsPack;
var dndSRDSpellsPack;
var dndSRDclassesPack;
var dndSRDClassfeaturesPack;
var dndSRDMonsterfeaturesPack;
export async function loadPacks() {
    if (packsLoaded)
        return;
    daeItemPack = await game.packs.get("Dynamic-Effects-SRD.DAE SRD Items").getDocuments();
    midiItemPack = await game.packs.get("midi-srd.Midi SRD Items").getDocuments();
    daeSpellPack = await game.packs.get("Dynamic-Effects-SRD.DAE SRD Spells")?.getDocuments();
    midiSpellPack = await game.packs.get("midi-srd.Midi SRD Spells").getDocuments();
    daeFeatsPack = await game.packs.get("Dynamic-Effects-SRD.DAE SRD Feats").getDocuments();
    midiFeatsPack = await game.packs.get("midi-srd.Midi SRD Feats").getDocuments();
    magicItemsPack = await game.packs.get("Dynamic-Effects-SRD.DAE SRD Magic Items").getDocuments();
    dndSRDItemsPack = await game.packs.get(`${game.system.id}.items`).getDocuments();
    dndSRDSpellsPack = await game.packs.get(`${game.system.id}.spells`).getDocuments();
    dndSRDclassesPack = await game.packs.get(`${game.system.id}.classes`).getDocuments();
    dndSRDMonsterfeaturesPack = await game.packs.get(`${game.system.id}.monsterfeatures`)?.getDocuments();
    dndSRDClassfeaturesPack = await game.packs.get(`${game.system.id}.classfeatures`)?.getDocuments();
    packsLoaded = true;
}
export async function migrateAllActorsDAESRD(includeSRD = false) {
    if (!game.settings.get("dae", "disableEffects")) {
        ui.notifications.error("Please set DAE disable all effect processing");
        error("Please set DAE disable all effect processing");
        return;
    }
    if (!game.modules.get("Dynamic-Effects-SRD")?.active) {
        ui.notifications.warn("DAE SRD Module not active");
        error("DAE SRD Module not active");
        return;
    }
    for (let a of game.actors) {
        await migrateActorDAESRD(a, includeSRD);
    }
    ;
}
export async function migrateAllNPCDAESRD(includeSRD = false) {
    if (!game.settings.get("dae", "disableEffects")) {
        ui.notifications.error("Please set DAE disable all effect processing");
        error("Please set DAE disable all effect processing");
        return;
    }
    if (!game.modules.get("Dynamic-Effects-SRD")?.active) {
        ui.notifications.warn("DAE SRD Module not active");
        error("DAE SRD Module not active");
        return;
    }
    for (let a of game.actors) {
        //@ts-ignore
        if (a.data.type !== "character") {
            await migrateActorDAESRD(a, includeSRD);
        }
        ;
    }
}
export async function migrateActorDAESRD(actor, includeSRD = false) {
    if (!game.settings.get("dae", "disableEffects")) {
        ui.notifications.error("Please set DAE disable all effect processing");
        error("Please set DAE disable all effect processing");
        return;
    }
    if (!game.modules.get("Dynamic-Effects-SRD")?.active) {
        ui.notifications.warn("DAE SRD Module not active");
        error("DAE SRD Module not active");
        return;
    }
    if (!packsLoaded)
        await loadPacks();
    const items = actor.data._source.items;
    let replaceItems = [];
    let count = 0;
    items.forEach(itemData => {
        let replaceData;
        switch (itemData.type) {
            case "feat":
                let srdFeats = (actor?.data?.type === "npc") ? dndSRDMonsterfeaturesPack : dndSRDClassfeaturesPack;
                if (includeSRD)
                    replaceData = findDAEItem(itemData, [daeFeatsPack, midiFeatsPack, dndSRDclassesPack, srdFeats]);
                else
                    replaceData = findDAEItem(itemData, [midiFeatsPack, daeFeatsPack]);
                if (replaceData)
                    console.warn("migrating", actor.name, replaceData.name, replaceData);
                if (replaceData) {
                    setProperty(replaceData.data, "equipped", itemData.data.equipped);
                    setProperty(replaceData.data, "attunement", itemData.data.attunement);
                    setProperty(replaceData.data.flags, "dae.migrated", true);
                    replaceItems.push(replaceData.toObject());
                    count++;
                }
                else
                    replaceItems.push(itemData);
                break;
            case "spell":
                if (includeSRD)
                    replaceData = findDAEItem(itemData, [daeSpellPack, midiSpellPack, dndSRDSpellsPack]);
                else
                    replaceData = findDAEItem(itemData, [midiSpellPack, daeSpellPack]);
                if (replaceData)
                    console.warn("migrating ", actor.name, replaceData.name, replaceData);
                if (replaceData) {
                    setProperty(replaceData.data, "prepared", itemData.data.prepared);
                    setProperty(replaceData.data.flags, "dae.migrated", true);
                    replaceItems.push(replaceData.toObject());
                    count++;
                }
                else
                    replaceItems.push(itemData);
                break;
            case "equipment":
            case "weapon":
            case "loot":
            case "consumable":
            case "tool":
            case "backpack":
                if (includeSRD)
                    replaceData = findDAEItem(itemData, [midiItemPack, daeItemPack, magicItemsPack, dndSRDItemsPack]);
                else
                    replaceData = findDAEItem(itemData, [midiItemPack, daeItemPack, magicItemsPack]);
                if (replaceData)
                    console.warn("migrated", actor.name, replaceData.name, replaceData);
                if (replaceData) {
                    setProperty(replaceData.data, "data.equipped", itemData.data.equipped);
                    setProperty(replaceData.data, "data.attunement", itemData.data.attunement);
                    setProperty(replaceData.data.flags, "dae.migrated", true);
                    replaceItems.push(replaceData.toObject());
                    count++;
                }
                else
                    replaceItems.push(itemData);
                break;
            default:
                replaceItems.push(itemData);
                break;
        }
    });
    let removeItems = actor.items.map(i => i.id);
    await actor.deleteEmbeddedDocuments("ActiveEffect", [], { deleteAll: true });
    await actor.deleteEmbeddedDocuments("Item", [], { deleteAll: true });
    // Adding all at once seems to create a problem.
    // await actor.createEmbeddedDocuments("Item", replaceItems, { addFeatures: true, promptAddFeatures: false });
    for (let item of replaceItems) {
        await actor.createEmbeddedDocuments("Item", [item], { addFeatures: false, promptAddFeatures: false });
    }
    console.warn(actor.name, "replaced ", count, " out of ", replaceItems.length, " items from the DAE SRD");
}
function removeDynamiceffects(actor) {
    actor.update({ "flags.-=dynamiceffects": null });
}
export async function fixupDDBAC(allActors = false) {
    try {
        const itemName = "DDB AC";
        const content = await game.packs.get("dae.premadeitems").getDocuments();
        const item = content.find(i => i.name === itemName);
        let items = game.actors.filter(a => a.data.flags.ddbimporter && a.data.flags.ddbimporter.baseAC)
            .filter(a => allActors || a.type === "character")
            .filter(a => !a.items.getName(itemName))
            .forEach(a => a.createEmbeddedDocuments("Item", [item.toObject()]));
    }
    catch (err) {
        error("migration did not complete", err);
    }
}
export function checkLibWrapperVersion() {
    if (isNewerVersion("1.8.0", game.modules.get("lib-wrapper").data.version)) {
        let d = new Dialog({
            // localize this text
            title: i18n("dae.confirm"),
            content: `<h2>DAE requires libWrapper version 1.8.0 or later</p>`,
            buttons: {
                one: {
                    icon: '<i class="fas fa-cross"></i>',
                },
            },
            default: "one"
        });
        d.render(true);
    }
}
export function checkArmorDisabled() {
    if (game.system.id === "dnd5e"
        && isNewerVersion(game.system.data.version, "1.3.9")
        && game.settings.get("dae", "ArmorDisabled") < 1) {
        let d = new Dialog({
            // localize this text
            title: i18n("dae.confirm"),
            content: `<h2>You have updated to DND 1.4.x</h2><p>DND 1.4.x auto calculates AC</p><p> Auto calculation in DAE will be disabled</p>`,
            buttons: {
                one: {
                    icon: '<i class="fas fa-cross"></i>',
                    label: "Disable DAE AC",
                    callback: async () => {
                        await cleanArmorWorld();
                        await cleanDAEArmorWorld();
                        game.settings.set("dae", "ArmorDisabled", 1);
                    }
                },
            },
            default: "one"
        });
        d.render(true);
    }
}
export async function cleanDAEArmorWorld() {
    await removeAllActorArmorItems();
    await removeAllTokenArmorItems();
}
export async function removeAllActorArmorItems() {
    let promises = [];
    for (let actor of game.actors) {
        //@ts-ignore
        await removeActorArmorItems(actor);
    }
}
export async function removeAllTokenArmorItems() {
    let promises = [];
    for (let scene of game.scenes) {
        //@ts-ignore
        for (let tokenDocument of scene.tokens) {
            if (!tokenDocument.isLinked && tokenDocument.actor) {
                await removeActorArmorItems(tokenDocument.actor);
            }
        }
    }
}
export async function removeActorArmorItems(actor) {
    let promises = [];
    for (let item of actor.items) {
        let toDelete = [];
        //@ts-ignore
        if (!item.effects)
            continue;
        //@ts-ignore
        for (let effect of item.effects) {
            for (let change of effect.data.changes) {
                if (change.key === "data.attributes.ac.value" && change.value === "AutoCalc") {
                    //@ts-ignore
                    console.warn("Removing DAE Item ", actor.name, item.name, item.id);
                    //@ts-ignore
                    toDelete.push(item.id);
                }
            }
        }
        if (toDelete.length > 0) {
            //@ts-ignore
            await actor.deleteEmbeddedDocuments("Item", toDelete);
        }
    }
}
export async function cleanEffectOrigins() {
    await cleanAllActorEffectOrigins();
    await cleanAllTokenEffectOrigins();
}
export async function cleanAllActorEffectOrigins() {
    //@ts-ignore
    for (let actor of game.actors.contents) {
        //@ts-ignore
        let ownedItemEffects = actor.effects.filter(ef => ef.data.origin?.includes("OwnedItem"));
        let updates = ownedItemEffects.map(ef => { return { _id: ef.id, origin: ef.data.origin.replace("OwnedItem", "Item") }; });
        if (updates.length > 0) {
            await actor.updateEmbeddedDocuments("ActiveEffect", updates);
            console.warn("Updates are ", actor.name, updates);
        }
    }
}
export async function cleanAllTokenEffectOrigins() {
    for (let scene of game.scenes) {
        //@ts-ignore
        for (let tokenDocument of scene.tokens) {
            if (!tokenDocument.isLinked && tokenDocument.actor) {
                const actor = tokenDocument.actor;
                let ownedItemEffects = actor.effects.filter(ef => ef.data.origin?.includes("OwnedItem"));
                let updates = ownedItemEffects.map(ef => { return { _id: ef.id, origin: ef.data.origin.replace("OwnedItem", "Item") }; });
                if (updates.length > 0) {
                    await actor.updateEmbeddedDocuments("ActiveEffect", updates);
                }
            }
        }
    }
}
export async function tobMapper(iconsPath = "icons/TOB") {
    const pack = game.packs.get("tome-of-beasts.beasts");
    await pack.getContent();
    let details = pack.contents.map(a => a.data._source);
    let detailNames = duplicate(details).map(detail => {
        let name = detail.name
            .replace(/[_\-,'"]/g, "")
            .replace(" of", "")
            .replace(" the", "")
            .replace(/\(.*\)/, "")
            .replace(/\s\s*/g, " ")
            .replace("Adult", "")
            .replace("Chieftain", "Chieftan")
            .toLocaleLowerCase();
        name = name.split(" ");
        detail.splitName = name;
        return detail;
    });
    detailNames = detailNames.sort((a, b) => b.splitName.length - a.splitName.length);
    let fields = details.map(a => { return { "name": a.name, "id": a._id, "tokenimg": a.token.img }; });
    let count = 0;
    game.socket.emit("manageFiles", { action: "browseFiles", storage: "data", target: iconsPath }, {}, async (result) => {
        for (let fileEntry of result.files) {
            let fileNameParts = fileEntry.split("/");
            const name = fileNameParts[fileNameParts.length - 1]
                .replace(".png", "")
                .replace(/['",\-_,]/g, "")
                .replace(/-/g, "")
                .toLocaleLowerCase();
            detailNames.filter(dtname => {
                if (!dtname.splitName)
                    return false;
                for (let namePart of dtname.splitName) {
                    if (!name.includes(namePart))
                        return false;
                }
                dtname.token.img = fileEntry;
                // dtname.img = fileEntry;
                delete dtname.splitName;
                // dtname.img = fileEntry;
                count += 1;
                return true;
            });
        }
        console.log("Matched ", count, "out of", detailNames.length, detailNames);
        console.log("Unmatched ", detailNames.filter(dt => dt.splitName));
        for (let actorData of detailNames) {
            if (actorData.splitName)
                continue;
            let actor = pack.get(actorData._id);
            await actor.update(actorData);
        }
    });
}
export async function fixTransferEffects(actor) {
    let items = actor.items.filter(i => i.effects.some(e => e.data.transfer));
    let transferEffects = actor.effects.filter(e => (!e.isTmporary || e.data.flags.dae?.transfer) && e.data.origin.includes("Item."));
    console.error("Deleing effects", transferEffects);
    await actor.deleteEmbeddedDocuments("ActiveEffect", transferEffects.map(e => e.id));
    const toCreate = items.map(i => i.toObject());
    console.error("Deleting items ", items.map(i => i.id));
    await actor.deleteEmbeddedDocuments("Item", items.map(i => i.id));
    console.error("Creating items ", toCreate);
    await actor.createEmbeddedDocuments("Item", toCreate);
}
export async function fixDeprecatedChangesActor(actor) {
    let changesMade = false;
    if (actor.effects.size > 0) {
        let effectsData = actor.data.effects.toObject();
        for (let effectData of effectsData) {
            for (let change of effectData.changes) {
                const hasSaveBonus = change.key.startsWith("data.abilities.") && change.key.endsWith(".save") && !change.key.endsWith(".bonuses.save");
                if (hasSaveBonus) {
                    console.log("actor ", actor.name, change.key);
                    change.key = change.key.replace(".save", ".bonuses.save");
                    if (!change.value.startsWith("+"))
                        change.value = "+" + change.value;
                    changesMade = true;
                }
                const hasCheckBonus = change.key.startsWith("data.abilities.") && change.key.endsWith(".mod");
                if (hasCheckBonus) {
                    console.log("actor ", actor.name, change.key);
                    change.key = change.key.replace(".mod", ".bonuses.check");
                    if (!change.value.startsWith("+"))
                        change.value = "+" + change.value;
                    changesMade = true;
                }
                const hasSkillMod = change.key.startsWith("data.skills") && change.key.endsWith(".mod");
                if (hasSkillMod) {
                    console.log("actor ", actor.name, change.key);
                    if (!change.value.startsWith("+"))
                        change.value = "+" + change.value;
                    change.key = change.key.replace(".mod", ".bonuses.check");
                    changesMade = true;
                }
                const hasSkillPassive = change.key.startsWith("data.skills.") && change.key.endsWith(".passive") && !change.key.endsWith("bonuses.passive");
                if (hasSkillPassive) {
                    console.log("actor ", actor.name, change.key);
                    change.key = change.key.replace(".passive", ".bonuses.passive");
                    if (!change.value.startsWith("+"))
                        change.value = "+" + change.value;
                    changesMade = true;
                }
                if (change.key === "data.attributes.ac.value") {
                    // change.key = "data.attributes.ac.value";
                }
            }
        }
        if (changesMade) {
            await actor.updateEmbeddedDocuments("ActiveEffect", effectsData);
        }
        //@ts-ignore
        for (let item of actor.items) {
            await fixDeprecatedChangesItem(item);
        }
    }
}
export async function fixDeprecatedChanges() {
    for (let actor of game.actors) {
        await fixDeprecatedChangesActor(actor);
    }
    for (let item of game.items) {
        await fixDeprecatedChangesItem(item);
    }
    for (let scene of game.scenes) {
        //@ts-ignore
        for (let tokenDocument of scene.tokens) {
            if (!tokenDocument.isLinked && tokenDocument.actor) {
                const actor = tokenDocument.actor;
                await fixDeprecatedChangesActor(actor);
            }
        }
    }
}
export async function fixDeprecatedChangesItem(item) {
    if (item.effects.size > 0) {
        let effectsData = item.data.effects.toObject();
        const actorstring = item.parent instanceof Actor ? `actor: ${item.parent.name}` : "";
        let changesMade = false;
        for (let effectData of effectsData) {
            for (let change of effectData.changes) {
                const hasSaveBonus = change.key.startsWith("data.abilities.") && change.key.endsWith(".save") && !change.key.endsWith(".bonuses.save");
                if (hasSaveBonus) {
                    console.log(`${actorstring} item `, item.name, change.key);
                    change.key = change.key.replace(".save", ".bonuses.save");
                    if (!change.value.startsWith("+"))
                        change.value = "+" + change.value;
                    changesMade = true;
                }
                const hasCheckBonus = change.key.startsWith("data.abilities.") && change.key.endsWith(".mod");
                if (hasCheckBonus) {
                    console.log(`${actorstring} item `, item.name, change.key);
                    change.key = change.key.replace(".mod", ".bonuses.check");
                    if (!change.value.startsWith("+"))
                        change.value = "+" + change.value;
                    changesMade = true;
                }
                const hasSkillMod = change.key.startsWith("data.skills") && change.key.endsWith(".mod");
                if (hasSkillMod) {
                    console.log(`${actorstring} item `, item.name, change.key);
                    change.key = change.key.replace(".mod", ".bonuses.check");
                    if (!change.value.startsWith("+"))
                        change.value = "+" + change.value;
                    changesMade = true;
                }
                const hasSkillPassive = change.key.startsWith("data.skills.") && change.key.endsWith(".passive") && !change.key.endsWith("bonuses.passive");
                if (hasSkillPassive) {
                    console.log(`${actorstring} item `, item.name, change.key);
                    change.key = change.key.replace(".passive", ".bonuses.passive");
                    if (!change.value.startsWith("+"))
                        change.value = "+" + change.value;
                    changesMade = true;
                }
                if (change.key === "data.attributes.ac.value") {
                    // change.key = "data.attributes.ac.bonus";
                }
            }
        }
        if (changesMade) {
            if (item.parent instanceof Actor) {
                let itemData = item.data.toObject();
                itemData.effects = effectsData;
                await item.parent.updateEmbeddedDocuments("Item", [itemData]);
            }
            else
                await item.updateEmbeddedDocuments("ActiveEffect", effectsData);
        }
    }
}
