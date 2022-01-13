import { buildFile } from "../animation-functions/file-builder/build-filepath.js";
import { particleDefaultValues } from "../animation-functions/particleDefaults.js";

export class AAanimationData {

    static async _getAnimationData(handler, autoObject) {
        const data = {
            primary: autoObject ? await this._primaryData(handler, autoObject) : await this._primaryData(handler),
            sourceFX: await this._sourceFX(handler),
            targetFX: await this._targetFX(handler),
        }
        return data;
    }

    static async _primaryData(handler, autoObject) {

        if (autoObject) {
            const data = {};
            const autoOverridden = handler.autoOverride?.enable
            Object.assign(data, autoObject);
            data.isAuto = true;
            data.animation = data.animation || "";
            data.customPath = data.custom ? data.customPath : false;
            data.customPath02 = data.custom02 ? data.customPath02 : false;

            data.staticType = data.type || "targetDefault";
            data.color = autoOverridden ? handler.autoOverride?.color : data.color;
            data.color02 = autoOverridden ? handler.autoOverride?.color02 : data.color02;
            data.repeat = autoOverridden ? handler.autoOverride?.repeat : data.repeat;
            data.delay = autoOverridden ? handler.autoOverride?.delay : data.delay || 0;
            data.scale = autoOverridden ? handler.autoOverride?.scale || 1 : data.scale || 1;
            data.scale02 = autoOverridden ? handler.autoOverride?.scale02 || 1 : data.scale02 || 1;
            data.scaleX = autoOverridden ? handler.autoOverride?.scaleX || 1 : data.scaleX || 1;
            data.scaleY = autoOverridden ? handler.autoOverride?.scaleY || 1 : data.scaleY || 1;
            data.opacity = data.opacity || 1;
            data.variant = autoOverridden ? handler.autoOverride?.variant : data.variant;
            data.variant02 = autoOverridden ? handler.autoOverride?.variant02 || "01" : data.variant02 || "01";
            data.persistent = autoOverridden ? handler.autoOverride?.persistent : data.persistent;
            data.menuType = data.staticOptions === 'shieldfx' ? true : false;
            data.below = data.below ?? false;
            data.measureType = data.measureType ?? 'alternating';
            data.hideFromPlayers = false,

            data.itemAudio = {
                enable: data.audio?.a01?.enable || false,
                file: data.audio?.a01?.file,
                volume: data.audio?.a01?.volume || 0.25,
                delay: data.audio?.a01?.delay || 0,
                repeat: handler.decoupleSound ? 1 : data.repeat,
            }

            data.switchAnimation = data.switchAnimation === undefined ? data.animation : data.switchAnimation;
            data.switchColor = data.switchColor === undefined ? data.color : data.switchColor;
            data.switchAudio = {
                enable: data.audio?.a02?.enable || false,
                file: data.audio?.a02?.file,
                volume: data.audio?.a02?.volume || 0.25,
                delay: data.audio?.a02?.delay || 0,
                repeat: handler.decoupleSound ? 1 : data.repeat,
            }

            data.removeTemplate = data.removeTemplate || false;
            data.occlusionMode = parseInt(data.occlusionMode ?? "3");
            data.occlusionAlpha = data.occlusionAlpha ?? "0";
            data.persistType = data.persistType || "sequencerground";

            data.ignoreTargets = data.ignoretargets || false;
            data.playSound = data.itemAudio.enable && data.itemAudio.file ? true : false;

            data.explosion = await this._explosionData(handler, true)
            return data;
        } else {
            const flags = handler.flags;
            const meleeSwitch = flags.meleeSwitch || {};
            const options = flags.options || {};
            const data = {
                isAuto: false,
                animation: flags.animation?.toLowerCase(),
                color: flags.color?.toLowerCase() ?? "",
                color02: flags.color02?.toLowerCase() ?? "",
                below: flags.animLevel || false,

                options: options,
                variant: options.variant || "01",
                variant02: options.variant02 || "01",
                repeat: options.repeat || 1,
                delay: options.delay || 250,
                scale: options.scale || 1,
                scaleX: options.scaleX || 1,
                scaleY: options.scaleY || 1,
                scale02: options.scale02 || 1,
                opacity: options.opacity || 1,
                persistent: options.persistent || false,
                enableCustom: options.enableCustom || false,
                enableCustom02: options.enableCustom02 || false,
                customPath: options.enableCustom ? options.customPath : false,
                customPath02: options.enableCustom02 ? options.customPath02 : false,
                staticType: options.staticType || "targetDefault",
                menuType: options.staticOptions === 'shieldfx' ? true : false,
                anchorX: options.anchorX || 1,
                anchorY: options.anchorY || 1,
                auraRadius: options.auraRadius || 3.5,
                teleDist: options.teleDist || 30,
                ignoreTargets: options.ignoreTargets || false,
                tempType: options.tempType || "circle",
                hideTemplate: options.hideTemplate || false,
                removeTemplate: options.removeTemplate ?? false,
                occlusionMode: parseInt(options.occlusionMode ?? "3"),
                occlusionAlpha: options.occlusionAlpha ?? "0",
                persistType: options.persistType || "sequencerground",
                measureType: options.measureType || "alternating",
                hideFromPlayers: options.hideFromPlayers || false,

                itemAudio: {
                    enable: flags.audio?.a01?.enable || false,
                    file: flags.audio?.a01?.file,
                    volume: flags.audio?.a01?.volume || 0.25,
                    delay: flags.audio?.a01?.delay || 0,
                    repeat: handler.decoupleSound ? 1 : options.repeat || 1,
                },

                switchAnimation: meleeSwitch.switchType === 'custom' ? meleeSwitch.animation || "" : flags.animation || "",
                switchType: meleeSwitch.switchType || "on",
                switchColor: meleeSwitch.color || "white",
                detect: meleeSwitch.detect ?? "auto",
                return: meleeSwitch.returning || false,
                switchVariant: meleeSwitch.variant ?? "01",
                range: meleeSwitch.range ?? 2,
                switchType: meleeSwitch.switchType ?? "on",
                switchAudio: {
                    enable: flags.audio?.a02?.enable || false,
                    file: flags.audio?.a02?.file,
                    volume: flags.audio?.a02?.volume || 0.25,
                    delay: flags.audio?.a02?.delay || 0,
                    repeat: handler.decoupleSound ? 1 : options.repeat || 1,
                },
                explosion: await this._explosionData(handler, false),
            }
            data.playSound = data.itemAudio?.enable && data.itemAudio?.file ? true : false;
            if (data.switchAnimation === 'shortsword') { data.switchAnimation = 'sword' };
            return data;
        }
    }

