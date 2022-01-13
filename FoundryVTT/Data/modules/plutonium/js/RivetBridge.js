import {Config} from "./Config.js";
import {LGT} from "./Util.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilActors} from "./UtilActors.js";

class RivetBridge {
	static init () {
		window.addEventListener("rivet.receive", evt => {
			console.log(...LGT, `Received Rivet message (JSON)`);
			return this._handlePacket(evt.detail);
		});

		window.addEventListener("rivet.receive-text", () => {
			console.log(...LGT, `Received Rivet message (text)`);
			const $ipts = $(`textarea.rivet-transfer`);
			const packetRaw = $ipts.last().val();
			$ipts.remove();
			return this._handlePacket(JSON.parse(packetRaw));
		});
	}

	static _handlePacket (pack) {
		switch (pack.type) {
			case "roll": return this._handleRollMessage(pack);
			case "entity": return this._pHandleEntityMessage(pack);
			case "currency": return this._pHandleCurrencyMessage(pack);
			case "5etools.lootgen.loot": return this._pHandleSpecialMessage_5etools_lootgen_loot(pack);
			default: ui.notifications.error(`Unhandled Rivet message with type "${pack.type}"! You may need to update your extension.`);
		}
	}

	static _handleRollMessage (pack) {
		const data = pack.data;

		if (!pack.settings.isSendRolls) return;

		const roll = new Roll(data.dice);

		const whisper = [];
		if (pack.settings.isWhisper) whisper.push(game.userId);

		roll.toMessage({
			speaker: {
				alias: data.rolledBy,
			},
			flavor: data.label,
			rollMode: "roll",
			whisper,
		});
	}

	/** Import an entity. */
	static async _pHandleEntityMessage (pack) {
		const minRole = Config.get("import", "minimumRole");
		if (game.user.role < minRole) return ui.notifications.warn(`You do not have the role required!`);

		const data = pack.data;
		const actor = this._getTargetActor();

		const {ChooseImporter} = await import("./ChooseImporter.js");
		const importer = ChooseImporter.getImporter(data?.entity?.__prop || data.page, actor);
		if (!importer) return ui.notifications.error(`Plutonium does not yet support entities from "${data.page}"! You may need to update your extension.`);
		try {
			await importer.pInit();
			const opts = {...(data.options || {})};
			if (data.isTemp) opts.isTemp = true;
			const importedMeta = await importer.pImportEntry(data.entity, opts);
			UtilApplications.doShowImportedNotification(importedMeta);
		} catch (e) {
			UtilApplications.doShowImportedNotification({entity: data, status: UtilApplications.TASK_EXIT_FAILED});
			setTimeout(() => { throw e; });
		}
	}

	static async _pHandleCurrencyMessage (pack) {
		const data = pack.data;
		const actor = this._getTargetActor();

		if (!actor) {
			await ChatMessage.create({
				content: `<div>Currency: ${Parser.getDisplayCurrency(data.currency)}</div>`,
				user: game.userId,
				type: 4,
				speaker: {alias: "Rivet"},
				whisper: game.users.contents.filter(it => it.isGM || it === game.user).map(it => it.id),
			});
			return;
		}

		try {
			await UtilActors.pAddCurrencyToActor({currency: data.currency, actor});
			ui.notifications.info(`Applied currency "${Parser.getDisplayCurrency(data.currency)}" to actor "${actor.name}"`);
		} catch (e) {
			ui.notifications.error(`Failed to apply currency "${Parser.getDisplayCurrency(data.currency)}" to actor "${actor.name}"`);
			setTimeout(() => { throw e; });
		}
	}

	static async _pHandleSpecialMessage_5etools_lootgen_loot (pack) {
		const {LootGeneratorApp} = await import("./LootGeneratorApp.js");

		const data = pack.data;
		const actor = this._getTargetActor();

		await LootGeneratorApp.pImportLoot({loot: data, actor, isLogToChat: true, isNotify: true});
	}

	static _getTargetActor () {
		const targetActorId = (Config.get("rivet", "targetActorId") || "").trim();
		if (!targetActorId) return null;

		const mSceneToken = /^Scene\.(?<sceneId>[^.]+)\.Token\.(?<tokenId>[^.]+)$/.exec(targetActorId);

		if (!mSceneToken) return CONFIG.Actor.collection.instance.get(targetActorId);

		const scene = game.scenes.get(mSceneToken.groups.sceneId);
		if (!scene) return null;

		const token = scene.tokens.get(mSceneToken.groups.tokenId);
		if (!token) return null;

		return token.actor;
	}
}

export {RivetBridge};
