import {SharedConsts} from "../shared/SharedConsts.js";
import {LGT} from "./Util.js";

/**
 * @deprecated In favor of using `libWrapper`
 */
class UtilPatch {
	// region methods
	/**
	 * @param obj
	 * @param methodName
	 * @param [opts]
	 * @param [opts.isBind]
	 */
	static cacheMethod (obj, methodName, opts) {
		opts = opts || {};

		const existing = UtilPatch.getCachedMethod(obj, methodName);
		if (existing != null) return existing;

		const toCache = opts.isBind ? obj[methodName].bind(obj) : obj[methodName];

		// Expose the original method
		obj[`_plutoniumCache${methodName}`] = toCache;

		if (!UtilPatch._CACHE_METHODS.has(obj)) UtilPatch._CACHE_METHODS.set(obj, {});

		const store = UtilPatch._CACHE_METHODS.get(obj);
		store[methodName] = toCache;

		return toCache;
	}

	static getCachedMethod (obj, methodName) {
		if (!UtilPatch._CACHE_METHODS.has(obj)) return null;
		const store = UtilPatch._CACHE_METHODS.get(obj);
		return store[methodName] || null;
	}

	static restoreCachedMethod (obj, methodName) {
		const method = UtilPatch.getCachedMethod(obj, methodName);
		if (!method) return;
		obj[methodName] = method;
	}
	// endregion

	// region getters
	/**
	 * @param obj
	 * @param getterName
	 * @param [opts]
	 * @param [opts.isBind]
	 */
	static cacheGetter (obj, getterName, opts) {
		opts = opts || {};

		const existing = UtilPatch.getCachedMethod(obj, getterName);
		if (existing != null) return;

		const getterMeta = this._getGetterMeta(obj, getterName);
		getterMeta.fnGet = opts.isBind ? getterMeta.fnGet.bind(getterMeta.obj) : getterMeta.fnGet;

		// Expose the original method for other mods/etc to use
		Object.defineProperty(
			getterMeta.obj,
			`_plutoniumCache${getterName}`,
			{
				configurable: true,
				get: getterMeta.fnGet,
			},
		);

		if (!UtilPatch._CACHE_METHODS.has(obj)) UtilPatch._CACHE_METHODS.set(obj, {});

		const store = UtilPatch._CACHE_METHODS.get(obj);
		store[getterName] = getterMeta;
	}

	static _getGetterMeta (obj, getterName) {
		const ownProp = Object.getOwnPropertyDescriptor(obj, getterName);
		if (ownProp && ownProp.get) {
			return {
				fnGet: ownProp.get,
				obj,
			};
		}

		while (Object.getPrototypeOf(obj) !== null) {
			obj = Object.getPrototypeOf(obj);
			const parentProp = Object.getOwnPropertyDescriptor(obj, getterName);
			if (parentProp && parentProp.get) {
				return {
					fnGet: parentProp.get,
					obj,
				};
			}
		}

		throw new Error(`Could not find getter "${getterName}" on object`);
	}

	static getCachedGetterMeta (obj, getterName) {
		const getterMeta = UtilPatch.getCachedMethod(obj, getterName);
		if (getterMeta) return getterMeta;

		while (Object.getPrototypeOf(obj) !== null) {
			obj = Object.getPrototypeOf(obj);
			const getterMeta = UtilPatch.getCachedMethod(obj, getterName);
			if (getterMeta) return getterMeta;
		}
	}

	static restoreCachedGetter (obj, getterName) {
		const getterMeta = UtilPatch.getCachedGetterMeta(obj, getterName);
		if (!getterMeta) return;
		Object.defineProperty(
			getterMeta.obj,
			getterName,
			{
				configurable: true,
				get: getterMeta.fnGet,
			},
		);
	}
	// endregion
}
UtilPatch._CACHE_METHODS = new Map();
UtilPatch._CACHE_GETTERS = new Map();

