import SwadeActor from "../documents/actor/SwadeActor.js";
import SwadeItem from "../documents/item/SwadeItem.js";
export default class SwadeEntityTweaks extends FormApplication {
    constructor(object, options = {}) {
        super(object, options);
    }
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = 'sheet-tweaks';
        options.width = 380;
        return options;
    }
    /* -------------------------------------------- */
    /**
     * Add the Entity name into the window title
     * @type {String}
     */
    get title() {
        return `${this.object.name}: SWADE Tweaks`;
    }
    /**
     * @override
     */
    get template() {
        return 'systems/swade/templates/actors/dialogs/tweaks-dialog.hbs';
    }
    /* -------------------------------------------- */
    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @return {Object}
     */
    getData() {
        const data = this.object.data;
        const settingFields = this._getAppropriateSettingFields();
        for (const key of Object.keys(settingFields)) {
            const fieldExists = getProperty(this.object.data, `data.additionalStats.${key}`);
            if (fieldExists) {
                settingFields[key]['useField'] = true;
            }
        }
        data['autoCalc'] = {
            toughness: getProperty(this.object, 'data.data.details.autoCalcToughness'),
            armor: getProperty(this.object, 'data.data.details.autoCalcArmor'),
        };
        data['settingFields'] = settingFields;
        data['isActor'] = this._isActor();
        data['isCharacter'] = this.object.data.type === 'character';
        data['isNPC'] = this.object.data.type === 'npc';
        data['isVehicle'] = this.object.data.type === 'vehicle';
        return data;
    }
    /* -------------------------------------------- */
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
    }
    /**
     * This method is called upon form submission after form data is validated
     * @param event {Event}       The initial triggering submission event
     * @param formData {Object}   The object of validated form data with which to update the object
     * @private
     */
    async _updateObject(event, formData) {
        event.preventDefault();
        const expandedFormData = expandObject(formData);
        //recombine the formdata
        setProperty(expandedFormData, 'data.additionalStats', this._handleAdditionalStats(expandedFormData));
        // Update the actor
        await this.object.update(expandedFormData);
        //TODO check if even necessary
        this.object.sheet.render(true);
    }
    _getAppropriateSettingFields() {
        const fields = game.settings.get('swade', 'settingFields');
        let settingFields = {};
        if (this.object instanceof SwadeActor) {
            settingFields = fields.actor;
        }
        else if (this.object instanceof SwadeItem) {
            settingFields = fields.item;
        }
        return settingFields;
    }
    _handleAdditionalStats(expandedFormData) {
        const formFields = getProperty(expandedFormData, 'data.additionalStats') || {};
        const prototypeFields = this._getAppropriateSettingFields();
        const newFields = deepClone(getProperty(this.object.data, 'data.additionalStats'));
        //handle setting specific fields
        const entries = Object.entries(formFields);
        for (const [key, value] of entries) {
            const fieldExistsOnEntity = getProperty(this.object.data, `data.additionalStats.${key}`);
            if (value['useField'] && !!fieldExistsOnEntity) {
                //update exisiting field;
                newFields[key]['hasMaxValue'] = prototypeFields[key]['hasMaxValue'];
                newFields[key]['dtype'] = prototypeFields[key]['dtype'];
                if (newFields[key]['dtype'] === 'Boolean') {
                    newFields[key]['-=max'] = null;
                }
            }
            else if (value['useField'] && !fieldExistsOnEntity) {
                //add new field
                newFields[key] = prototypeFields[key];
            }
            else {
                //delete field
                newFields[`-=${key}`] = null;
            }
        }
        //handle "stray" fields that exist on the actor but have no prototype
        for (const key of Object.keys(getProperty(this.object.data, 'data.additionalStats'))) {
            if (!prototypeFields[key]) {
                newFields[`-=${key}`] = null;
            }
        }
        return newFields;
    }
    _isActor() {
        return this.object.documentName === 'Actor';
    }
    /** @override */
    _getSubmitData(updateData = {}) {
        const data = super._getSubmitData(updateData);
        // Prevent submitting overridden values
        const overrides = foundry.utils.flattenObject(this.object.overrides);
        for (const k of Object.keys(overrides)) {
            delete data[k];
        }
        return data;
    }
}