    static async _explosionData(handler, autorec) {
        if (autorec) {
            const explosion = {
                enabled: false,
                animation: "",
                variant: "",
                color: "",
                delay: 1,
                radius: 1.5,
                enableCustom: false,
                customPath: false,
                below: false,
                audio: {
                    enable: false,
                    //file: handler.audio?.e01?.file,
                    volume: 0.25,
                    delay: 0,
                    repeat: 1,
                }
            }
            explosion.data = "";
            explosion.scale = 1;

            return explosion;
        } else {
            const explosions = handler.flags.explosions || {};
            const explosion = {
                enabled: explosions.enable || false,
                animation: explosions.animation || "",
                variant: explosions.variant ?? "",
                color: explosions.color || "",
                delay: (explosions.delay || 1) + 500,
                radius: explosions.radius || 1.5,
                enableCustom: explosions.enableCustom || false,
                customPath: explosions.enableCustom ? explosions.customPath : false,
                below: explosions.below || false,
                audio: {
                    enable: handler.flags.audio?.e01?.enable || false,
                    file: handler.flags.audio?.e01?.file,
                    volume: handler.flags.audio?.e01?.volume || 0.25,
                    delay: handler.flags.audio?.e01?.delay || 0,
                    repeat: handler.decoupleSound ? 1 : handler.flags?.options?.repeat || 1,
                },
            };
            explosion.playSound = explosion.enabled && explosion.audio?.enable && explosion.audio?.file !== "";
            explosion.data = explosion.enabled ? await buildFile(true, explosion.animation, "static", explosion.variant, explosion.color, explosion.customPath) : "";
            explosion.scale = ((200 * explosion.radius) / explosion.data?.metadata?.width) ?? 1;
            return explosion;
        }
    }

