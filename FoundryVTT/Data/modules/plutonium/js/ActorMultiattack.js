import {Config} from "./Config.js";
import {LGT, Util} from "./Util.js";
import {Consts} from "./Consts.js";
import {UtilCompat} from "./UtilCompat.js";
import {Charactermancer_Util} from "./UtilCharactermancer.js";
import {UtilGameSettings} from "./UtilGameSettings.js";

class ActorMultiattack {
	static init () {
		Hooks.on("createChatMessage", (chatMessage, renderOpts, actorId) => {
			this._pHandleCreateChatMessage(chatMessage, renderOpts, actorId);
		});
	}

	/**
	 * Some samples this should work on:
	 *  - Aboleth: "The aboleth makes three tentacle attacks."
	 *  - Abominable Yeti: "The yeti can use its Chilling Gaze and makes two claw attacks."
	 *  - Adult Black Dragon: "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws."
	 *  - Orc War Chief: "The orc makes two attacks with its greataxe or its spear."
	 *
	 * Some samples this should _more or less_ work on:
	 *  - Core Spawn Seer: "The seer uses Fission Staff twice, Psychedelic Orb twice, or each one once."
	 *
	 * @param chatMessage
	 * @param renderOpts
	 * @param userId
	 */
	static async _pHandleCreateChatMessage (chatMessage, renderOpts, userId) {
		// region Check preconditions
		if (!Config.get("actor", "isAutoMultiattack")) return;
		if (userId !== game.userId) return;

		const actorId = MiscUtil.get(chatMessage, "data", "speaker", "actor");
		if (!actorId) return;

		const actor = CONFIG.Actor.collection.instance.get(actorId);
		if (!actor) return;

		// (jQuery workaround to avoid crashes on non-element parsing)
		const itemId = $(`<div>${chatMessage.data.content || ""}</div>`).children().first().attr("data-item-id");
		if (!itemId) return;

		const item = actor.items.get(itemId);
		if (!item) return; // Can occur if the item used its last charge, and deleted itself on use

		const cleanLowerName = Util.getWithoutParens(item.name).toLowerCase();
		if (cleanLowerName !== "multiattack") return;

		const description = $(item.data.data.description.value).text().trim();
		if (!description) return;
		// endregion

		const toRuns = this._getToRuns({actor, description});

		// region Run actions
		for (const toRun of toRuns) {
			for (let i = 0; i < toRun.count; ++i) {
				// region intense hacks
				const evtFakeClick = {
					preventDefault: () => {},
					stopPropagation: () => {},
					currentTarget: $(`<div class="item" data-item-id="${toRun.item.id}"></div>`)[0],
				};

				if (UtilCompat.isBetterRollsActive()) {
					// region Based on `changeRollsToDual`
					const fakeEvent = new Event("fake");
					fakeEvent.ctrlKey = false;
					fakeEvent.shiftKey = false;
					fakeEvent.altKey = false;

					const params = {adv: 0, disadv: 0, event: fakeEvent};
					if (!UtilGameSettings.getSafe("betterrolls5e", "imageButtonEnabled")) {
						toRun.item.actor.sheet._onItemRoll(evtFakeClick);
					} else {
						await BetterRolls.rollItem(toRun.item, foundry.utils.mergeObject(params, {preset: 0})).toMessage();
					}
					// endregion
				} else {
					// region taken from `Item._onItemRoll`
					await toRun.item.roll();
					// endregion
				}
				// endregion
			}
		}
		// endregion
	}

	static _getToRuns ({actor, description}) {
		let sentences = Util.getSentences(description);
		const toRuns = [];
		let sentencesProc = this._pHandleCreateChatMessage_mutExtractNamedActions(actor, sentences, toRuns);
		sentencesProc = sentencesProc.flat();
		this._pHandleCreateChatMessage_mutExtractSimpleAttacks(actor, sentencesProc, toRuns);
		return toRuns;
	}

