import {Config} from "./Config.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilCompat} from "./UtilCompat.js";
import {UtilHooks} from "./UtilHooks.js";
import {LGT} from "./Util.js";

class UtilCompendium {
	// region Init
	static init () {
		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, () => this._pHandleConfigUpdate());
		this._pHandleConfigUpdate();
	}

	static async _pHandleConfigUpdate () {
		await this._pHandleConfigUpdate_pFlushCompendiumImageCaches();
	}

	/**
	 * On changing the item compendium sources, flush our image caches as required.
	 */
	static async _pHandleConfigUpdate_pFlushCompendiumImageCaches () {
		const configPaths = [
			["importCreature", "additionalDataCompendium"],
			["importCreature", "additionalDataCompendiumFeatures"],
			["importVehicle", "additionalDataCompendium"],
			["importClass", "additionalDataCompendium"],
			["importClass", "additionalDataCompendiumFeatures"],
			["importItem", "additionalDataCompendium"],
			["importRace", "additionalDataCompendium"],
			["importRace", "additionalDataCompendiumFeatures"],
			["importSpell", "additionalDataCompendium"],
			["importOptionalFeature", "additionalDataCompendium"],
		];

		await this._COMPENDIUM_CACHES_LOCK.pLock();
		try {
			configPaths.forEach(path => {
				const pathKey = path.join("___");

				const storedValue = this._COMPENDIUM_IMAGE_LAST_VALUES[pathKey] || "";
				const currentValue = Config.get(path[0], path[1]) || "";

				if (storedValue.trim() !== currentValue.trim()) {
					if (this._COMPENDIUM_CACHES[this._COMPENDIUM_CACHE_KEY_IMAGE]) delete this._COMPENDIUM_CACHES[this._COMPENDIUM_CACHE_KEY_IMAGE][pathKey];
				}

				this._COMPENDIUM_IMAGE_LAST_VALUES[pathKey] = currentValue;
			});
		} finally {
			this._COMPENDIUM_CACHES_LOCK.unlock();
		}
	}
	// endregion

	/**
	 * @param compendium
	 * @param isContent `true` if content should be fetched, `false` if index should be fetched.
	 */
	static async pGetCompendiumData (compendium, isContent) {
		// Force content fetch if Babele is active, as the original name is stored in a flag
		isContent = isContent || UtilCompat.isBabeleActive();

		// Workaround to prevent bugged compendiums from killing the load
		//   Bug could not be repro'd, but compendium can be inaccessible (including clicking it in the UI failing to open)
		const maxTimeSecs = 10;
		const compendiumData = await Promise.race([
			isContent ? compendium.getDocuments() : compendium.getIndex(),
			MiscUtil.pDelay(maxTimeSecs * 1000, null),
		]);
		if (!compendiumData) {
			console.warn(...LGT, `Loading of ${compendium?.metadata?.system}.${compendium?.metadata?.name} took more than ${maxTimeSecs} seconds! This usually means the compendium is inaccessible. Cancelling compendium load.`);
			return [];
		}
		return compendiumData;
	}

	/**
	 * Try to match a SRD (5etools) entity with a (Foundry) entity in the appropriate compendiums, and return the image.
	 * @param entityType Generally, the 5etools JSON property under which this 5etools data is stored.
	 * @param entity
	 * @param [opts] Options object.
	 * @param [opts.fnGetAliases] Function which takes the entity and returns alternate "alias" names to look for in the compendium.
	 * @param [opts.deepKeys] A list of keys (e.g. `"data.save.ability"` for data which should be cached when loading the compendium, to enable later lookups.
	 * @param [opts.isIgnoreSrd] If the presence of an "srd" flag in the data should be ignored, rather than respected.
	 */
	static async pGetCompendiumImage (entityType, entity, opts) {
		return this._pGetCacheAndGetCompendiumData(
			this._COMPENDIUM_CACHE_KEY_IMAGE,
			entityType,
			entity,
			opts,
		);
	}

	/**
	 * @param cacheId
	 * @param entityType
	 * @param entity
	 * @param [opts]
	 * @param [opts.fnGetAliases]
	 * @param [opts.deepKeys]
	 * @param [opts.isIgnoreSrd]
	 */
	static async _pGetCacheAndGetCompendiumData (cacheId, entityType, entity, opts) {
		opts = opts || {};

		if (!opts.isIgnoreSrd && !entity.srd) return null;

		let lookupMetas = [];
		if (entity.name) lookupMetas.push((typeof entity.srd === "string" ? entity.srd : entity.name).toLowerCase().trim());
		if (entity._displayName) lookupMetas.push(entity._displayName.toLowerCase().trim());

		if (opts.deepKeys) {
			// Convert to "metadata" form
			lookupMetas = lookupMetas.map(it => ({name: it}));

			if (opts.fnGetAliases) {
				const aliasMetas = opts.fnGetAliases(entity);
				aliasMetas.forEach(it => it.name = it.name ? it.name.toLowerCase().trim() : it.name);
				// If we are matching on deep keys, prefer the "alias" data first (i.e. match against max info)
				lookupMetas.unshift(...aliasMetas);
			}
		} else {
			if (opts.fnGetAliases) lookupMetas.push(...opts.fnGetAliases(entity).map(it => it.toLowerCase().trim()));
		}

		let compendiums;
		switch (entityType) {
			case "spell": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importSpell", "additionalDataCompendium")); break;
			case "monster": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importCreature", "additionalDataCompendium")); break;
			case "item": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importItem", "additionalDataCompendium")); break;
			case "class": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importClass", "additionalDataCompendium")); break;
			case "classFeature": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importClass", "additionalDataCompendiumFeatures")); break;
			case "subclassFeature": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importClass", "additionalDataCompendiumFeatures")); break;
			case "optionalfeature": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importOptionalFeature", "additionalDataCompendium")); break;
			case "race": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importRace", "additionalDataCompendium")); break;
			case "raceFeature": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importRace", "additionalDataCompendiumFeatures")); break;
			case "monsterFeature": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importCreature", "additionalDataCompendiumFeatures")); break;
			default: return null;
		}

		if (!compendiums.length) return null;

		// Modify our cache ID based on the deep keys being used
		if (opts.deepKeys) {
			cacheId = {
				baseCacheId: cacheId,
				deepKeys: opts.deepKeys,
				cacheId: [cacheId, ...opts.deepKeys.sort(SortUtil.ascSortLower)].join("__"),
			};
		}

		await this._COMPENDIUM_CACHES_LOCK.pLock();
		try {
			// Order is important--we want to exhaustively search for the first lookup meta, then the next, etc.
			for (const lookupMeta of lookupMetas) {
				for (const compendium of compendiums) {
					if (!this._isCompendiumCached(this._COMPENDIUM_CACHES, cacheId, compendium)) {
						await this._pCacheCompendium(this._COMPENDIUM_CACHES, cacheId, compendium);
					}

					const out = this._getCachedCompendiumData(this._COMPENDIUM_CACHES, cacheId, compendium, lookupMeta);
					if (out) return out;
				}
			}
		} finally {
			this._COMPENDIUM_CACHES_LOCK.unlock();
		}
	}

	static _pGetCacheAndGetCompendiumData_getCompendiums (joinedCompendiumNamesOrArray) {
		joinedCompendiumNamesOrArray = typeof joinedCompendiumNamesOrArray === "string"
			? joinedCompendiumNamesOrArray
				.split(",")
				.map(it => it.trim().toLowerCase())
			: joinedCompendiumNamesOrArray
				.map(it => it.toLowerCase());

		return joinedCompendiumNamesOrArray
			.map(it => game.packs.find(x => x.collection.toLowerCase() === it))
			.filter(Boolean);
	}

	/**
	 * As per `pGetCompendiumImage`, but search compendium actor items.
	 * @param entityType Generally, the 5etools JSON property under which this 5etools data is stored.
	 * @param entity
	 * @param [opts] Options object.
	 * @param [opts.fnGetAliases] Function which takes the entity and returns alternate "alias" names to look for in the compendium.
	 */
	static async pGetActorItemCompendiumImage (entityType, entity, opts) {
		return this._pGetCacheAndGetActorItemCompendiumData(
			this._COMPENDIUM_CACHE_KEY_IMAGE,
			entityType,
			entity,
			opts,
		);
	}

	/**
	 * @param cacheId
	 * @param entityType
	 * @param entity
	 * @param [opts]
	 * @param [opts.fnGetAliases]
	 */
	static async _pGetCacheAndGetActorItemCompendiumData (cacheId, entityType, entity, opts) {
		opts = opts || {};

		let lookupMetas = [];
		if (entity.name) lookupMetas.push((typeof entity.srd === "string" ? entity.srd : entity.name).toLowerCase().trim());
		if (entity._displayName) lookupMetas.push(entity._displayName.toLowerCase().trim());

		if (opts.fnGetAliases) lookupMetas.push(...opts.fnGetAliases(entity).map(it => it.toLowerCase().trim()));

		let compendiums;
		switch (cacheId) {
			case this._COMPENDIUM_CACHE_KEY_IMAGE: {
				switch (entityType) {
					case "monsterFeature": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(Config.get("importCreature", "additionalDataCompendium")); break;
					default: return null;
				}

				break;
			}

			case this._COMPENDIUM_CACHE_KEY_DATA: {
				switch (entityType) {
					case "monsterFeature": compendiums = this._pGetCacheAndGetCompendiumData_getCompendiums(ConfigConsts.SRD_COMPENDIUMS_CREATURES); break;
					default: return null;
				}

				break;
			}

			default: throw new Error(`Unknown cache ID "${cacheId}"`);
		}

		if (!compendiums.length) return null;

		await this._COMPENDIUM_ACTOR_CACHES_LOCK.pLock();
		try {
			// Order is important--we want to exhaustively search for the first lookup meta, then the next, etc.
			for (const lookupMeta of lookupMetas) {
				for (const compendium of compendiums) {
					if (!this._isCompendiumCached(this._COMPENDIUM_ACTOR_CACHES, cacheId, compendium)) {
						await this._pCacheActorItemCompendium(this._COMPENDIUM_ACTOR_CACHES, cacheId, compendium);
					}

					const out = this._getCachedCompendiumData(this._COMPENDIUM_ACTOR_CACHES, cacheId, compendium, lookupMeta);
					if (out) return out;
				}
			}
		} finally {
			this._COMPENDIUM_ACTOR_CACHES_LOCK.unlock();
		}
	}

	/**
	 * Try to match a SRD (5etools) entity with a (Foundry) entity in the appropriate SRD compendiums, and return the Foundry entity.
	 * @param entityType
	 * @param entity
	 * @param [opts] Options object.
	 * @param [opts.fnGetAliases] Function which takes the entity and returns alternate "alias" names to look for in the compendium.
	 */
	static async getSrdCompendiumEntity (entityType, entity, opts) {
		return this._pGetCacheAndGetCompendiumData(
			this._COMPENDIUM_CACHE_KEY_DATA,
			entityType,
			entity,
			opts,
		);
	}

	static _isCompendiumCached (caches, cacheId, compendium) {
		cacheId = cacheId.cacheId || cacheId;
		return !!MiscUtil.get(caches, cacheId, compendium.collection);
	}

	static async _pCacheCompendium (caches, cacheId, compendium) {
		let isContent;
		if (cacheId.baseCacheId) {
			isContent = true;
		} else {
			switch (cacheId) {
				case this._COMPENDIUM_CACHE_KEY_IMAGE: isContent = false; break;
				case this._COMPENDIUM_CACHE_KEY_DATA: isContent = true; break;
				default: throw new Error(`Unknown cache ID "${cacheId}"`);
			}
		}

		const compendiumData = await this.pGetCompendiumData(compendium, isContent);

		const cache = MiscUtil.getOrSet(caches, cacheId.cacheId || cacheId, compendium.collection, {});
		if (!compendiumData) return;

		if (cacheId.baseCacheId) {
			compendiumData.forEach(it => cache[this._getCleanCompendiumContentName(this._getCompendiumDocOriginalName(it))] = MiscUtil.copy(it.data));
		} else {
			switch (cacheId) {
				case this._COMPENDIUM_CACHE_KEY_IMAGE: compendiumData.forEach(it => cache[this._getCleanCompendiumContentName(this._getCompendiumDocOriginalName(it))] = it.img); break;
				case this._COMPENDIUM_CACHE_KEY_DATA: compendiumData.forEach(it => cache[this._getCleanCompendiumContentName(this._getCompendiumDocOriginalName(it))] = MiscUtil.copy(it.data)); break;
				default: throw new Error(`Unknown cache ID "${cacheId}"`);
			}
		}
	}

	static async _pCacheActorItemCompendium (caches, cacheId, compendium) {
		const compendiumData = await this.pGetCompendiumData(compendium, true);

		const cache = MiscUtil.getOrSet(caches, cacheId.cacheId || cacheId, compendium.collection, {});
		if (!compendiumData) return;

		compendiumData.forEach(act => {
			act.items.forEach(it => {
				const cleanName = this._getCleanCompendiumContentName(this._getCompendiumDocOriginalName(it));
				// There will be many duplicates, so use the first item we come across with a matching name
				switch (cacheId) {
					case this._COMPENDIUM_CACHE_KEY_IMAGE: {
						if (!it.img || it.img.toLowerCase().includes("mystery-man.svg")) return;
						cache[cleanName] = cache[cleanName] || it.img;
						break;
					}
					case this._COMPENDIUM_CACHE_KEY_DATA: cache[cleanName] = cache[cleanName] || MiscUtil.copy(it.data); break;
					default: throw new Error(`Unknown cache ID "${cacheId}"`);
				}
			});
		});
	}

	static _getCachedCompendiumData (caches, cacheId, compendium, lookupNameOrMeta) {
		const cache = MiscUtil.get(caches, cacheId.cacheId || cacheId, compendium.collection);
		if (!cache) return null;
		const fromCache = cache[lookupNameOrMeta.name || lookupNameOrMeta];
		if (!fromCache || typeof lookupNameOrMeta === "string") return fromCache;

		const isMatch = Object.entries(lookupNameOrMeta)
			.filter(([keyPath]) => keyPath !== "name")
			.every(([keyPath, valRequired]) => {
				if (typeof valRequired === "string") valRequired = valRequired.toLowerCase().trim();

				let it;
				const pathParts = keyPath.split(".");
				for (const pathPart of pathParts) {
					it = (it || fromCache)[pathPart];
					if (it === undefined) return false;
				}
				if (typeof it === "string") it = this._getCleanCompendiumContentName(it);

				return it === valRequired;
			});

		if (!isMatch) return null;

		switch (cacheId.baseCacheId) {
			case this._COMPENDIUM_CACHE_KEY_IMAGE: return fromCache.img;
			case this._COMPENDIUM_CACHE_KEY_DATA: return fromCache;
			default: throw new Error(`Unknown cache ID "${cacheId.baseCacheId}"`);
		}
	}

	/** Tolerate modules which rename compendium content. */
	static _getCompendiumDocOriginalName (doc) {
		if (!UtilCompat.isBabeleActive()) return doc.name;
		return doc.getFlag("babele", "originalName") || doc.name;
	}

	static _getCleanCompendiumContentName (name) {
		return name
			.trim()
			.toLowerCase()
			.replace(CleanUtil.SHARED_REPLACEMENTS_REGEX, (match) => CleanUtil.SHARED_REPLACEMENTS[match]);
	}

	// region Plutonium compendiums (unused; compendiums have been removed)
	static pGetPlutoniumCompendiumId (page, hash) {
		switch (page) {
			case UrlUtil.PG_BESTIARY: return this._pGetPlutoniumCompendiumId_generic({page, hash, packName: SharedConsts.PACK_NAME_CREATURES});
			case UrlUtil.PG_ITEMS: return this._pGetPlutoniumCompendiumId_generic({page, hash, packName: SharedConsts.PACK_NAME_ITEMS});
			case UrlUtil.PG_SPELLS: return this._pGetPlutoniumCompendiumId_generic({page, hash, packName: SharedConsts.PACK_NAME_SPELLS});
			default: throw new Error(`Unhandled page "${page}"`);
		}
	}

	static async _pGetPlutoniumCompendiumId_generic ({page, hash, packName}) {
		const pack = game.packs.get(`${SharedConsts.MODULE_NAME}.${packName}`);
		if (!pack) return null;

		if (!UtilCompendium._PLUT_CACHES[packName]) {
			const lock = UtilCompendium._PLUT_CACHES_LOCKS[packName] || new VeLock();
			try {
				await lock.pLock();
				if (!UtilCompendium._PLUT_CACHES[packName]) UtilCompendium._PLUT_CACHES[packName] = await pack.getDocuments();
			} finally {
				lock.unlock();
			}
		}

		const match = UtilCompendium._PLUT_CACHES[packName].find(it => it.data?.flags?.[SharedConsts.MODULE_NAME_FAKE]?.page === page && it.data?.flags?.[SharedConsts.MODULE_NAME_FAKE]?.hash === hash);
		if (!match) return null;

		return {
			packName: packName,
			packPackage: SharedConsts.MODULE_NAME,
			packId: match.id,
		};
	}
	// endregion

	static getAvailablePacks ({folderType}) {
		return game.packs.filter(it => !it.locked && it.metadata.type === folderType);
	}

	static async pGetUserCreatePack ({folderType}) {
		const $dispPackName = $(`<div class="w-100 italic"></div>`);
		const packLabel = await InputUiUtil.pGetUserString({
			title: `Enter New "${folderType}" Compendium Name`,
			fnIsValid: str => Parser.stringToSlug(str).length,
			$elePost: $$`<label class="mb-2 split-v-center ve-muted">
					<div class="mr-2 bold no-wrap">Compendium ID:</div>
					${$dispPackName}
				</label>`,
			cbPostRender: ({comp, propValue}) => {
				const hkId = () => $dispPackName.text(comp._state[propValue] ? (Parser.stringToSlug(comp._state[propValue]) || "(Invalid)") : "\u2014");
				comp._addHookBase(propValue, hkId);
				hkId();
			},
		});
		if (!packLabel || !packLabel.trim()) return null;

		return CompendiumCollection.createCompendium({
			entity: "Item",
			label: packLabel,
			name: Parser.stringToSlug(packLabel),
			package: "world",
		});
	}

	static $getSelCompendium ({availablePacks = null, folderType = null}) {
		availablePacks = availablePacks || this.getAvailablePacks({folderType});
		return $(`<select class="block ve-foundry-button m-0">
			${availablePacks.map((pack) => `<option value="${pack.collection}">${pack.metadata.label}</option>`).join("")}
		</select>`);
	}

	static getPackByCollection ({collection}) {
		if (collection == null) return null;
		return game.packs.find(it => it.collection === collection);
	}
}

UtilCompendium._COMPENDIUM_CACHE_KEY_IMAGE = "img";
UtilCompendium._COMPENDIUM_CACHE_KEY_DATA = "data";
UtilCompendium._COMPENDIUM_IMAGE_LAST_VALUES = {};
UtilCompendium._COMPENDIUM_CACHES = {};
UtilCompendium._COMPENDIUM_CACHES_LOCK = new VeLock();
UtilCompendium._COMPENDIUM_ACTOR_IMAGE_LAST_VALUES = {};
UtilCompendium._COMPENDIUM_ACTOR_CACHES = {};
UtilCompendium._COMPENDIUM_ACTOR_CACHES_LOCK = new VeLock();

UtilCompendium._PLUT_CACHES = {};
UtilCompendium._PLUT_CACHES_LOCKS = {};

export {UtilCompendium};
