// import {ItemEffectSelector} from "./apps/daeSelector"
import { ValidSpec, confirmDelete, aboutTimeInstalled } from "../dae.js";
import { i18n, confirmAction, daeSpecialDurations } from "../../dae.js";
import { DAEActiveEffectConfig } from "./DAEActiveEffectConfig.js";
export class ActiveEffects extends FormApplication {
    constructor() {
        super(...arguments);
        this.hookId = null;
        this.itemHookId = null;
        this.effectHookIdu = null;
        this.effectHookIdc = null;
        this.effectHookIdd = null;
        this.effectHookIdt = null;
        this.timeHookId = null;
        this.combatHookId = null;
    }
    static get defaultOptions() {
        const options = super.defaultOptions;
        // options.id = "effect-selector-actor";
        options.classes = ["dnd5e", "sw5e"];
        options.title = game.i18n.localize("dae.ActiveEffectName");
        options.template = "./modules/dae/templates/ActiveEffects.html";
        options.submitOnClose = true;
        options.height = 400;
        options.width = 600;
        return options;
    }
    get id() {
        const actor = this.object;
        let id = `ActiveEffects-${actor.id}`;
        if (actor.isToken)
            id += `-${actor.token.id}`;
        return id;
    }
    get title() {
        return game.i18n.localize("dae.ActiveEffectName") + ` ${this.object.name}` + (this.object.isOwned ? " (Owned Item) EXPERIMENTAL" : "");
    }
    get filters() { return ActiveEffects.filters; }
    getData() {
        //@ts-ignore
        const EFFECTMODES = CONST.ACTIVE_EFFECT_MODES;
        const modeKeys = Object.keys(EFFECTMODES);
        let actives = this.object.effects.map(ae => {
            let newAe = duplicate(ae.data);
            newAe.duration = duplicate(ae.duration);
            if (aboutTimeInstalled && newAe.duration?.type === "seconds") {
                //TODO change these to a simple calendar function after release
                //TODO change this to window.Gametime.ElapsedTime.timeString permanently
                //@ts-ignore
                newAe.duration.label = window.Gametime.DTM.timeString(ae.duration.remaining);
            }
            else if (newAe.duration.label) {
                newAe.duration.label = newAe.duration.label.replace("Seconds", "s").replace("Rounds", "R").replace("Turns", "T");
            }
            let specialDuration = getProperty(ae.data.flags, "dae.specialDuration") || [daeSpecialDurations["None"]];
            if (typeof specialDuration === "string")
                specialDuration = [ae.data.flags.dae.specialDuration];
            newAe.duration.label += ", " + `[${specialDuration.map(dur => daeSpecialDurations[dur])}]`;
            newAe.isTemporary = true;
            newAe.isTemporary = ae.isTemporary;
            newAe.sourceName = ae.sourceName;
            if (newAe.sourceName === newAe.label)
                newAe.sourceName = "";
            else
                newAe.sourceName = `(${newAe.sourceName})`;
            if (this.filters.has("summary")) {
                newAe.changes = [];
                return newAe;
            }
            newAe.changes.map(change => {
                change.label = ValidSpec.allSpecsObj[change.key]?.label || change.key;
                if (typeof change.value === "string" && change.value.length > 40) {
                    change.value = change.value.substring(0, 30) + " ... ";
                }
                else if (Array.isArray(change.value)) {
                    if (typeof change.value[0] === "string" && change.value[0].length > 20)
                        change.value[0] = "<Macro>";
                    change.value = change.value.join("|");
                }
                return change;
            });
            return newAe;
        });
        if (this.filters.has("temporary"))
            actives = actives.filter(e => e.isTemporary);
        if (this.filters.has("enabled"))
            actives = actives.filter(e => !e.disabled);
        actives.sort((a, b) => a.label < b.label ? -1 : 1);
        actives.forEach(e => {
            setProperty(e, "flags.dae.active", !e.disabled);
            let id = e.origin?.match(/Actor.*Item\.(.*)/);
            if (id?.length === 2) {
                const item = this.object.items?.get(id[1]);
                setProperty(e, "flags.dae.itemName", item?.name || "???");
            }
            else {
                setProperty(e, "flags.dae.itemName", "????");
            }
            e.transfer = e.transfer ?? e.flags?.dae?.transfer ?? true;
        });
        let efl = CONFIG.statusEffects
            .map(se => { return { "id": se.id, "label": se.id.startsWith("combat-utility-belt.") ? `${se.label} (CUB)` : i18n(se.label) }; })
            .sort((a, b) => a.label < b.label ? -1 : 1);
        this.effectList = { "new": "new" };
        efl.forEach(se => {
            this.effectList[se.id] = se.label;
        });
        //@ts-ignore documentClass;
        const isItem = this.object instanceof CONFIG.Item.documentClass;
        let data = {
            actives: actives,
            isGM: game.user.isGM,
            isItem,
            isOwned: this.object.isOwned,
            flags: this.object.data.flags,
            modes: modeKeys,
            validSpecs: ValidSpec.allSpecsObj,
            //@ts-ignore
            // canEdit: game.user.isGM || (playersCanSeeEffects === "edit" && game.user.isTrusted),
            canEdit: true,
            // showEffects: playersCanSeeEffects !== "none" || game.user.isGM,
            showEffects: true,
            effectList: this.effectList,
            newEffect: "new"
        };
        return data;
    }
    async _updateObject(event, formData) {
        formData = expandObject(formData);
        if (!formData.changes)
            formData.changes = [];
        formData.changes = Object.values(formData.changes);
        for (let c of formData.changes) {
            //@ts-ignore
            if (Number.isNumeric(c.value))
                c.value = parseFloat(c.value);
        }
        return this.object.update(formData);
    }
    _initializeFilterItemList(i, ul) {
        const set = this.filters;
        const filters = ul.querySelectorAll(".filter-item");
        for (let li of filters) {
            if (set.has(li.dataset.filter))
                li.classList.add("active");
        }
    }
    _onToggleFilter(event) {
        event.preventDefault();
        const li = event.currentTarget;
        const set = this.filters;
        const filter = li.dataset.filter;
        if (set.has(filter))
            set.delete(filter);
        else
            set.add(filter);
        this.render();
    }
    // delete change
    activateListeners(html) {
        super.activateListeners(html);
        const filterLists = html.find(".filter-list");
        filterLists.each(this._initializeFilterItemList.bind(this));
        filterLists.on("click", ".filter-item", this._onToggleFilter.bind(this));
        /*
          html.find('.change-delete').click(async ev => {
            let effect_id = $(ev.currentTarget).parents(".dae-change-list").attr("effect-id");
            let change_id = $(ev.currentTarget).parents(".dae-change-list").attr("change-id");
            var effect;
            // li.slideUp(200);
            effect = duplicate(this.object.data.effects.find(ef=>ef._id === effect_id));
            effect.changes.splice(parseInt(change_id),1);
            confirmAction(confirmDelete, () => {
                this.object.updateEmbeddedEntity("ActiveEffect", effect).then(() => this.render());
              });
          });
        */
        html.find('.refresh').click(async (ev) => {
            return this.submit({ preventClose: true }).then(() => this.render());
        });
        // Delete Effect
        html.find('.effect-delete').click(async (ev) => {
            const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
            confirmAction(confirmDelete, () => {
                this.object.deleteEmbeddedDocuments("ActiveEffect", [effect_id]).then(() => this.render());
            });
        });
        html.find('.effect-edit').click(async (ev) => {
            if (this.object.parent instanceof Item)
                return; // TODO Think about editing effects on items in bags
            const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
            let effect = this.object.effects.get(effect_id);
            new DAEActiveEffectConfig(effect).render(true);
        });
        html.find('.effect-add').click(async (ev) => {
            let effect_name = $(ev.currentTarget).parents(".effect-header").find(".newEffect option:selected").text();
            let AEDATA;
            let id = Object.entries(this.effectList).find(([key, value]) => value === effect_name)[0];
            if (effect_name === "new") {
                //@ts-ignore
                AEDATA = {
                    label: this.object.name,
                    icon: this.object.img || "icons/svg/mystery-man.svg",
                    changes: [],
                    transfer: false,
                };
            }
            else {
                AEDATA = CONFIG.statusEffects.find(se => se.id === id);
                AEDATA.label = i18n(AEDATA.label);
                //TODO remove this when core has this already?
                AEDATA["flags.core.statusId"] = id;
            }
            //@ts-ignore
            const created = await this.object.createEmbeddedDocuments("ActiveEffect", [AEDATA]);
            if (!created || created.legnth === 0)
                return;
            const effectId = created[0].id;
            let effect = this.object.effects.get(effectId);
            new DAEActiveEffectConfig(effect).render(true);
            this.render();
        });
        // this.hookId = Hooks.on("updateActor", () => this.render(true))
        function efhandler(type, object) {
            if (this.object.id === object.id) {
                setTimeout(() => this.render(), 0);
            }
        }
        ;
        function tmHandler(worldTime, dt) {
            //@ts-ignore
            if (Array.from(this.object.effects).some(ef => ef.isTemporary))
                setTimeout(() => this.render(), 0);
        }
        function tkHandler(scene, tokenData, update) {
            if (tokenData.actorId !== this.object.id)
                return;
            if (!update.actorData?.effects)
                return;
            setTimeout(() => this.render(), 0);
        }
        if (!this.effectHookIdu)
            this.effectHookIdu = Hooks.on("updateActiveEffect", efhandler.bind(this, "update"));
        if (!this.effectHookIdc)
            this.effectHookIdc = Hooks.on("createActiveEffect", efhandler.bind(this, "create"));
        if (!this.effectHookIdd)
            this.effectHookIdd = Hooks.on("deleteActiveEffect", efhandler.bind(this, "delete"));
        if (!this.effectHookIdt)
            this.effectHookIdt = Hooks.on("updateToken", tkHandler.bind(this));
        if (!this.itemHookId)
            this.itemHookId = Hooks.on("updateOwnedItem", efhandler.bind(this, "owneditem"));
        if (!this.timeHookId)
            this.timeHookId = Hooks.on("updateWorldTime", tmHandler.bind(this));
        if (!this.combatHookId)
            this.combatHookId = Hooks.on("updateCombat", tmHandler.bind(this));
    }
    async close() {
        Hooks.off("updateActiveEffect", this.effectHookIdu);
        Hooks.off("createActiveEffect", this.effectHookIdc);
        Hooks.off("deleteActiveEffect", this.effectHookIdd);
        Hooks.off("updateWorldTime", this.timeHookId);
        Hooks.off("updateToken", this.effectHookIdt);
        Hooks.off("updateOwnedItem", this.itemHookId);
        Hooks.off("updateCombat", this.combatHookId);
        return super.close();
    }
}
ActiveEffects.filters = new Set().add("summary");
