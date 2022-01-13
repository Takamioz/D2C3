export default class RollDialog extends FormApplication {
    constructor(ctx, resolve, options) {
        super(ctx, options);
        this.isResolved = false;
        this.extraButtonUsed = false;
        this.resolve = resolve;
        this.render(true);
    }
    static asPromise(ctx) {
        return new Promise((resolve) => new RollDialog(ctx, resolve));
    }
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: 'systems/swade/templates/apps/rollDialog.hbs',
            classes: ['swade', 'roll-dialog'],
            width: 400,
            height: 'auto',
            closeOnSubmit: true,
            submitOnClose: false,
            submitOnChange: false,
        });
    }
    get ctx() {
        return this.object;
    }
    get title() {
        return this.ctx.title ?? 'SWADE Rolldialog';
    }
    get rollMode() {
        const select = this.form?.querySelector('#rollMode');
        return (select?.value ??
            game.settings.get('core', 'rollMode'));
    }
    activateListeners(html) {
        super.activateListeners(html);
        $(document).on('keydown.chooseDefault', this._onKeyDown.bind(this));
        html.find('button#close').on('click', this.close.bind(this));
        html.find('button[type="submit"]').on('click', (ev) => {
            this.extraButtonUsed = ev.currentTarget.dataset.type === 'extra';
            this.submit();
        });
        html.find('input[type="checkbox"]').on('change', (ev) => {
            const target = ev.currentTarget;
            const index = Number(target.dataset.index);
            this.ctx.mods[index].ignore = target.checked;
            this.render();
        });
        html.find('button.add-modifier').on('click', () => {
            const label = html.find('.new-modifier-label').val();
            const value = html.find('.new-modifier-value').val();
            if (!!label && !!value) {
                const sanitized = this._sanitizeModifierInput(value);
                this.ctx.mods.push({ label, value: sanitized });
                this.render();
            }
        });
    }
    getData() {
        const data = {
            formula: this._buildRollForEvaluation().formula,
            rollMode: game.settings.get('core', 'rollMode'),
            rollModes: CONFIG.Dice.rollModes,
            displayExtraButton: true,
            extraButtonLabel: '',
            modifiers: this.ctx.mods.map(this._normalizeModValue),
        };
        if (this.ctx.item) {
            data.extraButtonLabel = game.i18n.localize('SWADE.RollRaise');
        }
        else if (this.ctx.actor &&
            !this.ctx.actor.isWildcard &&
            this.ctx.allowGroup) {
            data.extraButtonLabel = game.i18n.localize('SWADE.GroupRoll');
        }
        else {
            data.displayExtraButton = false;
        }
        return data;
    }
    async _updateObject(ev, formData) {
        const expanded = foundry.utils.expandObject(formData);
        Object.values(expanded.modifiers ?? []).forEach((v, i) => (this.ctx.mods[i].ignore = v.ignore));
        const roll = await this._evaluateRoll();
        this._resolve(roll);
    }
    _onKeyDown(event) {
        // Close dialog
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            return this.close();
        }
        // Confirm default choice
        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            return this.submit();
        }
    }
    _resolve(roll) {
        this.isResolved = true;
        this.resolve(roll);
        this.close();
    }
    async _evaluateRoll() {
        //Raise Damage
        if (this.extraButtonUsed && this.ctx.item && !this.ctx.actor) {
            this.ctx.mods.push({
                label: game.i18n.localize('SWADE.BonusDamage'),
                value: '+1d6x',
            });
        }
        const roll = this._buildRollForEvaluation();
        const terms = roll.terms;
        let flavor = this.ctx.flavor;
        //Add the Wild Die for a group roll of
        if (this.extraButtonUsed &&
            this.ctx.allowGroup &&
            this.ctx.actor &&
            !this.ctx.actor.isWildcard) {
            const traitPool = terms[0];
            if (traitPool instanceof PoolTerm) {
                const wildDie = new Die({
                    faces: 6,
                    modifiers: ['x'],
                    options: { flavor: game.i18n.localize('SWADE.WildDie') },
                });
                const wildRoll = Roll.fromTerms([wildDie]);
                traitPool.rolls.push(wildRoll);
                traitPool.terms.push(wildRoll.formula);
                flavor += `<br>${game.i18n.localize('SWADE.GroupRoll')}`;
            }
        }
        this._markWilDie(terms);
        //recreate the roll
        const finalizedRoll = Roll.fromTerms(terms, roll.options);
        //evaluate
        await finalizedRoll.evaluate({ async: true });
        // Convert the roll to a chat message and return it
        await finalizedRoll.toMessage({
            flavor: flavor + this._buildModifierFlavor(),
            speaker: this.ctx.speaker,
            flags: this.ctx.flags ?? {},
        }, { rollMode: this.rollMode });
        return finalizedRoll;
    }
    _buildRollForEvaluation() {
        return Roll.fromTerms([
            ...this.ctx.roll.terms,
            ...Roll.parse(this.ctx.mods
                .filter((v) => !v.ignore) //remove the disabled modifiers
                .map(this._normalizeModValue)
                .reduce((a, c) => {
                return (a += `${c.value}[${c.label}]`);
            }, ''), this._getRollData()),
        ]);
    }
    /**
     * This is a workaround to add the DSN Wild Die until the bug which resets the options object is resolved
     * @param terms Array of roll terms
     */
    _markWilDie(terms) {
        if (!game.dice3d)
            return;
        for (const term of terms) {
            if (term instanceof PoolTerm) {
                for (const roll of term.rolls) {
                    for (const term of roll.terms) {
                        if (term instanceof Die &&
                            term.flavor === game.i18n.localize('SWADE.WildDie')) {
                            const colorPreset = game.user?.getFlag('swade', 'dsnWildDie') ?? 'none';
                            if (colorPreset !== 'none') {
                                term.options['colorset'] = colorPreset;
                            }
                        }
                    }
                }
            }
        }
    }
    /** add a + if no +/- is present in the situational mod */
    _sanitizeModifierInput(modifier) {
        if (!modifier[0].match(/[+-]/))
            return '+' + modifier;
        return modifier;
    }
    _buildModifierFlavor() {
        return this.ctx.mods
            .filter((v) => !v.ignore) //remove the disabled modifiers
            .reduce((acc, cur) => {
            return (acc += `<br>${cur.label}: ${cur.value}`);
        }, '');
    }
    _getRollData() {
        if (this.ctx.actor)
            return this.ctx.actor.getRollData();
        return this.ctx.item?.actor?.getRollData() ?? {};
    }
    /** Normalize a given modifier value to a string for display and evaluation */
    _normalizeModValue(mod) {
        let normalizedValue;
        if (typeof mod.value === 'string') {
            normalizedValue = mod.value === '' ? '+0' : mod.value;
        }
        else if (typeof mod.value === 'number') {
            normalizedValue = mod.value.signedString();
        }
        else {
            throw new Error('Invalid modifier value ' + mod.value);
        }
        return {
            value: normalizedValue,
            label: mod.label,
            ignore: mod.ignore,
        };
    }
    /** @override */
    close(options) {
        //fallback if the roll has not yet been resolved
        if (!this.isResolved)
            this.resolve(null);
        $(document).off('keydown.chooseDefault');
        return super.close(options);
    }
}
