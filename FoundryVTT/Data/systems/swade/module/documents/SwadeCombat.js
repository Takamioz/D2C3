import { SWADE } from "../config.js";
export default class SwadeCombat extends Combat {
    /**
     * @override
     * Roll initiative for one or multiple Combatants within the Combat entity
     * @param ids A Combatant id or Array of ids for which to roll
     * @param formula A non-default initiative formula to roll. Otherwise the system default is used.
     * @param messageOptions  Additional options with which to customize created Chat Messages
     * @returns A promise which resolves to the updated Combat entity once updates are complete.
     */
    async rollInitiative(ids, options) {
        // Structure input data
        ids = typeof ids === 'string' ? [ids] : ids;
        const combatantUpdates = [];
        const initMessages = [];
        let isRedraw = false;
        let skipMessage = false;
        const actionCardDeck = game.tables.getName(SWADE.init.cardTable, {
            strict: true,
        });
        if (ids.length > actionCardDeck.results.filter((r) => !r.data.drawn).length) {
            ui.notifications.warn(game.i18n.localize('SWADE.NoCardsLeft'));
            return this;
        }
        // Iterate over Combatants, performing an initiative draw for each
        for (const id of ids) {
            // Get Combatant data
            const c = this.combatants.get(id, { strict: true });
            const roundHeld = c.roundHeld;
            const inGroup = c.groupId;
            if (c.initiative !== null && !roundHeld) {
                console.log('This must be a reroll');
                isRedraw = true;
            }
            //Do not draw cards for defeated or holding combatants
            if (c.data.defeated || roundHeld || inGroup)
                continue;
            // Set up edges
            let cardsToDraw = 1;
            if (c.actor.data.data.initiative.hasLevelHeaded)
                cardsToDraw = 2;
            if (c.actor.data.data.initiative.hasImpLevelHeaded)
                cardsToDraw = 3;
            const hasHesitant = c.actor.data.data.initiative.hasHesitant;
            const hasQuick = c.actor.data.data.initiative.hasQuick;
            // Draw initiative
            let card;
            if (isRedraw) {
                const oldCard = await this.findCard(c?.cardValue, c?.suitValue);
                const cards = await this.drawCard();
                if (oldCard) {
                    cards.push(oldCard);
                    card = await this.pickACard({
                        cards: cards,
                        combatantName: c.name,
                        oldCardId: oldCard?.id,
                    });
                    if (card === oldCard) {
                        skipMessage = true;
                    }
                }
                else {
                    card = cards[0];
                }
            }
            else if (hasHesitant) {
                // Hesitant
                const cards = await this.drawCard(2);
                if (cards.some((c) => c.getFlag('swade', 'isJoker'))) {
                    card = await this.pickACard({
                        cards: cards,
                        combatantName: c.name,
                    });
                }
                else {
                    //sort cards to pick the lower one
                    cards.sort((a, b) => {
                        const cardA = a.getFlag('swade', 'cardValue');
                        const cardB = b.getFlag('swade', 'cardValue');
                        const card = cardA - cardB;
                        if (card !== 0)
                            return card;
                        const suitA = a.getFlag('swade', 'suitValue');
                        const suitB = b.getFlag('swade', 'suitValue');
                        const suit = suitA - suitB;
                        return suit;
                    });
                    card = cards[0];
                }
            }
            else if (cardsToDraw > 1) {
                //Level Headed
                const cards = await this.drawCard(cardsToDraw);
                card = await this.pickACard({
                    cards: cards,
                    combatantName: c.name,
                    enableRedraw: hasQuick,
                    isQuickDraw: hasQuick,
                });
            }
            else if (hasQuick) {
                const cards = await this.drawCard();
                card = cards[0];
                const cardValue = card.getFlag('swade', 'cardValue');
                //if the card value is less than 5 then pick a card otherwise use the card
                if (cardValue <= 5) {
                    card = await this.pickACard({
                        cards: [card],
                        combatantName: c.name,
                        enableRedraw: true,
                        isQuickDraw: true,
                    });
                }
            }
            else {
                //normal card draw
                const cards = await this.drawCard();
                card = cards[0];
            }
            const newflags = {
                cardValue: card.getFlag('swade', 'cardValue'),
                suitValue: card.getFlag('swade', 'suitValue'),
                hasJoker: card.getFlag('swade', 'isJoker'),
                cardString: card.data.content,
            };
            const initiative = card.getFlag('swade', 'suitValue') +
                card.getFlag('swade', 'cardValue');
            combatantUpdates.push({
                _id: c.id,
                initiative: initiative,
                'flags.swade': newflags,
            });
            if (c.isGroupLeader) {
                await c.setSuitValue(c.suitValue ?? 0 + 0.9);
                const followers = game.combats?.viewed?.combatants.filter((f) => f.groupId === c.id) ??
                    [];
                let s = newflags.suitValue;
                for await (const f of followers) {
                    s -= 0.02;
                    combatantUpdates.push({
                        _id: f.id,
                        initiative: initiative,
                        'flags.swade': newflags,
                        'flags.swade.suitValue': s,
                    });
                }
            }
            // Generate random degree of rotation to give card slide tilt
            const min = 1;
            const max = 4;
            const rotation = Math.floor(Math.random() * (max - min) + min + 1) *
                (Math.round(Math.random()) ? 1 : -1);
            // Construct chat message data
            const template = `
            <section class="initiative-draw">
                <h4 class="result-text result-text-card">@Compendium[${card.pack}.${card.id}]{${card.name}}</h4>
                <img class="result-image" style="transform: rotate(${rotation}deg)" src="${card.data.img}">
            </section>
          `;
            const messageData = mergeObject({
                speaker: {
                    scene: game.scenes?.active?.id,
                    actor: c.actor ? c.actor.id : null,
                    token: c.token.id,
                    alias: `${c.token.name} ${game.i18n.localize('SWADE.InitDraw')}`,
                },
                whisper: c.token.data.hidden || c.hidden
                    ? game.users.filter((u) => u.isGM)
                    : [],
                content: template,
            }, options?.messageOptions);
            initMessages.push(messageData);
        }
        if (!combatantUpdates.length)
            return this;
        // Update multiple combatants
        await this.updateEmbeddedDocuments('Combatant', combatantUpdates);
        if (game.settings.get('swade', 'initiativeSound') && !skipMessage) {
            AudioHelper.play({
                src: 'systems/swade/assets/card-flip.wav',
                volume: 0.8,
                autoplay: true,
                loop: false,
            }, true);
        }
        // Create multiple chat messages
        if (game.settings.get('swade', 'initMessage') && !skipMessage) {
            await ChatMessage.createDocuments(initMessages);
        }
        // Return the updated Combat
        return this;
    }
    _sortCombatants(a, b) {
        if (!a || !b)
            return 0;
        //shortcut for the currently active combat
        const currentCombat = game.combats?.viewed;
        const currentRound = currentCombat?.round ?? 0;
        if ((a.roundHeld && currentRound !== a.roundHeld) ||
            (b.roundHeld && currentRound !== b.roundHeld)) {
            const isOnHoldA = a.roundHeld && (a.roundHeld ?? 0 < currentRound);
            const isOnHoldB = b.roundHeld && (b.roundHeld ?? 0 < currentRound);
            if (isOnHoldA && !isOnHoldB) {
                return -1;
            }
            if (!isOnHoldA && isOnHoldB) {
                return 1;
            }
        }
        /** Compares two tokens by initiative card */
        const cardSortCombatants = (a, b) => {
            const cardA = a.cardValue ?? 0;
            const cardB = b.cardValue ?? 0;
            const card = cardB - cardA;
            if (card !== 0)
                return card;
            const suitA = a.suitValue ?? 0;
            const suitB = b.suitValue ?? 0;
            return suitB - suitA;
        };
        /** Compares two combatants by name or - if they're the same - ID. */
        const nameSortCombatants = (a, b) => {
            const cn = a.name.localeCompare(b.name);
            if (cn !== 0)
                return cn;
            return a.id.localeCompare(b.id);
        };
        const finalSort = (a, b) => {
            if (a.data.flags?.swade && b.data.flags?.swade) {
                return cardSortCombatants(a, b);
            }
            else {
                return nameSortCombatants(a, b);
            }
        };
        return finalSort(a, b);
    }
    /**
     * Draws cards from the Action Cards table
     * @param count number of cards to draw
     * @returns an array with the drawn cards
     */
    async drawCard(count = 1) {
        const packName = game.settings.get('swade', 'cardDeck');
        let actionCardPack = game.packs.get(packName);
        if (!actionCardPack) {
            console.warn(game.i18n.localize('SWADE.SomethingWrongWithCardComp'));
            await game.settings.set('swade', 'cardDeck', SWADE.init.defaultCardCompendium);
            actionCardPack = game.packs.get(SWADE.init.defaultCardCompendium, {
                strict: true,
            });
        }
        const cards = new Array();
        const actionCardDeck = game.tables.getName(SWADE.init.cardTable, {
            strict: true,
        });
        const draw = await actionCardDeck.drawMany(count, { displayChat: false });
        for (const result of draw.results) {
            const resultID = result.data.resultId;
            const card = await actionCardPack.getDocument(resultID);
            cards.push(card);
        }
        return cards;
    }
    /**
     * Asks the GM to pick a card
     * @param cards an array of cards
     * @param combatantName name of the combatant
     * @param oldCardId id of the old card, if you're picking cards for a redraw
     * @param maxCards maximum number of cards to be displayed
     * @param enableRedraw sets whether a redraw is allowed
     * @param isQuickDraw sets whether this draw includes the Quick edge
     */
    async pickACard({ cards, combatantName, oldCardId, enableRedraw, isQuickDraw, }) {
        // any card
        let immedeateRedraw = false;
        if (isQuickDraw) {
            enableRedraw = !cards.some((card) => card.getFlag('swade', 'cardValue') > 5);
        }
        let card;
        const template = 'systems/swade/templates/initiative/choose-card.hbs';
        const html = await renderTemplate(template, {
            data: {
                cards: cards,
                oldCard: oldCardId,
            },
        });
        const buttons = {
            ok: {
                icon: '<i class="fas fa-check"></i>',
                label: game.i18n.localize('SWADE.Ok'),
                callback: (html) => {
                    const choice = html.find('input[name=card]:checked');
                    const cardId = choice.data('card-id');
                    card = cards.find((c) => c.id === cardId);
                },
            },
            redraw: {
                icon: '<i class="fas fa-plus"></i>',
                label: game.i18n.localize('SWADE.Redraw'),
                callback: () => {
                    immedeateRedraw = true;
                },
            },
        };
        if (!oldCardId && !enableRedraw) {
            delete buttons.redraw;
        }
        return new Promise((resolve) => {
            new Dialog({
                title: `${game.i18n.localize('SWADE.PickACard')} ${combatantName}`,
                content: html,
                buttons: buttons,
                default: 'ok',
                close: async () => {
                    if (immedeateRedraw) {
                        const newCards = await this.drawCard();
                        card = await this.pickACard({
                            cards: [...cards, ...newCards],
                            combatantName,
                            oldCardId,
                            enableRedraw,
                            isQuickDraw,
                        });
                    }
                    //if no card has been chosen then choose first in array
                    if (!card) {
                        if (oldCardId) {
                            card = cards.find((c) => c.id === oldCardId);
                        }
                        else {
                            console.log('No card was selected');
                            card = cards[0]; //If no card was selected, assign the first card that was drawn
                        }
                    }
                    resolve(card);
                },
            }).render(true);
        });
    }
    /**
     * Find a card from the deck based on it's suit and value
     * @param cardValue
     * @param cardSuit
     */
    async findCard(cardValue, cardSuit) {
        const packName = game.settings.get('swade', 'cardDeck');
        const actionCardPack = game.packs?.get(packName, {
            strict: true,
        });
        const content = await actionCardPack.getDocuments();
        return content.find((c) => c.getFlag('swade', 'cardValue') === cardValue &&
            c.getFlag('swade', 'suitValue') === cardSuit);
    }
    async resetAll() {
        const updates = this._getInitResetUpdates();
        await this.updateEmbeddedDocuments('Combatant', updates);
        return this.update({ turn: 0 });
    }
    async startCombat() {
        //Init autoroll
        await super.startCombat();
        if (game.settings.get('swade', 'autoInit')) {
            const combatantIds = [];
            for (const c of this.combatants.filter((c) => c.initiative === null)) {
                combatantIds.push(c.id);
            }
            await this.rollInitiative(combatantIds);
        }
        return this;
    }
    //FIXME return once types are maybe a bit more lenient
    //@ts-expect-error The types are a bit too strict here
    async nextTurn() {
        const turn = this.turn;
        const skip = this.settings['skipDefeated'];
        // Determine the next turn number
        let next = null;
        if (skip) {
            for (const [i, t] of this.turns.entries()) {
                if (i <= turn)
                    continue;
                // Skip defeated, lost turns, and followers on hold (their leaders act for them)
                if (!t.data.defeated && !t.turnLost && !(t.groupId && t.roundHeld)) {
                    next = i;
                    break;
                }
            }
        }
        else {
            next = turn + 1;
        }
        // Maybe advance to the next round
        const round = this.round;
        if (this.round === 0 || next === null || next >= this.turns.length) {
            return this.nextRound();
        }
        // Update the encounter
        return this.update({ round: round, turn: next }, 
        //FIXME return once types are updated
        //@ts-expect-error The property doesn't seem to be defined in the types
        { advanceTime: CONFIG.time.turnTime });
    }
    //FIXME return once types are maybe a bit more lenient
    //@ts-expect-error The types are a bit too strict here
    async nextRound() {
        if (!game.user.isGM) {
            game.socket?.emit('system.swade', {
                type: 'newRound',
                combatId: this.id,
            });
            return;
        }
        else {
            await super.nextRound();
            const jokerDrawn = this.combatants.some((c) => c.hasJoker ?? false);
            if (jokerDrawn) {
                await game
                    .tables.getName(SWADE.init.cardTable, { strict: true })
                    .reset();
                ui.notifications?.info(game.i18n.localize('SWADE.DeckShuffled'));
            }
            const updates = this._getInitResetUpdates();
            await this.updateEmbeddedDocuments('Combatant', updates);
            //Init autoroll
            if (game.settings.get('swade', 'autoInit')) {
                const combatantIds = this.combatants.map((c) => c.id);
                await this.rollInitiative(combatantIds);
            }
        }
    }
    _getInitResetUpdates() {
        const updates = this.combatants.map((c) => {
            const roundHeld = c.roundHeld;
            const turnLost = c.turnLost;
            const groupId = c.groupId;
            if (roundHeld) {
                if (turnLost && groupId) {
                    return {
                        _id: c.id,
                        initiative: null,
                        'flags.swade': {
                            hasJoker: false,
                            '-=turnLost': null,
                        },
                    };
                }
                else {
                    return {
                        _id: c.id,
                        initiative: null,
                        'flags.swade.hasJoker': false,
                    };
                }
            }
            else if (!roundHeld || turnLost) {
                return {
                    _id: c.id,
                    initiative: null,
                    'flags.swade': {
                        suitValue: null,
                        cardValue: null,
                        hasJoker: false,
                        cardString: '',
                        turnLost: false,
                    },
                };
            }
            else {
                return {
                    _id: c.id,
                };
            }
        });
        return updates;
    }
    async _preDelete(options, user) {
        await super._preDelete(options, user);
        const jokerDrawn = this.combatants.some((v) => v.hasJoker ?? false);
        //reset the deck when combat is ended
        if (jokerDrawn) {
            await game.tables
                ?.getName(SWADE.init.cardTable, { strict: true })
                .reset();
            ui.notifications?.info(game.i18n.localize('SWADE.DeckShuffled'));
        }
    }
}
