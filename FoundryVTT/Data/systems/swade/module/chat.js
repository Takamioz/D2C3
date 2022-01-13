import { SWADE } from "./config.js";
import ItemChatCardHelper from "./ItemChatCardHelper.js";
export async function formatRoll(chatMessage, html, data) {
    const colorMessage = chatMessage.getFlag('swade', 'colorMessage');
    // Little helper function
    const pushDice = (data, total, faces, red) => {
        let color = 'black';
        if (total > faces) {
            color = 'green';
        }
        if (red) {
            color = 'red';
        }
        let img = '';
        if ([4, 6, 8, 10, 12, 20].indexOf(faces) > -1) {
            img = `icons/svg/d${faces}-grey.svg`;
        }
        data.dice.push({
            img: img,
            result: total,
            color: color,
            dice: true,
        });
    };
    //helper function that determines if a roll contained at least one result of 1
    const rollIsRed = (roll) => {
        const retVal = roll.terms.some((d) => {
            if (d['class'] !== 'Die')
                return false;
            return d.results[0]['result'] === 1;
        });
        return retVal;
    };
    //helper function that determines if a roll contained at least one result of 1
    const dieIsRed = (die) => {
        if (!(die instanceof Die))
            return false;
        return die.results[0]['result'] === 1;
    };
    const roll = Roll.fromJSON(data.message.roll);
    const chatData = { dice: [], modifiers: [], result: 0 };
    for (const term of roll.terms) {
        if (term instanceof PoolTerm) {
            // Compute dice from the pool
            term.rolls.forEach((roll) => {
                const faces = roll.terms[0]['faces'];
                pushDice(chatData, roll.total, faces, colorMessage && rollIsRed(roll));
            });
        }
        else if (term instanceof Die) {
            // Grab the right dice
            const faces = term.faces;
            let totalDice = 0;
            term.results.forEach((result) => {
                totalDice += result.result;
            });
            pushDice(chatData, totalDice, faces, colorMessage && dieIsRed(term));
        }
        else {
            chatData.dice.push({
                img: null,
                result: term.expression,
                color: 'black',
                dice: false,
            });
        }
    }
    // Replace default dice-formula with custom html;
    const formulaTemplate = 'systems/swade/templates/chat/roll-formula.hbs';
    html
        .find('.dice-formula')
        .replaceWith(await renderTemplate(formulaTemplate, chatData));
    const results = { dice: [], total: 0 };
    const modifiers = [];
    let conviction = 0;
    for (const term of roll.terms) {
        if (term instanceof PoolTerm) {
            // Compute dice from the pool
            term.rolls.forEach((roll, i) => {
                const faces = roll.terms[0]['faces'];
                if (!term.results[i].discarded) {
                    const color = colorMessage && rollIsRed(roll);
                    pushDice(results, roll.total, faces, color);
                }
            });
        }
        else if (term instanceof Die) {
            if (term.flavor === game.i18n.localize('SWADE.Conv')) {
                conviction = term.total;
            }
            else {
                modifiers.push(term.total);
            }
        }
        else if (term instanceof Roll) {
            results.total += term.total;
        }
        else {
            modifiers.push(term.expression);
        }
    }
    //add conviction modifier
    let mod = 0;
    const modString = `0+${modifiers.join('')}`
        .replace(/\s*/g, '') //cut out the whitespace
        .replace(/\+{2,}/g, '+') //replace double plusses with single plus
        .replace(/[+-]*$/, '') //remove any plus or minus at the end of the string
        .replace('+-', '-'); //turn all +- into just minuses
    try {
        if (modString.length > 2) {
            mod = eval(modString);
        }
    }
    catch (err) {
        console.error(err);
    }
    finally {
        if (results.dice.length > 0) {
            results.dice.forEach((v) => {
                v.result += conviction;
                v.result += mod;
            });
        }
        else {
            results.total += mod + conviction;
        }
    }
    const resultTemplate = 'systems/swade/templates/chat/roll-result.hbs';
    html
        .find('.dice-total')
        .replaceWith(await renderTemplate(resultTemplate, results));
}
export function chatListeners(html) {
    html.on('click', '.card-header .item-name', (event) => {
        const target = $(event.currentTarget).parents('.item-card');
        const actor = game.actors.get(target.data('actorId'));
        if (actor &&
            (game.user.isGM || actor.testUserPermission(game.user, 'OBSERVER'))) {
            const desc = target.find('.card-content');
            desc.slideToggle();
        }
    });
    html.on('click', '.card-buttons button', async (event) => {
        const element = event.currentTarget;
        const actorId = $(element)
            .parents('[data-actor-id]')
            .attr('data-actor-id');
        const itemId = $(element)
            .parents('[data-item-id]')
            .attr('data-item-id');
        const actor = game.actors.get(actorId);
        const action = element.getAttribute('data-action');
        const messageId = $(element)
            .parents('[data-message-id]')
            .attr('data-message-id');
        // Bind item cards
        ItemChatCardHelper.onChatCardAction(event);
        //handle Power Item Card PP adjustment
        if (action === 'pp-adjust') {
            const ppToAdjust = $(element)
                .closest('.flexcol')
                .find('input.pp-adjust')
                .val();
            const adjustment = element.getAttribute('data-adjust');
            const power = actor.items.get(itemId);
            let key = 'data.powerPoints.value';
            const arcane = getProperty(power.data, 'data.arcane');
            if (arcane)
                key = `data.powerPoints.${arcane}.value`;
            const oldPP = getProperty(actor.data, key);
            if (adjustment === 'plus') {
                await actor.update({ [key]: oldPP + parseInt(ppToAdjust, 10) });
            }
            else if (adjustment === 'minus') {
                await actor.update({ [key]: oldPP - parseInt(ppToAdjust, 10) });
            }
            await ItemChatCardHelper.refreshItemCard(actor, messageId);
        }
        //handle Arcane Device Item Card PP adjustment
        if (action === 'arcane-device-pp-adjust') {
            const adPPToAdjust = $(element)
                .parents('.chat-card.item-card')
                .find('input.arcane-device-pp-adjust')
                .val();
            const adjustment = element.getAttribute('data-adjust');
            const item = actor.items.get(itemId);
            const key = 'data.powerPoints.value';
            const oldPP = getProperty(item.data, key);
            if (adjustment === 'plus') {
                await item.update({ [key]: oldPP + parseInt(adPPToAdjust, 10) });
            }
            else if (adjustment === 'minus') {
                await item.update({ [key]: oldPP - parseInt(adPPToAdjust, 10) });
            }
            await ItemChatCardHelper.refreshItemCard(actor, messageId);
        }
    });
}
/**
 * Hide the display of chat card action buttons which cannot be performed by the user
 */
