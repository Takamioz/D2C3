/**
 * Override and extend the basic :class:`Item` implementation
 * @noInheritDoc
 */
export default class SwadeItem extends Item {
    constructor() {
        super(...arguments);
        this.overrides = {};
    }
    get isMeleeWeapon() {
        if (this.type !== 'weapon')
            return false;
        const shots = getProperty(this.data, 'data.shots');
        const currentShots = getProperty(this.data, 'data.currentShots');
        return (!shots && !currentShots) || (shots === '0' && currentShots === '0');
    }
    prepareBaseData() {
        super.prepareBaseData();
        if (!this.overrides)
            this.overrides = {};
    }
    rollDamage(options = {}) {
        const mods = new Array();
        let itemData;
        if (['weapon', 'power', 'shield'].includes(this.type)) {
            itemData = this.data.data;
        }
        else {
            return null;
        }
        const actor = this.actor;
        const label = this.name;
        let ap = getProperty(this.data, 'data.ap');
        if (ap) {
            ap = ` - ${game.i18n.localize('SWADE.Ap')} ${ap}`;
        }
        else {
            ap = ` - ${game.i18n.localize('SWADE.Ap')} 0`;
        }
        let rollParts = [itemData.damage];
        if (this.type === 'shield' || options.dmgOverride) {
            rollParts = [options.dmgOverride];
        }
        //Additional Mods
        if (options.additionalMods) {
            options.additionalMods.forEach((v) => {
                if (typeof v === 'string') {
                    console.warn('The use of strings will be soon depreceated, please switch over to the TraitRollModifer interface');
                    mods.push({ label: game.i18n.localize('SWADE.Addi'), value: v });
                }
                else if (typeof v === 'number') {
                    console.warn('The use of numbers will be soon depreceated, please switch over to the TraitRollModifer interface');
                    mods.push({
                        label: game.i18n.localize('SWADE.Addi'),
                        value: v.signedString(),
                    });
                }
                else {
                    mods.push(v);
                }
            });
        }
        const terms = Roll.parse(rollParts.join(''), actor.getRollData());
        const baseRoll = new Array();
        for (const term of terms) {
            if (term instanceof Die) {
                if (!term.modifiers.includes('x'))
                    term.modifiers.push('x');
                baseRoll.push(term.formula);
            }
            else if (term instanceof StringTerm) {
                baseRoll.push(this._makeExplodable(term.term));
            }
            else {
                baseRoll.push(term.expression);
            }
        }
        //Conviction Modifier
        if (actor.data.type !== 'vehicle' &&
            game.settings.get('swade', 'enableConviction') &&
            actor.data.data.details.conviction.active) {
            mods.push({
                label: game.i18n.localize('SWADE.Conv'),
                value: '+1d6x',
            });
        }
        let flavour = '';
        if (options.flavour) {
            flavour = ` - ${options.flavour}`;
        }
        //Joker Modifier
        if (actor.hasJoker) {
            mods.push({
                label: game.i18n.localize('SWADE.Joker'),
                value: '+2',
            });
        }
        const newRoll = new Roll(baseRoll.join(''));
        if (options.suppressChat) {
            return Roll.fromTerms([
                ...newRoll.terms,
                ...Roll.parse(mods.reduce((acc, cur) => {
                    return (acc += `${cur.value}[${cur.label}]`);
                }, ''), this.getRollData()),
            ]);
        }
        // Roll and return
        return game.swade.RollDialog.asPromise({
            roll: newRoll,
            mods: mods,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `${label} ${game.i18n.localize('SWADE.Dmg')}${ap}${flavour}`,
            title: `${label} ${game.i18n.localize('SWADE.Dmg')}`,
            item: this,
            flags: { swade: { colorMessage: false } },
        });
    }
    getChatData(htmlOptions) {
        const data = deepClone(this.data.data);
        // Rich text description
        data.description = TextEditor.enrichHTML(data.description, htmlOptions);
        data.notes = TextEditor.enrichHTML(data.notes, htmlOptions);
        // Item properties
        const props = new Array();
        switch (this.type) {
            case 'hindrance':
                props.push(data.major
                    ? game.i18n.localize('SWADE.Major')
                    : game.i18n.localize('SWADE.Minor'));
                break;
            case 'shield':
                props.push(data.equipped
                    ? '<i class="fas fa-tshirt"></i>'
                    : '<i class="fas fa-tshirt" style="color:grey"></i>');
                props.push(`<i class='fas fa-shield-alt'></i> ${data.parry}`);
                props.push(`<i class='fas fa-umbrella'></i> ${data.cover}`);
                props.push(data.notes ? `<i class="fas fa-sticky-note"></i> ${data.notes}` : '');
                break;
            case 'armor':
                props.push(`<i class='fas fa-shield-alt'></i> ${data.armor}`);
                props.push(data.equipped
                    ? '<i class="fas fa-tshirt"></i>'
                    : '<i class="fas fa-tshirt" style="color:grey"></i>');
                props.push(data.notes ? `<i class="fas fa-sticky-note"></i> ${data.notes}` : '');
                props.push(data.locations.head ? game.i18n.localize('SWADE.Head') : '');
                props.push(data.locations.torso ? game.i18n.localize('SWADE.Torso') : '');
                props.push(data.locations.arms ? game.i18n.localize('SWADE.Arms') : '');
                props.push(data.locations.legs ? game.i18n.localize('SWADE.Legs') : '');
                break;
            case 'edge':
                props.push(data.requirements.value);
                props.push(data.isArcaneBackground ? 'Arcane' : '');
                break;
            case 'power':
                props.push(data.rank, data.arcane, `${data.pp}PP`, `<i class="fas fa-ruler"></i> ${data.range}`, `<i class='fas fa-hourglass-half'></i> ${data.duration}`, data.trapping);
                break;
            case 'weapon':
                props.push(data.equipped
                    ? '<i class="fas fa-tshirt"></i>'
                    : '<i class="fas fa-tshirt" style="color:grey"></i>');
                props.push(`<i class='fas fa-shield-alt'></i> ${data.ap}`);
                props.push(`<i class="fas fa-ruler"></i> ${data.range}`);
                props.push(data.notes ? `<i class="fas fa-sticky-note"></i> ${data.notes}` : '');
                break;
            default:
                break;
        }
        // Filter properties and return
        data.properties = props.filter((p) => !!p);
        //Additional actions
        const actions = getProperty(this.data, 'data.actions.additional');
        data.actions = [];
        for (const action in actions) {
            data.actions.push({
                key: action,
                type: actions[action].type,
                name: actions[action].name,
            });
        }
        return data;
    }
    /**
     * Assembles data and creates a chat card for the item
     * @returns the rendered chatcard
     */
    async show() {
        // Basic template rendering data
        if (!this.actor)
            return;
        const token = this.actor.token;
        const tokenId = token ? `${token.parent.id}.${token.id}` : null;
        const ammoManagement = game.settings.get('swade', 'ammoManagement');
        const hasAmmoManagement = this.type === 'weapon' &&
            !this.isMeleeWeapon &&
            ammoManagement &&
            !getProperty(this.data, 'data.autoReload');
        const hasDamage = !!getProperty(this.data, 'data.damage');
        const hasTraitRoll = ['weapon', 'power', 'shield'].includes(this.data.type) &&
            !!getProperty(this.data, 'data.actions.skill');
        const hasReloadButton = ammoManagement &&
            this.type === 'weapon' &&
            getProperty(this.data, 'data.shots') > 0 &&
            !getProperty(this.data, 'data.autoReload');
        const additionalActions = getProperty(this.data, 'data.actions.additional') || {};
        const hasAdditionalActions = !isObjectEmpty(additionalActions);
        const hasTraitActions = Object.values(additionalActions).some((v) => v.type === 'skill');
        const hasDamageActions = Object.values(additionalActions).some((v) => v.type === 'damage');
        const templateData = {
            actor: this.actor,
            tokenId: tokenId,
            item: this.data,
            data: this.getChatData({}),
            hasAmmoManagement: hasAmmoManagement,
            hasReloadButton: hasReloadButton,
            hasDamage: hasDamage,
            showDamageRolls: hasDamage || hasDamageActions,
            hasAdditionalActions: hasAdditionalActions,
            trait: getProperty(this.data, 'data.actions.skill'),
            hasTraitRoll: hasTraitRoll,
            showTraitRolls: hasTraitRoll || hasTraitActions,
            powerPoints: this._getPowerPoints(),
            settingrules: {
                noPowerPoints: game.settings.get('swade', 'noPowerPoints'),
            },
        };
        // Render the chat card template
        const template = 'systems/swade/templates/chat/item-card.hbs';
        const html = await renderTemplate(template, templateData);
        // Basic chat message data
        const chatData = {
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            content: html,
            speaker: {
                actor: this.parent?.id,
                token: tokenId,
                scene: token?.parent?.id,
                alias: this.parent?.name,
            },
            flags: { 'core.canPopout': true },
        };
        if (game.settings.get('swade', 'hideNpcItemChatCards') &&
            this.actor.data.type === 'npc') {
            chatData.whisper = game.users.filter((u) => u.isGM).map((u) => u.id);
        }
        // Toggle default roll mode
        const rollMode = game.settings.get('core', 'rollMode');
        if (['gmroll', 'blindroll'].includes(rollMode))
            chatData.whisper = ChatMessage.getWhisperRecipients('GM').map((u) => u.id);
        if (rollMode === 'selfroll')
            chatData.whisper = [game.user.id];
        if (rollMode === 'blindroll')
            chatData.blind = true;
        // Create the chat message
        const chatCard = await ChatMessage.create(chatData);
        Hooks.call('swadeChatCard', this.actor, this, chatCard, game.user.id);
        return chatCard;
    }
    _makeExplodable(expresion) {
        // Make all dice of a roll able to explode
        const diceRegExp = /\d*d\d+[^kdrxc]/g;
        expresion = expresion + ' '; // Just because of my poor reg_exp foo
        const diceStrings = expresion.match(diceRegExp) || [];
        const used = new Array();
        for (const match of diceStrings) {
            if (used.indexOf(match) === -1) {
                expresion = expresion.replace(new RegExp(match.slice(0, -1), 'g'), match.slice(0, -1) + 'x');
                used.push(match);
            }
        }
        return expresion;
    }
    /**
     * @returns the power points for the AB that this power belongs to or null when the item is not a power
     */
    _getPowerPoints() {
        if (this.type !== 'power')
            return null;
        const arcane = getProperty(this.data, 'data.arcane');
        let current = getProperty(this.actor.data, 'data.powerPoints.value');
        let max = getProperty(this.actor.data, 'data.powerPoints.max');
        if (arcane) {
            current = getProperty(this.actor.data, `data.powerPoints.${arcane}.value`);
            max = getProperty(this.actor.data, `data.powerPoints.${arcane}.max`);
        }
        return { current, max };
    }
    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);
        //Set default image if no image already exists
        if (!data.img) {
            this.data.update({ img: `systems/swade/assets/icons/${data.type}.svg` });
        }
        if (this.parent) {
            if (data.type === 'skill' && options.renderSheet !== null) {
                options.renderSheet = true;
            }
            if (this.parent.type === 'npc' &&
                hasProperty(this.data, 'data.equippable')) {
                this.data.update({ 'data.equipped': true });
            }
        }
    }
    async _preDelete(options, user) {
        await super._preDelete(options, user);
        //delete all transfered active effects from the actor
        if (this.parent) {
            const updates = new Array();
            for (const ae of this.parent.effects.values()) {
                if (ae.data.origin !== this.uuid)
                    continue;
                updates.push(ae.id);
            }
            await this.parent.deleteEmbeddedDocuments('ActiveEffect', updates);
        }
    }
    async _preUpdate(changed, options, user) {
        await super._preUpdate(changed, options, user);
        if (this.parent && hasProperty(changed, 'data.equipped')) {
            const updates = new Array();
            for (const ae of this.parent.effects.values()) {
                if (ae.data.origin !== this.uuid)
                    continue;
                updates.push({ _id: ae.id, disabled: !changed.data.equipped });
            }
            await this.actor.updateEmbeddedDocuments('ActiveEffect', updates);
        }
    }
}