	/**
	 * Pull out:
	 * "...can use its >>>Chilling Gaze<<< and make..."
	 * "...uses Fission Staff twice, Psychedelic Orb twice..."
	 */
	static _pHandleCreateChatMessage_mutExtractNamedActions (actor, sentences, outStack) {
		sentences = MiscUtil.copy(sentences);

		for (let i = 0; i < sentences.length; ++i) {
			const sentence = sentences[i];

			const tokens = Util.getTokens(sentence);

			// Remove tokens from the start of the sentence that start with a capital (e.g. proper names, "The")
			while ((Util.isPunctuation(tokens[0]) || Util.isCapsFirst(tokens[0])) && tokens.length) tokens.shift();

			// Extract titles (action names)
			const actionNameMetas = [];
			let tokenStack = [];
			let curMeta = {};

			const collectStack = () => {
				if (!tokenStack.filter(it => it !== " ").length) return;

				// Pop trailing spaces and "...and"/"...or"
				while (tokenStack.length) {
					if (StrUtil.TITLE_LOWER_WORDS.includes(tokenStack.last()) || tokenStack.last() === " ") {
						tokenStack.pop();
					} else {
						break;
					}
				}

				actionNameMetas.push({
					name: tokenStack.join(""),
					count: curMeta.count || 1,
				});

				tokenStack = [];
				curMeta = {};
			};

			for (let i = 0; i < tokens.length; ++i) {
				const token = tokens[i];

				// Ignore spaces if we have no other tokens
				if (!tokenStack.length && token === " ") continue;

				if (Util.isCapsFirst(token)) {
					tokenStack.push(token);
				} else if (tokenStack.length && (StrUtil.TITLE_LOWER_WORDS.includes(token) || token === " ")) {
					tokenStack.push(token);
				} else {
					const countAdverbs = Consts.TERMS_COUNT.find(meta => {
						const slice = tokens.slice(i, i + meta.tokens.length);
						return CollectionUtil.deepEquals(meta.tokens, slice);
					});

					if (tokenStack.length && countAdverbs) {
						i += countAdverbs.tokens.length - 1;
						curMeta.count = countAdverbs.count;
					}

					collectStack();
				}
			}
			collectStack();

			let sentenceOut = sentence;
			actionNameMetas.forEach(meta => {
				const cleanActionName = meta.name.toLowerCase().trim();
				if (cleanActionName.includes("multiattack")) return; // Avoid infinite loops

				const item = actor.items.find(it => Util.getWithoutParens(it.name).toLowerCase() === cleanActionName);
				if (!item) return;

				outStack.push({
					item,
					count: meta.count || 1,
				});

				// Break up the sentence in which we found this named action
				// This helps to handle e.g. Roper's "The roper makes four attacks with its tendrils, uses Reel, and makes
				//   one attack with its bite."
				sentenceOut = sentenceOut.replace(meta.name, ActorMultiattack._MARKER_SPLIT);
			});

			// (Split out the text we used, so it doesn't get passed to the next step)
			sentences[i] = sentenceOut.split(ActorMultiattack._MARKER_SPLIT);
		}

		return sentences;
	}

	/**
	 * Pull out:
	 * "... makes >>>three tentacle<<< attacks."
	 * "... and makes >>>two claw<<< attacks."
	 * "... makes three attacks: >>>one with its bite<<< and >>>two with its claws<<<."
	 * "... makes three melee attacks: >>>two with its fork<<< and >>>one with its tail<<<."
	 * "... makes >>>two attacks with its greataxe or its spear<<<."
	 * "... and makes >>>two melee<<< attacks."
	 * "... makes >>>one attack with its rotting fist<<<."
	 * "... makes >>>three attacks<<<."
	 */
	static _pHandleCreateChatMessage_mutExtractSimpleAttacks (actor, sentences, outStack) {
		sentences.forEach(sentence => {
			// region Named actions
			sentence = sentence.replace(/one (.*?) attack(?:[^:]|$)/gi, (...m) => this._doNamedActionReplace({outStack, actor, m}));

			sentence = sentence.replace(/(two|three|four|five|six|seven|eight) (.*?) attacks(?:[^:]|$)/gi, (...m) => this._doNamedActionReplace({outStack, actor, m}));
			// endregion

			// Choice between weapons
			sentence = sentence.replace(/makes (one|two|three|four|five|six|seven|eight) attacks? with its (.*?(?: or .*?)?)$/gi, (...m) => this._doWeaponChoiceReplace({outStack, actor, m}));

			// Complex actions
			sentence = sentence.replace(/makes (?:two|three|four|five|six|seven|eight)(?: melee| ranged)? attacks:(.*?)$/gi, (...m) => this._doComplexActionReplace({outStack, actor, m}));

			// Simple "makes X attacks"
			sentence = sentence.replace(/makes (two|three|four|five|six|seven|eight) attacks$/gi, (...m) => this._doAnyChoiceReplace({outStack, actor, m}));
		});
	}

