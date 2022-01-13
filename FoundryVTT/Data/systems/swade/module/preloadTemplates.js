export const preloadHandlebarsTemplates = async function () {
    const templatePaths = [
        //Character Sheets
        'systems/swade/templates/actors/npc-sheet.hbs',
        'systems/swade/templates/actors/vehicle-sheet.hbs',
        //NPC partials
        'systems/swade/templates/actors/partials/attributes.hbs',
        'systems/swade/templates/actors/partials/npc-summary-tab.hbs',
        'systems/swade/templates/actors/partials/powers-tab.hbs',
        'systems/swade/templates/setting-fields.hbs',
        'systems/swade/templates/shared-partials/action-card.hbs',
        //Vehicle Partials
        'systems/swade/templates/actors/vehicle-partials/summary-tab.hbs',
        'systems/swade/templates/actors/vehicle-partials/cargo-tab.hbs',
        'systems/swade/templates/actors/vehicle-partials/description-tab.hbs',
        'systems/swade/templates/actors/vehicle-partials/vitals.hbs',
        //Gear Cards
        'systems/swade/templates/actors/partials/weapon-card.hbs',
        'systems/swade/templates/actors/partials/armor-card.hbs',
        'systems/swade/templates/actors/partials/powers-card.hbs',
        'systems/swade/templates/actors/partials/shield-card.hbs',
        'systems/swade/templates/actors/partials/misc-card.hbs',
        //die type list
        'systems/swade/templates/die-sides-options.hbs',
        'systems/swade/templates/attribute-select.hbs',
        // Chat
        'systems/swade/templates/chat/roll-formula.hbs',
        //Items
        'systems/swade/templates/items/partials/header.hbs',
        'systems/swade/templates/items/partials/header-delete.hbs',
        'systems/swade/templates/items/partials/description.hbs',
        'systems/swade/templates/items/partials/actions.hbs',
        'systems/swade/templates/items/partials/powers.hbs',
        'systems/swade/templates/items/partials/ae-header.hbs',
        'systems/swade/templates/effect-list.hbs',
        //official sheet
        //main sheet
        'systems/swade/templates/official/sheet.hbs',
        //tabs
        'systems/swade/templates/official/tabs/summary.hbs',
        'systems/swade/templates/official/tabs/edges.hbs',
        'systems/swade/templates/official/tabs/inventory.hbs',
        'systems/swade/templates/official/tabs/powers.hbs',
        'systems/swade/templates/official/tabs/description.hbs',
        //misc partials
        'systems/swade/templates/official/partials/attributes.hbs',
        'systems/swade/templates/official/partials/item-card.hbs',
        'systems/swade/templates/official/partials/skill-card.hbs',
        'systems/swade/templates/official/partials/setting-fields.hbs',
        //Sidebar
        'systems/swade/templates/sidebar/combat-tracker.hbs',
    ];
    return loadTemplates(templatePaths);
};
