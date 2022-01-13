import { SWADE } from "./config.js";
export default class Bennies {
    static async spendEvent(ev) {
        ev.preventDefault();
        const userId = ev.target.parentElement.dataset.userId;
        const user = game.users.get(userId, { strict: true });
        await user.spendBenny();
    }
    /**
     * Refresh the bennies of a character
     * @param user the User the character belongs to
     * @param displayToChat display a message to chat
     *
     */
    static async refreshAll() {
        for (const user of game.users.values()) {
            user.refreshBennies(false);
        }
        const npcWildcardsToRefresh = game.actors.filter((a) => !a.hasPlayerOwner && a.data.type === 'npc' && a.isWildcard);
        if (game.settings.get('swade', 'hardChoices')) {
            for await (const actor of npcWildcardsToRefresh) {
                actor.update({ 'data.bennies.value': 0 });
            }
        }
        else {
            for await (const actor of npcWildcardsToRefresh) {
                actor.refreshBennies(false);
            }
        }
        if (game.settings.get('swade', 'notifyBennies')) {
            const message = await renderTemplate(SWADE.bennies.templates.refreshAll, {});
            ChatMessage.create({
                content: message,
            });
        }
    }
    static async giveEvent(ev) {
        ev.preventDefault();
        const userId = ev.target.parentElement.dataset.userId;
        const user = game.users.get(userId, { strict: true });
        await user.getBenny();
        ui.players?.render(true);
    }
    static updateBenny(ev) {
        const userId = ev.target.parentElement.dataset.userId;
        const user = game.users.get(userId, { strict: true });
        ev.target.innerHTML = user.bennies.toString();
    }
    static append(player, options) {
        const user = options.users.find((user) => user.id == player.dataset.userId);
        const span = document.createElement('span');
        span.classList.add('bennies-count');
        // Player view
        if (!game.user.isGM) {
            if (user.isGM) {
                span.innerHTML = user.getFlag('swade', 'bennies');
            }
            else if (user.character) {
                span.onmouseleave = Bennies.updateBenny;
                span.onclick = this.spendEvent;
                span.onmouseover = () => {
                    span.innerHTML = '-';
                };
                span.title = game.i18n.localize('SWADE.BenniesSpend');
                span.innerHTML = user.character.data.data.bennies.value;
            }
            else {
                return;
            }
            player.append(span);
            return;
        }
        // GM interactive interface
        span.classList.add('bennies-gm');
        span.onmouseleave = Bennies.updateBenny;
        span.onclick = user.isGM ? this.spendEvent : this.giveEvent;
        span.onmouseover = () => {
            span.innerHTML = user.isGM ? '-' : '+';
        };
        span.title = user.isGM
            ? game.i18n.localize('SWADE.BenniesSpend')
            : game.i18n.localize('SWADE.BenniesGive');
        // Manage GM Bennies
        if (user.isGM) {
            const bennies = user.getFlag('swade', 'bennies');
            // Set bennies to number as defined in GM benny setting
            if (bennies == null) {
                const gmBennies = game.settings.get('swade', 'gmBennies');
                user.setFlag('swade', 'bennies', gmBennies).then(() => {
                    span.innerHTML = gmBennies.toString();
                    player.append(span);
                });
            }
            else {
                span.innerHTML = user.getFlag('swade', 'bennies');
                player.append(span);
            }
        }
        else if (user.character) {
            span.innerHTML = user.character.data.data.bennies.value;
            player.append(span);
        }
    }
}
