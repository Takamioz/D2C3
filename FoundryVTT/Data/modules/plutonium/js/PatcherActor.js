import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {LGT, Util} from "./Util.js";
import {Patcher_RollData} from "./PatcherRollData.js";
import {UtilHooks} from "./UtilHooks.js";

class Patcher_Actor {
	static init () {
		this._init_tryPatchGetRollData();
		this._init_tryPatchApplyActiveEffects();
	}

	static _init_tryPatchGetRollData () {
		try {
			libWrapper.register(
				SharedConsts.MODULE_NAME,
				"CONFIG.Actor.documentClass.prototype.getRollData",
				function (fn, ...args) {
					const out = fn(...args);
					return Patcher_Actor._getRollData(this, out);
				},
				UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
			);
		} catch (e) {
			console.error(...LGT, `Failed to bind getRollData handler!`, e);
		}
	}

	static _getRollData (actor, rollData) {
		if (!rollData) return rollData;
		Object.assign(rollData, Patcher_RollData.getAdditionalRollDataBase(actor));
		return rollData;
	}

	static _init_tryPatchApplyActiveEffects () {
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"Actor.prototype.applyActiveEffects",
			function (fn, ...args) {
				if (!Config.get("actor", "isUseExtendedActiveEffectsParser")) return fn(...args);
				return Patcher_Actor._applyActiveEffects(this, ...args);
			},
			UtilLibWrapper.LIBWRAPPER_MODE_MIXED,
		);

		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, () => this._handleConfigUpdate());
	}

	static _handleConfigUpdate () {
		CONFIG.Actor.collection.instance.contents.forEach(act => {
			act.prepareData();
			if (act.sheet?.element?.length) act.sheet.render();
		});
	}

	/** Based on `Actor.applyActiveEffects` */
	static _applyActiveEffects (actor) {
		if (!actor.effects || (!actor.effects.size && !actor.effects.length)) return;

		const overrides = {};

		// Organize non-disabled effects by their application priority
		const changes = actor.effects.reduce((changes, e) => {
			if (e.data.disabled) return changes;
			return changes.concat(e.data.changes.map(c => {
				c = duplicate(c);
				c.effect = e;
				c.priority = c.priority ?? (c.mode * 10);
				return c;
			}));
		}, []);
		changes.sort((a, b) => a.priority - b.priority);

		Patcher_Actor._applyActiveEffects_mutValues(actor, changes);

		// Apply all changes
		for (let change of changes) {
			const result = change.effect.apply(actor, change);
			if (result !== null) overrides[change.key] = result;
		}

		// Expand the set of final overrides
		actor.overrides = foundry.utils.expandObject(overrides);
	}

	static _applyActiveEffects_mutValues (actor, changes) {
		if (!changes.length) return;

		// region Custom implementation--resolve roll syntax/variables
		//   Note that the effects are already `duplicate`'d (i.e. copied) above, so we can freely mutate them.
		//   Try to avoid unnecessary evaluations, to avoid throwing a bunch of exceptions, and nuking performance etc.
		let rollData; // (Lazy init)
		const activeEffectsLookup = UtilActiveEffects.getAvailableEffectsLookup(actor, {isActorEffect: true});

		changes.forEach(it => {
			// Apply custom parsing only to strings
			if (typeof it.value !== "string") return;

			const type = UtilActiveEffects.getActiveEffectType(activeEffectsLookup, it.key);

			switch (type) {
				// Try to evaluate these, as the user may have e.g. entered e.g. damage parts
				case "object":
				case "array": {
					try {
						// eslint-disable-next-line no-eval
						it.value = eval(it.value);
					} catch (e) {
						// Ignore exceptions, and use the text as-is
						if (Util.isDebug()) console.error(...LGT, e);
					}
					break;
				}

				// These could be anything--optimistically apply the dice syntax
				case undefined:
				case null:
				case "null":
				case "number": // We've got a string, and should have a number--try to convert by parsing as a dice expression
				case "boolean": { // As above, but we'll convert to a boolean at the end
					if (!rollData) rollData = Patcher_Actor._applyActiveEffects_getFullRollData(actor);

					try {
						it.value = this._getEvaluatedExpression(actor, it.value, rollData);

						// If we're expecting a boolean, forcibly convert
						if (type === "boolean") it.value = !!it.value;
					} catch (e) {
						// Ignore exceptions, and use the value as-is
						if (Util.isDebug()) console.error(...LGT, e);
					}

					break;
				}

				case "string": // Avoid modifying if the desired output is a string
				case "undefined": // Should never occur? (since the model is defined as JSON)
				default: break;
			}
		});
		// endregion
	}

	/**
	 * With the deprecation of "sync" rolls in v9+, we can no longer rely on using `Roll( ... )` to evaluate expressions.
	 * Therefore, run a custom version through the 5etools dice engine. Note that this may not 1:1 match the Foundry
	 * parser, but should be close enough for "simple" expressions.
	 */
	static _getEvaluatedExpression (actor, expression, rollData) {
		const expressionMerged = expression
			.replace(/@(?<path>[a-zA-Z0-9.]+)/g, (...m) => {
				const out = foundry.utils.getProperty(rollData, m.last().path);
				if (out === undefined) {
					console.warn(...LGT, `Failed to resolve attribute "${m.last().path}" in expression "${expression}" for actor "${actor.name}" (${actor.id})`);
					return 0;
				}
				return out;
			});
		let wrpTree;
		try {
			wrpTree = Renderer.dice.lang.getTree3(expressionMerged, false);
		} catch (e) {
			console.warn(...LGT, `Failed to parse expression "${expression}" ("${expressionMerged}" with roll data applied)`, e.message);
			return 0;
		}

		return wrpTree.tree.evl({});
	}

	static _applyActiveEffects_getFullRollData (actor) {
		const cpyActorData = MiscUtil.copy(actor.data);
		cpyActorData.effects = [];
		// eslint-disable-next-line new-cap
		const cpyActor = new CONFIG.Actor.documentClass({...cpyActorData});
		cpyActor.prepareData();
		return cpyActor.getRollData();
	}

	/** Called when applying "CUSTOM" active effects. */
	static handleHookApplyActiveEffect (actor, change) {
		if (!Config.get("actor", "isUseExtendedActiveEffectsParser")) return;
		if (!(change.key || "").startsWith(SharedConsts.MODULE_NAME_FAKE)) return;

		const key = UtilActiveEffects.getKeyFromCustomKey(change.key);

		switch (key) {
			// region Deprecated in favor of using the base "priority" system
			//   Left here as an informative example and so legacy props are handled.
			case "data.attributes.ac.flat": {
				// region Based on `ActiveEffect._applyOverride` ("UPGRADE" mode)
				const {value} = change;
				const current = foundry.utils.getProperty(actor.data, key);
				if ((typeof (current) === "number") && (current >= Number(value))) return null;
				setProperty(actor.data, key, value);
				return;
				// endregion
			}
			// endregion

			default: console.warn(...LGT, `Unhandled custom active effect key: ${key}`);
		}
	}
}

export {Patcher_Actor};
