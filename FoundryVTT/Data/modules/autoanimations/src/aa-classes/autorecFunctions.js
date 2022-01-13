import { JB2AFREEDB } from "../animation-functions/databases/jb2a-free-database.js"
import { JB2APATREONDB } from "../animation-functions/databases/jb2a-patreon-database.js"
import { aaColorMenu, aaVariantMenu } from "../animation-functions/databases/jb2a-menu-options.js"
import { autoRecMigration } from "../custom-recognition/autoRecMerge.js"

export class AutorecFunctions {

    /**
     * 
     * @param {game.settings.get('autonanimations', 'aaAutorec')} obj 
     * @param {Menu field to get from} type 
     * @returns all NAMES in lower case from Autorec Menu defined by type
     */
    static _getAllNames(obj, type) {
        const nameArray = []
        try { Object.keys(obj[type]).length }
        catch (exception) { return nameArray }
        const arrayLength = Object.keys(obj[type]).length
        for (var i = 0; i < arrayLength; i++) {
            if (!obj[type][i].name) { continue }

            nameArray.push(obj[type][i].name.toLowerCase())
        }
        return nameArray;
    }
    /*
    static _findObjectByName(data, type, name) {
        const newName = name.toLowerCase()
        var newObject = Object.values(data[type])
            .sort((a, b) => b.name.replace(/\s+/g, '').length - a.name.replace(/\s+/g, '').length)
            .find(section => {
                //cutting out all spaces
                return newName.includes(section.name.replace(/\s+/g, '').toLowerCase()) ? section : "";
            })

        return [newObject]
    }
    */

    /**
     * 
     * @param {game.settings.get('autoanimations', 'aaAutorec')} settings 
     * @param {Item name with all spaces removed} name 
     * @returns Returns TRUE if it is found in the Autorec Menus, otherwise FALSE
     */
    static foundInAutorec(settings, name) {
        const nameList = this._getAllTheNames(settings);//gets ALL names in Autorec sorted longest to shortest
        const isFound = this._autorecNameCheck(nameList, name);//checks autoNameList against current name
        return isFound;
    }

    /**
     * 
     * @param {array of Names from the Automatic Recognition menus, sorted longest to shortest} nameArray 
     * @param {item Name in lower case and no spaces} name 
     * @returns 
     */
    static _autorecNameCheck(nameArray, name) {
        if (!name) { return; }
        const arrayLength = nameArray.length;
        const newName = name.toLowerCase()
        let nameFound = false;
        for (var i = 0; i < arrayLength; i++) {
            //cutting out all spaces
            var currentArrayName = nameArray[i].replace(/\s+/g, '').toLowerCase()
            if (currentArrayName === "") { }
            else if (newName.includes(currentArrayName)) {
                nameFound = true;
                break;
            }
        }
        return nameFound;
    }

    /**
     * 
     * @param {Original item name} oldName 
     * @returns Original name with all spaces removed
     */
    static _rinseName(oldName) {
        if (!oldName) { return; }
        const newName = oldName.replace(/\s+/g, '');
        return newName;
    }

    /**
     * 
     * @param {game.settings.get('autoanimations', 'Autorec')} obj 
     * @returns 
     */
    static _getAllTheNames(obj) {
        const nameArray = []
        const keys = Object.keys(obj)
        const keyLength = keys.length
        for (var i = 0; i < keyLength; i++) {
            var arrayLength = Object.keys(obj[keys[i]]).length
            var currentObject = obj[keys[i]]
            for (var k = 0; k < arrayLength; k++) {
                if (!currentObject[k].name) { continue }

                nameArray.push(currentObject[k].name.toLowerCase())
            }
        }
        nameArray.sort((a, b) => b.length - a.length)
        return nameArray;
    }
    /*
    static _findObjectByNameFull(data, name) {
        const keys = Object.keys(data)
        console.log(keys)
        const keyLength = keys.length
        //let newObject;
        for (var i = 1; i < keyLength; i++) {
            var newObject = Object.values(data[keys[i]])
                //.sort((a, b) => b.name.replace(/\s+/g, '').length - a.name.replace(/\s+/g, '').length)
                .find(section => {
                    //added .replace()
                    return name.toLowerCase().includes(section.name.replace(/\s+/g, '').toLowerCase()) && section.name !== "" ? section : "";
                })

            if (newObject) { return [[newObject], keys[i]] }
        }
    }
    */

