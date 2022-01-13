import SwadeEntityTweaks from "../apps/SwadeEntityTweaks.js";
import * as chat from "../chat.js";
import { SWADE } from "../config.js";
/**
 * @noInheritDoc
 */
export default class SwadeBaseActorSheet extends ActorSheet {
    activateListeners(html) {
        super.activateListeners(html);
        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable)
            return;
        if (this.actor.isOwner) {
            const handler = (ev) => this._onDragStart(ev);
            html.find('li.active-effect').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
        }
        // Update Item
        html.find('.item-edit').on('click', (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'));
            item?.sheet?.render(true);
        });
        html.find('.item .item-controls .item-show').on('click', async (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'));
            item.show();
        });
        html.find('.item .item-name .item-image').on('click', async (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'));
            item.show();
        });
        // Edit armor modifier
        html.find('.armor-value').on('click', (ev) => {
            let target = ev.currentTarget.dataset.target ?? '';
            const shouldAutoCalcArmor = getProperty(this.actor.data, 'data.details.autoCalcToughness');
            if (target === 'armor' && shouldAutoCalcArmor) {
                target = 'toughness';
            }
            this._modifyDefense(target);
        });
        // Roll attribute
        html.find('.attribute-label a').on('click', (event) => {
            const element = event.currentTarget;
            const attribute = element.parentElement.parentElement.dataset
                .attribute;
            this.actor.rollAttribute(attribute);
        });
        // Roll Damage
        html.find('.damage-roll').on('click', (event) => {
            const element = event.currentTarget;
            const itemId = $(element).parents('[data-item-id]').attr('data-item-id');
            const item = this.actor.items.get(itemId);
            return item.rollDamage();
        });
        //Add Benny
        html.find('.benny-add').on('click', () => {
            this.actor.getBenny();
        });
        //Remove Benny
        html.find('.benny-subtract').on('click', () => {
            this.actor.spendBenny();
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
                await chat.createConvictionEndMessage(this.actor);
            }
        });
        // Filter power list
        html.find('.arcane-tabs .arcane').on('click', (ev) => {
            const arcane = ev.currentTarget.dataset.arcane;
            html.find('.arcane-tabs .arcane').removeClass('active');
            ev.currentTarget.classList.add('active');
            this._filterPowers(html, arcane);
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
        html.find('.effect-action').on('click', (ev) => {
            const a = ev.currentTarget;
            const effectId = a.closest('li').dataset.effectId;
            const effect = this.actor.effects.get(effectId);
            const action = a.dataset.action;
            switch (action) {
                case 'edit':
                    return effect.sheet.render(true);
                case 'delete':
                    return effect.delete();
                case 'toggle':
                    return effect.update({ disabled: !effect?.data.disabled });
                case 'open-origin':
                    fromUuid(effect.data?.origin).then((item) => {
                        if (item)
                            this.actor.items.get(item.id).sheet?.render(true);
                    });
                    break;
                default:
                    console.warn(`The action ${action} is not currently supported`);
                    break;
            }
        });
        html.find('.add-effect').on('click', async (ev) => {
            const transfer = $(ev.currentTarget).data('transfer');
            const effect = await CONFIG.ActiveEffect.documentClass.create({
                label: game.i18n
                    .localize('ENTITY.New')
                    .replace('{entity}', game.i18n.localize('Active Effect')),
                icon: '/icons/svg/mystery-man-black.svg',
                transfer: transfer,
            }, { renderSheet: true, parent: this.actor });
            this.actor.effects.get(effect?.id)?.sheet.render(true);
        });
        html.find('.additional-stats .roll').on('click', async (ev) => {
            const button = ev.currentTarget;
            const stat = button.dataset.stat;
            const statData = getProperty(this.actor.data, `data.additionalStats.${stat}`);
            let modifier = statData.modifier || '';
            if (!!modifier && !modifier.match(/^[+-]/)) {
                modifier = '+' + modifier;
            }
            const roll = new Roll(`${statData.value}${modifier}`, this.actor.getRollData());
            await roll.evaluate({ async: true });
            await roll.toMessage({
                speaker: ChatMessage.getSpeaker(),
                flavor: statData.label,
            });
        });
    }
    getData() {
        const data = super.getData();
        data.config = SWADE;
        data.itemsByType = {};
        //@ts-ignore
        for (const type of game.system.documentTypes.Item) {
            data.itemsByType[type] = data.items.filter((i) => i.type === type) || [];
        }
        data.itemsByType.skill.sort((a, b) => a.name.localeCompare(b.name));
        if (this.actor.data.type !== 'vehicle') {
            //Encumbrance
            data.inventoryWeight = this._calcInventoryWeight([
                ...data.itemsByType['gear'],
                ...data.itemsByType['weapon'],
                ...data.itemsByType['armor'],
                ...data.itemsByType['shield'],
            ]);
            data.maxCarryCapacity = this.actor.calcMaxCarryCapacity();
            if (this.actor.data.type === 'character') {
                data.powersOptions =
                    'class="powers-list resizable" data-base-size="560"';
            }
            else {
                data.powersOptions = 'class="powers-list"';
            }
            // Display the current active arcane
            data.activeArcane = this.options['activeArcane'];
            data.arcanes = [];
            const powers = data.itemsByType['power'];
            if (powers) {
                powers.forEach((pow) => {
                    if (!pow.data.arcane)
                        return;
                    if (data.arcanes.find((el) => el == pow.data.arcane) ===
                        undefined) {
                        data.arcanes.push(pow.data.arcane);
                        // Add powerpoints data relevant to the detected arcane
                        if (!hasProperty(data, `data.data.powerPoints.${pow.data.arcane}`)) {
                            data.data.data.powerPoints[pow.data.arcane] = {
                                value: 0,
                                max: 0,
                            };
                        }
                    }
                });
            }
            // Check for enabled optional rules
            data.settingrules = {
                conviction: game.settings.get('swade', 'enableConviction'),
                noPowerPoints: game.settings.get('swade', 'noPowerPoints'),
            };
        }
        const additionalStats = data.data.data.additionalStats || {};
        for (const attr of Object.values(additionalStats)) {
            attr['isCheckbox'] = attr['dtype'] === 'Boolean';
        }
        data.hasAdditionalStatsFields = Object.keys(additionalStats).length > 0;
        return data;
    }
    /**
     * Extend and override the sheet header buttons
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        // Token Configuration
        if (this.actor.isOwner) {
            buttons = [
                {
                    label: game.i18n.localize('SWADE.Tweaks'),
                    class: 'configure-actor',
                    icon: 'fas fa-dice',
                    onclick: (ev) => this._onConfigureEntity(ev),
                },
                ...buttons,
            ];
        }
        return buttons;
    }
    _onConfigureEntity(event) {
        event.preventDefault();
        new SwadeEntityTweaks(this.actor).render(true);
    }
    //TODO Define better return type
    async _chooseItemType(choices) {
        if (!choices) {
            choices = {
                weapon: game.i18n.localize('ITEM.TypeWeapon'),
                armor: game.i18n.localize('ITEM.TypeArmor'),
                shield: game.i18n.localize('ITEM.TypeShield'),
                gear: game.i18n.localize('ITEM.TypeGear'),
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
                        label: game.i18n.localize('SWADE.Ok'),
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
                        label: game.i18n.localize('SWADE.Cancel'),
                    },
                },
                default: 'ok',
            }).render(true);
        });
    }
    _checkNull(items) {
        if (items && items.length) {
            return items;
        }
        return [];
    }
    async _onResize(event) {
        super._onResize(event);
        const html = $(event.path);
        const selector = `#${this.id} .resizable`;
        const resizable = html.find(selector);
        resizable.each((_, el) => {
            const heightDelta = this.position.height - this.options.height;
            el.style.height = `${heightDelta + parseInt(el.dataset.baseSize)}px`;
        });
    }
    _modifyDefense(target) {
        let targetLabel;
        let targetProperty;
        switch (target) {
            case 'parry':
                targetLabel = `${game.i18n.localize('SWADE.Parry')} ${game.i18n.localize('SWADE.Mod')}`;
                targetProperty = 'parry.modifier';
                break;
            case 'armor':
                targetLabel = `${game.i18n.localize('SWADE.Armor')}`;
                targetProperty = 'toughness.armor';
                break;
            case 'toughness':
                targetLabel = `${game.i18n.localize('SWADE.Tough')} ${game.i18n.localize('SWADE.Mod')}`;
                targetProperty = 'toughness.modifier';
                break;
            default:
                targetLabel = `${game.i18n.localize('SWADE.Tough')} ${game.i18n.localize('SWADE.Mod')}`;
                targetProperty = 'toughness.value';
                break;
        }
        const targetPropertyPath = `data.stats.${targetProperty}`;
        const targetPropertyValue = getProperty(this.actor.data, targetPropertyPath);
        const title = `${game.i18n.localize('SWADE.Ed')} ${this.actor.name} ${targetLabel}`;
        const template = `
      <form><div class="form-group">
        <label>${game.i18n.localize('SWADE.Ed')} ${targetLabel}</label>
        <input name="modifier" value="${targetPropertyValue}" type="text"/>
      </div></form>`;
        new Dialog({
            title: title,
            content: template,
            buttons: {
                set: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize('SWADE.Ok'),
                    callback: (html) => {
                        const mod = html.find('input[name="modifier"]').val();
                        const newData = {};
                        newData[targetPropertyPath] = parseInt(mod);
                        this.actor.update(newData);
                    },
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize('SWADE.Cancel'),
                },
            },
            default: 'set',
        }).render(true);
    }
    _calcInventoryWeight(items) {
        let retVal = 0;
        items.forEach((i) => {
            retVal += i.data.weight * i.data.quantity;
        });
        return retVal;
    }
    _filterPowers(html, arcane) {
        this.options['activeArcane'] = arcane;
        // Show, hide powers
        html.find('.power').each((id, pow) => {
            if (pow.dataset.arcane == arcane || arcane == 'All') {
                pow.classList.add('active');
            }
            else {
                pow.classList.remove('active');
            }
        });
        // Show, Hide powerpoints
        html.find('.power-counter').each((id, ct) => {
            if (ct.dataset.arcane == arcane) {
                ct.classList.add('active');
            }
            else {
                ct.classList.remove('active');
            }
        });
    }
}
