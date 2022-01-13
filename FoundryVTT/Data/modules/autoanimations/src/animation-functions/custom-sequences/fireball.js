import { buildFile } from "../file-builder/build-filepath.js"

// Credit goes to Wasp-Sequencer Guy for the structure of the Fireball Sequence
export async function fireball(handler, autoObject) {

    const data = {}
    const flags = handler.flags;
    if (autoObject) {
        Object.assign(data, autoObject);
        const autoOverridden = flags.autoOverride?.enable ?? false;
        const autoOverrideAfter = flags.autoOverride?.fireball?.afterEffect ?? false;
        const autoFireball = flags.autoOverride?.fireball ?? {};
        data.projectile = autoOverridden ? autoFireball.projectile : data.projectile;
        data.projectileVariant = autoFireball ? autoFireball.projectileVariant : data.projectilVariant ?? "01";
        data.projectileColor = autoOverridden ? autoFireball.projectileColor ?? data.projectileColor : data.projectileColor ?? "";
        data.projectileRepeat = data.projectileRepeat ?? 1;
        data.projectileDelay = data.projectileDelay ?? 250;
        data.wait01 = autoOverridden ? autoFireball.wait01 ?? -500 : data.wait01 ?? -500;

        data.explosion01 = data.explosion01;
        data.explosion01Variant = data.explosion01Variant ?? "01";
        data.explosion01Color = autoOverridden ? autoFireball.explosion01Color ?? "" : data.explosion01Color ?? "";
        data.explosion01Repeat = data.explosion01Repeat ?? 1;
        data.explosion01Delay = data.explosion01Delay ?? 250;
        data.explosion01Scale = data.explosion01Scale ?? 1;
        data.wait02 = data.wait02 ?? -500;

        data.explosion02 = data.explosion02;
        data.explosion02Variant = data.explosion02Variant ?? "01";
        data.explosion02Color = autoOverridden ? autoFireball.explosion02Color ?? "" : data.explosion02Color ?? "";
        data.explosion02Repeat = data.explosion02Repeat ?? 1;
        data.explosion02Delay = data.explosion02Delay ?? 250;
        data.explosion02Scale = data.explosion02Scale ?? 1;

        data.afterEffect = autoOverrideAfter ? autoFireball.afterEffect ?? false : data.afterEffect;
        data.afterEffectPath = autoOverrideAfter ? autoFireball.afterEffectPath ?? "" : data.afterEffectPath ?? "";
        data.wait03 = autoOverrideAfter ? autoFireball.wait03 ?? 500 : data.wait03 ?? 500;

        data.itemAudio = {
            enable: data.audio?.a01?.enable || false,
            file: data.audio?.a01?.file,
            volume: data.audio?.a01?.volume || 0.25,
            delay: data.audio?.a01?.delay || 0,
            repeat: handler.decoupleSound ? 1 : data.projectileRepeat || 1,
        }
        data.exAudio01 = {
            enable: data.audio?.e01?.enable || false,
            file: data.audio?.e01?.file,
            volume: data.audio?.e01?.volume || 0.25,
            delay: data.audio?.e01?.delay || 0,
            repeat: handler.decoupleSound ? 1 : data.explosion01Repeat || 1,
        }
        data.exAudio02 = {
            enable: data.audio?.e02?.enable || false,
            file: data.audio?.e02?.file,
            volume: data.audio?.e02?.volume || 0.25,
            delay: data.audio?.e02?.delay || 0,
            repeat: handler.decoupleSound ? 1 : data.explosion02Repeat || 1,
        }
    } else {
        const fireballFlags = flags.fireball ?? {};
        data.projectile = fireballFlags.projectile;
        data.projectileVariant = fireballFlags.projectileVariant ?? "01";
        data.projectileColor = fireballFlags.projectileColor ?? "";
        data.projectileRepeat = fireballFlags.projectileRepeat ?? 1;
        data.projectileDelay = fireballFlags.projectileDelay ?? 250;
        data.wait01 = fireballFlags.wait01 ?? -500;

        data.explosion01 = fireballFlags.explosion01;
        data.explosion01Variant = fireballFlags.explosion01Variant ?? "01";
        data.explosion01Color = fireballFlags.explosion01Color ?? "";
        data.explosion01Repeat = fireballFlags.explosion01Repeat ?? 1;
        data.explosion01Delay = fireballFlags.explosion01Delay ?? 250;
        data.explosion01Scale = fireballFlags.explosion01Scale ?? 1;
        data.wait02 = fireballFlags.wait02 ?? -500;

        data.explosion02 = fireballFlags.explosion02;
        data.explosion02Variant = fireballFlags.explosion02Variant ?? "01";
        data.explosion02Color = fireballFlags.explosion02Color ?? "";
        data.explosion02Repeat = fireballFlags.explosion02Repeat ?? 1;
        data.explosion02Delay = fireballFlags.explosion02Delay ?? 250;
        data.explosion02Scale = fireballFlags.explosion02Scale ?? 1;

        data.afterEffect = fireballFlags.afterEffect;
        data.afterEffectPath = fireballFlags.afterEffectPath ?? "";
        data.wait03 = fireballFlags.wait03 ?? 500;
        data.removeTemplate = flags.options?.removeTemplate ?? false;

        data.itemAudio = {
            enable: handler.flags?.audio?.a01?.enable || false,
            file: handler.flags?.audio?.a01?.file,
            volume: handler.flags?.audio?.a01?.volume || 0.25,
            delay: handler.flags?.audio?.a01?.delay || 0,
            repeat: handler.decoupleSound ? 1 : data.projectileRepeat || 1,
        }
        data.exAudio01 = {
            enable: handler.flags?.audio?.e01?.enable || false,
            file: handler.flags?.audio?.e01?.file,
            volume: handler.flags?.audio?.e01?.volume || 0.25,
            delay: handler.flags?.audio?.e01?.delay || 0,
            repeat: handler.decoupleSound ? 1 : data.explosion01Repeat || 1,
        }
        data.exAudio02 = {
            enable: handler.flags?.audio?.e02?.enable || false,
            file: handler.flags?.audio?.e02?.file,
            volume: handler.flags?.audio?.e02?.volume || 0.25,
            delay: handler.flags?.audio?.e02?.delay || 0,
            repeat: handler.decoupleSound ? 1 : data.explosion02Repeat || 1,
        }
    }

    const projectileAnimation = await buildFile(false, data.projectile, "range", data.projectileVariant, data.projectileColor);
    const explosion01 = data.explosion01 !== "a1" ? await buildFile(true, data.explosion01, "static", data.explosion01Variant, data.explosion01Color) : "";
    const explosion02 = data.explosion02 !== "a1" ? await buildFile(true, data.explosion02, "static", data.explosion02Variant, data.explosion02Color) : "";

    let fireballTemplate = canvas.templates.placeables[canvas.templates.placeables.length - 1].data._id;//canvas.templates.get(args[0].templateId)
    let tokenD = handler.actorToken;
    let template = await canvas.templates.documentCollection.get(fireballTemplate)
    let size;
    let position;
    if (game.modules.get("dnd5e-helpers")?.active && (game.settings.get("dnd5e-helpers", "gridTemplateScaling") === 2 || game.settings.get("dnd5e-helpers", "gridTemplateScaling") === 3)) {
        const scale5e = template.data.distance / Math.sqrt(2);
        position = {
            x: template.data.x + (((scale5e / canvas.dimensions.distance) * canvas.grid.size) / 2),
            y: template.data.y + (((scale5e / canvas.dimensions.distance) * canvas.grid.size) / 2),
        }
        size = (canvas.grid.size * (template.data.distance / canvas.dimensions.distance));
    } else if (template.data?.t === 'rect') {
        const offset = canvas.grid.size * (template.data?.width / canvas.dimensions.distance);
        position = {
            x: template.data.x + (offset / 2),
            y: template.data.y + (offset / 2),
        }
        size = (canvas.grid.size * (template.data.distance / canvas.dimensions.distance));
    } else {
        position = {
            x: template.data.x,
            y: template.data.y,
        }
        size = canvas.grid.size * ((template.data.distance * 2) / canvas.dimensions.distance);
    }

    new Sequence("Automated Animations")
        .sound()
            .file(data.itemAudio.file)
            .volume(data.itemAudio.volume)
            .delay(data.itemAudio.delay)
            .repeats(data.itemAudio.repeat, data.projectileDelay)
            .playIf(() => {
                return data.itemAudio.enable && data.itemAudio.file;
            })
        .effect()
            .file(projectileAnimation.file)
            .atLocation(tokenD)
            .stretchTo(position)
            .repeats(data.projectileRepeat, data.projectileDelay)
            .waitUntilFinished(data.wait01)
        .sound()
            .file(data.exAudio01.file)
            .volume(data.exAudio01.volume)
            .delay(data.exAudio01.delay)
            .repeats(data.exAudio01.repeat, data.explosion01Delay)
            .playIf(() => {
                return data.exAudio01.enable && data.exAudio01.file;
            })
        .effect()
            .file(explosion01.file)
            .playIf(data.explosion01 !== "a1")
            .atLocation(position)
            .size(size * .35 * data.explosion01Scale)
            .repeats(data.explosion01Repeat, data.explosion01Delay)
            //.timeRange(0, 1200)
            .waitUntilFinished(data.wait02)
        .sound()
            .file(data.exAudio02.file)
            .volume(data.exAudio02.volume)
            .delay(data.exAudio02.delay)
            .repeats(data.exAudio02.repeat, data.explosion02Delay)
            .playIf(() => {
                return data.exAudio02.enable && data.exAudio02.file;
            })
        .effect()
            .file(explosion02.file)
            .playIf(data.explosion02 !== "a1")
            .atLocation(position)
            .size(size * data.explosion02Scale)
            .zIndex(5)
            .waitUntilFinished(-750 + data.wait03)
        .effect()
            .file(data.afterEffectPath)
            .size(size)
            .atLocation(position)
            .belowTokens(true)
            .persist(true)
            .origin(handler.item.uuid)
            .fadeIn(250)
            .playIf(data.afterEffect)
        .play()

        if (data.removeTemplate) {
            canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [template.data._id])
        }
    
}