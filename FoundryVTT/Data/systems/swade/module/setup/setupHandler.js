import { SWADE } from "../config.js";
import { createActionCardTable } from "../util.js";
export class SwadeSetup {
    static async setup() {
        if (!game.tables?.getName(SWADE.init.cardTable)) {
            await createActionCardTable(false, SWADE.init.defaultCardCompendium);
            ui.notifications?.info('First-Time-Setup complete');
        }
    }
}
