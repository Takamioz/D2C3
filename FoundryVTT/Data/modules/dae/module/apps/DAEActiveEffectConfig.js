import { ValidSpec, aboutTimeInstalled, confirmDelete, cubActive, conditionalVisibilityActive, ceActive, atlActive } from "../dae.js";
import { i18n, confirmAction, daeSpecialDurations, daeMacroRepeats, log } from "../../dae.js";
export var otherFields = [];
export function addAutoFields(fields) {
    fields.forEach(f => {
        if (!otherFields.includes(f))
            otherFields.push(f);
    });
    otherFields.sort();
}
export class DAEActiveEffectConfig extends ActiveEffectConfig {
    constructor(object = {}, options = {}) {
        super(object, options);
        this.tokenMagicEffects = {};
        //@ts-ignore
        if (game.modules.get("tokenmagic")?.active) {
            game.settings.get("tokenmagic", "presets").forEach(preset => {
                this.tokenMagicEffects[preset.name] = preset.name;
            });
        }
        else
            this.tokenMagicEffects["invalid"] = "module not installed";
        this.fieldsList = Object.keys(ValidSpec.allSpecsObj);
        this.fieldsList = this.fieldsList.concat(otherFields);
        //@ts-ignore
        // if (window.MidiQOL?.midiFlags)  this.fieldsList = this.fieldsList.concat(window.MidiQOL.midiFlags);
        this.fieldsList.sort();
        //@ts-ignore
        log(`There are ${this.fieldsList.length} fields to choose from of which ${window.MidiQOL?.midiFlags?.length || 0} come from midi-qol and ${ValidSpec.allSpecs.length} from dae`);
        if (game.system.id === "dnd5e") {
            this.fieldsList = this.fieldsList.join(", ");
            this.traitList = duplicate(CONFIG.DND5E.damageResistanceTypes);
            this.traitList = mergeObject(this.traitList, CONFIG.DND5E.healingTypes);
            Object.keys(this.traitList).forEach(type => {
                this.traitList[`-${type}`] = `-${CONFIG.DND5E.damageResistanceTypes[type]}`;
            });
            this.languageList = duplicate(CONFIG.DND5E.languages);
            Object.keys(CONFIG.DND5E.languages).forEach(type => {
                this.languageList[`-${type}`] = `-${CONFIG.DND5E.languages[type]}`;
            });
            this.conditionList = duplicate(CONFIG.DND5E.conditionTypes);
            Object.keys(CONFIG.DND5E.conditionTypes).forEach(type => {
                this.conditionList[`-${type}`] = `-${CONFIG.DND5E.conditionTypes[type]}`;
            });
            this.toolProfList = duplicate(CONFIG.DND5E.toolProficiencies);
            Object.keys(CONFIG.DND5E.toolProficiencies).forEach(type => {
                this.toolProfList[`-${type}`] = `-${CONFIG.DND5E.toolProficiencies[type]}`;
            });
            this.armorProfList = duplicate(CONFIG.DND5E.armorProficiencies);
            Object.keys(CONFIG.DND5E.armorProficiencies).forEach(type => {
                this.armorProfList[`-${type}`] = `-${CONFIG.DND5E.armorProficiencies[type]}`;
            });
            this.weaponProfList = duplicate(CONFIG.DND5E.weaponProficiencies);
            Object.keys(CONFIG.DND5E.weaponProficiencies).forEach(type => {
                this.weaponProfList[`-${type}`] = `-${CONFIG.DND5E.weaponProficiencies[type]}`;
            });
        }
        else if (game.system.id === "sw5e") {
            this.fieldsList = this.fieldsList.join(", ");
            this.traitList = duplicate(CONFIG.SW5E.damageResistanceTypes);
            Object.keys(CONFIG.SW5E.damageResistanceTypes).forEach(type => {
                this.traitList[`-${type}`] = `-${CONFIG.SW5E.damageResistanceTypes[type]}`;
            });
            this.languageList = duplicate(CONFIG.SW5E.languages);
            Object.keys(CONFIG.SW5E.languages).forEach(type => {
                this.languageList[`-${type}`] = `-${CONFIG.SW5E.languages[type]}`;
            });
            this.conditionList = duplicate(CONFIG.SW5E.conditionTypes);
            Object.keys(CONFIG.SW5E.conditionTypes).forEach(type => {
                this.conditionList[`-${type}`] = `-${CONFIG.SW5E.conditionTypes[type]}`;
            });
            this.toolProfList = duplicate(CONFIG.SW5E.toolProficiencies);
            Object.keys(CONFIG.SW5E.toolProficiencies).forEach(type => {
                this.toolProfList[`-${type}`] = `-${CONFIG.SW5E.toolProficiencies[type]}`;
            });
            this.armorProfList = duplicate(CONFIG.SW5E.armorProficiencies);
            Object.keys(CONFIG.SW5E.armorProficiencies).forEach(type => {
                this.armorProfList[`-${type}`] = `-${CONFIG.SW5E.armorProficiencies[type]}`;
            });
            this.weaponProfList = duplicate(CONFIG.SW5E.weaponProficiencies);
            Object.keys(CONFIG.SW5E.weaponProficiencies).forEach(type => {
                this.weaponProfList[`-${type}`] = `-${CONFIG.SW5E.weaponProficiencies[type]}`;
            });
        }
        if (cubActive) {
            this.cubConditionList = {};
            game.cub.conditions?.forEach(cubc => {
                this.cubConditionList[cubc.name] = cubc.name;
            });
        }
        this.statusEffectList = {};
        let efl = CONFIG.statusEffects
            .map(se => {
            if (se.id.startsWith("combat-utility-belt."))
                return { id: se.id, label: `${se.label} (CUB)` };
            if (se.id.startsWith("Convenient Effect:"))
                return { id: se.id, label: `${se.label} (CE)` };
            return { id: se.id, label: i18n(se.label) };
        })
            .sort((a, b) => a.label < b.label ? -1 : 1);
        efl.forEach(se => {
            this.statusEffectList[se.id] = se.label;
        });
        if (ceActive) {
            this.ceEffectList = {};
            game.dfreds.effects?.all.forEach(ceEffect => {
                this.ceEffectList[ceEffect.name] = ceEffect.name;
            });
        }
        const ConditionalVisibilityNames = ["invisible", "hidden", "obscured", "indarkness"];
        const ConditionalVisibilityVisionNames = ["blindsight", "devilssight", "seeinvisible", "tremorsense", "truesight"];
        if (conditionalVisibilityActive && false) {
            this.ConditionalVisibilityList = {};
            ConditionalVisibilityNames.forEach(cvc => {
                this.ConditionalVisibilityList[cvc] = i18n(`CONVIS.${cvc}`);
            });
            this.ConditionalVisibilityVisionList = {};
            ConditionalVisibilityVisionNames.forEach(cvc => {
                this.ConditionalVisibilityVisionList[cvc] = i18n(`CONVIS.${cvc}`);
            });
        }
        if (atlActive) {
            this.ATLPresets = {};
            game.settings.get("ATL", "presets").forEach(preset => this.ATLPresets[preset.name] = preset.name);
        }
        this.validFields = { "__": "" };
        this.validFields = ValidSpec.allSpecs
            .filter(e => e._fieldSpec.includes(""))
            .reduce((mods, em) => {
            mods[em._fieldSpec] = em._label;
            return mods;
        }, this.validFields);
        for (let field of otherFields) {
            this.validFields[field] = field;
        }
    }
    get toolProfList() { return DAEActiveEffectConfig.toolProfList; }
    set toolProfList(list) { DAEActiveEffectConfig.toolProfList = list; }
    get armorProfList() { return DAEActiveEffectConfig.armorProfList; }
    set armorProfList(list) { DAEActiveEffectConfig.armorProfList = list; }
    get weaponProfList() { return DAEActiveEffectConfig.weaponProfList; }
    set weaponProfList(list) { DAEActiveEffectConfig.weaponProfList = list; }
    static async setupProficiencies() {
        if (game.system.id === "dnd5e") {
            if (DAEActiveEffectConfig.profInit)
                return;
            this.profInit = true;
            const pack = game.packs.get(CONFIG.DND5E.sourcePacks.ITEMS);
            const profs = [
                { type: "tool", list: DAEActiveEffectConfig.toolProfList },
                { type: "armor", list: DAEActiveEffectConfig.armorProfList },
                { type: "weapon", list: DAEActiveEffectConfig.weaponProfList }
            ];
            for (let { type, list } of profs) {
                let choices = CONFIG.DND5E[`${type}Proficiencies`];
                const ids = CONFIG.DND5E[`${type}Ids`];
                if (ids !== undefined) {
                    const typeProperty = (type !== "armor") ? `${type}Type` : `armor.type`;
                    for (const [key, id] of Object.entries(ids)) {
                        const item = await pack.getDocument(id);
                        list[key] = item.name;
                    }
                }
            }
        }
    }
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["sheet", "active-effect-sheet"],
            title: "EFFECT.ConfigTitle",
            template: `./modules/dae/templates/DAEActiveSheetConfig.html`,
            width: 900,
            height: "auto",
            resizable: true,
            tabs: [{ navSelector: ".tabs", contentSelector: "form", initial: "details" }]
        });
    }
    /* ----------------------------------------- */
    /** @override */
    get title() {
        let suffix = this.object.parent.isOwned ? "(Owned Item) Experimental" : "";
        return `${i18n("EFFECT.ConfigTitle")}: ${this.object.data.label}` + suffix;
    }
    get id() {
        const object = this.object;
        let id = `ActiveEffectsConfig-${object?.id}`;
        if (object?.isToken)
            id += `-${object.token.id}`;
        return id;
    }
    /* ----------------------------------------- */
    getOptionsForSpec(spec) {
        if (spec === "data.traits.languages.value")
            return this.languageList;
        if (spec === "data.traits.ci.value")
            return this.conditionList;
        if (spec === "data.traits.toolProf.value")
            return this.toolProfList;
        if (spec === "data.traits.armorProf.value")
            return this.armorProfList;
        if (spec === "data.traits.weaponProf.value")
            return this.weaponProfList;
        if (["data.traits.di.value", "data.traits.dr.value", "data.traits.dv.value"].includes(spec))
            return this.traitList;
        if (spec.includes("data.skills") && spec.includes("value"))
            return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
        if (spec.includes("data.skills") && spec.includes("ability")) {
            if (game.system.id === "dnd5e")
                return CONFIG.DND5E.abilities;
            else
                return CONFIG.SW5E.abilities;
        }
        if (spec.includes("tokenMagic"))
            return this.tokenMagicEffects;
        if (spec === "macro.CUB")
            return this.cubConditionList;
        if (spec === "macro.CE")
            return this.ceEffectList;
        if (spec === "StatusEffect")
            return this.statusEffectList;
        if (spec === "macro.ConditionalVisibility")
            return this.ConditionalVisibilityList;
        if (spec === "macro.ConditionalVisibilityVision")
            return this.ConditionalVisibilityVisionList;
        if (spec === "ATL.preset")
            return this.ATLPresets;
        /*
            blindsight: false
        devilssight: false
        hidden: false
        indarkness: false
        invisible: false
        obscured: false
        seeinvisible: true
        tremorsense: false
        truesight: false
        */
        if (spec === "data.traits.size")
            return CONFIG.DND5E.actorSizes;
        return false;
    }
    /** @override */
    async getData(options) {
        const data = super.getData(options);
        await DAEActiveEffectConfig.setupProficiencies();
        //@ts-ignore
        const allModes = Object.entries(CONST.ACTIVE_EFFECT_MODES)
            .reduce((obj, e) => {
            //@ts-ignore
            obj[e[1]] = game.i18n.localize("EFFECT.MODE_" + e[0]);
            return obj;
        }, {});
        //@ts-ignore
        data.specialDuration = daeSpecialDurations;
        data.macroRepeats = daeMacroRepeats;
        const translations = geti18nTranslations();
        data.stackableOptions = translations.stackableOptions ?? { "none": "Effects do not stack", "multi": "Stacking effects apply the effect multiple times", "count": "each stack increase stack count by 1" };
        if (this.object.parent) {
            //@ts-ignore documentClass
            data.isItem = this.object.parent instanceof CONFIG.Item.documentClass;
            //@ts-ignore documentClass
            data.isActor = this.object.parent instanceof CONFIG.Actor.documentClass;
        }
        data.validFields = this.validFields;
        data.submitText = "EFFECT.Submit";
        //@ts-ignore
        data.effect.changes.forEach(change => {
            if (change.key.startsWith("flags.midi-qol")) {
                //@ts-ignore
                change.modes = allModes; //change.mode ? allModes: [allModes[CONST.ACTIVE_EFFECT_MODES.CUSTOM]];
            }
            else if ([-1, undefined].includes(ValidSpec.allSpecsObj[change.key]?.forcedMode)) {
                change.modes = allModes;
            }
            else {
                const mode = {};
                mode[ValidSpec.allSpecsObj[change.key]?.forcedMode] = allModes[ValidSpec.allSpecsObj[change.key]?.forcedMode];
                change.modes = mode;
            }
            change.options = this.getOptionsForSpec(change.key);
            if (!change.priority)
                change.priority = change.mode * 10;
        });
        if (aboutTimeInstalled && data.effect.duration?.startTime) {
            //@ts-ignore
            const Gametime = window.Gametime;
            let startTime = Gametime.DT.createFromSeconds(data.effect.duration.startTime).shortDate();
            data.startTimeString = (startTime.date + " " + startTime.time) || "";
            if (data.effect.duration.seconds) {
                const endTime = Gametime.DT.createFromSeconds(data.effect.duration.startTime + data.effect.duration.seconds).shortDate();
                data.durationString = endTime.date + " " + endTime.time;
            }
        }
        if (!data.effect.flags.dae?.specialDuration || !(data.effect.flags.dae.specialDuration instanceof Array))
            setProperty(data.effect.flags, "dae.specialDuration", []);
        data.sourceName = this.object.sourceName;
        data.fieldsList = this.fieldsList;
        return data;
    }
    _keySelected(event) {
        const target = event.target;
        // $(target.parentElement.parentElement.children[1]).find(".keylist").val(ValidSpec.allSpecs[target.selectedIndex].fieldSpec)
        if (target.selectedIndex === 0)
            return; // Account for dummy element 0
        $(target.parentElement.parentElement.parentElement.children[0]).find(".awesomplete").val(target.value);
        /*
            if (!ValidSpec.allSpecs[selected]) { // otherfields
              $(target.parentElement.parentElement.parentElement.children[0]).find(".awesomplete").val(selected)
            } else {
              $(target.parentElement.parentElement.parentElement.children[0]).find(".awesomplete").val(ValidSpec.allSpecs[target.selectedIndex-1].fieldSpec)
            }
            */
        return this.submit({ preventClose: true }).then(() => this.render());
    }
    /* ----------------------------------------- */
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        html.find(".keylist").change(this._keySelected.bind(this));
        html.find(".awesomplete").on("awesomplete-selectcomplete", this._textSelected.bind(this));
    }
    /* ----------------------------------------- */
    _textSelected(event) {
        return this.submit({ preventClose: true }).then(() => this.render());
    }
    /* ----------------------------------------- */
    _onEffectControl(event) {
        event.preventDefault();
        const button = event.currentTarget;
        switch (button.dataset.action) {
            case "add":
                this._addEffectChange(button);
                return this.submit({ preventClose: true }).then(() => this.render());
            case "delete":
                return confirmAction(confirmDelete, () => {
                    button.closest(".effect-change").remove();
                    this.submit({ preventClose: true }).then(() => this.render());
                });
            case "add-specDur":
                this._addSpecDuration(button);
                return this.submit({ preventClose: true }).then(() => this.render());
            case "delete-specDur":
                return confirmAction(confirmDelete, () => {
                    button.closest(".effect-special-duration").remove();
                    this.submit({ preventClose: true }).then(() => this.render());
                });
        }
    }
    _addSpecDuration(button) {
        const durations = button.closest(".tab").querySelector(".special-duration-list");
        const last = durations.lastElementChild;
        const idx = last ? last.dataset.index + 1 : 0;
        const duration = $(` 
    <li class="effect-special-duration flexrow" data-index="${idx}">
    <div class="formgroup">
      <select name="flags.dae.specialDuration.${idx}" data-dtype="string">
        {{selectOptions ../specialDuration selected=label}}
      </select>
      <div class="effect-controls">
        <a class="effect-control" data-action="delete-specDur"><i class="fas fa-trash"></i></a>
      </div>
    </div>
  </li>
    `);
        durations.appendChild(duration[0]);
    }
    /* ----------------------------------------- */
    _addEffectChange(button) {
        const changes = button.closest(".tab").querySelector(".changes-list");
        const last = changes.lastElementChild;
        const idx = last ? last.dataset.index + 1 : 0;
        const change = $(`
    <li class="effect-change" data-index="${idx}">
        <input type="text" name="changes.${idx}.key" value=""/>
        <input type="number" name="changes.${idx}.mode" value="2"/>
        <input type="text" name="changes.${idx}.value" value="0"/>
        <input type="number" name="changes.${idx}.priority" value="0">
    </li>`);
        changes.appendChild(change[0]);
    }
    /* ----------------------------------------- */
    /** @override */
    async _updateObject(event, formData) {
        formData = expandObject(formData);
        if (!formData.changes)
            formData.changes = [];
        formData.changes = Object.values(formData.changes);
        if (formData.flags?.dae?.specialDuration && typeof formData.flags.dae.specialDuration !== "string") {
            const newSpecDur = [];
            Object.values(formData.flags?.dae?.specialDuration).forEach(value => newSpecDur.push(value));
            formData.flags.dae.specialDuration = newSpecDur;
        }
        else
            setProperty(formData, "flags.dae.specialDuration", []);
        //@ts-ignore
        //@ts-ignore isNumeric
        if (Number.isNumeric(formData.duration.startTime) && Math.abs(Number(formData.duration.startTime) < 3600)) {
            let startTime = parseInt(formData.duration.startTime);
            if (Math.abs(startTime) <= 3600) { // Only acdept durations of 1 hour or less as the start time field
                formData.duration.startTime = game.time.worldTime + parseInt(formData.duration.startTime);
            }
        }
        else if (this.object.parent.isOwned)
            formData.duration.startTime = null;
        setProperty(formData, "flags.dae.transfer", formData.transfer);
        //setProperty(formData, "flags.dae", {stackable: formData.flags.dae.stackable});
        if (this.object.parent.isOwned) { // we are editing an owned item
            let itemData = this.object.parent.data.toObject();
            itemData.effects.forEach(efData => {
                if (efData._id === this.object.id)
                    mergeObject(efData, formData, { overwrite: true, inplace: true });
            });
            return this.object.parent.actor.updateEmbeddedDocuments("Item", [itemData], { diff: true });
        }
        else {
            await this.object.update(formData);
        }
    }
}
export function geti18nTranslations() {
    let translations = game.i18n.translations["dae"];
    //@ts-ignore _fallback not accessible
    if (!translations)
        translations = game.i18n._fallback["dae"];
    return translations ?? {};
}