class UtilPatcher {
	/** Search for the exact text node, to avoid breaking compatibility with e.g. Tidy UI */
	static findPlutoniumTextNodes (ele, {isSingle = false} = {}) {
		const stack = [];
		this._findPlutoniumTextNodes(ele, {isSingle, stack});
		return isSingle ? stack[0] : stack;
	}

	static _findPlutoniumTextNodes (ele, {isSingle, stack}) {
		if (!ele) return;
		if (isSingle && stack.length) return;

		if (ele.nodeName === "#text") {
			const txt = (ele.data || "").trim();
			if (txt === SharedConsts.MODULE_TITLE) stack.push(ele);
			if (isSingle && stack.length) return;
		}

		for (let i = 0; i < ele.childNodes.length; ++i) {
			const node = ele.childNodes[i];
			this._findPlutoniumTextNodes(node, {isSingle, stack});
			if (isSingle && stack.length) return;
		}
	}
}

/**
 * Unfortunately [and probably for the best], libWrapper (as of 2021-07-06) can't wrap `_onDropActor` or `_onDropItem`,
 *   so we directly overwrite the method instead.
 */
class UtilPatchActorDrop {
	static init () {
		const ActorSheet5eCharacter = MiscUtil.get(CONFIG.Actor, "sheetClasses", "character", "dnd5e.ActorSheet5eCharacter", "cls");
		if (!ActorSheet5eCharacter) {
			return console.warn(...LGT, `Could not find "dnd5e.ActorSheet5eCharacter" sheet. Are you using a non-dnd5e system?`);
		}

		const baseClassActor = Object.getPrototypeOf(ActorSheet5eCharacter);

		UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP = UtilPatch.cacheMethod(baseClassActor.prototype, "_onDrop");
		UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP_ACTOR = UtilPatch.cacheMethod(baseClassActor.prototype, "_onDropActor");
		UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP_ITEM = UtilPatch.cacheMethod(baseClassActor.prototype, "_onDropItem");

		baseClassActor.prototype._onDrop = async function (...args) {
			const boundCachedMethod = UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP.bind(this);
			return UtilPatchActorDrop._pCallPatches.bind(this)(boundCachedMethod, UtilPatchActorDrop._PATCHES_DROP, ...args);
		};

		baseClassActor.prototype._onDropActor = async function (...args) {
			const boundCachedMethod = UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP_ACTOR.bind(this);
			return UtilPatchActorDrop._pCallPatches.bind(this)(boundCachedMethod, UtilPatchActorDrop._PATCHES_DROP_ACTOR, ...args);
		};

		baseClassActor.prototype._onDropItem = async function (...args) {
			const boundCachedMethod = UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP_ITEM.bind(this);
			return UtilPatchActorDrop._pCallPatches.bind(this)(boundCachedMethod, UtilPatchActorDrop._PATCHES_DROP_ITEM, ...args);
		};
	}

	static async _pCallPatches (boundCachedMethod, patches, ...args) {
		if (!patches.length) return boundCachedMethod(...args);

		let boundLast = null;
		[...patches].reverse()
			.forEach(patch => boundLast = patch.bind(this, boundLast || boundCachedMethod, ...args));

		return boundLast();
	}

	static registerDrop (patch) { UtilPatchActorDrop._PATCHES_DROP.push(patch); }
	static registerDropActor (patch) { UtilPatchActorDrop._PATCHES_DROP_ACTOR.push(patch); }
	static registerDropItem (patch) { UtilPatchActorDrop._PATCHES_DROP_ITEM.push(patch); }
}
UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP = null;
UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP_ACTOR = null;
UtilPatchActorDrop._CACHED_ACTOR_SHEET_DROP_ITEM = null;
UtilPatchActorDrop._PATCHES_DROP = [];
UtilPatchActorDrop._PATCHES_DROP_ACTOR = [];
UtilPatchActorDrop._PATCHES_DROP_ITEM = [];

export {UtilPatch, UtilPatcher, UtilPatchActorDrop};
