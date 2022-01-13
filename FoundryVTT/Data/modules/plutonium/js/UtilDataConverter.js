import {UtilActors} from "./UtilActors.js";
import {Config} from "./Config.js";
import {Vetools} from "./Vetools.js";
import {Consts} from "./Consts.js";

class UtilDataConverter {
	static getNameWithSourcePart (ent, {displayName = null, isActorItem = false} = {}) {
		return `${displayName || `${ent.type === "variant" ? "Variant: " : ""}${Renderer.stripTags(ent._displayName || ent.name || "")}`}${!isActorItem && ent.source && Config.get("import", "isAddSourceToName") ? ` (${Parser.sourceJsonToAbv(ent.source)})` : ""}`;
	}

	static getSourceWithPagePart (ent) {
		return `${Parser.sourceJsonToAbv(ent.source)}${Config.get("import", "isAddPageNumberToSource") && ent.page ? `${UtilDataConverter.SOURCE_PAGE_PREFIX}${ent.page}` : ""}`;
	}

	static async pGetItemWeaponType (uid) {
		uid = uid.toLowerCase().trim();

		if (UtilActors.WEAPONS_MARTIAL.includes(uid)) return "martial";
		if (UtilActors.WEAPONS_SIMPLE.includes(uid)) return "simple";

		let [name, source] = Renderer.splitTagByPipe(uid);
		source = source || "phb";
		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source});

		if (Renderer.hover.isCached(UrlUtil.PG_ITEMS, source, hash)) return Renderer.hover.getFromCache(UrlUtil.PG_ITEMS, source, hash)?.weaponCategory;

		// If the item *probably* isn't available, return null. This prevents us from re-running the cache if we're
		//   looking for e.g. a string which isn't an item UID.
		if (Renderer.hover.isPageSourceCached(UrlUtil.PG_ITEMS, source)) return null;

		// If we've yet to attempt to load this source, load the item, and hopefully return the type
		const found = await Renderer.hover.pCacheAndGet(UrlUtil.PG_ITEMS, source, hash);
		return found?.weaponCategory;
	}

	static async pGetClassItemClassAndSubclass ({sheetItem, cache = null} = {}) {
		cache = cache || {};
		if (!cache._allClasses && !cache._allSubclasses) {
			const classData = await DataUtil.class.loadJSON();
			const brew = await BrewUtil.pAddBrewData();
			cache._allClasses = [...(classData.class || []), ...(brew?.class || [])];
			cache._allSubclasses = [...(classData.subclass || []), ...(brew?.subclass || [])];
		}

		const nameLowerClean = sheetItem.name.toLowerCase().trim();
		const sourceLowerClean = (UtilDataConverter.getItemSource(sheetItem) || "").toLowerCase();

		const matchingClasses = cache._allClasses.filter(cls =>
			cls.name.toLowerCase() === nameLowerClean
				&& (
					!Config.get("import", "isStrictMatching")
					|| sourceLowerClean === Parser.sourceJsonToAbv(cls.source).toLowerCase()
				),
		);
		if (!matchingClasses.length) return {matchingClasses: [], matchingSubclasses: [], sheetItem};

		if (!(sheetItem.data.data.subclass || "").trim()) return {matchingClasses, matchingSubclasses: [], sheetItem};

		const matchingSubclasses = matchingClasses
			.map(cls => cache._allSubclasses.filter(sc => sc.className === cls.name && sc.classSource === cls.source && sc.name.toLowerCase() === sheetItem.data.data.subclass.toLowerCase().trim()))
			.flat();
		return {matchingClasses, matchingSubclasses, sheetItem};
	}

	static getItemSource (itm) {
		let data = itm.data || {};
		if (data.data) data = data.data;
		let rawSource = data.source;

		// region vtta-dndbeyond workaround
		// This is invalid, but as of 2020-12-15, vtta-dndbeyond can create an array of sources on race items on imported
		//   characters. Tolerate it.
		if (rawSource instanceof Array) rawSource = rawSource[0];
		// endregion

		if (!rawSource) return rawSource;
		return rawSource.split(UtilDataConverter._SOURCE_PAGE_PREFIX_RE)[0].trim();
	}

	static getSpellPointTotal ({totalSpellcastingLevels}) {
		if (!totalSpellcastingLevels) return 0;

		const spellSlotCounts = UtilActors.CASTER_TYPE_TO_PROGRESSION.full[totalSpellcastingLevels - 1]
			|| UtilActors.CASTER_TYPE_TO_PROGRESSION.full[0];

		return spellSlotCounts
			.map((countSlots, ix) => {
				const spellLevel = ix + 1;
				return Parser.spLevelToSpellPoints(spellLevel) * countSlots;
			})
			.sum();
	}

	static getPsiPointTotal ({totalMysticLevels}) {
		if (!totalMysticLevels || isNaN(totalMysticLevels) || totalMysticLevels < 0) return 0;

		totalMysticLevels = Math.round(Math.min(totalMysticLevels, Consts.CHAR_MAX_LEVEL));

		return [4, 6, 14, 17, 27, 32, 38, 44, 57, 64, 64, 64, 64, 64, 64, 64, 64, 71, 71, 71][totalMysticLevels - 1];
	}

	// region Description rendering
	static async pGetWithDescriptionPlugins (pFn, {actorId = null, tagHashItemIdMap = null} = {}) {
		const hkLink = (entry, procHash) => this._pGetWithDescriptionPlugins_fnPlugin(entry, procHash);
		const hkStr = (tag, text) => {
			const inn = `{${tag} ${text}}`;
			const itemId = this._pGetWithDescriptionPlugins_getTagItemId({tag, text, tagHashItemIdMap});
			const out = this._getConvertedTagLinkString(inn, {actorId, itemId});
			if (inn === out) return null; // If no changes were made, return `null`, to fall back on regular rendering.
			return out;
		};
		const hkImg = (entry, url) => {
			const out = Vetools.getImageSavedToServerUrl({originalUrl: url});
			// Always assume the image download/save worked--if not, the user will have to deal with it.
			//
			//   The reasoning for this is as follows:
			//
			//     We cannot use async code inside the renderer, as this would mean a complete re-write. Therefore, we
			//   would have to modify the entries _before_ they hit the renderer. This is not sustainable, as the renderer
			//   itself is allowed to create its own entries internally/etc.; we have to use plugins to ensure the entries
			//   we care about are always processed correctly.
			//
			//     We could instead find-replace the results of the wrapped callback function, below, as we assume it is a
			//   string. This is a horrible hack, however, and forces us to e.g. regex for known image file extensions.
			//
			//     In the absence of other solutions, we optimistically assume the download will always work. :)
			Vetools.pSaveImageToServerAndGetUrl({originalUrl: url, force: true}).then(null).catch(() => {});
			return out;
		};

		Renderer.get().addPlugin("link_attributesHover", hkLink);
		if (Config.get("import", "isRenderLinksAsTags")) Renderer.get().addPlugin("string_tag", hkStr);
		if (Config.get("import", "isSaveImagesToServer")) {
			Renderer.get().addPlugin("image_urlPostProcess", hkImg);
			Renderer.get().addPlugin("image_urlThumbnailPostProcess", hkImg);
		}

		let out;
		try {
			out = await pFn();
		} finally {
			Renderer.get().removePlugin("link_attributesHover", hkLink);
			Renderer.get().removePlugin("string_tag", hkStr);
			Renderer.get().removePlugin("image_urlPostProcess", hkImg);
			Renderer.get().removePlugin("image_urlThumbnailPostProcess", hkImg);
		}

		return out;
	}

	/**
	 * Fetch a possible actor item ID for a given tag, e.g. when mapping creature spell sections.
	 */
	static _pGetWithDescriptionPlugins_getTagItemId ({tag, text, tagHashItemIdMap}) {
		const tagName = tag.slice(1); // slice to remove leading `@`
		if (!tagHashItemIdMap?.[tagName]) return null;
		const defaultSource = Parser.TAG_TO_DEFAULT_SOURCE[tagName];
		if (!defaultSource) return null;
		const page = Renderer.hover.TAG_TO_PAGE[tagName];
		if (!page) return null;
		const hashBuilder = UrlUtil.URL_TO_HASH_BUILDER[page];
		if (!hashBuilder) return null;
		let [name, source] = text.split("|");
		source = source || defaultSource;
		const hash = hashBuilder({name, source});
		return tagHashItemIdMap?.[tagName]?.[hash];
	}

	static _pGetWithDescriptionPlugins_fnPlugin (entry, procHash) {
		const page = entry.href.hover.page;
		const source = entry.href.hover.source;
		const hash = procHash;
		const preloadId = entry.href.hover.preloadId;
		return {
			attributesHoverReplace: [
				`data-plut-hover="${true}" data-plut-hover-page="${page.qq()}" data-plut-hover-source="${source.qq()}" data-plut-hover-hash="${hash.qq()}" ${preloadId ? `data-plut-hover-preload-id="${preloadId.qq()}"` : ""}`,
			],
		};
	}

	// region Replace entity links with @<tag>s
	static _getConvertedTagLinkString (str, {actorId, itemId} = {}) {
		UtilDataConverter._LINK_TAG_METAS = UtilDataConverter._LINK_TAG_METAS
			|| Object.keys(Parser.TAG_TO_DEFAULT_SOURCE).map(tag => ({tag, re: RegExp(`^{@${tag} (?<text>[^}]+)}$`, "g")}));

		for (const {tag, re} of UtilDataConverter._LINK_TAG_METAS) str = str.replace(re, (...m) => this._replaceEntityLinks_getReplacement({tag, text: m.last().text, actorId, itemId}));
		return str;
	}

	static getConvertedTagLinkEntries (entries) {
		if (!entries) return entries;

		return UtilDataConverter.WALKER_GENERIC.walk(
			MiscUtil.copy(entries),
			{
				string: str => {
					const textStack = [""];
					this._getConvertedTagLinkEntries_recurse(str, textStack);
					return textStack.join("");
				},
			},
		);
	}

	// Based on `Renderer._renderString`
	static _getConvertedTagLinkEntries_recurse (str, textStack) {
		const tagSplit = Renderer.splitByTags(str);
		const len = tagSplit.length;
		for (let i = 0; i < len; ++i) {
			const s = tagSplit[i];
			if (!s) continue;

			// For tags, try to convert them. If we can, use the converted string. If not, recurse.
			if (s.startsWith("{@")) {
				const converted = this._getConvertedTagLinkString(s);

				if (converted !== s) {
					textStack[0] += (converted);
					continue;
				}

				textStack[0] += s.slice(0, 1);
				this._getConvertedTagLinkEntries_recurse(s.slice(1, -1), textStack);
				textStack[0] += s.slice(-1);

				continue;
			}

			textStack[0] += s;
		}
	}

	static _replaceEntityLinks_getReplacement ({tag, text, actorId, itemId}) {
		if (actorId && itemId) {
			const [, , displayText] = text.split("|");
			return `@ActorEmbeddedItem[${actorId}][${itemId}]${displayText ? `{${displayText}}` : ""}`;
		}
		return `@${tag}[${text}]`;
	}

	/** Async string find-replace. (Unused). */
	static async _pReplaceEntityLinks_pReplace ({str, re, tag}) {
		let m;
		while ((m = re.exec(str))) {
			const prefix = str.slice(0, m.index);
			const suffix = str.slice(re.lastIndex);
			const replacement = this._replaceEntityLinks_getReplacement({tag, m});
			str = `${prefix}${replacement}${suffix}`;
			re.lastIndex = prefix.length + replacement.length;
		}
		return str;
	}
	// endregion

	// endregion

	static _RECHARGE_TYPES = {
		"round": null,
		"restShort": "sr",
		"restLong": "lr",
		"dawn": "day",
		"dusk": "day",
		"midnight": "day",
		"special": null,
	};

	static getFvttUsesPer (it, {isStrict = true} = {}) {
		if (isStrict && !this._RECHARGE_TYPES[it]) return null;
		return Parser._parse_aToB(this._RECHARGE_TYPES, it);
	}
}
UtilDataConverter.WALKER_READONLY_GENERIC = MiscUtil.getWalker({isNoModification: true, keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST});
UtilDataConverter.WALKER_GENERIC = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST});
UtilDataConverter.SOURCE_PAGE_PREFIX = " pg. ";
UtilDataConverter._SOURCE_PAGE_PREFIX_RE = new RegExp(`${UtilDataConverter.SOURCE_PAGE_PREFIX}\\d+`);

UtilDataConverter._LINK_TAG_METAS = null;

export {UtilDataConverter};
