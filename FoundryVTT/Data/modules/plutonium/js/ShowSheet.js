import {UtilApplications} from "./UtilApplications.js";
import {UtilSocket} from "./UtilSocket.js";
import {UtilMigrate} from "./UtilMigrate.js";
import {UtilActors} from "./UtilActors.js";
import {UtilDocuments} from "./UtilDocuments.js";

class ShowSheet {
	// region External
	static init () {
		UtilSocket.addSocketEventListener(
			ShowSheet._SOCKET_NAMESPACE,
			id => {
				ShowSheet._pShowSheet(id);
			},
		);
	}

	static pHandleButtonClick (evt, app, $html, data) {
		evt.preventDefault();
		return this._pHandleShowClick(app, data);
	}
	// endregion

	static async _pHandleShowClick (app, data) {
		const name = app.title || UtilApplications.getDataName(data);

		// Based on `JournalEntry#show`
		if (!UtilMigrate.isOwner(data)) throw new Error("You may only request to show sheets which you own.");

		const activeUsersWithoutPermissions = CONFIG.User.collection.instance.contents.filter(it => it.active).filter(user => !(app.actor || app.document).testUserPermission(user));
		if (activeUsersWithoutPermissions.length) {
			const isSetDefaultPerms = await InputUiUtil.pGetUserBoolean({
				title: `Update Permissions`,
				textYes: `Make Visible to All Users`,
				textNo: `Show to Current Viewers`,
				htmlDescription: `${Parser.numberToText(activeUsersWithoutPermissions.length).uppercaseFirst()} ${activeUsersWithoutPermissions.length === 1 ? "user is" : "users are"} currently unable to view this sheet.<br>Would you like to update the default permissions for this sheet, to allow all users to view it?`,
			});

			if (isSetDefaultPerms) {
				await UtilDocuments.pUpdateDocument(
					app.actor || app.document,
					{permission: {default: CONST.ENTITY_PERMISSIONS.LIMITED}},
				);
			}
		}

		await UtilSocket.pSendData(ShowSheet._SOCKET_NAMESPACE, app.id);
		ShowSheet._pShowSheet(app.id);
		ui.notifications.info(`"${name}" show to authorized players.`);
	}

	/**
	 * @param appId of the form e.g. `actor-<actorID>`
	 */
	static _pShowSheet (appId) {
		if (!appId) return;
		const [type, id] = appId.split(/-/);

		let entity;

		switch (type) {
			case "actor": {
				entity = CONFIG.Actor.collection.instance.get(id);
				break;
			}
			case "": // FIXME(Future) remove this when https://gitlab.com/foundrynet/foundryvtt/-/issues/5012 is closed
			case "item": {
				entity = CONFIG.Item.collection.instance.get(id);
				break;
			}
			default: throw new Error(`Unsupported entity type "${type}"`);
		}

		if (!entity || !entity.visible) return;

		return entity.sheet.render(true);
	}
}
ShowSheet._SOCKET_NAMESPACE = "ShowSheet";

export {ShowSheet};
