import { Dice3D } from './Dice3D.js';
import { DiceBox } from './DiceBox.js';
import { DiceSFXManager } from './DiceSFXManager.js';
import { Utils } from './Utils.js';
import { DiceNotation } from './DiceNotation.js';
import { DiceColors, DICE_SCALE } from './DiceColors.js';
/**
 * Form application to configure settings of the 3D Dice.
 */
export class DiceConfig extends FormApplication {

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: game.i18n.localize("DICESONICE.configTitle"),
            id: "dice-config",
            template: "modules/dice-so-nice/templates/dice-config.html",
            width: 650,
            height: "auto",
            closeOnSubmit: true,
            tabs: [
                { navSelector: ".tabs", contentSelector: "#config-tabs", initial: "general" },
                { navSelector: ".dsn-appearance-tabs", contentSelector: "#dsn-appearance-content", initial: "global" }
            ]
        })
    }

    async getData(options) {
        let data = mergeObject({
            fxList: Utils.localize({
                "none": "DICESONICE.None",
                "fadeOut": "DICESONICE.FadeOut"
            }),
            speedList: Utils.localize({
                "1": "DICESONICE.NormalSpeed",
                "2": "DICESONICE.2xSpeed",
                "3": "DICESONICE.3xSpeed"
            }),
            textureList: Utils.prepareTextureList(),
            materialList: Utils.localize({
                "auto": "DICESONICE.MaterialAuto",
                "plastic": "DICESONICE.MaterialPlastic",
                "metal": "DICESONICE.MaterialMetal",
                "glass": "DICESONICE.MaterialGlass",
                "wood": "DICESONICE.MaterialWood",
                "chrome": "DICESONICE.MaterialChrome"
            }),
            fontList: Utils.prepareFontList(),
            colorsetList: Utils.prepareColorsetList(),
            shadowQualityList: Utils.localize({
                "none": "DICESONICE.None",
                "low": "DICESONICE.Low",
                "high": "DICESONICE.High"
            }),
            systemList: Utils.prepareSystemList(),
            soundsSurfaceList: Utils.localize({
                "felt": "DICESONICE.SurfaceFelt",
                "wood_table": "DICESONICE.SurfaceWoodTable",
                "wood_tray": "DICESONICE.SurfaceWoodTray",
                "metal": "DICESONICE.SurfaceMetal"
            }),
            canvasZIndexList: Utils.localize({
                "over": "DICESONICE.CanvasZIndexOver",
                "under": "DICESONICE.CanvasZIndexUnder",
            }),
            throwingForceList: Utils.localize({
                "weak": "DICESONICE.ThrowingForceWeak",
                "medium": "DICESONICE.ThrowingForceMedium",
                "strong": "DICESONICE.ThrowingForceStrong"
            })
        },
            this.reset ? Dice3D.ALL_DEFAULT_OPTIONS() : Dice3D.ALL_CONFIG()
        );
        delete data.sfxLine;
        //fix corupted save from #139
        if (data.specialEffects) {
            for (let [key, value] of Object.entries(data.specialEffects)) {
                if (Array.isArray(value.diceType) || Array.isArray(value.onResult) || Array.isArray(value.specialEffect))
                    delete data.specialEffects[key];
            }
        }

        this.canvas = $('<div id="dice-configuration-canvas"></div>')[0];
        let config = mergeObject(
            this.reset ? Dice3D.ALL_DEFAULT_OPTIONS() : Dice3D.ALL_CONFIG(),
            { dimensions: { w: 634, h: 245 }, autoscale: false, scale: 60, boxType: "showcase" }
        );

        this.box = new DiceBox(this.canvas, game.dice3d.box.dicefactory, config);
        await this.box.initialize();
        if (!game.user.getFlag("dice-so-nice", "appearance")) {
            if (this.box.dicefactory.preferredSystem != "standard")
                config.appearance.global.system = this.box.dicefactory.preferredSystem;
            if (this.box.dicefactory.preferredColorset != "standard")
                config.appearance.global.colorset = this.box.dicefactory.preferredColorset;
        }
        this.box.showcase(config);

        this.navOrder = {};
        let triggerTypeList = [{ id: "", name: "" }];
        this.possibleResultList = {};
        let i = 0;
        this.box.diceList.forEach((el) => {
            this.navOrder[el.userData] = i++;
            triggerTypeList.push({ id: el.userData, name: el.userData });
            this.possibleResultList[el.userData] = [];
            let preset = this.box.dicefactory.systems.standard.dice.find(dice => dice.type == el.userData);
            let termClass = Object.values(CONFIG.Dice.terms).find(term => term.name == preset.term) || Die;
            let term = new termClass({});

            if(el.userData == "d100"){
                for(let i = 1; i<=100;i++){
                    let label = term.getResultLabel({ result: i });
                    let option = { id: i + "", name: label };
                    this.possibleResultList[el.userData].push(option);
                }
            } else {
                preset.values.forEach((value) => {
                    let label = term.getResultLabel({ result: value });
                    let option = { id: value + "", name: label };
                    this.possibleResultList[el.userData].push(option);
                });
            }
        });

        let specialEffectsList = [];
        let specialEffectsPromises = [];
        let specialEffects = Dice3D.SFX();
        if (this.reset)
            specialEffects = [];
        this.triggerTypeList = [...triggerTypeList, ...DiceSFXManager.EXTRA_TRIGGER_TYPE];
        mergeObject(this.possibleResultList, DiceSFXManager.EXTRA_TRIGGER_RESULTS);

        //Filter out the SFX that are not registered
        if (specialEffects) {
            let registeredTriggerTypes = this.triggerTypeList.map(trigger => trigger.id);
            specialEffects = specialEffects.filter(sfx => registeredTriggerTypes.includes(sfx.diceType));
        }

        if (specialEffects) {
            specialEffects.forEach((sfx, index) => {
                let sfxClass = DiceSFXManager.SFX_MODE_CLASS[sfx.specialEffect];
                let dialogContent = sfxClass.getDialogContent(sfx, index);
                let hdbsTemplate = Handlebars.compile(dialogContent.content);

                specialEffectsPromises.push(renderTemplate("modules/dice-so-nice/templates/partial-sfx.html", {
                    id: index,
                    diceType: sfx.diceType,
                    onResult: sfx.onResult,
                    specialEffect: sfx.specialEffect,
                    specialEffectsMode: DiceSFXManager.SFX_MODE_LIST,
                    triggerTypeList: this.triggerTypeList,
                    possibleResultList: this.possibleResultList[sfx.diceType],
                    options: hdbsTemplate(dialogContent.data)
                }).then((html) => {
                    specialEffectsList.push(html);
                }));
            });
            await Promise.all(specialEffectsPromises);
        }
        data.specialEffectsList = specialEffectsList.join("");

        let tabsList = [];
        for (let scope in data.appearance) {
            if (data.appearance.hasOwnProperty(scope)) {
                tabsList.push(scope);
                if (scope != "global") {
                    if (!data.appearance[scope].labelColor)
                        data.appearance[scope].labelColor = data.appearance.global.labelColor;
                    if (!data.appearance[scope].diceColor)
                        data.appearance[scope].diceColor = data.appearance.global.diceColor;
                    if (!data.appearance[scope].outlineColor)
                        data.appearance[scope].outlineColor = data.appearance.global.outlineColor;
                    if (!data.appearance[scope].edgeColor)
                        data.appearance[scope].edgeColor = data.appearance.global.edgeColor;
                }
            }
        }

        let tabsAppearance = [];
        let tabsPromises = [];
        data.navAppearance = {};
        tabsList.forEach((diceType) => {
            tabsPromises.push(renderTemplate("modules/dice-so-nice/templates/partial-appearance.html", {
                dicetype: diceType,
                appearance: data.appearance[diceType],
                systemList: data.systemList,
                colorsetList: data.colorsetList,
                textureList: data.textureList,
                materialList: data.materialList,
                fontList: data.fontList
            }).then((html) => {
                tabsAppearance.push(html);
            }));
            if (diceType != "global")
                data.navAppearance[diceType] = diceType.toUpperCase();
        });
        await Promise.all(tabsPromises);

        if (tabsAppearance.length > 1)
            data.displayHint = "style='display:none;'";
        else
            data.displayHint = '';

        data.tabsAppearance = tabsAppearance.join("");
        this.lastActiveAppearanceTab = "global";

        this.initializationData = data;
        this.currentGlobalAppearance = data.appearance.global;
        this.sfxDialogList = [];

        const templateSelect2 = (result) => {

            if (result.element) {
                let label = this.possibleResultList[result.element.parentElement.dataset.sfxResultDicetype].find(el => el.id == result.text).name;
                if (label != result.text)
                    return `${label} (${result.text})`;
                else
                    return result.text;
            } else {
                return result.text;
            }
        };

        this.select2Options = {
            dropdownCssClass: "dice-so-nice",
            escapeMarkup: function (text) { return text; },
            dropdownParent: "form.dice-so-nice",
            templateResult: templateSelect2,
            templateSelection: templateSelect2,
            width: "306px"
        }

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        $(html).find("#dice-configuration-canvas-container").append(this.canvas);


        this.toggleHideAfterRoll();
        this.toggleAutoScale();
        this.toggleCustomization();
        this.filterSystems();
        this.setPreferredOptions();

        select2dsn.call($(this.element).find("[data-sfx-result]"), this.select2Options);

        if (!this.reset) {
            $(this.element).on("change", "[data-showExtraDice]", (ev) => {
                this.onApply(ev);
            });

            $(this.element).on("change", "[data-hideAfterRoll]", (ev) => {
                this.toggleHideAfterRoll(ev);
            });

            $(this.element).on("change", "[data-sounds]", (ev) => {
                this.toggleSounds(ev);
            });

            $(this.element).on("change", "[data-autoscale]", (ev) => {
                this.toggleAutoScale(ev);
            });

            $(this.element).on("change", "[data-colorset]", (ev) => {
                this.toggleCustomColors($(ev.target).data("dicetype"));
            });

            $(this.element).on("change", "[data-system]", (ev) => {
                this.toggleCustomization($(ev.target).data("dicetype"));
            });

            $(this.element).on("change", "input,select", (ev) => {
                this.onApply(ev);
            });

            $(this.element).on("click", "[data-reset]", (ev) => {
                this.onReset(ev);
            });

            $(this.element).on("click", "[data-cancel]", (ev) => {
                this.close();
            });

            $(this.element).on("click", "[data-close-tab]", (ev) => {
                let diceType = $(ev.target).parent().data("tab");
                this.closeAppearanceTab(diceType);
            });

            $(this.element).on("click", "[data-test]", (ev) => {
                let config = this.getShowcaseAppearance();
                let denominationList = [];
                this.box.diceList.forEach((el) => {
                    //the d100 will roll the d10 so we remove the d10 from the list
                    if (el.userData != "d10")
                        denominationList.push(el.userData);
                });
                let roll = new Roll(denominationList.join("+")).evaluate().then((roll) =>{
                    let data = new DiceNotation(roll);

                    let specialEffects = this.getShowcaseSFX();
                    let customization = mergeObject({ appearance: config.appearance }, { specialEffects: specialEffects });

                    game.dice3d._showAnimation(data, customization);
                });
            });

            $(this.element).on("click", "[data-sfx-create]", (ev) => {
                let ID = $(this.element).find(".sfx-line").length;
                let firstSFX = Object.keys(DiceSFXManager.SFX_MODE_LIST)[0];
                let sfxClass = DiceSFXManager.SFX_MODE_CLASS[firstSFX];
                let dialogContent = sfxClass.getDialogContent({}, ID);
                let hdbsTemplate = Handlebars.compile(dialogContent.content);
                renderTemplate("modules/dice-so-nice/templates/partial-sfx.html", {
                    id: ID,
                    diceType: "",
                    onResult: [],
                    specialEffect: "",
                    specialEffectsMode: DiceSFXManager.SFX_MODE_LIST,
                    triggerTypeList: this.triggerTypeList,
                    possibleResultList: [],
                    options: hdbsTemplate(dialogContent.data)
                }).then((html) => {
                    $(this.element).find("#sfxs-list").append(html);
                    select2dsn.call($("[data-sfx-result]"), this.select2Options);
                    this.setPosition();
                });
            });

            $(this.element).on("click", "[data-sfx-delete]", (ev) => {
                $(ev.target).parents(".sfx-line").remove();
                $(this.element).find(".sfx-line").each(function (index) {
                    $(this).find("input, select").each(function () {
                        let name = $(this).attr("name");
                        $(this).attr("name", name.replace(/(\w+\[)(\d+)(\]\[\w+\])/, "$1" + index + "$3"));
                    });
                });
                this.setPosition();
            });

            $(this.element).on("click", "[data-sfx-options]", (ev) => {
                let sfxLineOptions = $(ev.target).parents(".sfx-line").find("[data-sfx-hidden-options]");

                if (sfxLineOptions.length < 1)
                    return;

                let d = new Dialog({
                    title: game.i18n.localize("DICESONICE.Options"),
                    content: `<form autocomplete="off" onsubmit="event.preventDefault();"></form>`,
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check-circle"></i>',
                            label: 'OK'
                        }
                    },
                    default: "ok",
                    render: (html) => {
                        sfxLineOptions.detach().appendTo($(html).find("form"));
                    },
                    close: (html) => {
                        $(html).find("[data-sfx-hidden-options]").detach().appendTo($(ev.target).parents(".sfx-line").find(".sfx-hidden"));
                        this.sfxDialogList = this.sfxDialogList.filter(dialog => dialog.appId != d.appId);
                    }
                });
                d.render(true);
                this.sfxDialogList.push(d);
            });

            $(this.element).on("change", "[data-sfx-dicetype]", (ev) => {
                let dicetype = $(ev.target).val();
                let optionHTML = $([]);
                if (dicetype != "") {
                    this.possibleResultList[dicetype].forEach(opt => {
                        let frag = $("<option></option>");
                        frag.html(opt.id);
                        frag.attr("value", opt.id);
                        optionHTML = optionHTML.add(frag);
                    });
                    $(ev.target).parents(".sfx-line").find("[data-sfx-result]").html(optionHTML).attr("data-sfx-result-dicetype", dicetype).trigger("change");
                } else {
                    $(ev.target).parents(".sfx-line").find("[data-sfx-result]").empty().trigger("change");
                }
            });

            $(this.element).on("change", "[data-sfx-result]", (ev) => {
                this.setPosition();
            });

            $(this.element).on("change", "[data-sfx-specialeffect]", (ev) => {
                this.sfxDialogList.forEach((dialog) => {
                    dialog.close();
                });
                this.sfxDialogList = [];
                let sfxLine = $(ev.target).parents(".sfx-line");

                let ID = sfxLine.prevAll(".sfx-line").length;
                let sfxClass = DiceSFXManager.SFX_MODE_CLASS[$(ev.target).val()];
                let dialogContent = sfxClass.getDialogContent({}, ID);
                let hdbsTemplate = Handlebars.compile(dialogContent.content);

                sfxLine.find(".sfx-hidden [data-sfx-hidden-options]").html(hdbsTemplate(dialogContent.data));
                for (let fp of sfxLine.find(".sfx-hidden [data-sfx-hidden-options] button.file-picker")) {
                    fp.onclick = this._activateFilePicker.bind(this);
                }
            });

            /**
             * Save As
             */
            $(this.element).on("click", "[data-saveas]", async (ev) => {
                let saves = game.user.getFlag("dice-so-nice", "saves");
                let saveList = new Map();
                if (saves)
                    saveList = new Map(Object.entries(saves));

                let dialogSaveAs = new Dialog({
                    title: game.i18n.localize("DICESONICE.SaveAs"),
                    width: 550,
                    content: await renderTemplate("modules/dice-so-nice/templates/dialog-saveas.html",
                        {
                            saveList: saveList.keys()
                        }),
                    buttons: {},
                    render: html => {
                        if (saveList.size) {
                            $(html).on("click", "[data-overwrite]", (ev) => {
                                let name = $(html).find("[data-save-list]").val();
                                this.actionSaveAs(name);
                                dialogSaveAs.close();
                            });

                            $(html).on("click", "[data-delete]", async (ev) => {
                                let name = $(html).find("[data-save-list]").val();
                                await this.actionDeleteSave(name);
                                saveList.delete(name);
                                $(html).find("[data-save-list] option:selected").remove();
                                if (!saveList.size) {
                                    $(html).find("[data-overwrite]").prop("disabled", true);
                                    $(html).find("[data-delete]").prop("disabled", true);
                                }
                            });

                        } else {
                            $(html).find("[data-overwrite]").prop("disabled", true);
                            $(html).find("[data-delete]").prop("disabled", true);
                        }

                        $(html).on("click", "[data-add-new]", (ev) => {
                            let name = $(html).find("[data-save-name]").val();
                            if (name) {
                                if (saveList.has(name)) {
                                    ui.notifications.error(game.i18n.localize("DICESONICE.SaveAsErrorAlreadyExist"));
                                } else {
                                    this.actionSaveAs(name);
                                    dialogSaveAs.close();
                                }
                            }
                            else
                                ui.notifications.error(game.i18n.localize("DICESONICE.SaveAsErrorName"));
                        });
                    }
                }, {
                    width: 450,
                    classes: ["dice-so-nice"]
                }).render(true);
            });

            /**
             * Load
             */
            $(this.element).on("click", "[data-load]", async (ev) => {
                let saves = game.user.getFlag("dice-so-nice", "saves");
                let saveList = [];
                if (saves)
                    saveList = new Map(Object.entries(saves));

                new Dialog({
                    title: game.i18n.localize("DICESONICE.Load"),
                    content: await renderTemplate("modules/dice-so-nice/templates/dialog-load.html",
                        {
                            saveList: saveList.keys()
                        }),
                    buttons: {
                        load: {
                            icon: '<i class="fas fa-box-open"></i>',
                            label: game.i18n.localize("DICESONICE.Load"),
                            callback: async html => {
                                let name = $(html).find("[data-save-list]").val();
                                await this.actionLoadSave(name);
                                //Close Dice Settings
                                this.close();
                            }
                        },
                        no: {
                            icon: '<i class="fas fa-ban"></i>',
                            label: game.i18n.localize("DICESONICE.Cancel")
                        }
                    },
                    render: html => {
                        if (!saveList.size)
                            $(html).find('[data-button="load"]').prop("disabled", true);
                    },
                    default: "no"
                }, {
                    width: 550
                }).render(true);
            });


            /**
             * Import
             */
            $(this.element).on("click", "[data-import]", async (ev) => {
                new Dialog({
                    title: game.i18n.localize("DICESONICE.Import"),
                    content: await renderTemplate("modules/dice-so-nice/templates/dialog-import.html"),
                    buttons: {
                        import: {
                            icon: '<i class="fas fa-file-import"></i>',
                            label: game.i18n.localize("DICESONICE.Import"),
                            callback: html => {
                                const form = html.find("form")[0];
                                if (!form.data.files.length) return ui.notifications.error(game.i18n.localize("DICESONICE.ImportNoFile"));
                                readTextFromFile(form.data.files[0]).then(async json => {
                                    await this.actionImportFromJSON(json);
                                    this.close();
                                });
                            }
                        },
                        no: {
                            icon: '<i class="fas fa-ban"></i>',
                            label: "Cancel"
                        }
                    },
                    default: "import"
                }, {
                    width: 400
                }).render(true);
            });

            $(this.element).on("click", "[data-export]", async (ev) => {
                const filename = `fvtt-dicesonice-${Date.now()}.json`;
                this.actionExportToJSON().then((json) => {
                    saveDataToFile(json, "text/json", filename);
                });
            });

            $(this.element).on("click", "[data-exportSFX]", async (ev) => {
                const filename = `fvtt-dicesonice-SFX-${Date.now()}.json`;
                this.actionExportSFXToJSON().then((json) => {
                    saveDataToFile(json, "text/json", filename);
                });
            });

            $(this.element).on("click", "#dice-configuration-canvas", (event) => {
                let rect = event.target.getBoundingClientRect();
                let x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                if (x > 1)
                    x = 1;
                let y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;
                let pos = { x: x, y: y };
                let dice = this.box.findShowcaseDie(pos);
                if (dice) {
                    let diceType = this.box.findRootObject(dice.object).userData;
                    if (!game.user.getFlag("dice-so-nice", "appearance") && (this.box.dicefactory.preferredSystem != "standard" || this.box.dicefactory.preferredColorset != "custom"))
                        this.getShowcaseAppearance();
                    if ($(this.element).find(`.dsn-appearance-tabs [data-tab="${diceType}"]`).length) {
                        this.activateAppearanceTab(diceType);
                    } else {
                        $(this.element).find(".dsn-appearance-hint").hide();
                        renderTemplate("modules/dice-so-nice/templates/partial-appearance.html", {
                            dicetype: diceType,
                            appearance: this.currentGlobalAppearance,
                            systemList: this.initializationData.systemList,
                            colorsetList: this.initializationData.colorsetList,
                            textureList: this.initializationData.textureList,
                            materialList: this.initializationData.materialList,
                            fontList: this.initializationData.fontList
                        }).then((html) => {
                            let tabName = diceType.toUpperCase();

                            let insertBefore = null;
                            //let's find where to insert the tab so it keeps the same order as the dice list
                            $(this.element).find(".dsn-appearance-tabs .item").each((index, el) => {
                                if (this.navOrder[$(el).data("tab")] >= this.navOrder[diceType]) {
                                    insertBefore = $(el).data("tab");
                                    return false;
                                }
                            });
                            let htmlNavString = `<span class="item" data-group="dsn-dice" data-tab="${diceType}">${tabName} <i class="fas fa-times" data-close-tab></i></span>`;
                            if (insertBefore) {
                                $(html).insertBefore($(this.element).find(`.tabAppearance[data-tab="${insertBefore}"]`));
                                $(htmlNavString).insertBefore($(this.element).find(`.dsn-appearance-tabs .item[data-tab="${insertBefore}"]`));
                            } else {
                                $(this.element).find("#dsn-appearance-content").append(html);
                                $(this.element).find(".dsn-appearance-tabs").append(htmlNavString);
                            }
                            this.activateAppearanceTab(diceType);
                            this.toggleCustomization(diceType);
                            this.filterSystems(diceType);
                        });
                    }
                }
            });
        }
    }

    async actionSaveAs(name) {
        await this.submit({
            preventClose: true,
            preventRender: true
        });

        Utils.actionSaveAs(name);
    }

    async actionDeleteSave(name) {
        await Utils.actionDeleteSave(name);
    }

    async actionLoadSave(name) {
        await Utils.actionLoadSave(name);
    }

    async actionExportToJSON() {

        //save current settings first
        await this.submit({
            preventClose: true,
            preventRender: true
        });
        let data = {
            appearance: game.user.getFlag("dice-so-nice", "appearance"),
            sfxList: game.user.getFlag("dice-so-nice", "sfxList"),
            settings: game.user.getFlag("dice-so-nice", "settings")
        };

        return JSON.stringify(data, null, 2);
    }

    async actionExportSFXToJSON() {

        //save current settings first
        await this.submit({
            preventClose: true,
            preventRender: true
        });
        let data = {
            sfxList: game.user.getFlag("dice-so-nice", "sfxList")
        };

        return JSON.stringify(data, null, 2);
    }

    async actionImportFromJSON(json) {
        let data = JSON.parse(json);

        if (data.appearance) {
            await game.user.unsetFlag("dice-so-nice", "appearance");
            await game.user.setFlag("dice-so-nice", "appearance", data.appearance);
        }
        if (data.sfxList) {
            await game.user.unsetFlag("dice-so-nice", "sfxList");
            await game.user.setFlag("dice-so-nice", "sfxList", data.sfxList);
        }
        if (data.settings) {
            await game.user.unsetFlag("dice-so-nice", "settings");
            await game.user.setFlag("dice-so-nice", "settings", data.settings);
        }
    }

    activateAppearanceTab(diceType) {
        let tabs = this._tabs[1];
        if (tabs.active != diceType)
            tabs.activate(diceType, { triggerCallback: true });
    }

    closeAppearanceTab(diceType) {
        if (diceType == "global")
            return;
        let tabs = this._tabs[1];
        if (this._tabs[1].active == diceType)
            tabs.activate("global", { triggerCallback: true });

        $(this.element).find(`.tabAppearance[data-tab="${diceType}"]`).remove();
        $(this.element).find(`.dsn-appearance-tabs [data-tab="${diceType}"]`).remove();

        this.onApply();
    }

    _onChangeTab(event, tabs, active) {
        super._onChangeTab(event, tabs, active);
        if (tabs._contentSelector == "#dsn-appearance-content") {
            if (this.lastActiveAppearanceTab != "global") {
                let appearanceArray = [];
                $(this.element).find(`.tabAppearance[data-tab="global"],.tabAppearance[data-tab="${this.lastActiveAppearanceTab}"]`).each((index, element) => {
                    let obj = {
                        labelColor: $(element).find('[data-labelColor]').val(),
                        diceColor: $(element).find('[data-diceColor]').val(),
                        outlineColor: $(element).find('[data-outlineColor]').val(),
                        edgeColor: $(element).find('[data-edgeColor]').val(),
                        colorset: $(element).find('[data-colorset]').val(),
                        texture: $(element).find('[data-texture]').val(),
                        material: $(element).find('[data-material]').val(),
                        font: $(element).find('[data-font]').val(),
                        system: $(element).find('[data-system]').val(),
                    };
                    //disabled systems arent returned
                    if (obj.system == null) {
                        obj.system = this.currentGlobalAppearance.system;
                    }
                    appearanceArray.push(obj);
                });
                if (appearanceArray.length > 1) {
                    let diff = diffObject(appearanceArray[0], appearanceArray[1]);
                    if (isObjectEmpty(diff)) {
                        this.closeAppearanceTab(this.lastActiveAppearanceTab)
                    }
                }
            }
            this.lastActiveAppearanceTab = active;
        }
    }

    toggleHideAfterRoll() {
        let hideAfterRoll = $(this.element).find('[data-hideAfterRoll]')[0].checked;
        $(this.element).find('[data-timeBeforeHide]').prop("disabled", !hideAfterRoll);
        $(this.element).find('[data-hideFX]').prop("disabled", !hideAfterRoll);
    }

    toggleSounds() {
        let sounds = $(this.element).find('[data-sounds]')[0].checked;
        $(this.element).find('[data-soundsSurface]').prop("disabled", !sounds);
        $(this.element).find('[data-soundsVolume]').prop("disabled", !sounds);
        //$('.sounds-range-value').css({ 'opacity': !sounds ? 0.4 : 1 });
    }

    toggleAutoScale() {
        let autoscale = $(this.element).find('[data-autoscale]')[0].checked;
        $(this.element).find('[data-scale]').prop("disabled", autoscale);
        //$('.scale-range-value').css({ 'opacity': autoscale ? 0.4 : 1 });
    }

    toggleCustomColors(dicetype) {
        let scope = $(this.element).find(".tabAppearance");
        if (dicetype) {
            scope = scope.filter(`[data-tab="${dicetype}"]`);
        }
        scope.each((index, element) => {
            let colorset = $(element).find('[data-colorset]');
            let disabled = colorset.val() !== 'custom' || colorset.prop("disabled");
            $(element).find('[data-labelColor]').prop("disabled", disabled);
            $(element).find('[data-diceColor]').prop("disabled", disabled);
            $(element).find('[data-outlineColor]').prop("disabled", disabled);
            $(element).find('[data-edgeColor]').prop("disabled", disabled);
            $(element).find('[data-labelColorSelector]').prop("disabled", disabled);
            $(element).find('[data-diceColorSelector]').prop("disabled", disabled);
            $(element).find('[data-outlineColorSelector]').prop("disabled", disabled);
            $(element).find('[data-edgeColorSelector]').prop("disabled", disabled);
        });
    }

    toggleCustomization(diceType = null) {
        let container;
        if (diceType) {
            container = $(this.element).find(`.tabAppearance[data-tab="${diceType}"]`);
        } else {
            container = $(this.element).find(`.tabAppearance`);
        }

        container.each((index, element) => {
            let diceType = $(element).data("tab");
            if (diceType != "global") {
                let system = $(element).find('[data-system]').val();
                let customizationElements = $(element).find('[data-colorset],[data-texture],[data-material],[data-font]');
                if (system != "standard") {
                    let diceobj = this.box.dicefactory.systems[system].dice.find(obj => obj.type == diceType);
                    if (diceobj) {
                        let colorsetData = {};
                        if (diceobj.colorset) {
                            colorsetData = DiceColors.getColorSet(diceobj.colorset);
                        }
                        customizationElements.each((index, el) => {
                            let colorsetForce = false;
                            if ($(el).is("[data-colorset]") && !isObjectEmpty(colorsetData))
                                colorsetForce = true;
                            else if ($(el).is("[data-texture]") && !isObjectEmpty(colorsetData) && colorsetData.texture != "custom")
                                colorsetForce = true;
                            else if ($(el).is("[data-material]") && !isObjectEmpty(colorsetData) && colorsetData.material != "custom")
                                colorsetForce = true;
                            else if ($(el).is("[data-font]") && ((!isObjectEmpty(colorsetData) && colorsetData.font != "custom") || diceobj.font))
                                colorsetForce = true;
                            $(el).prop("disabled", diceobj.modelFile || colorsetForce);
                        });
                    }
                } else {
                    customizationElements.prop("disabled", false);
                }
            }
        });
        this.toggleCustomColors(diceType);
    }

    filterSystems(diceType = null) {
        let container;
        if (diceType) {
            container = $(this.element).find(`.tabAppearance[data-tab="${diceType}"] [data-system]`);
        } else {
            container = $(this.element).find(`.tabAppearance [data-system]`);
        }
        container.each((index, element) => {
            let diceType = $(element).data("dicetype");
            if (diceType != "global") {
                $(element).find("option").each((indexOpt, elementOpt) => {
                    let model = this.box.dicefactory.systems["standard"].dice.find(obj => obj.type == diceType);
                    if (!this.box.dicefactory.systems[$(elementOpt).val()].dice.find(obj => obj.type == diceType || (model && obj.shape == model.shape && obj.values.length == model.values.length)))
                        $(elementOpt).attr("disabled", "disabled");
                });
            }
        });
    }

    setPreferredOptions() {
        if (!game.user.getFlag("dice-so-nice", "appearance")) {
            if (this.box.dicefactory.preferredSystem != "standard")
                $(this.element).find('.tabAppearance[data-tab="global"] [data-system]').val(this.box.dicefactory.preferredSystem);
            if (this.box.dicefactory.preferredColorset != "custom")
                $(this.element).find('.tabAppearance[data-tab="global"] [data-colorset]').val(this.box.dicefactory.preferredColorset);
        }
    }

    getShowcaseAppearance() {
        let config = {
            autoscale: false,
            scale: 60,
            shadowQuality: $('[data-shadowQuality]').val(),
            bumpMapping: $('[data-bumpMapping]').is(':checked'),
            sounds: $('[data-sounds]').is(':checked'),
            throwingForce: $('[data-throwingForce]').val(),
            useHighDPI: $('[data-useHighDPI]').is(':checked'),
            showExtraDice: $('[data-showExtraDice]').is(':checked'),
            muteSoundSecretRolls: $('[data-muteSoundSecretRolls]').is(':checked'),
            enableFlavorColorset: $('[data-enableFlavorColorset]').is(':checked'),
            appearance: {}
        };
        $(this.element).find('.tabAppearance').each((index, element) => {
            config.appearance[$(element).data("tab")] = {
                labelColor: $(element).find('[data-labelColor]').val(),
                diceColor: $(element).find('[data-diceColor]').val(),
                outlineColor: $(element).find('[data-outlineColor]').val(),
                edgeColor: $(element).find('[data-edgeColor]').val(),
                colorset: $(element).find('[data-colorset]').val(),
                texture: $(element).find('[data-texture]').val(),
                material: $(element).find('[data-material]').val(),
                font: $(element).find('[data-font]').val(),
                system: $(element).find('[data-system]').val(),
            };
        });
        this.currentGlobalAppearance = config.appearance.global;
        return config;
    }

    //Not used because SFX aren't initialized. Keeping it here for later use.
    getShowcaseSFX() {
        let sfxList = [];

        $(this.element).find('.sfx-line').each((index, element) => {
            let sfx = {
                diceType: $(element).find('[data-sfx-dicetype]').val(),
                onResult: $(element).find('[data-sfx-result]').val(),
                specialEffect: $(element).find('[data-sfx-specialeffect]').val(),
                options: {}
            };
            $(element).find("[data-sfx-hidden-options]").find("input,select").each((i, el) => {
                let name = $(el).attr("name").match(/.*\[(.*)\]$/)[1];
                if ($(el).attr("type") == "checkbox")
                    sfx.options[name] = $(el).prop("checked");
                else
                    sfx.options[name] = $(el).val();
            });
            if (sfx.diceType && sfx.onResult && sfx.specialEffect)
                sfxList.push(sfx);
        });
        return sfxList;
    }

    onApply(event = null) {
        if (event)
            event.preventDefault();

        setTimeout(() => {
            let config = this.getShowcaseAppearance();
            this.box.dicefactory.disposeCachedMaterials("showcase");
            this.box.update(config).then(() => {
                this.box.showcase(config);
            });
        }, 100);
    }

    onReset() {
        this.reset = true;
        this.render();
        this._tabs[0].activate("general");
    }

    parseInputs(data) {
        var ret = {};
        retloop:
        for (var input in data) {
            var val = data[input];

            var parts = input.split('[');
            var last = ret;

            for (var i in parts) {
                var part = parts[i];
                if (part.substr(-1) == ']') {
                    part = part.substr(0, part.length - 1);
                }

                if (i == parts.length - 1) {
                    last[part] = val;
                    continue retloop;
                } else if (!last.hasOwnProperty(part)) {
                    last[part] = {};
                }
                last = last[part];
            }
        }
        return ret;
    }

    async _updateObject(event, formData) {
        //Remove custom settings if custom isn't selected to prevent losing them in the user save
        formData = this.parseInputs(formData);
        let sfxLine = formData.sfxLine;
        if (sfxLine) {
            sfxLine = Object.values(sfxLine);
            //Remove empty lines
            for (let i = sfxLine.length - 1; i >= 0; i--) {
                //also prevent bug #217, unknown cause
                if (sfxLine[i].diceType == undefined || sfxLine[i].diceType == "" || sfxLine[i].onResult == "" || Array.isArray(sfxLine[i].diceType) || Array.isArray(sfxLine[i].specialEffect))
                    sfxLine.splice(i, 1);
            }
            //Remove duplicate lines
            let dataArr = sfxLine.map(item => {
                return [JSON.stringify(item), item]
            });
            let mapArr = new Map(dataArr);

            sfxLine = [...mapArr.values()];

            delete formData.sfxLine;
        }

        for (let scope in formData.appearance) {
            if (formData.appearance.hasOwnProperty(scope)) {
                if (formData.appearance[scope].colorset != "custom") {
                    delete formData.appearance[scope].labelColor;
                    delete formData.appearance[scope].diceColor;
                    delete formData.appearance[scope].outlineColor;
                    delete formData.appearance[scope].edgeColor;
                }
            }
        }
        let currentSettings = Dice3D.CONFIG();

        //required
        await game.user.unsetFlag("dice-so-nice", "sfxList");
        await game.user.unsetFlag("dice-so-nice", "appearance");
        await game.user.unsetFlag("dice-so-nice", "settings");


        let appearance = mergeObject(Dice3D.APPEARANCE(), formData.appearance, { insertKeys: true, insertValues: false });
        delete formData.appearance;
        let settings = mergeObject(Dice3D.CONFIG(), formData, { insertKeys: false, insertValues: false });

        // preserve rollingArea config
        settings.rollingArea = currentSettings.rollingArea;

        await game.user.setFlag('dice-so-nice', 'settings', settings);
        await game.user.setFlag("dice-so-nice", "appearance", appearance);
        await game.user.setFlag("dice-so-nice", "sfxList", sfxLine);

        game.socket.emit("module.dice-so-nice", { type: "update", user: game.user.id });
        DiceSFXManager.init();
        ui.notifications.info(game.i18n.localize("DICESONICE.saveMessage"));

        if ((currentSettings.canvasZIndex != settings.canvasZIndex) ||
            (currentSettings.bumpMapping != settings.bumpMapping) ||
            (currentSettings.useHighDPI != settings.useHighDPI)) {
            window.location.reload();
        }
        else
            game.dice3d.update(settings);
    }

    close(options) {
        super.close(options);
        this.box.clearScene();
        this.box.dicefactory.disposeCachedMaterials("showcase");
    }

    async _onSubmit(event, options) {
        this.sfxDialogList.forEach((dialog) => {
            dialog.close();
        });
        await super._onSubmit(event, options);
    }
}