    static async _sourceFX(handler) {
        const source = handler.flags.sourceToken || {};
        const enableCustom = source.enableCustom || false;
        const sourceFX = {
            enabled: source.enable || false,
            customSourcePath: enableCustom ? source.customPath : false,
            repeat: source.loops || 1,
            delay: source.loopDelay || 250,
            below: source.animLevel || false,
            startDelay: source.delayAfter || 500,
            scale: source.scale || 1,
            animation: source.name || "",
            color: source.color,
            variant: source.variant,
            opacity: source.opacity || 1,
            itemAudio: {
                enable: handler.flags.audio?.s01?.enable || false,
                file: handler.flags.audio?.s01?.file,
                volume: handler.flags.audio?.s01?.volume || 0.25,
                delay: handler.flags.audio?.s01?.delay || 0,
                repeat: handler.decoupleSound ? 1 : source.loops || 1,
            },
        }

        if (source.enable && source.name === "a1" && !source.enableCustom) {
            sourceFX.enabled = false;
            console.warn("AUTOMATED ANIMATIONS || Target Animation is enabled on this item but NO Animation is chosen!");
        }
        const sourceScale = handler.actorToken.w;
        sourceFX.data = sourceFX.enabled ? await buildFile(true, sourceFX.animation, "static", sourceFX.variant, sourceFX.color, sourceFX.customSourcePath) : "";
        sourceFX.sFXScale = sourceFX.enabled ? 2 * sourceScale / sourceFX.data?.metadata?.width : 1;
        sourceFX.sourceSeq = new Sequence();
        sourceFX.sourceSeq.sound()
            .file(sourceFX.itemAudio.file)
            .volume(sourceFX.itemAudio.volume)
            .delay(sourceFX.itemAudio.delay)
            .playIf(() => {
                return sourceFX.itemAudio.enable && sourceFX.itemAudio.file && sourceFX.enabled;
            })
        sourceFX.sourceSeq.effect()
            .file(sourceFX.data.file)
            .atLocation(handler.actorToken)
            .gridSize(canvas.grid.size)
            .scale(sourceFX.sFXScale * sourceFX.scale)
            .repeats(sourceFX.repeat, sourceFX.delay)
            .belowTokens(sourceFX.below)
            .opacity(sourceFX.opacity)
            .waitUntilFinished(sourceFX.startDelay)
            .playIf(sourceFX.enabled)

        return sourceFX;
    }

    static async _targetFX(handler) {
        const target = handler.flags?.targetToken || {};
        const enableCustom = target.enableCustom || false;
        const targetFX = {
            enabled: target.enable || false,
            customTargetPath: enableCustom ? target.customPath : false,
            repeat: target.loops || 1,
            delay: target.loopDelay || 250,
            below: target.animLevel || false,
            startDelay: target.delayStart || 500,
            scale: target.scale || 1,
            animation: target.name || "",
            color: target.color,
            variant: target.variant,
            persistent: target.persistent || false,
            opacity: target.opacity || 1,
            itemAudio: {
                enable: handler.flags.audio?.t01?.enable || false,
                file: handler.flags.audio?.t01?.file,
                volume: handler.flags.audio?.t01?.volume || 0.25,
                delay: handler.flags.audio?.t01?.delay || 0,
                repeat: handler.decoupleSound ? 1 : target.loops || 1,
            },
        }

        if (target.enable && target.name === "a1" && !target.enableCustom) {
            targetFX.enabled = false;
            console.warn("AUTOMATED ANIMATIONS || Target Animation is enabled on this item but NO Animation is chosen!");
        }
        targetFX.data = targetFX.enabled ? await buildFile(true, targetFX.animation, "static", targetFX.variant, targetFX.color, targetFX.customTargetPath) : {};
        return targetFX
    }

    static _targetSequence(targetFX, target, handler) {
        let hit;
        if (handler.playOnMiss) {
            hit = handler.hitTargetsId.includes(target.id) ? true : false;
        } else {
            hit = true;
        }

        const playNow = (targetFX.enabled && hit) ? true : false;

        targetFX.tFXScale = targetFX.enabled ? 2 * target.w / targetFX.data.metadata?.width : 1;
        targetFX.targetSeq = new Sequence();
        targetFX.targetSeq.sound()
            .file(targetFX.itemAudio?.file)
            .volume(targetFX.itemAudio?.volume)
            .delay(targetFX.itemAudio?.delay + targetFX.startDelay)
            .repeats(targetFX.repeat, targetFX.delay)
            .playIf(() => {
                return targetFX.itemAudio?.enable && targetFX.itemAudio?.file && targetFX.enabled;
            })
        targetFX.targetSeq.effect()
            .delay(targetFX.startDelay)
            .file(targetFX.data?.file)
            .atLocation(target)
            .scale(targetFX.tFXScale * targetFX.scale)
            .repeats(targetFX.repeat, targetFX.delay)
            .belowTokens(targetFX.below)
            .persist(targetFX.persistent)
            .gridSize(canvas.grid.size)
            .opacity(targetFX.opacity)
            .playIf(playNow)

        return targetFX;
    }

    static removePersistentEffect(token, effectName, sceneID) {
        let clsd = false;
        const tokenName = token.name;
        let d = new Dialog({
            title: tokenName,
            buttons: {
                yes: {
                    label: "Remove " + effectName,
                    callback: (html) => { clsd = true }
                },
            },
            default: 'yes',
            close: () => {
                if (clsd === false) console.log('This was closed without using a button');
                if (clsd === true) Sequencer.EffectManager.endEffects({ object: token, name: effectName, sceneId: sceneID });
            }
        },
            { width: 100, height: 75 }
        );
        d.options.resizable = true;
        d.render(true)
    }

