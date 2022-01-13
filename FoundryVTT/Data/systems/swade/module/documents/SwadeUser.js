import { createGmBennyAddMessage } from "../chat.js";
import { shouldShowBennyAnimation } from "../util.js";
export default class SwadeUser extends User {
    get bennies() {
        if (this.isGM) {
            return this.getFlag('swade', 'bennies') ?? 0;
        }
        else if (this.character) {
            return this.character.bennies;
        }
        return 0;
    }
    async spendBenny() {
        if (this.isGM) {
            if (this.bennies === 0)
                return;
            const message = await renderTemplate(CONFIG.SWADE.bennies.templates.spend, {
                target: game.user,
                speaker: game.user,
            });
            const chatData = {
                content: message,
            };
            if (game.settings.get('swade', 'notifyBennies')) {
                ChatMessage.create(chatData);
            }
            await this.setFlag('swade', 'bennies', this.bennies - 1);
            const dsnShowBennyAnimation = await shouldShowBennyAnimation();
            if (!!game.dice3d && dsnShowBennyAnimation) {
                game.dice3d.showForRoll(await new Roll('1dB').evaluate({ async: true }), game.user, true, null, false);
            }
        }
        else if (this.character) {
            await this.character.spendBenny();
        }
    }
    async getBenny() {
        if (this.isGM) {
            await this.setFlag('swade', 'bennies', this.bennies + 1);
            createGmBennyAddMessage(this);
        }
        else if (this.character) {
            await this.character.getBenny();
        }
    }
    async refreshBennies(displayToChat = true) {
        if (this.isGM) {
            const gmBennies = game.settings.get('swade', 'gmBennies');
            await this.setFlag('swade', 'bennies', gmBennies);
            ui.players?.render(true);
        }
        else if (this.character) {
            await this.character.refreshBennies(displayToChat);
        }
    }
}
