import {LGT} from "./Util.js";
import {Config} from "./Config.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilDocuments} from "./UtilDocuments.js";

class TokenHpRoller {
	static init () {
		Hooks.on("createToken", async (docToken) => {
			if (!game.user.isGM || !docToken.isOwner) return;

			const rollMode = Config.get("tokens", "npcHpRollMode");
			if (rollMode === ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_NONE) return;

			if (
				docToken.actor?.type !== "npc"
				|| docToken.isLinked
				|| !docToken.actor?.data?.data?.attributes?.hp?.formula
			) return;

			const roll = new Roll(docToken.actor.data.data.attributes.hp.formula);
			try {
				await roll.evaluate({
					minimize: rollMode === ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_MIN,
					maximize: rollMode === ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_MAX,
				});
				const messageRollMode = this._getMessageRollMode(rollMode);
				if (messageRollMode) roll.toMessage({}, {rollMode: messageRollMode});
			} catch (e) {
				console.warn(...LGT, `Failed to roll HP formula "${docToken.actor.data.data.attributes.hp.formula}" for token "${docToken.name}" (${docToken.id})! The default HP value will be used instead.`);
				return;
			}

			// Hack to prevent rare timing-related issue when creating a token.
			// This issue usually occurs when creating the first token after game load.
			// More precisely, it was reproducible when dragging a homebrew creature, using a `raw.github` token URL, to a
			//   scene containing no other tokens. "NPC HP Roll Mode" was set to "Maximum Value".
			await Promise.race([
				this._pDoWaitForTokenBars(docToken),
				MiscUtil.pDelay(300),
			]);

			await UtilDocuments.pUpdateDocument(
				docToken.actor,
				{
					data: {
						attributes: {
							hp: {
								value: roll.total,
								max: roll.total,
							},
						},
					},
				},
			);
		});
	}

	static async _pDoWaitForTokenBars (docToken) {
		for (let attempts = 0; attempts < 100; ++attempts) {
			if (docToken.bars) break;
			await MiscUtil.pDelay(10);
		}
	}

	static _getMessageRollMode (rollMode) {
		switch (rollMode) {
			case ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_STANDARD: return "roll";
			case ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_GM: return "gmroll";
			case ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_BLIND: return "blindroll";
			case ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_SELF: return "selfroll";
			default: return null;
		}
	}
}

export {TokenHpRoller};