export function hideChatActionButtons(message, html, data) {
    const chatCard = html.find('.swade.chat-card');
    if (chatCard.length > 0) {
        // If the user is the message author or the actor owner, proceed
        const actor = game.actors.get(data.message.speaker.actor);
        if (actor && actor.isOwner)
            return;
        else if (game.user.isGM || data.author.id === game.user.id)
            return;
        // Otherwise conceal action buttons except for saving throw
        const buttons = chatCard.find('button[data-action]');
        buttons.each((i, btn) => {
            if (btn.dataset.action === 'save')
                return;
            btn.style.display = 'none';
        });
    }
}
/**
 * Creates an end message for Conviction
 * @param actor The Actor whose conviction is ending
 */
export async function createConvictionEndMessage(actor) {
    await ChatMessage.create({
        speaker: {
            actor: actor.id,
            alias: actor.name,
            token: actor.token?.id,
        },
        content: game.i18n.localize('SWADE.ConvictionEnd'),
    });
}
/**
 * Creates a chat message for GM Bennies
 */
export async function createGmBennyAddMessage(user = game.user, given) {
    let message = await renderTemplate(SWADE.bennies.templates.gmadd, {
        target: user,
        speaker: user,
    });
    if (given) {
        message = await renderTemplate(SWADE.bennies.templates.add, {
            target: user,
            speaker: user,
        });
    }
    const chatData = {
        content: message,
    };
    ChatMessage.create(chatData);
}
export async function rerollFromChat(li, spendBenny) {
    const message = game.messages?.get(li.data('messageId'));
    const flavor = new DOMParser().parseFromString(getProperty(message, 'data.flavor'), 'text/html');
    const speaker = getProperty(message, 'data.speaker');
    const roll = message.roll;
    const actor = ChatMessage.getSpeakerActor(speaker);
    const currentBennies = getProperty(actor.data, 'data.bennies.value');
    const doSpendBenny = spendBenny && !!actor && actor.isWildcard;
    if (doSpendBenny && currentBennies <= 0) {
        ui.notifications?.warn(game.i18n.localize('SWADE.NoBennies'));
        return;
    }
    const prefix = doSpendBenny
        ? game.i18n.localize('SWADE.RerollWithBenny')
        : game.i18n.localize('SWADE.FreeReroll');
    const prefixes = flavor.getElementsByClassName('prefix');
    if (prefixes.length > 0) {
        Array.from(prefixes).forEach((el) => {
            el.innerText = prefix;
        });
    }
    else {
        flavor.body.innerHTML = `<strong class="prefix">${prefix}</strong><br>${flavor.body.innerHTML}`;
    }
    const newRollData = {
        speaker: speaker,
        flavor: flavor.body.innerHTML,
    };
    if (doSpendBenny) {
        await actor.spendBenny();
    }
    roll.reroll({ async: false }).toMessage(newRollData);
}
