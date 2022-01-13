/**
 * This is the TypeScript entry file for Foundry VTT.
 * Author: FloRad
 * Content License: All Rights Reserved Pinnacle Entertainment, Inc
 * Software License: Apache License, Version 2.0
 */
import RollDialog from "./module/apps/RollDialog.js";
import SwadeEntityTweaks from "./module/apps/SwadeEntityTweaks.js";
import CharacterSummarizer from "./module/CharacterSummarizer.js";
import { SWADE } from "./module/config.js";
import SwadeActor from "./module/documents/actor/SwadeActor.js";
import Benny from "./module/documents/Benny.js";
import SwadeItem from "./module/documents/item/SwadeItem.js";
import SwadeActiveEffect from "./module/documents/SwadeActiveEffect.js";
import SwadeCombat from "./module/documents/SwadeCombat.js";
import SwadeCombatant from "./module/documents/SwadeCombatant.js";
import SwadeMeasuredTemplate from "./module/documents/SwadeMeasuredTemplate.js";
import SwadeUser from "./module/documents/SwadeUser.js";
import { registerCustomHelpers } from "./module/handlebarsHelpers.js";
import ItemChatCardHelper from "./module/ItemChatCardHelper.js";
import { listenJournalDrop } from "./module/journalDrop.js";
import * as migrations from "./module/migration.js";
import { preloadHandlebarsTemplates } from "./module/preloadTemplates.js";
import { registerSettingRules, registerSettings } from "./module/settings.js";
import CharacterSheet from "./module/sheets/official/CharacterSheet.js";
import SwadeItemSheet from "./module/sheets/SwadeItemSheet.js";
import SwadeNPCSheet from "./module/sheets/SwadeNPCSheet.js";
import SwadeVehicleSheet from "./module/sheets/SwadeVehicleSheet.js";
import SwadeCombatTracker from "./module/sidebar/SwadeCombatTracker.js";
import SwadeHooks from "./module/SwadeHooks.js";
import SwadeSocketHandler from "./module/SwadeSocketHandler.js";
import { createSwadeMacro, rollItemMacro } from "./module/util.js";
/* ------------------------------------ */
/* Initialize system					          */
/* ------------------------------------ */
Hooks.once('init', () => {
    console.log(`SWADE | Initializing Savage Worlds Adventure Edition\n${SWADE.ASCII}`);
    // Record Configuration Values
    //CONFIG.debug.hooks = true;
    CONFIG.SWADE = SWADE;
    game.swade = {
        SwadeEntityTweaks,
        rollItemMacro,
        sockets: new SwadeSocketHandler(),
        itemChatCardHelper: ItemChatCardHelper,
        migrations: migrations,
        CharacterSummarizer,
        RollDialog,
    };
    //register custom Handlebars helpers
    registerCustomHelpers();
    //register document classes
    CONFIG.Actor.documentClass = SwadeActor;
    CONFIG.Item.documentClass = SwadeItem;
    CONFIG.Combat.documentClass = SwadeCombat;
    CONFIG.Combatant.documentClass = SwadeCombatant;
    CONFIG.ActiveEffect.documentClass = SwadeActiveEffect;
    CONFIG.User.documentClass = SwadeUser;
    //register custom object classes
    CONFIG.MeasuredTemplate.objectClass = SwadeMeasuredTemplate;
    //register custom sidebar tabs
    CONFIG.ui.combat = SwadeCombatTracker;
    //register custom status effects
    CONFIG.statusEffects = SWADE.statusEffects;
    //@ts-expect-error Not yet implemented in Types
    CompendiumCollection.INDEX_FIELDS.JournalEntry.push('data.flags.swade');
    //Preload Handlebars templates
    preloadHandlebarsTemplates();
    // Register custom system settings
    registerSettings();
    registerSettingRules();
    // Register sheets
    Actors.unregisterSheet('core', ActorSheet);
    Items.unregisterSheet('core', ItemSheet);
    Actors.registerSheet('swade', CharacterSheet, {
        types: ['character'],
        makeDefault: true,
        label: 'SWADE.OfficialSheet',
    });
    Actors.registerSheet('swade', SwadeNPCSheet, {
        types: ['npc'],
        makeDefault: true,
        label: 'SWADE.CommunityNPCSheet',
    });
    Actors.registerSheet('swade', SwadeVehicleSheet, {
        types: ['vehicle'],
        makeDefault: true,
        label: 'SWADE.CommunityVicSheet',
    });
    Items.registerSheet('swade', SwadeItemSheet, {
        makeDefault: true,
        label: 'SWADE.CommunityItemSheet',
    });
    CONFIG.Dice.terms['b'] = Benny;
    // Drop a journal image to a tile (for cards)
    listenJournalDrop();
});
Hooks.once('ready', async () => SwadeHooks.onReady());
/** This hook only really exists to stop Races from being added to the actor as an item */
Hooks.on('preCreateItem', 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
(item, options, userId) => {
    if (item.parent && item.data.type === 'ability') {
        const subType = item.data.data.subtype;
        if (subType === 'race' || subType === 'archetype')
            return false; //return early if we're doing race stuff
    }
});
Hooks.on('renderActorDirectory', (app, html, options) => SwadeHooks.onRenderActorDirectory(app, html, options));
Hooks.on('getActorDirectoryEntryContext', (html, options) => {
    SwadeHooks.onGetActorDirectoryEntryContext(html, options);
});
Hooks.on('getActorEntryContext', (html, options) => {
    SwadeHooks.onGetCombatTrackerEntryContext(html, options);
});
Hooks.on('renderCompendium', (app, html, data) => SwadeHooks.onRenderCompendium(app, html, data));
Hooks.on('renderCombatTracker', (app, html, data) => SwadeHooks.onRenderCombatTracker(app, html, data));
// Add roll data to the message for formatting of dice pools
Hooks.on('renderChatMessage', (message, html, data) => SwadeHooks.onRenderChatMessage(message, html, data));
Hooks.on('getChatLogEntryContext', (html, options) => SwadeHooks.onGetChatLogEntryContext(html, options));
Hooks.on('renderChatLog', (app, html, data) => SwadeHooks.onRenderChatLog(app, html, data));
// Add benny management to the player list
Hooks.on('renderPlayerList', async (list, html, options) => SwadeHooks.onRenderPlayerList(list, html, options));
Hooks.on('getUserContextOptions', (html, context) => SwadeHooks.onGetUserContextOptions(html, context));
Hooks.on('getSceneControlButtons', (sceneControlButtons) => SwadeHooks.onGetSceneControlButtons(sceneControlButtons));
Hooks.on('renderChatPopout', (app, html, data) => SwadeHooks.onRenderChatLog(app, html, data));
Hooks.on('dropActorSheetData', (actor, sheet, data) => SwadeHooks.onDropActorSheetData(actor, sheet, data));
Hooks.on('renderCombatantConfig', (app, html, options) => SwadeHooks.onRenderCombatantConfig(app, html, options));
Hooks.once('diceSoNiceInit', (dice3d) => {
    SwadeHooks.onDiceSoNiceInit(dice3d);
});
Hooks.once('diceSoNiceReady', (dice3d) => {
    SwadeHooks.onDiceSoNiceReady(dice3d);
});
Hooks.on('hotbarDrop', (bar, data, slot) => createSwadeMacro(data, slot));
Hooks.on('getCombatTrackerEntryContext', (html, options) => {
    SwadeHooks.onGetCombatTrackerEntryContext(html, options);
});
Hooks.on('getCompendiumDirectoryEntryContext', (html, options) => {
    SwadeHooks.onGetCompendiumDirectoryEntryContext(html, options);
});
