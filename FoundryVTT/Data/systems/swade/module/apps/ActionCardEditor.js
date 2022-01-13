import { SWADE } from "../config.js";
export default class ActionCardEditor extends FormApplication {
    constructor(cards, pack, options = {}) {
        super({}, options);
        this.pack = pack;
        this.cards = new Map(cards.map((v) => [v.id, v]));
    }
    static async fromPack(compendium) {
        const cards = await compendium.getDocuments();
        return new this(cards, compendium);
    }
    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            id: SWADE.actionCardEditor.id,
            title: game.i18n.localize('SWADE.ActionCardEditor'),
            template: 'systems/swade/templates/apps/action-card-editor.hbs',
            classes: ['swade', 'action-card-editor'],
            scrollY: ['.card-list'],
            width: 600,
            height: 'auto',
            closeOnSubmit: false,
            submitOnClose: false,
        };
    }
    async getData() {
        const data = {
            deckName: this.pack.metadata.label,
            cards: Array.from(this.cards.values()).sort(this._sortCards),
        };
        return data;
    }
    activateListeners(html) {
        super.activateListeners(html);
        html.find('.card-face').on('click', (ev) => this._showCard(ev));
        html.find('.add-card').on('click', async () => this._createNewCard());
    }
    async _updateObject(event, formData = {}) {
        const data = expandObject(formData);
        const cards = Object.entries(data.card);
        for (const [id, value] of cards) {
            await this.cards.get(id)?.update({
                name: value.name,
                img: value.img,
                'flags.swade': {
                    cardValue: value.cardValue,
                    suitValue: value.suitValue,
                    isJoker: value.suitValue === 99,
                },
            });
        }
        this.render(true);
    }
    _sortCards(a, b) {
        const suitA = a.getFlag('swade', 'suitValue');
        const suitB = b.getFlag('swade', 'suitValue');
        const suit = suitB - suitA;
        if (suit !== 0)
            return suit;
        const cardA = a.getFlag('swade', 'cardValue');
        const cardB = b.getFlag('swade', 'cardValue');
        const card = cardB - cardA;
        return card;
    }
    _showCard(event) {
        const id = event.currentTarget.dataset.id;
        new ImagePopout(this.cards.get(id)?.data.img, {
            shareable: true,
        }).render(true);
    }
    async _createNewCard() {
        const newCard = await JournalEntry.create({
            name: 'New Card',
            img: 'systems/swade/assets/ui/ace-white.svg',
            'flags.swade': { cardValue: 0, suitValue: 0, isJoker: false },
        }, { pack: this.pack.collection });
        if (newCard) {
            this.cards.set(newCard.id, newCard);
            this.render(true, { scroll: true });
        }
    }
    render(force, options) {
        super.render(force, options);
    }
    async _render(force, options = {}) {
        await super._render(force, options);
        if (options.scroll) {
            document
                .querySelector(`#${SWADE.actionCardEditor.id} .card-list`)
                ?.scrollIntoView(false);
        }
    }
}
