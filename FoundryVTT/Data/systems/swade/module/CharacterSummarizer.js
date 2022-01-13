/**
 * Produce short, plaintext summaries of the most important aspects of an Actor's character sheet.
 */
export default class CharacterSummarizer {
    constructor(actor) {
        this.actor = actor;
        if (!CharacterSummarizer.isSupportedActorType(actor)) {
            ui.notifications?.error(`Can't do character summariser against actor of type ${actor.type}`);
            this.summary = '';
            return;
        }
        this.summary = this._makeSummary();
    }
    static isSupportedActorType(char) {
        return char.type === 'character' || char.type === 'npc';
    }
    static summarizeCharacters(chars) {
        for (const char of chars) {
            const s = new game.swade.CharacterSummarizer(char);
            CharacterSummarizer._showDialog(s);
        }
    }
    static _showDialog(summarizer) {
        if (summarizer.getSummary() === '')
            return;
        const d = new Dialog({
            title: game.i18n.localize('SWADE.CharacterSummary'),
            content: summarizer.getSummary(),
            buttons: {
                close: {
                    label: game.i18n.localize('SWADE.Ok'),
                },
                copyHtml: {
                    label: game.i18n.localize('SWADE.CopyHtml'),
                    callback: () => {
                        summarizer.copySummaryHtml();
                    },
                },
                copyMarkdown: {
                    label: game.i18n.localize('SWADE.CopyMarkdown'),
                    callback: () => {
                        summarizer.copySummaryMarkdown();
                    },
                },
            },
            default: 'close',
        });
        d.render(true);
    }
    // Util method for calling this code from macros
    getSummary() {
        return this.summary;
    }
    copySummaryHtml() {
        this._copyToClipboard(this.summary);
    }
    copySummaryMarkdown() {
        // as the HTML is so simple here, just going to convert
        // it inline.
        const markdownSummary = this.summary
            .replace(/<\/?p>/g, '\n')
            .replace(/<br\/?>/g, '\n')
            .replace(/<\/?strong>/g, '*')
            .replace(/<h1>/g, '# ')
            .replace(/<\/h1>/g, '\n')
            .replace(/&mdash;/g, '—');
        this._copyToClipboard(markdownSummary);
    }
    // this code taken from https://stackoverflow.com/a/65996386
    _copyToClipboard(textToCopy) {
        // navigator clipboard api needs a secure context (https)
        if (navigator.clipboard && window.isSecureContext) {
            // navigator clipboard api method
            return navigator.clipboard.writeText(textToCopy);
        }
        else {
            // text area method
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            // make the textarea out of viewport
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
    }
    _makeSummary() {
        let summary = `<h1>${this.actor.name}</h1>`;
        // Basic character information block
        summary += '<p><strong>' + game.i18n.localize('SWADE.Race') + '</strong>: ';
        summary += getProperty(this.actor.data, 'data.details.species.name');
        summary +=
            '<br/><strong>' + game.i18n.localize('SWADE.Rank') + '</strong>: ';
        summary += getProperty(this.actor.data, 'data.advances.rank');
        summary += ' (' + getProperty(this.actor.data, 'data.advances.value');
        summary += ' ' + game.i18n.localize('SWADE.Adv');
        summary +=
            ')<br/><strong>' + game.i18n.localize('SWADE.Bennies') + '</strong>: ';
        summary += getProperty(this.actor.data, 'data.bennies.max') + '</p>';
        // Attributes
        const attributes = new Array();
        attributes.push(game.i18n.localize('SWADE.AttrAgiShort') +
            ' ' +
            this._formatDieStat(this.actor, 'data.attributes.agility.die'));
        attributes.push(game.i18n.localize('SWADE.AttrSmaShort') +
            ' ' +
            this._formatDieStat(this.actor, 'data.attributes.smarts.die'));
        attributes.push(game.i18n.localize('SWADE.AttrSprShort') +
            ' ' +
            this._formatDieStat(this.actor, 'data.attributes.spirit.die'));
        attributes.push(game.i18n.localize('SWADE.AttrStrShort') +
            ' ' +
            this._formatDieStat(this.actor, 'data.attributes.strength.die'));
        attributes.push(game.i18n.localize('SWADE.AttrVigShort') +
            ' ' +
            this._formatDieStat(this.actor, 'data.attributes.vigor.die'));
        summary += this._formatList(attributes, game.i18n.localize('SWADE.Attributes'));
        // Speed, pace, toughness
        summary +=
            '<p><strong>' +
                game.i18n.localize('SWADE.Pace') +
                '</strong>: ' +
                getProperty(this.actor.data, 'data.stats.speed.value') +
                ', ';
        summary +=
            '<strong>' +
                game.i18n.localize('SWADE.Parry') +
                '</strong>: ' +
                getProperty(this.actor.data, 'data.stats.parry.value') +
                ', ';
        summary +=
            '<strong>' +
                game.i18n.localize('SWADE.Tough') +
                '</strong>: ' +
                getProperty(this.actor.data, 'data.stats.toughness.value');
        summary +=
            ' (' +
                getProperty(this.actor.data, 'data.stats.toughness.armor') +
                ')</p>';
        // Items - skills, powers, gear, etc
        const skills = new Array();
        const edges = new Array();
        const hindrances = new Array();
        const weaponsAndArmour = new Array();
        const gear = new Array();
        const powers = new Array();
        const abilities = new Array();
        this.actor.items.forEach((item) => {
            let damage, range, ap, rof, armor, shieldParry, shieldCover;
            switch (item.type) {
                case 'skill':
                    skills.push(item.name + ' ' + this._formatDieStat(item, 'data.die'));
                    break;
                case 'edge':
                    edges.push(item.name);
                    break;
                case 'hindrance':
                    hindrances.push(item.name);
                    break;
                case 'weapon':
                    damage = getProperty(item.data, 'data.damage');
                    range = getProperty(item.data, 'data.range');
                    ap = getProperty(item.data, 'data.ap');
                    rof = getProperty(item.data, 'data.rof');
                    weaponsAndArmour.push(`${item.name} (${damage}, ${range}, ` +
                        `${game.i18n.localize('SWADE.Ap')}${ap}, ` +
                        `${game.i18n.localize('SWADE.RoF')}${rof})`);
                    break;
                case 'armor':
                    armor = getProperty(item.data, 'data.armor');
                    weaponsAndArmour.push(`${item.name} (${armor})`);
                    break;
                case 'shield':
                    shieldParry = getProperty(item.data, 'data.parry');
                    shieldCover = getProperty(item.data, 'data.cover');
                    weaponsAndArmour.push(`${item.name} (+${shieldParry} / ${shieldCover})`);
                    break;
                case 'gear':
                    gear.push(item.name);
                    break;
                case 'power':
                    powers.push(item.name);
                    break;
                case 'ability':
                    abilities.push(item.name);
                    break;
                default:
                    ui.notifications?.error(`Item ${item.name} has unknown type ${item.type}`);
            }
        });
        summary += this._formatList(skills, game.i18n.localize('SWADE.Skills'));
        summary += this._formatList(edges, game.i18n.localize('SWADE.Edges'));
        summary += this._formatList(hindrances, game.i18n.localize('SWADE.Hindrances'));
        summary += this._formatList(weaponsAndArmour, game.i18n.localize('SWADE.WeaponsAndArmor'));
        summary += this._formatList(gear, game.i18n.localize('SWADE.Inv'));
        summary += this._formatList(powers, game.i18n.localize('SWADE.Pow'));
        summary += this._formatList(abilities, game.i18n.localize('SWADE.SpecialAbilities'));
        // Additional stats
        const additionalStats = new Array();
        Object.keys(getProperty(this.actor.data, 'data.additionalStats')).forEach((additionalStatKey) => {
            const stat = getProperty(this.actor.data, `data.additionalStats.${additionalStatKey}`);
            switch (stat.dtype) {
                case 'String':
                    additionalStats.push(`${stat.label}: ${stat.value}`);
                    break;
                case 'Number':
                    if (stat.hasMaxValue) {
                        additionalStats.push(`${stat.label}: ${stat.value}/${stat.max}`);
                    }
                    else {
                        additionalStats.push(`${stat.label}: ${stat.value}`);
                    }
                    break;
                case 'Die':
                    additionalStats.push(`${stat.label}: ${stat.value}` +
                        this._formatModifier(stat.modifier));
                    break;
                case 'Boolean':
                    if (stat.value) {
                        additionalStats.push(`${stat.label}: ${game.i18n.localize('SWADE.Yes')}`);
                    }
                    else {
                        additionalStats.push(`${stat.label}: ${game.i18n.localize('SWADE.No')}`);
                    }
                    break;
                default:
                    ui.notifications?.error(`For ${additionalStatKey}, cannot process additionalStat of type ${stat.dtype}`);
            }
        });
        summary += this._formatList(additionalStats, game.i18n.localize('SWADE.AddStats'));
        return summary;
    }
    _formatList(list, name) {
        if (list.length === 0) {
            list.push('&mdash;');
        }
        list.sort();
        let val = `<p><strong>${name}</strong>: `;
        val += list.join(', ');
        val += '</p>';
        return val;
    }
    _formatDieStat(entity, dataKey) {
        const sides = getProperty(entity.data, dataKey + '.sides');
        const modifier = getProperty(entity.data, dataKey + '.modifier');
        const val = `d${sides}` + this._formatModifier(modifier);
        return val;
    }
    _formatModifier(modifier) {
        if (modifier === undefined || modifier === null || modifier === 0) {
            return '';
        }
        if (!!modifier && !String(modifier).match(/^[+-]/)) {
            modifier = '+' + modifier;
        }
        return modifier;
    }
    // This is currently unused but will be used later
    _getSkillAboveAttributeInSteps(skill) {
        const linkedAttributeName = getProperty(skill.data, 'data.attribute');
        if (linkedAttributeName === undefined || linkedAttributeName === '') {
            return 0;
        }
        const sidesDelta = getProperty(skill.data, 'data.die.sides') -
            getProperty(this.actor.data, `data.attributes.${linkedAttributeName}.die.sides`);
        return sidesDelta / 2;
    }
}