    /**
     * 
     * @param {game.settings.get('autoanimations', 'aaAutorec')} settings 
     * @param {item Name with all spaces removed} name 
     * @returns Autorec Object containing all default settings
     */
    static _findObjectFromArray(settings, name) {
        if (!name) { return; }
        const data = this._combineMenus(settings); //combines all Autorec Menus into a single array
        const length = data.length;
        for (var i = 0; i < length; i++) {
            var newObject = Object.values(data)
                .sort((a, b) => b.name.replace(/\s+/g, '').length - a.name.replace(/\s+/g, '').length)
                .find(section => {
                    //added .replace()
                    return name.toLowerCase().includes(section.name.replace(/\s+/g, '').toLowerCase()) && section.name !== "" ? section : "";
                })
            if (newObject) { return newObject }
        }
    }

    /**
     * 
     * @param {game.settings.get('autoanimations', 'aaAutorec')} data 
     * @returns combined menus in a single array sorted by NAME field longest to shortest 
     */
    static _combineMenus(data) {
        const mergedArray = [];
        const keys = Object.keys(data);
        const keyLength = keys.length;
        for (var i = 1; i < keyLength; i++) {
            var arrayLength = Object.keys(data[keys[i]]).length
            var currentObject = data[keys[i]];
            for (var k = 0; k < arrayLength; k++) {
                if (!currentObject[k].name) { break; }
                currentObject[k].menuSection = keys[i]
                mergedArray.push(currentObject[k])
            }
        }
        mergedArray.sort((a, b) => b.name.replace(/\s+/g, '').length - a.name.replace(/\s+/g, '').length)

        return mergedArray;
    }

    static _checkPreset(itemName) {

    }

    static _checkAutoRec(itemName) {
        const autoRecSettings = game.settings.get('autoanimations', 'aaAutorec');
        const autoName = this._rinseName(itemName)
        const nameArray = this._getAllTheNames(autoRecSettings);
        let foundName = false;
        if (this._autorecNameCheck(nameArray, autoName)) {
            foundName = true;
        }
        return foundName;
    }

    /**
     * Exports Automatic Recognition Menu settings
     */
    static _exportAutorecToJSON() {
        const data = (game.settings.get('autoanimations', 'aaAutorec'))
        const filename = `fvtt-autoanimations-autorecognition.json`;
        saveDataToFile(JSON.stringify(data, null, 2), "text/json", filename);
    }
    /**
     * 
     * @param {Imported JSON file from an Export} json 
     */
    static async _importAutorecFromJSON(json) {
        const data = JSON.parse(json);
        console.warn("autoanimations | Import settings ", data);
        await game.settings.set("autoanimations", "aaAutorec", data);
        await autoRecMigration.handle(game.settings.get('autoanimations', 'aaAutorec'))
    }

    static _autoPreview(name, patreon, flags) {

        const data = {};
        data.autoOverriden = flags.autoanimations?.options?.overrideAuto;
        data.autoRecSettings = game.settings.get('autoanimations', 'aaAutorec');
        data.autoName = this._rinseName(name);
        data.autorecSection = this._findObjectFromArray(data.autoRecSettings, data.autoName);
        if (!data.autorecSection) { return; }

        data.autorecObject = data.autorecSection;
        data.autorecType = data.autorecSection.menuSection;
        data.name = data.autorecObject?.animation;
        data.color = data.autoOverriden ? flags.autoanimations?.options?.autoColor : data.autorecObject?.color;
        data.variant = data.autoOverriden ? flags.autoanimations?.options?.autoVariant : data.autorecObject?.variant;
        data.nameArray = this._getAllTheNames(data.autoRecSettings);

        if (data.autorecObject?.custom) {
            return data.autorecObject?.customPath;
        }
        if (data.autorecType === 'preset') { return; }
        if (data.autorecType !== 'melee' && data.autorecType !== 'range') { data.autorecType = 'static' }

        //const autoName = this._rinseName(name);
        if (!data.autoName) { return; }
        if (!this._autorecNameCheck(data.nameArray, data.autoName)) {
            return;
        }

        const jb2a = patreon ? JB2APATREONDB : JB2AFREEDB;

        let file;
        switch (true) {
            case data.autorecType === 'melee':
                try { file = jb2a.melee[data.name][data.variant][data.color][0] }
                catch (exception) { }
                break;
            case data.autorecType === 'range':
                try { file = jb2a[data.autorecType][data.name][data.variant][data.color][Object.keys(jb2a[data.autorecType][data.name][data.variant][data.color])[1]][0] }
                catch (exception) { }
                break;
            default:
                try { file = jb2a.static[data.name][data.variant][data.color][0] }
                catch (exception) { }
        }
        return file;
    }

