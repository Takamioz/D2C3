import { SWADE } from "./config.js";
import SwadeItem from "./documents/item/SwadeItem.js";
import { getTrait, notificationExists } from "./util.js";
/**
 * A helper class for Item chat card logic
 */
export default class ItemChatCardHelper {
    static async onChatCardAction(event) {
        event.preventDefault();
        // Extract card data
        const button = event.currentTarget;
        button.disabled = true;
        const card = button.closest('.chat-card');
        const messageId = card.closest('.message').dataset.messageId;
        const message = game.messages?.get(messageId);
        const action = button.dataset.action;
        const additionalMods = new Array();
        //save the message ID if we're doing automated ammo management
        if (game.settings.get('swade', 'ammoManagement')) {
            SWADE['itemCardMessageId'] = messageId;
        }
        // Validate permission to proceed with the roll
        if (!(game.user.isGM || message.isAuthor))
            return null;
        // Get the Actor from a synthetic Token
        const actor = this.getChatCardActor(card);
        if (!actor)
            return null;
        // Get the Item
        const item = actor.items.get(card.dataset.itemId);
        if (!item) {
            ui.notifications?.error(`The requested item ${card.dataset.itemId} does not exist on Actor ${actor.name}`);
            return null;
        }
        //if it's a power and the No Power Points rule is in effect
        if (item.data.type === 'power' &&
            game.settings.get('swade', 'noPowerPoints')) {
            const ppCost = $(card).find('input.pp-adjust').val();
            let modifier = Math.ceil(ppCost / 2);
            modifier = Math.min(modifier * -1, modifier);
            const actionObj = getProperty(item.data, `data.actions.additional.${action}`);
            if (action === 'formula' || (actionObj && actionObj.type === 'skill')) {
                additionalMods.push({
                    label: game.i18n.localize('ITEM.TypePower'),
                    value: modifier,
                });
            }
        }
        const roll = await this.handleAction(item, actor, action, additionalMods);
        //Only refresh the card if there is a roll and the item isn't a power
        if (roll && item.type !== 'power')
            await this.refreshItemCard(actor);
        // Re-enable the button
        button.disabled = false;
        return roll;
    }
    static getChatCardActor(card) {
        // Case 1 - a synthetic actor from a Token
        const tokenKey = card.dataset.tokenId;
        if (tokenKey) {
            const [sceneId, tokenId] = tokenKey.split('.');
            const scene = game.scenes?.get(sceneId);
            if (!scene)
                return null;
            const token = scene.tokens.get(tokenId);
            if (!token)
                return null;
            return token.actor;
        }
        // Case 2 - use Actor ID directory
        const actorId = card.dataset.actorId;
        return game.actors?.get(actorId) ?? null;
    }
    /**
     * Handles the basic skill/damage/reload AND the additional actions
     * @param item
     * @param actor
     * @param action
     */
    static async handleAction(item, actor, action, additionalMods = []) {
        const traitName = getProperty(item.data, 'data.actions.skill');
        let roll = null;
        const ammo = actor.items.getName(getProperty(item.data, 'data.ammo'));
        const usesAmmoManagement = game.settings.get('swade', 'ammoManagement') && !item.isMeleeWeapon;
        const drawsAmmoFromInv = getProperty(item.data, 'data.autoReload');
        const ammoAvailable = ammo && getProperty(ammo, 'data.data.quantity') > 0;
        const enoughShots = getProperty(item.data, 'data.currentShots') > 1;
        const canReload = this.isReloadPossible(actor) && usesAmmoManagement;
        const cannotShoot = (canReload && drawsAmmoFromInv && !ammoAvailable) ||
            (canReload && !enoughShots);
        switch (action) {
            case 'damage':
                if (getProperty(item.data, 'data.actions.dmgMod')) {
                    additionalMods.push({
                        label: game.i18n.localize('SWADE.ItemDmgMod'),
                        value: getProperty(item.data, 'data.actions.dmgMod'),
                    });
                }
                roll = await item.rollDamage({ additionalMods });
                Hooks.call('swadeAction', actor, item, action, roll, game.user.id);
                break;
            case 'formula':
                //check if we have anough ammo available
                if (item.data.type !== 'power' && cannotShoot) {
                    ui.notifications?.warn('SWADE.NotEnoughAmmo', { localize: true });
                    return null;
                }
                if (getProperty(item.data, 'data.actions.skillMod')) {
                    additionalMods.push({
                        label: game.i18n.localize('SWADE.ItemTraitMod'),
                        value: getProperty(item.data, 'data.actions.skillMod'),
                    });
                }
                roll = await this.doTraitAction(getTrait(traitName, actor), actor, {
                    additionalMods,
                });
                if (roll)
                    await this.subtractShots(actor, item.id);
                Hooks.call('swadeAction', actor, item, action, roll, game.user.id);
                break;
            case 'arcane-device':
                roll = await actor.makeArcaneDeviceSkillRoll({}, getProperty(item.data, 'data.arcaneSkillDie'));
                break;
            case 'reload':
                if (getProperty(item.data, 'data.currentShots') >=
                    getProperty(item.data, 'data.shots')) {
                    //check to see we're not posting the message twice
                    if (!notificationExists('SWADE.ReloadUnneeded', true)) {
                        ui.notifications?.info('SWADE.ReloadUnneeded', { localize: true });
                    }
                    break;
                }
                await this.reloadWeapon(actor, item);
                await this.refreshItemCard(actor);
                break;
            default:
                roll = await this.handleAdditionalActions(item, actor, action, additionalMods);
                // No need to call the hook here, as handleAdditionalActions already calls the hook
                // This is so an external API can directly use handleAdditionalActions to use an action and still fire the hook
                break;
        }
        return roll;
    }
    /**
     * Handles misc actions
     * @param item The item that this action is used on
     * @param actor The actor who has the item
     * @param action The action key
     * @returns the evaluated roll
     */
    static async handleAdditionalActions(item, actor, action, additionalMods = []) {
        const availableActions = getProperty(item.data, 'data.actions.additional');
        const ammoManagement = game.settings.get('swade', 'ammoManagement') && !item.isMeleeWeapon;
        const actionToUse = availableActions[action];
        // if there isn't actually any action then return early
        if (!actionToUse) {
            return null;
        }
        let roll = null;
        if (actionToUse.type === 'skill') {
            //set the trait name and potentially override it via the action
            let traitName = getProperty(item.data, 'data.actions.skill');
            if (actionToUse.skillOverride)
                traitName = actionToUse.skillOverride;
            //find the trait and either get the skill item or the key of the attribute
            const trait = getTrait(traitName, actor);
            if (actionToUse.skillMod && parseInt(actionToUse.skillMod) !== 0) {
                additionalMods.push({
                    label: actionToUse.name ?? game.i18n.localize('SWADE.ActionTraitMod'),
                    value: actionToUse.skillMod,
                });
            }
            const currentShots = getProperty(item.data, 'data.currentShots');
            //do autoreload stuff if applicable
            const hasAutoReload = getProperty(item.data, 'data.autoReload');
            const ammo = actor.items.getName(getProperty(item.data, 'data.ammo'));
            const canAutoReload = !!ammo && getProperty(ammo.data, 'data.quantity') <= 0;
            if (ammoManagement &&
                ((hasAutoReload && !canAutoReload) ||
                    (!!actionToUse.shotsUsed && currentShots < actionToUse.shotsUsed))) {
                ui.notifications?.warn('SWADE.NotEnoughAmmo', { localize: true });
                return null;
            }
            if (getProperty(item.data, 'data.actions.skillMod') !== '') {
                additionalMods.push({
                    label: game.i18n.localize('SWADE.ItemTraitMod'),
                    value: getProperty(item.data, 'data.actions.skillMod'),
                });
            }
            roll = await this.doTraitAction(trait, actor, {
                flavour: actionToUse.name,
                rof: actionToUse.rof,
                additionalMods,
            });
            if (roll) {
                await this.subtractShots(actor, item.id, actionToUse.shotsUsed || 0);
            }
        }
        else if (actionToUse.type === 'damage') {
            //Do Damage stuff
            if (getProperty(item.data, 'data.actions.dmgMod') !== '') {
                additionalMods.push({
                    label: game.i18n.localize('SWADE.ItemDmgMod'),
                    value: getProperty(item.data, 'data.actions.dmgMod'),
                });
            }
            if (actionToUse.dmgMod) {
                additionalMods.push({
                    label: actionToUse.name,
                    value: actionToUse.dmgMod,
                });
            }
            roll = await item.rollDamage({
                dmgOverride: actionToUse.dmgOverride,
                flavour: actionToUse.name,
                additionalMods,
            });
        }
        Hooks.call('swadeAction', actor, item, action, roll, game.user.id);
        return roll;
    }
    static doTraitAction(trait, actor, options) {
        const rollSkill = trait instanceof SwadeItem || !trait;
        const rollAttribute = typeof trait === 'string';
        if (rollSkill) {
            //get the id from the item or null if there was no trait
            const id = trait instanceof SwadeItem ? trait.id : null;
            return actor.rollSkill(id, options);
        }
        else if (rollAttribute) {
            return actor.rollAttribute(trait, options);
        }
        else {
            return null;
        }
    }
    static async subtractShots(actor, itemId, shotsUsed = 1) {
        const item = actor.items.get(itemId);
        const currentShots = parseInt(getProperty(item.data, 'data.currentShots'));
        const hasAutoReload = getProperty(item.data, 'data.autoReload');
        const ammoManagement = game.settings.get('swade', 'ammoManagement');
        const isReloadPossible = this.isReloadPossible(actor);
        //handle Auto Reload
        if (hasAutoReload) {
            if (!isReloadPossible)
                return;
            const ammo = actor.items.getName(getProperty(item.data, 'data.ammo'));
            if (!ammo && !isReloadPossible)
                return;
            const current = getProperty(ammo.data, 'data.quantity');
            const newQuantity = current - shotsUsed;
            await ammo.update({ 'data.quantity': newQuantity });
            //handle normal shot consumption
        }
        else if (ammoManagement && !!shotsUsed && currentShots - shotsUsed >= 0) {
            await item.update({ 'data.currentShots': currentShots - shotsUsed });
        }
    }
    static async reloadWeapon(actor, weapon) {
        if (weapon.data.type !== 'weapon')
            return;
        const ammoName = weapon.data.data.ammo;
        //return if there's no ammo set
        if (!ammoName) {
            if (!notificationExists('SWADE.NoAmmoSet', true)) {
                ui.notifications?.info('SWADE.NoAmmoSet', { localize: true });
            }
            return;
        }
        const isReloadPossible = this.isReloadPossible(actor);
        const ammo = actor.items.getName(ammoName);
        const shots = weapon.data.data.shots;
        let ammoInMagazine = shots;
        const missingAmmo = shots - weapon.data.data.currentShots;
        if (isReloadPossible) {
            if (!ammo) {
                if (!notificationExists('SWADE.NotEnoughAmmoToReload', true)) {
                    ui.notifications?.warn('SWADE.NotEnoughAmmoToReload', {
                        localize: true,
                    });
                }
                return;
            }
            const ammoInInventory = getProperty(ammo.data, 'data.quantity');
            let leftoverAmmoInInventory = ammoInInventory - missingAmmo;
            if (ammoInInventory < missingAmmo) {
                ammoInMagazine = weapon.data.data.currentShots + ammoInInventory;
                leftoverAmmoInInventory = 0;
                if (!notificationExists('SWADE.NotEnoughAmmoToReload', true)) {
                    ui.notifications?.warn('SWADE.NotEnoughAmmoToReload', {
                        localize: true,
                    });
                }
            }
            //update the ammo item
            await ammo.update({
                'data.quantity': leftoverAmmoInInventory,
            });
        }
        //update the weapon
        await weapon.update({ 'data.currentShots': ammoInMagazine });
        //check to see we're not posting the message twice
        if (!notificationExists('SWADE.ReloadSuccess', true)) {
            ui.notifications?.info('SWADE.ReloadSuccess', { localize: true });
        }
    }
    static async refreshItemCard(actor, messageId) {
        //get ChatMessage and remove temporarily stored id from CONFIG object
        let message;
        if (messageId) {
            message = game.messages?.get(messageId);
        }
        else {
            message = game.messages?.get(SWADE['itemCardMessageId']);
            delete SWADE['itemCardMessageId'];
        }
        if (!message) {
            return;
        } //solves for the case where ammo management isn't turned on so there's no errors
        const messageContent = new DOMParser().parseFromString(getProperty(message, 'data.content'), 'text/html');
        const messageData = $(messageContent)
            .find('.chat-card.item-card')
            .first()
            .data();
        const item = actor.items.get(messageData.itemId);
        if (item.type === 'weapon') {
            const currentShots = getProperty(item.data, 'data.currentShots');
            const maxShots = getProperty(item.data, 'data.shots');
            //update message content
            $(messageContent)
                .find('.ammo-counter .current-shots')
                .first()
                .text(currentShots);
            $(messageContent).find('.ammo-counter .max-shots').first().text(maxShots);
        }
        if (item.type === 'power') {
            const arcane = getProperty(item.data, 'data.arcane');
            let currentPP = getProperty(actor.data, 'data.powerPoints.value');
            let maxPP = getProperty(actor.data, 'data.powerPoints.max');
            if (arcane) {
                currentPP = getProperty(actor.data, `data.powerPoints.${arcane}.value`);
                maxPP = getProperty(actor.data, `data.powerPoints.${arcane}.max`);
            }
            //update message content
            $(messageContent).find('.pp-counter .current-pp').first().text(currentPP);
            $(messageContent).find('.pp-counter .max-pp').first().text(maxPP);
        }
        const isArcaneDevice = getProperty(item.data, 'data.isArcaneDevice');
        if (isArcaneDevice) {
            const currentPP = getProperty(item.data, 'data.powerPoints.value');
            const maxPP = getProperty(item.data, 'data.powerPoints.max');
            //update message content
            $(messageContent).find('.pp-counter .current-pp').first().text(currentPP);
            $(messageContent).find('.pp-counter .max-pp').first().text(maxPP);
        }
        //update the message and render the chatlog/chat popout
        await message.update({ content: messageContent.body.innerHTML });
        ui.chat?.render(true);
        for (const appId in message.apps) {
            const app = message.apps[appId];
            if (app.rendered) {
                app.render(true);
            }
        }
    }
    static isReloadPossible(actor) {
        const isPC = actor.data.type === 'character';
        const isNPC = actor.data.type === 'npc';
        const isVehicle = actor.data.type === 'vehicle';
        const npcAmmoFromInventory = game.settings.get('swade', 'npcAmmo');
        const vehicleAmmoFromInventory = game.settings.get('swade', 'vehicleAmmo');
        const useAmmoFromInventory = game.settings.get('swade', 'ammoFromInventory');
        return ((isVehicle && vehicleAmmoFromInventory) ||
            (isNPC && npcAmmoFromInventory) ||
            (isPC && useAmmoFromInventory));
    }
}
