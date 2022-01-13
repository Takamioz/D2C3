import {UtilApplications} from "./UtilApplications.js";

class UtilKeybinding {
	static getPlayerActor ({minRole = null} = {}) {
		if (minRole != null && game.user.role < minRole) {
			ui.notifications.warn(`You do not have the role required!`);
			return null;
		}
		if (!game.user.character) {
			ui.notifications.warn(`You do not have a character!`);
			return null;
		}
		return game.user.character;
	}

	static getCurrentImportableSheetDocumentMeta ({isRequireActor = false, isRequireOwnership = false, minRole = null} = {}) {
		if (minRole != null && game.user.role < minRole) {
			ui.notifications.warn(`You do not have the role required!`);
			return null;
		}
		const app = UtilApplications.getOpenAppsSortedByZindex()
			.filter(it => {
				if (!it.document) return false;
				if (isRequireOwnership && !it.document.isOwner) return false;
				const isActor = it.document instanceof Actor;
				if (isRequireActor && !isActor) return false;
				return isActor || (it.document instanceof RollTable);
			})
			.last();
		if (!app) {
			ui.notifications.warn(`No actor ${isRequireActor ? "" : `or table `}sheets open!`);
			return null;
		}
		return {
			actor: app.document instanceof Actor ? app.document : null,
			table: app.document instanceof RollTable ? app.document : null,
		};
	}

	static getCurrentSelectedTokenActor ({isRequireOwnership = false, minRole = null}) {
		if (minRole != null && game.user.role < minRole) {
			ui.notifications.warn(`You do not have the role required!`);
			return null;
		}

		const actors = [...canvas.tokens.controlled].filter(it => it.actor).map(it => it.actor).unique().filter(act => !isRequireOwnership || act.isOwner);
		if (actors.length > 1) {
			ui.notifications.warn(`Multiple tokens with actors selected!`);
			return null;
		}
		if (!actors.length) {
			ui.notifications.warn(`No tokens with actors selected!`);
			return null;
		}

		return actors[0];
	}
}

export {UtilKeybinding};
