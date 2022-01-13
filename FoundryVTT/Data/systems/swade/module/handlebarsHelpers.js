import { SWADE } from "./config.js";
export const registerCustomHelpers = function () {
    Handlebars.registerHelper('add', function (a, b) {
        const result = parseInt(a) + parseInt(b);
        return result.signedString();
    });
    Handlebars.registerHelper('signedString', function (number) {
        const result = parseInt(number);
        if (isNaN(result))
            return '';
        return result.signedString();
    });
    Handlebars.registerHelper('times', function (a, b) {
        return a * b;
    });
    Handlebars.registerHelper('formatNumber', function (number) {
        return Math.round((number + Number.EPSILON) * 1000) / 1000;
    });
    Handlebars.registerHelper('isEmpty', (element) => {
        if (typeof element === undefined)
            return true;
        if (Array.isArray(element) && element.length)
            return false;
        if (element === '')
            return true;
    });
    // Sheet
    Handlebars.registerHelper('localizeSkillAttribute', (attribute, useShorthand = false) => {
        if (!attribute)
            return '';
        return game.i18n.localize(useShorthand ? SWADE.attributes[attribute].short : SWADE.attributes[attribute].long);
    });
    Handlebars.registerHelper('modifier', (str) => {
        str = str === '' || str === null ? '0' : str;
        const value = typeof str == 'string' ? parseInt(str) : str;
        return value == 0 ? '' : value > 0 ? ` + ${value}` : ` - ${-value}`;
    });
    Handlebars.registerHelper('enrich', (content) => {
        return new Handlebars.SafeString(TextEditor.enrichHTML(content));
    });
    Handlebars.registerHelper('canBeEquipped', (item) => {
        return item.data.data['equippable'] || item.data.data['isVehicular'];
    });
    Handlebars.registerHelper('disabled', (value) => {
        return value ? 'disabled' : '';
    });
    Handlebars.registerHelper('displayEmbedded', (array = []) => {
        const collection = new Map(array);
        const entities = [];
        collection.forEach((val, key) => {
            const type = val.type === 'ability'
                ? game.i18n.localize('SWADE.SpecialAbility')
                : game.i18n.localize(`ITEM.Type${val.type.capitalize()}`);
            let majorMinor = '';
            if (val.type === 'hindrance') {
                if (val.data.major) {
                    majorMinor = game.i18n.localize('SWADE.Major');
                }
                else {
                    majorMinor = game.i18n.localize('SWADE.Minor');
                }
            }
            entities.push(`<li class="flexrow">
          <img src="${val.img}" alt="${type}" class="effect-icon" />
          <span class="effect-label">${type} - ${val.name} ${majorMinor}</span>
          <span class="effect-controls">
            <a class="effect-action delete-embedded" data-Id="${key}">
              <i class="fas fa-trash"></i>
            </a>
          </span>
        </li>`);
        });
        return `<ul class="effects-list">${entities.join('\n')}</ul>`;
    });
    Handlebars.registerHelper('capitalize', (str) => {
        if (typeof str !== 'string')
            return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    });
    Handlebars.registerHelper('isOnHold', (id) => {
        const c = game.combat?.combatants.get(id);
        return c.roundHeld;
    });
    Handlebars.registerHelper('isNotOnHold', (id) => {
        const c = game.combat?.combatants.get(id);
        if (!c.roundHeld) {
            return true;
        }
        else {
            return false;
        }
    });
    Handlebars.registerHelper('turnLost', (id) => {
        const c = game.combat?.combatants.get(id);
        return c.turnLost;
    });
    Handlebars.registerHelper('isGroupLeader', (id) => {
        const c = game.combat?.combatants.get(id);
        return c.isGroupLeader;
    });
    Handlebars.registerHelper('isInGroup', (id) => {
        const c = game.combat?.combatants.get(id);
        return c.groupId;
    });
    Handlebars.registerHelper('roundHeld', (id) => {
        const c = game.combat?.combatants.get(id);
        return c.roundHeld;
    });
    Handlebars.registerHelper('leaderColor', (id) => {
        const c = game.combat?.combatants.get(id);
        const leaderId = c.groupId;
        const leader = game.combat?.combatants.get(leaderId);
        const groupColor = hasProperty(leader, 'data.flags.swade.groupColor');
        if (groupColor) {
            return leader.getFlag('swade', 'groupColor');
        }
        else {
            if (leader?.players?.length) {
                return leader.players[0].data.color;
            }
            else {
                return game.users?.find((u) => u.isGM)?.data.color;
            }
        }
    });
    Handlebars.registerHelper('groupColor', (id) => {
        const c = game.combat?.combatants.get(id);
        const groupColor = c.getFlag('swade', 'groupColor');
        if (groupColor) {
            return groupColor;
        }
        else {
            if (c?.players?.length) {
                return c.players[0].data.color;
            }
            else {
                const gm = game.users?.find((u) => u.isGM);
                return gm.data.color;
            }
        }
    });
};