	static _doNamedActionReplace ({outStack, actor, m}) {
		const rawActionCount = m[1].toLowerCase();
		const actionCount = Parser.textToNumber(rawActionCount);

		const actionNameClean = Util.getWithoutParens(m[2]).toLowerCase();
		if (actionNameClean.includes("multiattack")) return ""; // Avoid infinite loops

		if (actionNameClean === "melee" || actionNameClean === "ranged") {
			this._pHandleCreateChatMessage_handleMeleeRangedAttacks(actor, actionNameClean, actionCount, outStack);
			return "";
		}

		const item = actor.items.find(it => Util.getWithoutParens(it.name).toLowerCase() === actionNameClean);

		if (!item) return m[0];

		outStack.push({
			item,
			count: actionCount,
		});

		return "";
	}

	static _doWeaponChoiceReplace ({outStack, actor, m}) {
		const rawActionCount = m[1];
		let ptAttacks = m[2];

		const allActionTokens = Util.getTokens(ptAttacks);

		while (allActionTokens.length) {
			const thisActionTokens = [];

			for (let i = 0; i < allActionTokens.length; ++i) {
				const cleanActionToken = allActionTokens[i].toLowerCase();

				if (
					cleanActionToken === "and" || cleanActionToken === "or" || cleanActionToken === "its" || cleanActionToken === "with"
					|| Util.isPunctuation(cleanActionToken)
				) {
					allActionTokens.shift(); // remove the unused token
					break;
				} else {
					thisActionTokens.push(allActionTokens.shift());
					i--;
				}
			}

			if (thisActionTokens.length) {
				const thisActionName = thisActionTokens.join("").trim();
				if (thisActionName.toLowerCase().includes("multiattack")) continue; // Avoid infinite loops

				const item = this._getActionByLowerName(actor, thisActionName);

				if (item) {
					outStack.push({
						item,
						count: Parser.textToNumber(rawActionCount),
					});
				}
			}
		}

		return allActionTokens.join("").trim();
	}

	static _doAnyChoiceReplace ({outStack, actor, m}) {
		const rawActionCount = m[1];
		const actionCount = Parser.textToNumber(rawActionCount);

		const attackItems = actor.items.filter(it => it.type === "weapon" && !it.name.toLowerCase().includes("multiattack"));

		// Spew out the max number of each possible attack
		// TODO(Future) prompt the user?
		attackItems.forEach(item => {
			outStack.push({
				item,
				count: actionCount,
			});
		});

		return "";
	}

	static _doComplexActionReplace ({outStack, actor, m}) {
		let ptAttacks = m[1];
		let foundAny = false;
		let lastPtAttacks = null;

		while (ptAttacks.length && ptAttacks !== lastPtAttacks) {
			lastPtAttacks = ptAttacks;

			ptAttacks = ptAttacks.replace(/(one|two|three|four|five|six|seven|eight) with (?:its |his |her )(.*)/gi, (...n) => {
				const rawActionCount = n[1];
				const rawActionPart = n[2];

				const thisActionTokens = [];
				const allActionTokens = Util.getTokens(rawActionPart);

				for (let i = 0; i < allActionTokens.length; ++i) {
					const cleanActionToken = allActionTokens[i].toLowerCase();

					if (cleanActionToken === "and" || cleanActionToken === "or" || Util.isPunctuation(cleanActionToken)) {
						allActionTokens.shift(); // remove the unused token
						break;
					} else {
						thisActionTokens.push(allActionTokens.shift());
						i--;
					}
				}

				if (thisActionTokens.length) {
					const thisActionName = thisActionTokens.join("").trim();
					if (thisActionName.toLowerCase().includes("multiattack")) return allActionTokens.join("").trim(); // Avoid infinite loops

					const item = this._getActionByLowerName(actor, thisActionName);

					if (item) {
						outStack.push({
							item,
							count: Parser.textToNumber(rawActionCount),
						});
					}
				}

				return allActionTokens.join("").trim();
			});
		}

		if (foundAny) return "";
		return m[0];
	}

