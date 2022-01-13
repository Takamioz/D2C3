import { SWADE } from "../config.js";
import SwadeBaseActorSheet from "./SwadeBaseActorSheet.js";
/**
 * @noInheritDoc
 */
export default class SwadeVehicleSheet extends SwadeBaseActorSheet {
    /**
     * Extend and override the default options used by the Actor Sheet
     * @returns {Object}
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['swade', 'sheet', 'actor', 'vehicle'],
            width: 600,
            height: 540,
            tabs: [
                {
                    navSelector: '.tabs',
                    contentSelector: '.sheet-body',
                    initial: 'summary',
                },
            ],
        });
    }
    get template() {
        // Later you might want to return a different template
        // based on user permissions.
        return 'systems/swade/templates/actors/vehicle-sheet.hbs';
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
            html.find('li.item.weapon').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
        }
        //Toggle Equipmnent Card collapsible
        html.find('.gear-card .card-header .item-name').on('click', (ev) => {
            const card = $(ev.currentTarget).parents('.gear-card');
            const content = card.find('.card-content');
            content.toggleClass('collapsed');
            if (content.hasClass('collapsed')) {
                content.slideUp();
            }
            else {
                content.slideDown();
            }
        });
        // Delete Item
        html.find('.item-delete').on('click', async (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const ownedItem = this.actor.items.get(li.data('itemId'));
            const template = `
          <form>
            <div>
              <center>${game.i18n.localize('SWADE.Del')} 
                <strong>${ownedItem?.name}</strong>?
              </center>
              <br>
            </div>
          </form>`;
            await Dialog.confirm({
                title: game.i18n.localize('SWADE.Del'),
                content: template,
                render: () => { },
                yes: async () => {
                    await ownedItem?.delete();
                    li.slideUp(200, () => this.render(false));
                },
                no: () => { },
            });
        });
        // Add new object
        html.find('.item-create').on('click', async (event) => {
            event.preventDefault();
            const header = event.currentTarget;
            const type = header.dataset.type ?? '';
            let modData;
            let weaponData;
            switch (type) {
                case 'choice':
                    this._chooseItemType().then(async (dialogInput) => {
                        const itemData = this._createItemData(dialogInput.type, header, dialogInput.name);
                        await Item.create(itemData, {
                            renderSheet: true,
                            parent: this.actor,
                        });
                    });
                    break;
                case 'mod':
                    modData = this._createItemData('gear', header);
                    modData.data.isVehicular = true;
                    modData.data.equipped = true;
                    modData.name = `New ${type.capitalize()}`;
                    await Item.create(modData, {
                        renderSheet: true,
                        parent: this.actor,
                    });
                    break;
                case 'vehicle-weapon':
                    weaponData = this._createItemData('weapon', header);
                    weaponData.data.isVehicular = true;
                    weaponData.data.equipped = true;
                    await Item.create(weaponData, {
                        renderSheet: true,
                        parent: this.actor,
                    });
                    break;
                default:
                    await Item.create(this._createItemData(type, header), {
                        renderSheet: true,
                        parent: this.actor,
                    });
                    break;
            }
        });
        //Reset the Driver
        html.find('.reset-driver').on('click', async () => {
            await this._resetDriver();
        });
        // Open driver sheet
        html.find('.driver-img').on('click', async () => {
            await this._openDriverSheet();
        });
        //Maneuver Check
        html
            .find('#maneuverCheck')
            .on('click', () => this.actor.rollManeuverCheck());
    }
    /**
     * @override
     */
    async getData() {
        const data = super.getData();
        data.config = SWADE;
        data.itemsByType = {};
        data.opSkills = this._buildOpSkillList();
        for (const item of data.items) {
            let list = data.itemsByType[item.type];
            if (!list) {
                list = [];
                data.itemsByType[item.type] = list;
            }
            list.push(item);
        }
        //Prepare inventory
        data.inventory = this._determineCargo().sort((a, b) => a.name.localeCompare(b.name) ?? 0);
        data.inventoryWeight = 0;
        data.inventory.forEach((i) => {
            data.inventoryWeight += i.data.data['weight'] * i.data.data['quantity'];
        });
        //Fetch Driver data
        data.driver = await this._fetchDriver();
        // Check for enabled optional rules
        data.settingrules = {
            vehicleEdges: game.settings.get('swade', 'vehicleEdges'),
            modSlots: game.settings.get('swade', 'vehicleMods'),
        };
        if (data.settingrules.modSlots) {
            const modsUsed = this._calcModSlotsUsed();
            data.mods = {
                used: modsUsed,
                percentage: this._calcModsPercentage(modsUsed),
            };
        }
        return data;
    }
    /**
     * Determines the cargo inventory of the vehicle, sorting out all the non-vehicular items
     * @param itemsByType an object with the items filtered by type
     */
    _determineCargo() {
        return [
            ...this.actor.itemTypes.gear.filter((i) => i.data.type === 'gear' &&
                (!i.data.data.isVehicular || !i.data.data.equipped)),
            ...this.actor.itemTypes.weapon.filter((i) => i.data.type === 'weapon' &&
                (!i.data.data.isVehicular || !i.data.data.equipped)),
            ...this.actor.itemTypes.armor,
            ...this.actor.itemTypes.shield,
        ];
    }
    async setDriver(id) {
        const driver = game.actors?.get(id);
        if (driver && driver.data.type !== 'vehicle') {
            await this.actor.update({ 'data.driver.id': id });
        }
    }
    async _fetchDriver() {
        if (this.actor.data.type !== 'vehicle')
            return null;
        const driverId = this.actor.data.data.driver.id;
        const driver = await this.actor.getDriver();
        const userCanViewDriver = game.user?.isGM ||
            (driver && driver.permission >= CONST.DOCUMENT_PERMISSION_LEVELS.LIMITED);
        const driverData = {
            img: 'icons/svg/mystery-man-black.svg',
            name: 'No Driver',
            userCanSeeDriver: userCanViewDriver,
        };
        //Return if the vehicle has no driver
        if (!driverId || !driver) {
            return driverData;
        }
        //Display the Driver data if the current user has at least Limited permission on the driver Actor
        if (userCanViewDriver) {
            driverData.img = driver.img;
            driverData.name = driver.name;
        }
        else {
            //else just show an aunknown driver
            driverData.name = 'Unkown Driver';
        }
        return driverData;
    }
    async _resetDriver() {
        await this.actor.update({ 'data.driver.id': null });
    }
    async _openDriverSheet() {
        const driverId = getProperty(this.actor.data, 'data.driver.id');
        const driver = (await fromUuid(driverId));
        if (driver) {
            driver.sheet?.render(true);
        }
    }
    // item creation helper func
    _createItemData(type, header, name) {
        const itemData = {
            name: name ? name : `New ${type.capitalize()}`,
            type: type,
            img: `systems/swade/assets/icons/${type}.svg`,
            data: deepClone(header.dataset),
        };
        delete itemData.data['type'];
        return itemData;
    }
    /**
     * calculate how many modslots are used
     */
    _calcModSlotsUsed() {
        const mods = this.actor.items.filter((i) => (i.data.type === 'gear' || i.data.type === 'weapon') &&
            i.data.data.isVehicular &&
            i.data.data.equipped);
        let retVal = 0;
        for (const m of mods) {
            if (m.data.type !== 'weapon' && m.data.type !== 'gear')
                continue;
            const slots = m.data.data.mods ?? 0;
            const quantity = m.data.data.quantity ?? 0;
            retVal += slots * quantity;
        }
        return retVal;
    }
    /**
     * calculate how many percent of modslots are used
     * @param modsUsed number of active modslots
     */
    _calcModsPercentage(modsUsed) {
        if (this.actor.data.type !== 'vehicle')
            return;
        const maxMods = this.actor.data.data.maxMods;
        let p = (modsUsed / maxMods) * 100;
        //cap the percentage at 100
        if (p > 100) {
            p = 100;
        }
        return p;
    }
    _buildOpSkillList() {
        const opSkills = SWADE.vehicles.opSkills;
        return opSkills.reduce((acc, cur) => {
            acc[cur] = cur;
            return acc;
        }, {});
    }
}
