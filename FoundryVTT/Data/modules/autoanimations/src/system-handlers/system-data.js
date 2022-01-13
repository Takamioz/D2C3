import { endTiming } from "../constants/timings.js";
import { AASystemData } from "./getdata-by-system.js";
import { flagMigrations } from "./flagMerge.js";
import { AutorecFunctions } from "../aa-classes/autorecFunctions.js";

export default class flagHandler {

    static async make(msg, isChat, external) {
        const systemID = game.system.id.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, "");
        const data = external ? external : await AASystemData[systemID](msg, isChat)
        if (!data.item) { /*this._log("Retrieval Failed")*/; return {}; }
        //this._log("Data Retrieved", data)

        //console.log(data.item.data.flags.autoanimations)
        const flags = await flagMigrations.handle(data.item);

        return new flagHandler(data, flags)
    }

    constructor(systemData, flagData) {
        this.debug = game.settings.get("autoanimations", "debug");
        this._log("Getting System Data")

        const data = systemData;

        const midiActive = game.modules.get('midi-qol')?.active;

        this.flags = flagData ?? {};
        this.animation = this.flags.animation || "";

        this.reachCheck = data.reach || 0;
        this.item = data.item;
        this.hasAttack = this.item?.hasAttack ?? false;
        this.hasDamage = this.item?.hasDamage ?? false;
        this.itemName = this.item.name?.toLowerCase() ?? "";
        this.itemMacro = this.item.data?.flags?.itemacro?.macro?.data?.name ?? "";
        this.itemType = this.item.data?.type?.toLowerCase() ?? "";

        this.actorToken = data.token.isEmbedded ? data.token.object : data.token;
        this.actor = data.token.actor;
        this.allTargets = data.targets;
        this.hitTargets = data.hitTargets;
        this.hitTargetsId = data.hitTargets ? Array.from(this.hitTargets.filter(actor => actor.id).map(actor => actor.id)) : [];
        this.targetsId = Array.from(this.allTargets.filter(actor => actor.id).map(actor => actor.id));

        //midi-qol specific settings
        this.playOnMiss = midiActive || game.system.id === 'pf2e' ? game.settings.get("autoanimations", "playonmiss") : false;
        //this.playOnMiss = true;
        const midiSettings = midiActive ? game.settings.get("midi-qol", "ConfigSettings") : false
        this._gmAD = midiActive ? midiSettings?.gmAutoDamage : "";
        this._userAD = midiActive ? midiSettings?.autoRollDamage : "";


        this.animKill = this.flags.killAnim || false;
        this.animOverride = this.flags.override || false;
        this.animType = this.flags.animType || "";

        this.bards = this.flags.bards ?? {};

        this.autoOverride = this.flags.autoOverride ?? {};

        this.animNameFinal;
        switch (true) {
            case ((!this.flags.override) || ((this.flags.override) && (this.animation === ``))):
                this.animNameFinal = this.itemName;
                break;
            default:
                this.animNameFinal = this.animation;
                break;
        }
        
        this.convertedName = this.animation.replace(/\s+/g, '');
        this.animEnd = endTiming(this.animNameFinal);
        this.autorecSettings = game.settings.get('autoanimations', 'aaAutorec');

        this.rinsedName = this.itemName ? AutorecFunctions._rinseName(this.itemName) : "noitem";
        this.AutorecTemplateItem = AutorecFunctions._autorecNameCheck(AutorecFunctions._getAllNames(this.autorecSettings, 'templates'), this.rinsedName);
        this.autorecObject = AutorecFunctions._findObjectFromArray(this.autorecSettings, this.rinsedName);

        this.isAutorecFireball = false;
        this.isAutorecAura = false;
        if (this.autorecObject && !this.animOverride) {
            this.isAutorecFireball = this.autorecObject.menuSection === "preset" && this.autorecObject.animation === "fireball" ? true : false;
            this.isAutorecAura = this.autorecObject.menuSection === "aura" ? true : false
        }
        this.isAutorecTemplate = (this.AutorecTemplateItem || this.isAutorecFireball) && !this.animOverride ? true : false;

        this.isOverrideTemplate = (this.animType === "template" && this.animOverride) || (this.animType === "preset" && this.flags.animation === "fireball" && this.animOverride) ? true : false;
        this.isOverrideAura = this.animType === "aura" && this.animOverride ? true: false;
        this.decoupleSound = game.settings.get("autoanimations", "decoupleSound")
    }

    get isTemplateOrAuraAnimation () {
        return this.isOverrideAura || this.isAutorecAura || this.isOverrideTemplate || this.isAutorecTemplate;
    }

    get soundNoAnimation () {
        return this.animKill && this.flags.audio?.a01?.enable && this.flags.audio?.a01?.file
    }

    getDistanceTo(target) {
        if (game.system.id === 'pf1') {
            const scene = game.scenes.active;
            const gridSize = scene.data.grid;

            const left = (token) => token.data.x;
            const right = (token) => token.data.x + token.w;
            const top = (token) => token.data.y;
            const bottom = (token) => token.data.y + token.h;

            const isLeftOf = right(this.actorToken) <= left(target);
            const isRightOf = left(this.actorToken) >= right(target);
            const isAbove = bottom(this.actorToken) <= top(target);
            const isBelow = top(this.actorToken) >= bottom(target);

            let x1 = left(this.actorToken);
            let x2 = left(target);
            let y1 = top(this.actorToken);
            let y2 = top(target);

            if (isLeftOf) {
                x1 += (this.actorToken.data.width - 1) * gridSize;
            }
            else if (isRightOf) {
                x2 += (target.data.width - 1) * gridSize;
            }

            if (isAbove) {
                y1 += (this.actorToken.data.height - 1) * gridSize;
            }
            else if (isBelow) {
                y2 += (target.data.height - 1) * gridSize;
            }

            const ray = new Ray({ x: x1, y: y1 }, { x: x2, y: y2 });
            const distance = canvas.grid.grid.measureDistances([{ ray }], { gridSpaces: true })[0];
            return distance;
        } else {
            var x, x1, y, y1, d, r, segments = [], rdistance, distance;
            for (x = 0; x < this.actorToken.data.width; x++) {
                for (y = 0; y < this.actorToken.data.height; y++) {
                    const origin = new PIXI.Point(...canvas.grid.getCenter(this.actorToken.data.x + (canvas.dimensions.size * x), this.actorToken.data.y + (canvas.dimensions.size * y)));
                    for (x1 = 0; x1 < target.data.width; x1++) {
                        for (y1 = 0; y1 < target.data.height; y1++) {
                            const dest = new PIXI.Point(...canvas.grid.getCenter(target.data.x + (canvas.dimensions.size * x1), target.data.y + (canvas.dimensions.size * y1)));
                            const r = new Ray(origin, dest);
                            segments.push({ ray: r });
                        }
                    }
                }
            }
            if (segments.length === 0) {
                return -1;
            }
            rdistance = canvas.grid.measureDistances(segments, { gridSpaces: true });
            distance = rdistance[0];
            rdistance.forEach(d => {
                if (d < distance)
                    distance = d;
            });
            return distance;
        }
    }

    _log(...args) {
        if (this.debug) console.log(`DEBUG | Automated Animations |`, ...args);
    }
}



