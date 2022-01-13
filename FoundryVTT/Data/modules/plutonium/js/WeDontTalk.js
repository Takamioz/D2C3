import {Config} from "./Config.js";

class WeDontTalk {
	static _doDeleteAll () {
		$(`#chat-log`).find(`[data-plut-wdt-accept]`).closest(`[data-message-id]`).each((i, e) => {
			const msgId = $(e).attr("data-message-id");
			const msg = CONFIG.ChatMessage.collection.instance.get(msgId);
			if (!msg) return;
			msg.delete();
		});
	}

	static init () {
		StorageUtil.pGet(WeDontTalk._STORAGE_KEY)
			.then(async val => {
				if (val) return this._doDeleteAll();

				const pHandleStreamerMode = evt => Config.pHandleButtonClick(evt, "ui");

				const pHandleAccept = async () => {
					$(document.body).off("click", `[data-plut-wdt-accept]`, pHandleAccept);
					$(document.body).off("click", `[data-plut-wdt-streamer]`, pHandleStreamerMode);
					await StorageUtil.pSet(WeDontTalk._STORAGE_KEY, true);
					ui.notifications.info(`Thanks!`);
					this._doDeleteAll();
				};

				$(document.body).on("click", `[data-plut-wdt-accept]`, pHandleAccept);
				$(document.body).on("click", `[data-plut-wdt-streamer]`, pHandleStreamerMode);

				// Avoid showing the telling notification if we're in streamer mode
				if (Config.get("ui", "isStreamerMode")) return;

				await ChatMessage.create({
					content: `<div>
							<p>Welcome to Plutonium!</p>
							<p>We would like to remind you that neither Foundry nor Forge support piracy in any shape or form, and that <b>all</b> discussion related to the use of Plutonium should be done in our <a target="_blank" href="https://discord.gg/nGvRCDs" rel="noopener noreferrer">Discord</a>.</p>
							<p>Additionally, if you wish to screenshot or stream your game, we recommend <span data-plut-wdt-streamer="true" class="render-roller">Streamer Mode</span>.</p>
							<div><button data-plut-wdt-accept="true">I Understand</button></div>
						</div>`,
					user: game.userId,
					type: 4,
					whisper: [game.userId],
				});
			});
	}
}
WeDontTalk._STORAGE_KEY = "we_dont_talk";

export {WeDontTalk};