	/** Attempt to find the attack that does the most damage. If that fails, use the first attack found. */
	static _pHandleCreateChatMessage_handleMeleeRangedAttacks (actor, actionNameClean, actionCount, outStack) {
		let item;

		const meleeItems = [];
		const rangedItems = [];

		actor.items
			.filter(it => it.type === "weapon")
			.forEach(it => {
				const data = MiscUtil.get(it, "data", "data");
				if (!data) return;

				// Check weapon type
				const weaponType = MiscUtil.get(data, "weaponType");
				switch (weaponType) {
					case "simpleM":
					case "martialM": {
						meleeItems.push(it);
						if (MiscUtil.get(data, "properties", "thr")) rangedItems.push(it);
						return;
					}

					case "simpleR":
					case "martialR": {
						rangedItems.push(it);
						return;
					}
				}

				// Failing that, check action type
				const actionType = MiscUtil.get(data, "actionType");
				switch (actionType) {
					case "mwak": {
						meleeItems.push(it);
						if (MiscUtil.get(data, "properties", "thr")) rangedItems.push(it);
						return;
					}
					case "rwak": {
						rangedItems.push(it);
						return;
					}
				}

				// Failing that, check text
				const cleanText = (MiscUtil.get(data, "description", "value") || "")
					.replace(/[^a-zA-Z0-9:.,()]/g, "")
					.replace(/\s+/g, " ")
					.trim();
				if (/melee or ranged weapon attack:/i.test(cleanText)) {
					meleeItems.push(it);
					rangedItems.push(it);
				} else if (/melee weapon attack:/i.test(cleanText)) {
					meleeItems.push(it);
				} else if (/ranged weapon attack:/i.test(cleanText)) {
					rangedItems.push(it);
				}
			});

		const items = actionNameClean === "melee" ? meleeItems : rangedItems;

		item = items
			.map(it => {
				const damageParts = MiscUtil.get(it, "data", "data", "damage", "parts");
				if (!damageParts) return null;

				// Map the parts to their mean damage
				const mappedParts = damageParts
					.map(pt => {
						try {
							const cleanPart = pt[0].replace(/@mod/gi, () => {
								const abilityScores = Charactermancer_Util.getCurrentAbilityScores(actor);
								const atr = MiscUtil.get(it, "data", "data", "ability")
									|| Charactermancer_Util.getAttackAbilityScore(it, abilityScores, actionNameClean === "melee" ? "melee" : "ranged");
								const score = abilityScores?.[atr] || 10;
								return Parser.getAbilityModNumber(score);
							});

							const wrpTree = Renderer.dice.lang.getTree3(`avg(${cleanPart})`);
							return {
								type: pt[1],
								meanDamage: wrpTree.tree.evl({}),
							};
						} catch (e) {
							console.error(...LGT, `Failed to evaluate damage part "${pt[0]}"`, e);
							return null;
						}
					})
					.filter(Boolean);

				if (!mappedParts.length) return null;

				// Use the highest average damage part for each damage type--we assume that two parts with the same
				//   damage type represent two different modes of using the same weapon, rather than summing the two
				//   parts together.
				const typeToMeanDamage = {};
				mappedParts.forEach(it => typeToMeanDamage[it.type] = Math.max(it.meanDamage, typeToMeanDamage[it.type] || 0));

				// Finally, sum all the means of the different damage types, to give us a final mean for the whole
				//   attack.
				const meanDamage = Object.values(typeToMeanDamage).reduce((a, b) => a + b, 0);

				return {
					item: it,
					meanDamage,
				};
			})
			.filter(Boolean)
			.sort((a, b) => SortUtil.ascSort(b.meanDamage, a.meanDamage))
			.map(it => it.item)
			.find(Boolean);

		// If we failed to find an item above due to errors, use the first item
		if (!item && items[0]) item = items[0];
		else if (!item && !items[0]) return;

		outStack.push({
			item,
			count: actionCount,
		});
	}

	static _getActionByLowerName (actor, actionName) {
		let item = actor.items.find(it => Util.getWithoutParens(it.name).toLowerCase() === actionName);

		// If we did not find the item, try to find it would any trailing "s" (e.g. "claws" -> "claw")
		if (!item && actionName.endsWith("s")) {
			const thisActionNameSingular = actionName.slice(0, -1);
			item = actor.items.find(it => Util.getWithoutParens(it.name).toLowerCase() === thisActionNameSingular);
		}

		return item;
	}
}
ActorMultiattack._MARKER_SPLIT = "<PLUT_SPLIT_MARKER>";

export {ActorMultiattack};
