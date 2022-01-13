import {ImportListCreature} from "./ImportListCreature.js";
import {MixinUserChooseImporter} from "./ImportList.js";
import {UtilGameSettings} from "./UtilGameSettings.js";
import {Config} from "./Config.js";
import {Util} from "./Util.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilKeybinding} from "./UtilKeybinding.js";

class ActorPolymorpher {
	// region External
	static preInit () {
		this._preInit_registerKeybinds();
	}

	static _preInit_registerKeybinds () {
		const doKeybindingOpenForCharacter = () => {
			const actor = UtilKeybinding.getPlayerActor({minRole: Config.get("tools", "minimumRolePolymorph")});
			if (!actor) return true;
			this._pOpen({actor});
			return true;
		};

		const doKeybindingOpenForCurrentSheet = () => {
			const meta = UtilKeybinding.getCurrentImportableSheetDocumentMeta({isRequireActor: true, isRequireOwnership: true, minRole: Config.get("tools", "minimumRolePolymorph")});
			if (!meta?.actor) return true;
			this._pOpen({...meta});
			return true;
		};

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"ActorPolymorpher__openForCharacter",
			{
				name: "Open Polymorpher Targeting Player Character",
				editable: [],
				onDown: () => doKeybindingOpenForCharacter(),
			},
		);

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"ActorPolymorpher__openForCurrentSheet",
			{
				name: "Open Polymorpher Targeting Current Sheet",
				editable: [],
				onDown: () => doKeybindingOpenForCurrentSheet(),
			},
		);
	}

	static init () {
		if (game.user.isGM) this._init_gm();
		else this._init_player();
	}

	static _isActorTransformed (actor) {
		if (MiscUtil.get(actor.data.flags, "dnd5e", "originalActor")) return true;
		if (MiscUtil.get(actor.data.flags, "dnd5e", "transformOptions")) return true;
		return false;
	}

	static _pSendPlayerUndoTransformationRequest ({actorId}) {
		const actor = CONFIG.Actor.collection.instance.get(actorId);
		return ChatMessage.create({
			sound: "sounds/notify.wav",
			content: `<p>${game.user.name} has transformed back into their original form, and requests you delete their temporary polymorphed actor "${actor.name.escapeQuotes()}." Proceed?</p><div><button data-plut-poly-actor-delete="${actorId}">Delete</button></div>`,
			user: game.userId,
			type: 4,
			whisper: game.users.contents.filter(it => it.isGM).map(it => it.id),
		});
	}

	static _pSendPlayerDeleteTempActorRequest ({actorId}) {
		const actor = CONFIG.Actor.collection.instance.get(actorId);
		return ChatMessage.create({
			sound: "sounds/notify.wav",
			content: `<p>${game.user.name} requests you delete their temporary polymorph template actor "${actor.name.escapeQuotes()}." Proceed?</p><div><button data-plut-poly-temp-actor-delete="${actorId}">Delete</button></div>`,
			user: game.userId,
			type: 4,
			whisper: game.users.contents.filter(it => it.isGM).map(it => it.id),
		});
	}

	static async _pDeleteRequestMessage ({ele}) {
		const msgId = $(ele)
			.closest(`[data-message-id]`)
			.attr("data-message-id");
		if (!msgId) return;

		const msg = CONFIG.ChatMessage.collection.instance.get(msgId);
		if (msg) await msg.delete();
	}

	static _init_player () {
		// When a player clicks the "restore transformation" button, whisper a prompt to the GM(s)
		$(document.body)
			.on("click", `.restore-transformation`, evt => {
				const actorId = $(evt.currentTarget).closest(`.sheet.actor`).attr("id").replace("actor-", "");
				const actor = CONFIG.Actor.collection.instance.get(actorId);

				if (!this._isActorTransformed(actor)) {
					const msg = `This actor does not appear to be transformed\u2014this may be a bug!`;
					console.warn(msg);
					ui.notfications.warn(msg);
				}

				this._pSendPlayerUndoTransformationRequest({actorId});
			});
	}

	static _init_gm () {
		$(document.body)
			.on("click", `[data-plut-poly-actor-delete]`, async evt => {
				const actorId = $(evt.currentTarget).attr("data-plut-poly-actor-delete");
				const actor = CONFIG.Actor.collection.instance.get(actorId);
				if (!actor) return ui.notifications.warn(`Actor "${actorId}" not found!`);

				if (!this._isActorTransformed(actor)) {
					const isDeleteAnyway = await InputUiUtil.pGetUserBoolean({title: "Are You Sure?", htmlDescription: `This actor does not appear to be transformed. Are you sure you want to delete this actor, which may be an original actor?`});
					if (!isDeleteAnyway) return;
				}

				await actor.delete();
				ui.notifications.info(`Deleted actor "${actor.name}"`);

				await this._pDeleteRequestMessage({ele: evt.currentTarget});
			})
			.on("click", `[data-plut-poly-temp-actor-delete]`, async evt => {
				const actorId = $(evt.currentTarget).attr("data-plut-poly-temp-actor-delete");
				const actor = CONFIG.Actor.collection.instance.get(actorId);
				if (!actor) return ui.notifications.warn(`Actor "${actorId}" not found!`);

				await actor.delete();
				ui.notifications.info(`Deleted actor "${actor.name}"`);

				await this._pDeleteRequestMessage({ele: evt.currentTarget});
			});
	}

	static async pHandleButtonClick (evt, app, $html, data) {
		return this._pOpen({actor: app.actor});
	}

	static async _pOpen ({actor}) {
		if (!game.user.isGM) {
			const messages = [
				game.user.can("ACTOR_CREATE") ? "" : "you lack actor creation permissions",
				// FIXME(Future) This is required only for "temp" actor+item creation, which we currently hack around
				// game.user.can("ITEM_CREATE") ? "" : "you lack item creation permissions",
				UtilGameSettings.getSafe("dnd5e", "allowPolymorphing") ? "" : "system-wide player polymorphing is disabled",
			].filter(Boolean);

			if (messages.length) return ui.notifications.warn(`Cannot polymorph: ${messages.join("; ")}`);
		}

		const sourceActor = await ActorPolymorpher.ImportList.pGetUserChoice(
			{
				id: "creatures-actorPolymorpher",
				name: "Creatures",
				singleName: "Creature",

				wizardTitleWindow: `Select Source (Polymorphing Actor "${actor.name}")`,
				wizardTitlePanel3: "Configure and Open List",
				wizardTitleButtonOpenImporter: "Open List",
			},
			"actorPolymorpher",
		);
		if (sourceActor == null) return;

		try {
			await this._doFakeActorDrop(actor, sourceActor);
		} catch (e) {
			console.error(e);
		}

		if (Util.Fvtt.canUserCreateFolders()) {
			if (sourceActor.folder.children.length || sourceActor.folder.content.length > 1) {
				const isDeleteAnyway = await InputUiUtil.pGetUserBoolean({title: "Delete Temp Folder?", htmlDescription: `The temp folder "${Config.get("import", "tempFolderName")}" contains more contents than expected.<br>Delete it anyway?`});
				if (!isDeleteAnyway) return;
			}
			await sourceActor.folder.delete({deleteSubfolders: true, deleteContents: true});
			return;
		}

		this._pSendPlayerDeleteTempActorRequest({actorId: sourceActor.id});
	}

	// endregion

	// region Based on `Actor5e._onDropActor`
	static async _doFakeActorDrop (actor, sourceActor) {
		// Define a function to record polymorph settings for future use
		const rememberOptions = html => {
			const options = {};
			html.find("input").each((i, el) => {
				options[el.name] = el.checked;
			});
			const settings = foundry.utils.mergeObject(UtilGameSettings.getSafe("dnd5e", "polymorphSettings") || {}, options);
			game.settings.set("dnd5e", "polymorphSettings", settings);
			return settings;
		};

		// Create and render the Dialog
		return new Dialog({
			title: game.i18n.localize("DND5E.PolymorphPromptTitle"),
			content: {
				options: UtilGameSettings.getSafe("dnd5e", "polymorphSettings"),
				i18n: CONFIG.DND5E.polymorphSettings,
				isToken: actor.isToken,
			},
			default: "accept",
			buttons: {
				accept: {
					icon: `<i class="fas fa-fw fa-check"></i>`,
					label: game.i18n.localize("DND5E.PolymorphAcceptSettings"),
					callback: html => actor.transformInto(sourceActor, rememberOptions(html)),
				},
				wildshape: {
					icon: `<i class="fas fa-fw fa-paw"></i>`,
					label: game.i18n.localize("DND5E.PolymorphWildShape"),
					callback: html => actor.transformInto(sourceActor, {
						keepBio: true,
						keepClass: true,
						keepMental: true,
						mergeSaves: true,
						mergeSkills: true,
						transformTokens: rememberOptions(html).transformTokens,
					}),
				},
				polymorph: {
					icon: `<i class="fas fa-fw fa-pastafarianism"></i>`,
					label: game.i18n.localize("DND5E.Polymorph"),
					callback: html => actor.transformInto(sourceActor, {
						transformTokens: rememberOptions(html).transformTokens,
					}),
				},
				cancel: {
					icon: `<i class="fas fa-fw fa-times"></i>`,
					label: game.i18n.localize("Cancel"),
				},
			},
		}, {
			classes: ["dialog", "dnd5e"],
			width: 600,
			template: "systems/dnd5e/templates/apps/polymorph-prompt.html",
		}).render(true);
	}
	// endregion
}

ActorPolymorpher.ImportList = class extends MiscUtil.mix(ImportListCreature).with(MixinUserChooseImporter) {
	constructor (externalData) {
		super(
			externalData,
			{
				title: "Select Creature",
			},
			{
				titleButtonRun: "Select",
			},
			{
				isForceImportToTempDirectory: true,
			},
		);
	}

	getData () {
		const out = super.getData();
		out.buttonsAdditional = [
			{
				name: "btn-run-mods",
				text: "Select with CR Scaling/Rename",
			},
		];
		return out;
	}
};

export {ActorPolymorpher};
