import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";

class Patcher_RollData {
	static init () {
		if (game.user.isGM) return;
		this._init_player_bindCharacterUpdateHook();
	}

	/**
	 * As a player, when our character gets updated, find any other actors we control, check if they use any
	 * "@srd5e.userchar" data, and if so, trigger an update on them. This allows changes to propagate without manually
	 * forcing an update on the slaved sheets.
	 */
	static _init_player_bindCharacterUpdateHook () {
		Hooks.on("updateActor", (actor) => {
			if (!Config.get("actor", "isRefreshOtherOwnedSheets")) return;
			if (game.user.character?.id !== actor?.id) return;

			const toRefresh = game.actors.contents.filter(act => {
				if (game.user.character.id === act.id || !act.isOwner) return false;

				let found = false;
				Patcher_RollData._PLAYER_CONTROLLED_NON_CHARS_WALKER.walk(
					act.data._source,
					{
						string: (str) => {
							if (!str.includes(Patcher_RollData._PLAYER_CONTROLLED_NON_CHARS_SENTINEL)) return;
							return found = true;
						},
					},
				);
				return found;
			});

			toRefresh.forEach(act => {
				act.prepareData();
				if (act.sheet?.element?.length) act.sheet.render();
			});
		});
	}

	static getAdditionalRollDataBase (entity) {
		// Add info from the user's character
		// `@srd5e.userchar.id`, etc.
		const pb = game.user.character?.data?.data?.attributes?.prof;
		let spellAttackRanged; let spellAttackMelee = null;
		if (game.user.character) {
			const scAbility = game.user.character ? game.user.character.data?.data.attributes.spellcasting || "int" : null;
			const baseMod = (game.user.character.data?.data?.abilities?.[scAbility].mod ?? 0)
				+ (pb ?? 0);
			spellAttackRanged = baseMod + Number(game.user.character.data?.data?.bonuses?.rsak?.attack) || 0;
			spellAttackMelee = baseMod + Number(game.user.character.data?.data?.bonuses?.msak?.attack) || 0;
		}

		return {
			// Add `@name` as the entity's name
			name: entity.name,
			[SharedConsts.MODULE_NAME_FAKE]: {
				name: {
					// Add `@srd5e.name.<scrubbed entity name>`
					[entity.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")]: 1,
				},
				user: {
					id: game.user.id,
				},
				userchar: {
					id: game.user.character?.id,
					pb,
					classes: game.user.character?.data?.data?.classes || {},
					abilities: game.user.character?.data?.data?.abilities || {},
					spellAttackRanged,
					spellAttackMelee,
				},
			},
		};
	}
}
Patcher_RollData._PLAYER_CONTROLLED_NON_CHARS_WALKER = MiscUtil.getWalker({isNoModification: true, isBreakOnReturn: true});
Patcher_RollData._PLAYER_CONTROLLED_NON_CHARS_SENTINEL = `@${SharedConsts.MODULE_NAME_FAKE}.userchar.`;

export {Patcher_RollData};
