import ItemChatCardHelper from "../../ItemChatCardHelper.js";
export default class CharacterSheet extends ActorSheet {
    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            classes: ['swade-official', 'sheet', 'actor'],
            width: 630,
            height: 700,
            resizable: true,
            tabs: [
                {
                    navSelector: '.tabs',
                    contentSelector: '.sheet-body',
                    initial: 'summary',
                },
            ],
        };
    }
    get template() {
        return 'systems/swade/templates/official/sheet.hbs';
    }
    activateListeners(html) {
        super.activateListeners(html);
        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable)
            return;
        // Drag events for macros.
        if (this.actor.isOwner) {
            const handler = (ev) => this._onDragStart(ev);
            // Find all items on the character sheet.
            html.find('li.item.skill').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
            html.find('li.item.weapon').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
            html.find('li.item.armor').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
            html.find('li.item.shield').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
            html.find('li.item.misc').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
            html.find('li.item.power').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
            html.find('li.active-effect').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
            html.find('li.item.edge-hindrance').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
        }
        //Display Advances on About tab
        html.find('label.advances').on('click', async () => {
            this._tabs[0].activate('description');
        });
        //Toggle Conviction
        html.find('.conviction-toggle').on('click', async () => {
            const current = getProperty(this.actor.data, 'data.details.conviction.value');
            const active = getProperty(this.actor.data, 'data.details.conviction.active');
            if (current > 0 && !active) {
                await this.actor.update({
                    'data.details.conviction.value': current - 1,
                    'data.details.conviction.active': true,
                });
                ChatMessage.create({
                    speaker: {
                        actor: this.actor.id,
                        alias: this.actor.name,
                    },
                    content: game.i18n.localize('SWADE.ConvictionActivate'),
                });
            }
            else {
                await this.actor.update({
                    'data.details.conviction.active': false,
                });
            }
        });
        html.find('.add-benny').on('click', () => {
            this.actor.getBenny();
        });
        html.find('.spend-benny').on('click', () => {
            this.actor.spendBenny();
        });
        //Roll Attribute
        html.find('.attribute-label').on('click', (ev) => {
            const attribute = ev.currentTarget.parentElement.dataset
                .attribute;
            this.actor.rollAttribute(attribute);
        });
        //Toggle Equipment Card collapsible
        html.find('.skill-card .skill-name.item-name').on('click', (ev) => {
            $(ev.currentTarget)
                .parents('.item.skill.skill-card')
                .find('.card-content')
                .slideToggle();
        });
        // Roll Skill
        html.find('.skill-card .skill-die').on('click', (ev) => {
            const element = ev.currentTarget;
            const item = element.parentElement.dataset.itemId;
            this.actor.rollSkill(item);
        });
        //Running Die
        html.find('.running-die').on('click', async (ev) => {
            if (this.actor.data.type === 'vehicle')
                return;
            const runningDieSides = this.actor.data.data.stats.speed.runningDie;
            const runningMod = this.actor.data.data.stats.speed.runningMod;
            const pace = this.actor.data.data.stats.speed.adjusted;
            const runningDie = `1d${runningDieSides}[${game.i18n.localize('SWADE.RunningDie')}]`;
            const mods = [
                { label: game.i18n.localize('SWADE.Pace'), value: pace.signedString() },
            ];
            if (runningMod) {
                mods.push({
                    label: 'Modifier',
                    value: runningMod.signedString(),
                });
            }
            if (ev.shiftKey) {
                const rollFormula = runningDie + runningMod.signedString() + pace.signedString();
                const runningRoll = new Roll(rollFormula);
                await runningRoll.evaluate({ async: true });
                await runningRoll.toMessage({
                    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                    flavor: game.i18n.localize('SWADE.Running'),
                });
                return;
            }
            game.swade.RollDialog.asPromise({
                roll: new Roll(runningDie),
                mods: mods,
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: game.i18n.localize('SWADE.Running'),
                title: game.i18n.localize('SWADE.Running'),
                actor: this.actor,
                allowGroup: false,
            });
        });
        // Roll Damage
        html.find('.damage-roll').on('click', (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'));
            return item.rollDamage();
        });
        //Toggle Equipment Card collapsible
        html.find('.gear-card .item-name').on('click', (ev) => {
            $(ev.currentTarget)
                .parents('.gear-card')
                .find('.card-content')
                .slideToggle();
        });
        //Edit Item
        html.find('.item-edit').on('click', (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'), { strict: true });
            item.sheet?.render(true);
        });
        //Show Item
        html.find('.item-show').on('click', (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'), { strict: true });
            item.show();
        });
        // Delete Item
        html.find('.item-delete').on('click', async (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'), {
                strict: true,
            });
            const template = `
      <form>
        <div style="text-align: center;">
          <p>
          ${game.i18n.localize('Delete')} <strong>${item.name}</strong>?
          </p>
        </div>
      </form>`;
            await Dialog.confirm({
                title: game.i18n.localize('Delete'),
                content: template,
                yes: () => {
                    li.slideUp(200, () => item.delete());
                },
                no: () => { },
            });
        });
        html.find('.item-create').on('click', async (ev) => {
            const header = ev.currentTarget;
            const type = header.dataset.type;
            // item creation helper func
            const createItem = function (type, name = `New ${type.capitalize()}`) {
                const itemData = {
                    name: name ? name : `New ${type.capitalize()}`,
                    type: type,
                    data: header.dataset,
                };
                delete itemData.data['type'];
                return itemData;
            };
            switch (type) {
                case 'choice':
                    this._chooseItemType().then(async (dialogInput) => {
                        if (dialogInput.type !== 'effect') {
                            const itemData = createItem(dialogInput.type, dialogInput.name);
                            await Item.create(itemData, {
                                renderSheet: true,
                                parent: this.actor,
                            });
                        }
                        else {
                            this._createActiveEffect(dialogInput.name);
                        }
                    });
                    break;
                case 'effect':
                    this._createActiveEffect();
                    break;
                default:
                    await Item.create(createItem(type), {
                        renderSheet: true,
                        parent: this.actor,
                    });
                    break;
            }
        });
        //Toggle Equipment Status
        html.find('.item-toggle').on('click', async (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const itemID = li.data('itemId');
            const item = this.actor.items.get(itemID);
            await this.actor.updateEmbeddedDocuments('Item', [
                this._toggleEquipped(itemID, item),
            ]);
        });
        html.find('.effect-action').on('click', async (ev) => {
            const a = ev.currentTarget;
            const effectId = a.closest('li').dataset.effectId;
            const effect = this.actor.effects.get(effectId);
            const action = a.dataset.action;
            let item = null;
            switch (action) {
                case 'edit':
                    return effect.sheet.render(true);
                case 'delete':
                    return effect.delete();
                case 'toggle':
                    return effect.update({ disabled: !effect.data.disabled });
                case 'open-origin':
                    item = (await fromUuid(effect.data.origin));
                    if (item)
                        item?.sheet?.render(true);
                    break;
                default:
                    console.warn(`The action ${action} is not currently supported`);
                    break;
            }
        });
        html.find('.item .item-name').on('click', (ev) => {
            $(ev.currentTarget).parents('.item').find('.description').slideToggle();
        });
        html.find('.armor-display').on('click', () => {
            const armorPropertyPath = 'data.stats.toughness.armor';
            const armorvalue = getProperty(this.actor.data, armorPropertyPath);
            const label = game.i18n.localize('SWADE.Armor');
            const template = `
      <form><div class="form-group">
        <label>${game.i18n.localize('SWADE.Ed')} ${label}</label>
        <input name="modifier" value="${armorvalue}" type="number"/>
      </div></form>`;
            new Dialog({
                title: `${game.i18n.localize('SWADE.Ed')} ${this.actor.name} ${label}`,
                content: template,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: game.i18n.localize('SWADE.Ok'),
                        callback: (html) => {
                            const newData = {};
                            newData[armorPropertyPath] = html
                                .find('input[name="modifier"]')
                                .val();
                            this.actor.update(newData);
                        },
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize('Cancel'),
                    },
                },
                default: 'ok',
            }).render(true);
        });
        html.find('.parry-display').on('click', () => {
            const parryPropertyPath = 'data.stats.parry.modifier';
            const parryMod = getProperty(this.actor.data, parryPropertyPath);
            const label = game.i18n.localize('SWADE.Parry');
            const template = `
      <form><div class="form-group">
        <label>${game.i18n.localize('SWADE.Ed')} ${label}</label>
        <input name="modifier" value="${parryMod}" type="number"/>
      </div></form>`;
            new Dialog({
                title: `${game.i18n.localize('SWADE.Ed')} ${this.actor.name} ${label}`,
                content: template,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: game.i18n.localize('SWADE.Ok'),
                        callback: (html) => {
                            const newData = {};
                            newData[parryPropertyPath] = html
                                .find('input[name="modifier"]')
                                .val();
                            this.actor.update(newData);
                        },
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize('Cancel'),
                    },
                },
                default: 'ok',
            }).render(true);
        });
        //Item Action Buttons
        html.find('.card-buttons button').on('click', async (ev) => {
            const button = ev.currentTarget;
            const action = button.dataset.action;
            const itemId = $(button).parents('.chat-card.item-card').data().itemId;
            const item = this.actor.items.get(itemId, { strict: true });
            const additionalMods = new Array();
            const ppToAdjust = $(button)
                .parents('.chat-card.item-card')
                .find('input.pp-adjust')
                .val();
            const arcaneDevicePPToAdjust = $(button)
                .parents('.chat-card.item-card')
                .find('input.arcane-device-pp-adjust')
                .val();
            //if it's a power and the No Power Points rule is in effect
            if (item.type === 'power' &&
                game.settings.get('swade', 'noPowerPoints')) {
                let modifier = Math.ceil(parseInt(ppToAdjust, 10) / 2);
                modifier = Math.min(modifier * -1, modifier);
                const actionObj = getProperty(item.data, `data.actions.additional.${action}.skillOverride`);
                //filter down further to make sure we only apply the penalty to a trait roll
                if (action === 'formula' ||
                    (!!actionObj && actionObj.type === 'skill')) {
                    additionalMods.push({
                        label: game.i18n.localize('ITEM.TypePower'),
                        value: modifier.signedString(),
                    });
                }
            }
            ItemChatCardHelper.handleAction(item, this.actor, action, additionalMods);
            //handle Power Item Card PP adjustment
            if (action === 'pp-adjust') {
                const adjustment = button.getAttribute('data-adjust');
                const power = this.actor.items.get(itemId, { strict: true });
                let key = 'data.powerPoints.value';
                const arcane = getProperty(power.data, 'data.arcane');
                if (arcane)
                    key = `data.powerPoints.${arcane}.value`;
                let newPP = getProperty(this.actor.data, key);
                if (adjustment === 'plus') {
                    newPP += parseInt(ppToAdjust, 10);
                }
                else if (adjustment === 'minus') {
                    newPP -= parseInt(ppToAdjust, 10);
                }
                await this.actor.update({ [key]: newPP });
            }
            //handle Arcane Device Item Card PP adjustment
            if (action === 'arcane-device-pp-adjust') {
                const adjustment = button.getAttribute('data-adjust');
                const item = this.actor.items.get(itemId);
                const key = 'data.powerPoints.value';
                let newPP = getProperty(item.data, key);
                if (adjustment === 'plus') {
                    newPP += parseInt(arcaneDevicePPToAdjust, 10);
                }
                else if (adjustment === 'minus') {
                    newPP -= parseInt(arcaneDevicePPToAdjust, 10);
                }
                await item.update({ [key]: newPP });
            }
        });
        //Additional Stats roll
        html.find('.additional-stats .roll').on('click', async (ev) => {
            const button = ev.currentTarget;
            const stat = button.dataset.stat;
            const statData = this.actor.data.data.additionalStats[stat];
            let modifier = statData.modifier || '';
            if (!!modifier && !modifier.match(/^[+-]/)) {
                modifier = '+' + modifier;
            }
            //return early if there's no data to roll
            if (!statData.value)
                return;
            const roll = new Roll(`${statData.value}${modifier}`, this.actor.getRollData());
            await roll.evaluate({ async: true });
            await roll.toMessage({
                speaker: ChatMessage.getSpeaker(),
                flavor: statData.label,
            });
        });
        //Wealth Die Roll
        html.find('.currency .roll').on('click', () => {
            if (this.actor.data.type === 'vehicle')
                return;
            const die = this.actor.data.data.details.wealth.die ?? 6;
            const mod = this.actor.data.data.details.wealth.modifier ?? 0;
            const wildDie = this.actor.data.data.details.wealth['wild-die'] ?? 6;
            const dieLabel = game.i18n.localize('SWADE.WealthDie');
            const wildDieLabel = game.i18n.localize('SWADE.WildDie');
            const formula = `{1d${die}x[${dieLabel}], 1d${wildDie}x[${wildDieLabel}]}kh`;
            game.swade.RollDialog.asPromise({
                roll: new Roll(formula),
                mods: [{ label: 'Modifier', value: mod }],
                speaker: ChatMessage.getSpeaker(),
                actor: this.actor,
                flavor: game.i18n.localize('SWADE.WealthDie'),
                title: game.i18n.localize('SWADE.WealthDie'),
            });
        });
    }
    getData() {
        const data = super.getData();
        data.bennyImageURL = game.settings.get('swade', 'bennyImageSheet');
        const ammoManagement = game.settings.get('swade', 'ammoManagement');
        for (const item of Array.from(this.actor.items.values())) {
            // Basic template rendering data
            const data = item.data;
            const actions = item.data.data?.actions?.additional ?? {};
            item.actions = [];
            for (const action in actions) {
                item.actions.push({
                    key: action,
                    type: actions[action].type,
                    name: actions[action].name,
                });
            }
            item.hasDamage =
                !!getProperty(data, 'data.damage') ||
                    !!item.actions.find((action) => action.type === 'damage');
            item.skill =
                getProperty(data, 'data.actions.skill') ||
                    !!item.actions.find((action) => action.type === 'skill');
            item.hasSkillRoll =
                ['weapon', 'power', 'shield'].includes(data.type) &&
                    getProperty(data, 'data.actions.skill');
            item.hasAmmoManagement =
                ammoManagement &&
                    item.type === 'weapon' &&
                    !item.isMeleeWeapon &&
                    !data.data.autoReload;
            item.hasReloadButton =
                ammoManagement && data.data.shots > 0 && !data.data.autoReload;
            item.powerPoints = this.getPowerPoints(data);
        }
        //sort skills alphabetically
        data.sortedSkills = this.actor.itemTypes.skill.sort((a, b) => a.name.localeCompare(b.name));
        data.currentBennies = [];
        const bennies = getProperty(this.actor.data, 'data.bennies.value');
        for (let i = 0; i < bennies; i++) {
            data.currentBennies.push(i + 1);
        }
        const additionalStats = data.data.data.additionalStats || {};
        for (const attr of Object.values(additionalStats)) {
            attr['isCheckbox'] = attr.dtype === 'Boolean';
        }
        data.hasAdditionalStatsFields = Object.keys(additionalStats).length > 0;
        const powerFilter = (i) => i.data.type === 'power';
        //Deal with ABs and Powers
        const powers = {
            arcanes: {},
            arcanesCount: this.actor.items
                .filter(powerFilter)
                .map((p) => {
                return p.data.data['arcane'];
            })
                .filter(Boolean).length,
            hasPowersWithoutArcane: this.actor.items.filter(powerFilter).reduce((acc, cur) => {
                if (cur.data.data['arcane']) {
                    return acc;
                }
                else {
                    return (acc += 1);
                }
            }, 0) > 0,
        };
        for (const power of this.actor.items.filter(powerFilter)) {
            if (power.data.type !== 'power')
                continue;
            const arcane = power.data.data.arcane;
            if (!arcane)
                continue;
            if (!powers.arcanes[arcane]) {
                powers.arcanes[arcane] = {
                    valuePath: `data.powerPoints.${arcane}.value`,
                    value: getProperty(this.actor.data, `data.powerPoints.${arcane}.value`),
                    maxPath: `data.powerPoints.${arcane}.max`,
                    max: getProperty(this.actor.data, `data.powerPoints.${arcane}.max`),
                    powers: [],
                };
            }
            powers.arcanes[arcane].powers.push(power);
        }
        data.powers = powers;
        data.parry = 0;
        for (const shield of this.actor.itemTypes.shield) {
            if (shield.data.type !== 'shield')
                continue;
            if (shield.data.data.equipped) {
                data.parry += shield.data.data.parry;
            }
        }
        // Check for enabled optional rules
        data.settingrules = {
            conviction: game.settings.get('swade', 'enableConviction'),
            noPowerPoints: game.settings.get('swade', 'noPowerPoints'),
            wealthType: game.settings.get('swade', 'wealthType'),
            currencyName: game.settings.get('swade', 'currencyName'),
        };
        // Progress attribute abbreviation toggle
        data.useAttributeShorts = game.settings.get('swade', 'useAttributeShorts');
        //weight unit
        data.weightUnit = 'lbs';
        if (game.settings.get('swade', 'weightUnit') === 'metric') {
            data.weightUnit = 'kg';
        }
        return data;
    }
    getPowerPoints(item) {
        if (item.data.type !== 'power')
            return {};
        const arcane = item.data.data.arcane;
        let current = getProperty(item.actor, 'data.data.data.powerPoints.value');
        let max = getProperty(item.actor, 'data.data.powerPoints.max');
        if (arcane) {
            current = getProperty(item.actor, `data.data.powerPoints.${arcane}.value`);
            max = getProperty(item.actor, `data.data.powerPoints.${arcane}.max`);
        }
        return { current, max };
    }
    /**
     * Extend and override the sheet header buttons
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        // Token Configuration
        const canConfigure = this.actor.isOwner;
        if (this.options.editable && canConfigure) {
            const button = {
                label: game.i18n.localize('SWADE.Tweaks'),
                class: 'configure-actor',
                icon: 'fas fa-dice',
                onclick: (ev) => this._onConfigureEntity(ev),
            };
            buttons = [button, ...buttons];
        }
        return buttons;
    }
    _onConfigureEntity(event) {
        event.preventDefault();
        new game.swade.SwadeEntityTweaks(this.actor).render(true);
    }
    _toggleEquipped(id, item) {
        return {
            _id: id,
            data: {
                equipped: !item.data.data.equipped,
            },
        };
    }
    async _chooseItemType(choices) {
        if (!choices) {
            choices = {
                weapon: game.i18n.localize('ITEM.TypeWeapon'),
                armor: game.i18n.localize('ITEM.TypeArmor'),
                shield: game.i18n.localize('ITEM.TypeShield'),
                gear: game.i18n.localize('ITEM.TypeGear'),
                effect: 'Active Effect',
            };
        }
        const templateData = {
            types: choices,
            hasTypes: true,
            name: game.i18n
                .localize('ENTITY.New')
                .replace('{entity}', game.i18n.localize('ENTITY.Item')),
        }, dlg = await renderTemplate('templates/sidebar/entity-create.html', templateData);
        //Create Dialog window
        return new Promise((resolve) => {
            new Dialog({
                title: game.i18n
                    .localize('ENTITY.Create')
                    .replace('{entity}', game.i18n.localize('ENTITY.Item')),
                content: dlg,
                buttons: {
                    ok: {
                        label: game.i18n.localize('ENTITY.CreateNew'),
                        icon: '<i class="fas fa-check"></i>',
                        callback: (html) => {
                            resolve({
                                type: html.find('select[name="type"]').val(),
                                name: html.find('input[name="name"]').val(),
                            });
                        },
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize('Cancel'),
                    },
                },
                default: 'ok',
            }).render(true);
        });
    }
    async _createActiveEffect(name) {
        let possibleName = game.i18n
            .localize('ENTITY.New')
            .replace('{entity}', game.i18n.localize('Active Effect'));
        if (name)
            possibleName = name;
        await CONFIG.ActiveEffect.documentClass.create({
            label: possibleName,
            icon: '/icons/svg/mystery-man-black.svg',
        }, { renderSheet: true, parent: this.actor });
    }
}
