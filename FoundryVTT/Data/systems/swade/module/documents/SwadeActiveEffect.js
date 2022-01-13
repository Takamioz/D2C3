export default class SwadeActiveEffect extends ActiveEffect {
    get changes() {
        return this.data.changes;
    }
    get affectsItems() {
        if (this.parent instanceof CONFIG.Actor.documentClass) {
            const affectedItems = new Array();
            this.changes.forEach((c) => affectedItems.push(...this._getAffectedItems(this.parent, c)));
            return affectedItems.length > 0;
        }
        return false;
    }
    /** @override */
    apply(actor, change) {
        const match = change.key.match(SwadeActiveEffect.ITEM_REGEXP);
        if (match) {
            //get the properties from the match
            const key = match[3].trim();
            const value = change.value;
            //get the affected items
            const affectedItems = this._getAffectedItems(actor, change);
            //apply the AE to each item
            for (const item of affectedItems) {
                const overrides = foundry.utils.flattenObject(item.overrides);
                overrides[key] = Number.isNumeric(value) ? Number(value) : value;
                //mock up a new change object with the key and value we extracted from the original key and feed it into the super apply method alongside the item
                const mockChange = { ...change, key, value };
                //@ts-expect-error It normally expects an Actor but since it only targets the data we can re-use it for Items
                super.apply(item, mockChange);
                item.overrides = foundry.utils.expandObject(overrides);
            }
        }
        else {
            return super.apply(actor, change);
        }
    }
    _getAffectedItems(actor, change) {
        const items = new Array();
        const match = change.key.match(SwadeActiveEffect.ITEM_REGEXP);
        if (match) {
            //get the properties from the match
            const type = match[1].trim().toLowerCase();
            const name = match[2].trim();
            //filter the items down, according to type and name/id
            items.push(...actor.items.filter((i) => i.type === type && (i.name === name || i.id === name)));
        }
        return items;
    }
    /**
     * Removes Effects from Items
     * @param parent The parent object
     */
    _removeEffectsFromItems(parent) {
        const affectedItems = new Array();
        this.changes.forEach((c) => affectedItems.push(...this._getAffectedItems(parent, c)));
        for (const item of affectedItems) {
            const overrides = foundry.utils.flattenObject(item.overrides);
            for (const change of this.changes) {
                const match = change.key.match(SwadeActiveEffect.ITEM_REGEXP);
                if (match) {
                    const key = match[3].trim();
                    //delete override
                    delete overrides[key];
                    //restore original data from source
                    const source = getProperty(item.data._source, key);
                    setProperty(item.data, key, source);
                }
            }
            item.overrides = foundry.utils.expandObject(overrides);
            if (item.sheet?.rendered)
                item.sheet.render(true);
        }
    }
    async _preUpdate(changed, options, user) {
        super._preUpdate(changed, options, user);
        //return early if the parent isn't an actor or we're not actually affecting items
        if (this.affectsItems &&
            this.parent instanceof CONFIG.Actor.documentClass) {
            this._removeEffectsFromItems(this.parent);
        }
    }
    async _preDelete(options, user) {
        super._preDelete(options, user);
        const parent = this.parent;
        //remove the effects from the item
        if (this.affectsItems && parent instanceof CONFIG.Actor.documentClass) {
            this._removeEffectsFromItems(parent);
        }
    }
}
SwadeActiveEffect.ITEM_REGEXP = /@([a-zA-Z0-9]+){([^.]+)}\[([a-zA-Z0-9.]+)\]/;