    static howToDelete(type) {
        switch (type) {
            case 'overheadtile':
                ui.notifications.info("This is an OVERHEAD Tile. Use the Tile Foreground Layer to remove the Animation")
                break;
            case 'groundtile':
                ui.notifications.info("This is an GROUND Tile. Use the Tile Layer to remove the Animation")
                break;
            case 'sequencerground':
                ui.notifications.info("This is SEQUENCER Persistent Effect. Use the Sequencer Effect Manager to remove the Animation")
                break
        }
    }

    static async compileParticleData(autoObject, options3d) {
        const type = options3d.type;
        if (autoObject) {
            const explode3d = options3d.addexplosion || {};
            const data = {
                type: type,
                speed: options3d.speed ?? particleDefaultValues[type].speed,
                repeat: options3d.repeat ?? particleDefaultValues[type].repeat,
                delay: options3d.delay ?? particleDefaultValues[type].delay,
                arc: options3d.arc ?? particleDefaultValues[type].arc,
                scale: options3d.scale ?? particleDefaultValues[type].scale,
                color01: options3d.color01 ?? particleDefaultValues[type].color01,
                color02: options3d.color02 ?? particleDefaultValues[type].color02,
                sprite: options3d.sprite ?? particleDefaultValues[type].sprite,
                life: options3d.life ?? particleDefaultValues[type].life,
                emittersize: options3d.emittersize ?? particleDefaultValues[type].emittersize,
                alpha: options3d.alpha ?? particleDefaultValues[type].alpha,
                mass: options3d.mass ?? particleDefaultValues[type].mass,
                gravity: options3d.gravity ?? particleDefaultValues[type].gravity,
                rate: options3d.rate ?? particleDefaultValues[type].rate,
                explosion: {
                    enable: explode3d.enable || false,
                    color01: explode3d.color01 ?? particleDefaultValues[type].explosion.color01,
                    color02: explode3d.color02 ?? particleDefaultValues[type].explosion.color02,
                    speed: explode3d.speed ?? particleDefaultValues[type].explosion.speed,
                    gravity: explode3d.gravity ?? particleDefaultValues[type].explosion.gravity,
                    life: explode3d.life ?? particleDefaultValues[type].explosion.life,
                    rate: explode3d.rate ?? particleDefaultValues[type].explosion.rate,
                    emittersize: explode3d.emittersize ?? particleDefaultValues[type].explosion.emittersize,
                    alpha: explode3d.alpha ?? particleDefaultValues[type].explosion.alpha,
                    mass: explode3d.mass ?? particleDefaultValues[type].explosion.mass,
                    sprite: explode3d.sprite ?? particleDefaultValues[type].explosion.sprite,
                    scale: explode3d.scale ?? particleDefaultValues[type].explosion.scale,
                }
            };
            return data;
        } else {
            const explode3d = options3d[type].addexplosion || {};
            const data = {
                type: type,
                speed: options3d[type].speed ?? particleDefaultValues[type].speed,
                repeat: options3d[type].repeat ?? particleDefaultValues[type].repeat,
                delay: options3d[type].delay ?? particleDefaultValues[type].delay,
                arc: options3d[type].arc ?? particleDefaultValues[type].arc,
                scale: options3d[type].scale ?? particleDefaultValues[type].scale,
                color01: options3d[type].color01 ?? particleDefaultValues[type].color01,
                color02: options3d[type].color02 ?? particleDefaultValues[type].color02,
                sprite: options3d[type].sprite ?? particleDefaultValues[type].sprite,
                life: options3d[type].life ?? particleDefaultValues[type].life,
                emittersize: options3d[type].emittersize ?? particleDefaultValues[type].emittersize,
                alpha: options3d[type].alpha ?? particleDefaultValues[type].alpha,
                mass: options3d[type].mass ?? particleDefaultValues[type].mass,
                gravity: options3d[type].gravity ?? particleDefaultValues[type].gravity,
                rate: options3d[type].rate ?? particleDefaultValues[type].rate,
                explosion: {
                    enable: explode3d.enable || false,
                    color01: explode3d.color01 ?? particleDefaultValues[type].explosion.color01,
                    color02: explode3d.color02 ?? particleDefaultValues[type].explosion.color02,
                    speed: explode3d.speed ?? particleDefaultValues[type].explosion.speed,
                    gravity: explode3d.gravity ?? particleDefaultValues[type].explosion.gravity,
                    life: explode3d.life ?? particleDefaultValues[type].explosion.life,
                    rate: explode3d.rate ?? particleDefaultValues[type].explosion.rate,
                    emittersize: explode3d.emittersize ?? particleDefaultValues[type].explosion.emittersize,
                    alpha: explode3d.alpha ?? particleDefaultValues[type].explosion.alpha,
                    mass: explode3d.mass ?? particleDefaultValues[type].explosion.mass,
                    sprite: explode3d.sprite ?? particleDefaultValues[type].explosion.sprite,
                    scale: explode3d.scale ?? particleDefaultValues[type].explosion.scale,
                }
            };
            return data;
        }
    }

}