    static _autorecChoices(itemName, flags) {
        const autoRecSettings = game.settings.get('autoanimations', 'aaAutorec');
        const autoName = AutorecFunctions._rinseName(itemName)
        const nameArray = AutorecFunctions._getAllTheNames(autoRecSettings);
        if (!AutorecFunctions._autorecNameCheck(nameArray, autoName)) {
            return;
        }
        const colorMenu = aaColorMenu;
        const variantMenu = aaVariantMenu;
        const autorecSection = AutorecFunctions._findObjectFromArray(autoRecSettings, autoName);
        if (autorecSection.custom) { return { colors: null, variantChoices: null } }
        let autorecType = autorecSection.menuSection

        let animationName = autorecType === 'preset' && autorecSection.animation === "teleportation" ? autorecSection.subAnimation : autorecSection.animation;
        if (autorecSection[1] === 'templates') {
            animationName = autorecSection.type;
        }
        if (autorecType !== 'melee' && autorecType !== 'range') { autorecType = 'static' }
        const name = animationName === 'shield' ? 'shieldspell' : animationName
        let variant;
        try { variant = !autorecSection.variant ? Object.keys(colorMenu[autorecType][name])[0] : autorecSection.variant; }
        catch (exception) { }
        if (autorecSection[1] === 'templates') {
            variant = autorecSection.animation;
        }

        let autoVariant;
        if (flags.autoanimations?.options?.overrideAuto) {
            autoVariant = flags.autoanimations?.options?.autoVariant;
        }
        variant = !autoVariant ? variant : autoVariant;

        let colors;
        try { colors = colorMenu[autorecType][name][variant] }
        catch (exception) { }
        let variantChoices;
        try { variantChoices = variantMenu[autorecType][name] }
        catch (exception) { }
        if (autorecSection[1] === "templates") { variantChoices = undefined }

        return { colors, variantChoices };
    }

}

/*
async function sortAutorec() {
    const autoRec = await game.settings.get('autoanimations', 'aaAutorec');
    console.log(autoRec)
    const sortedMenu = {};

    sortedMenu.version = autoRec.version;
    sortedMenu.search = autoRec.search;
    sortedMenu.melee = await sortMenu(autoRec.melee);
    sortedMenu.range = await sortMenu(autoRec.range);
    sortedMenu.static = await sortMenu(autoRec.static);
    sortedMenu.templates = await sortMenu(autoRec.templates);
    sortedMenu.auras = await sortMenu(autoRec.auras);
    sortedMenu.preset = await sortMenu(autoRec.preset)

    console.log(sortedMenu)
}

async function sortMenu(data) {
    const mergedArray = [];
    const keys = Object.keys(data);
    const keyLength = keys.length;
    for (var i = 0; i < keyLength; i++) {
        var currentObject = data[keys[i]];
        if (!currentObject.name) { break; }
        currentObject.menuSection = keys[i]
        mergedArray.push(currentObject)
    }
    mergedArray.sort((a, b) => b.name.toLowerCase() > a.name.toLowerCase() ? -1 : 1)

    const melee = {};
    const newLength = mergedArray.length;
    for (var i = 0; i < newLength; i++) {
        var currentKey = i.toString()
        melee[currentKey] = mergedArray[currentKey];
    }
    return melee;
}

async function newMenu(data) {
    const melee = {};
    const keyLength = data.length;
    for (var i = 0; i < keyLength; i++) {
        var currentKey = i.toString()
        melee[currentKey] = data[currentKey];
    }
    return melee;
}
*/