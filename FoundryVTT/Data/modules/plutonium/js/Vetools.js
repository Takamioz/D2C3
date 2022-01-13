import {SharedConsts} from "../shared/SharedConsts.js";
import {Consts} from "./Consts.js";
import {JqueryExtension} from "./JqueryExtension.js";
import {Config} from "./Config.js";
import {GameStorage} from "./GameStorage.js";
import {LGT} from "./Util.js";
import {UtilNotifications} from "./UtilNotifications.js";
import {UtilHooks} from "./UtilHooks.js";

class NotAxios {
	static async get (url) { return {data: (await (await fetch(url)).json())}; }
}

class Vetools {
	// region Meta
	static async pDoPreload () {
		if (Config.get("import", "isNoHomebrewIndexes")) return;

		// Load this asynchronously, to avoid killing the load if it doesn't exist
		Vetools._pGetHomebrewIndices()
			.then(({source, prop, abbreviation}) => {
				Vetools.HOMEBREW_INDEX__PROP = prop;
				Vetools.HOMEBREW_INDEX__SOURCE = source;
				Vetools.HOMEBREW_INDEX__ABBREVIATION = abbreviation;
				console.log(...LGT, "Loaded homebrew index.");
			})
			.catch(e => {
				Vetools.HOMEBREW_INDEX__PROP = {};
				Vetools.HOMEBREW_INDEX__SOURCE = {};
				Vetools.HOMEBREW_INDEX__ABBREVIATION = {};
				ui.notifications.error(`Failed to load homebrew index! ${VeCt.STR_SEE_CONSOLE}`);
				setTimeout(() => { throw e; });
			});
	}

	static withUnpatchedDiceRendering (fn) {
		Renderer.getRollableEntryDice = Vetools._CACHED_GET_ROLLABLE_ENTRY_DICE;
		const out = fn();
		Renderer.getRollableEntryDice = Vetools._PATCHED_GET_ROLLABLE_ENTRY_DICE;
		return out;
	}

	static withCustomDiceRenderingPatch (fn, fnRender) {
		Renderer.getRollableEntryDice = fnRender;
		const out = fn();
		Renderer.getRollableEntryDice = Vetools._PATCHED_GET_ROLLABLE_ENTRY_DICE;
		return out;
	}

	static getCleanDiceString (diceString) {
		return diceString
			// Use symbols Foundry can understand
			.replace(/×/g, "*")
			.replace(/÷/g, "/")
			// Foundry (as of 2020-11-15) doesn't support prompting for user variables in rolls
			.replace(/#\$.*?\$#/g, "0")
		;
	}

	static doMonkeyPatch () {
		JqueryExtension.init();
		this._initSourceLookup();

		VeCt.STR_SEE_CONSOLE = "See the console (F12 or CTRL+SHIFT+J) for details.";

		StorageUtil.pSet = GameStorage.pSetClient.bind(GameStorage);
		StorageUtil.pGet = GameStorage.pGetClient.bind(GameStorage);

		Renderer.get().setBaseUrl(Vetools.BASE_SITE_URL);
		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, () => {
			if (Config.get("import", "isUseLocalImages")) {
				const localImageDirPath = `${Config.get("import", "localImageDirectoryPath")}/`.replace(/\/+$/, "/");
				Renderer.get().setBaseMediaUrl("img", localImageDirPath);
				return;
			}
			Renderer.get().setBaseMediaUrl("img", null);
		});

		Renderer.hover.MIN_Z_INDEX = Consts.Z_INDEX_MAX_FOUNDRY + 1;
		Renderer.hover._MAX_Z_INDEX = Renderer.hover.MIN_Z_INDEX + 10;

		BrewUtil.homebrew = {};
		BrewUtil.homebrewMeta = {sources: []};

		// region Rolls
		Vetools._CACHED_GET_ROLLABLE_ENTRY_DICE = Renderer.getRollableEntryDice;
		Vetools._PATCHED_GET_ROLLABLE_ENTRY_DICE = (
			entry,
			name,
			toDisplay,
			{
				isAddHandlers = true,
				pluginResults = null,
			} = {},
		) => {
			const cpy = MiscUtil.copy(entry);

			if (typeof cpy.toRoll !== "string") {
				// handle legacy format
				cpy.toRoll = Renderer.legacyDiceToString(cpy.toRoll);
			}

			// If there's a prompt, find the lowest level at which there is additional text (e.g. level 4 for fireball)
			//   and use that text
			if (cpy.prompt) {
				const minAdditionalDiceLevel = Math.min(...Object.keys(cpy.prompt.options)
					.map(it => Number(it))
					.filter(it => cpy.prompt.options[it]));
				cpy.toRoll = cpy.prompt.options[minAdditionalDiceLevel];
			}

			const toRollClean = this.getCleanDiceString(cpy.toRoll);

			if (Config.get("import", "isRendererDiceDisabled")) return toDisplay || toRollClean;

			return `[[/r ${toRollClean}]]${toRollClean.toLowerCase().trim() !== toDisplay.toLowerCase().trim() ? ` (${toDisplay})` : ""}`;
		};

		Renderer.getRollableEntryDice = Vetools._PATCHED_GET_ROLLABLE_ENTRY_DICE;

		// Swap the original `getRollableEntryDice` back in when we're about to render a window.
		//   This prevents e.g. "[[/r 1d20]]" from appearing in the rendered content.
		const cachedRenderHoverMethods = {};
		const renderHoverMethods = [
			"$getHoverContent_stats",
			"$getHoverContent_fluff",
			"$getHoverContent_statsCode",
			"$getHoverContent_miscCode",
			"$getHoverContent_generic",
		];
		renderHoverMethods.forEach(methodName => {
			cachedRenderHoverMethods[methodName] = Renderer.hover[methodName];
			Renderer.hover[methodName] = (...args) => {
				Renderer.getRollableEntryDice = Vetools._CACHED_GET_ROLLABLE_ENTRY_DICE;
				const out = cachedRenderHoverMethods[methodName](...args);
				Renderer.getRollableEntryDice = Vetools._PATCHED_GET_ROLLABLE_ENTRY_DICE;
				return out;
			};
		});

		// region Express predefined hovers as `data-`
		const cachedGetMakePredefinedHover = Renderer.hover.getMakePredefinedHover.bind(Renderer.hover);
		Renderer.hover.getMakePredefinedHover = (entry, opts) => {
			const out = cachedGetMakePredefinedHover(entry, opts);
			out.html = `data-plut-hover="${true}" data-plut-hover-preload="${true}" data-plut-hover-preload-id="${out.id}" ${opts ? `data-plut-hover-preload-options="${JSON.stringify(opts).qq()}"` : ""}`;
			return out;
		};
		// endregion

		Renderer.dice.rollerClick = (evtMock, ele, packed, name) => {
			const entry = JSON.parse(packed);
			if (entry.toRoll) (new Roll(entry.toRoll)).toMessage();
		};

		Renderer.dice.pRollEntry = (entry, rolledBy, opts) => {
			if (entry.toRoll) (new Roll(entry.toRoll)).toMessage();
		};
		// endregion

		// region Patch over content handler bindings--these should only ever be used in hover windows
		Vetools._CACHED_MONSTER_DO_BIND_COMPACT_CONTENT_HANDLERS = Renderer.monster.doBindCompactContentHandlers;
		Renderer.monster.doBindCompactContentHandlers = (opts) => {
			const nxtOpts = {...opts};
			nxtOpts.fnRender = (...args) => Vetools.withUnpatchedDiceRendering(() => opts.fnRender(...args));
			return Vetools._CACHED_MONSTER_DO_BIND_COMPACT_CONTENT_HANDLERS(nxtOpts);
		};
		// endregion

		JqueryUtil.doToast = (options) => {
			if (typeof options === "string") {
				options = {
					content: options,
					type: "info",
				};
			}
			options.type = options.type || "info";

			switch (options.type) {
				case "warning": return ui.notifications.warn(options.content);
				case "danger": return ui.notifications.error(options.content);
				default: return ui.notifications.info(options.content);
			}
		};

		DataUtil.loadJSON = async (url) => Vetools.pGetWithCache(url);

		Vetools._CACHED_RENDERER_HOVER_CACHE_AND_GET = Renderer.hover.pCacheAndGet.bind(Renderer.hover);
		Renderer.hover.pCacheAndGet = async function (page, source, ...others) {
			// region Local brew preload
			// If it's a homebrew source, pre-load our local homebrew. This allows us to cope with the case where local
			//   brew--which the 5et loader expects to be ready in `BrewUtil`--is still "cold" on disk.
			const sourceLower = `${source}`.toLowerCase();
			if (!Vetools._VET_SOURCE_LOOKUP[sourceLower]) await Vetools._pDoCacheLocalBrew();
			// endregion

			return Vetools._CACHED_RENDERER_HOVER_CACHE_AND_GET(page, source, ...others);
		};

		BrewUtil.hasSourceJson = (source) => !!Vetools.HOMEBREW_META_SOURCES[(source || "").toLowerCase()];
		BrewUtil.sourceJsonToAbv = (source) => (Vetools.HOMEBREW_META_SOURCES[(source || "").toLowerCase()] || {}).abbreviation || source;
		BrewUtil.sourceJsonToFull = (source) => (Vetools.HOMEBREW_META_SOURCES[(source || "").toLowerCase()] || {}).full || source;
		BrewUtil.sourceJsonToSource = (source) => Vetools.HOMEBREW_META_SOURCES[(source || "").toLowerCase()];
		BrewUtil.sourceJsonToStyle = (source) => {
			const lowSource = (source || "").toLowerCase();
			if (Vetools.HOMEBREW_META_SOURCES[lowSource] && Vetools.HOMEBREW_META_SOURCES[lowSource].color) {
				const validColor = BrewUtil.getValidColor(Vetools.HOMEBREW_META_SOURCES[lowSource].color);
				if (validColor.length) return `style="color: #${validColor};"`;
				return "";
			} else return "";
		};
		BrewUtil.getJsonSources = () => Object.values(Vetools.HOMEBREW_META_SOURCES);
		BrewUtil._STORABLE = [...BrewUtil._STORABLE, "foundrySpell", "foundryClassFeature", "foundrySubclassFeature", "foundryOptionalfeature"];
		BrewUtil._PAGE = UrlUtil.PG_MANAGE_BREW;
		BrewUtil._pCleanSaveBrew = () => { /* No-op */ };
	}

	static _initSourceLookup () { Object.keys(Parser.SOURCE_JSON_TO_FULL).forEach(source => Vetools._VET_SOURCE_LOOKUP[source.toLowerCase()] = true); }

	static async _pDoCacheLocalBrew () { await this.pGetLocalHomebrewSources(); }

	static addToHomebrewSourceLookup (data) {
		if (data._meta && data._meta.sources) {
			data._meta.sources.forEach(metaSource => Vetools.HOMEBREW_META_SOURCES[(metaSource.json || "").toLowerCase()] = MiscUtil.copy(metaSource));
		}
	}

	/**
	 * Add loaded content to homebrew, so that it can be referenced later in the session.
	 * As the content is not copied during 5etools' homebrew loading, we can get away with doing this without much
	 * memory cost.
	 * @param data The full JSON data.
	 */
	static async pAddToHomebrew (data) {
		// Homebrew files should always have a source header
		const sources = MiscUtil.get(data, "_meta", "sources");
		if (!sources || !(sources instanceof Array) || !sources.every(it => !Parser.SOURCE_JSON_TO_ABV[it.json])) return;
		await BrewUtil.pDoHandleBrewJson(data, "NO_PAGE");
	}
	// endregion

	// region Requests
	static async pGetWithCache (url) {
		if (!url.includes("?")) url = `${url}?t=${Consts.RUN_TIME}`;

		// Strip any excess slashes
		const parts = url.split(Vetools._RE_HTTP_URL).filter(Boolean);
		parts[parts.length - 1] = parts.last().replace(/\/+/g, "/");
		url = parts.join("");

		const urlBase = url.split("?")[0];

		if (Vetools.CACHE_REQUESTS_IN_FLIGHT[urlBase]) {
			await Vetools.CACHE_REQUESTS_IN_FLIGHT[urlBase];
			return Vetools.CACHED_REQUESTS[urlBase];
		}

		Vetools.CACHE_REQUESTS_IN_FLIGHT[urlBase] = (async () => {
			// Use local data where possible
			let data;
			if (!Config.get("import", "isNoLocalData") && url.startsWith(`${Vetools.BASE_SITE_URL}data/`)) {
				const urlPart = url.split(Vetools.BASE_SITE_URL).slice(1).join(Vetools.BASE_SITE_URL);
				const localUrl = `modules/${SharedConsts.MODULE_NAME}/${urlPart}`;

				data = (await NotAxios.get(localUrl)).data;
			} else {
				data = (await NotAxios.get(url)).data;
			}

			Vetools.addToHomebrewSourceLookup(data);
			await Vetools.pAddToHomebrew(data);

			await DataUtil.pDoMetaMerge(urlBase, data);
			return (Vetools.CACHED_REQUESTS[urlBase] = data);
		})();

		await Vetools.CACHE_REQUESTS_IN_FLIGHT[urlBase];
		return Vetools.CACHED_REQUESTS[urlBase];
	}

	static async pLoadImporterSourceSpecial (source) {
		let content;
		if (source.special.cacheKey) content = Vetools.CACHED_REQUESTS[source.special.cacheKey] || (Vetools.CACHED_REQUESTS[source.special.cacheKey] = await source.special.pGet());
		else content = await source.special.pGet();
		return content;
	}

	static async pGetChangelog () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/changelog.json`); }

	static async pGetPackageIndex () { return Vetools.pGetWithCache(Config.get("importAdventure", "indexUrl")); }

	static async pGetSpellIndex () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/spells/index.json`); }
	static getSpellUrl (filename) { return `${Vetools.BASE_SITE_URL}data/spells/${filename}`; }

	static async pGetCreatureIndex () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/bestiary/index.json`); }
	static getCreatureUrl (filename) { return `${Vetools.BASE_SITE_URL}data/bestiary/${filename}`; }

	static async pGetItems (addGroups) {
		return {item: await Renderer.item.pBuildList({isAddGroups: !!addGroups})}; // This has built-in caching
	}

	static async pGetItemFluff () {
		const url = `${Vetools.BASE_SITE_URL}data/fluff-items.json`;
		return Vetools.pGetWithCache(url);
	}

	/**
	 * @param [opts] Options object.
	 * @param [opts.isAddBaseRaces] If an entity should be created for each base race.
	 */
	static async pGetRaces (opts) {
		return DataUtil.race.loadJSON(opts);
	}

	static async pGetClasses () {
		return DataUtil.class.loadRawJSON();
	}

	static async pGetClassSubclassFeatures () {
		return DataUtil.class.loadRawJSON();
	}

	static async pGetRollableTables () {
		return DataUtil.table.loadJSON();
	}

	static async _pGetAdventureBookIndex (filename, {prop, fnGetUrl}) {
		const url = `${Vetools.BASE_SITE_URL}data/${filename}`;
		const index = await Vetools.pGetWithCache(url);
		index[prop].forEach(it => {
			it._pubDate = new Date(it.published || "1970-01-01");
			it._url = fnGetUrl(it.id);
		});
		return index;
	}

	static async pGetAdventureIndex () {
		return this._pGetAdventureBookIndex("adventures.json", {prop: "adventure", fnGetUrl: Vetools.getAdventureUrl.bind(Vetools)});
	}

	static async pGetBookIndex () {
		return this._pGetAdventureBookIndex("books.json", {prop: "book", fnGetUrl: Vetools.getBookUrl.bind(Vetools)});
	}

	static _getAdventureBookUrl (type, id) {
		return `${Vetools.BASE_SITE_URL}data/${type}/${type}-${id.toLowerCase()}.json`;
	}

	static getAdventureUrl (id) {
		return this._getAdventureBookUrl("adventure", id);
	}

	static getBookUrl (id) {
		return this._getAdventureBookUrl("book", id);
	}

	static pGetImageUrlFromFluff (fluff) {
		if (!fluff?.images?.length) return;

		const imgEntry = fluff.images[0];
		if (!imgEntry?.href) return;

		if (imgEntry.href.type === "internal") {
			return imgEntry.href.path ? `${Vetools.getInternalImageUrl(imgEntry.href.path)}` : null;
		}

		if (imgEntry.href.type === "external") {
			return imgEntry.href.url ? imgEntry.href.url : null;
		}
	}

	static async pHasTokenUrl (entityType, it) {
		return (await Vetools._pGetTokenUrl(entityType, it)).hasToken;
	}

	static async pGetTokenUrl (entityType, it) {
		return (await Vetools._pGetTokenUrl(entityType, it)).url;
	}

	static _isSaveableToServerUrl (originalUrl) { return originalUrl && typeof originalUrl === "string" && Vetools._RE_HTTP_URL.test(originalUrl); }
	static _isSaveTypedImagesToServer ({imageType = "image"} = {}) {
		switch (imageType) {
			case "image": return Config.get("import", "isSaveImagesToServer");
			case "token": return Config.get("import", "isSaveTokensToServer");
			default: throw new Error(`Unhandled type "${imageType}"!`);
		}
	}

	static async _pGetTokenUrl (entityType, it) {
		if (it.tokenUrl) return {url: it.tokenUrl, hasToken: true};

		const fallbackMeta = {
			url: this.getBlankTokenUrl(),
			hasToken: false,
		};

		switch (entityType) {
			case "monster":
			case "vehicle":
			case "object": {
				const fnGets = {
					"monster": Renderer.monster.getTokenUrl,
					"vehicle": Renderer.vehicle.getTokenUrl,
					"object": Renderer.object.getTokenUrl,
				};
				const fnGet = fnGets[entityType];
				if (!fnGet) throw new Error(`Missing getter!`);

				if (it.hasToken) return {url: fnGet(it), hasToken: true};
				if (it._versionBase_hasToken) return {url: fnGet({name: it._versionBase_name, source: it._versionBase_source}), hasToken: true};

				return fallbackMeta;
			}
			case "trap": return fallbackMeta;
			default: throw new Error(`Unhandled entity type "${entityType}"`);
		}
	}

	static getBlankTokenUrl () { return UrlUtil.link(`${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/blank.png`); }

	static getImageUrl (entry) {
		if (entry?.href.type === "internal") return Vetools.getInternalImageUrl(entry.href.path, {isSkipEncode: true});
		return entry.href?.url;
	}

	static getInternalImageUrl (path, {isSkipEncode = false} = {}) {
		if (!path) return null;
		const fnEncode = isSkipEncode ? it => it : encodeURI;

		const out = `${fnEncode(Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl)}img/${fnEncode(path)}`;

		if (isSkipEncode) return out;
		return out.replace(/'/g, "%27"); // URL encode, as Foundry uses these in single-quoted CSS `background-image` strings
	}

	static async pOptionallySaveImageToServerAndGetUrl (originalUrl, {imageType = "image"} = {}) {
		if (this._isLocalUrl({originalUrl})) return originalUrl;
		if (!this._isSaveTypedImagesToServer({imageType})) return originalUrl;
		return this.pSaveImageToServerAndGetUrl({originalUrl});
	}

	static _isLocalUrl ({originalUrl}) { return new URL(document.baseURI).origin === new URL(originalUrl, document.baseURI).origin; }

	static getImageSavedToServerUrl ({originalUrl, path} = {}) {
		if (!path && !this._isSaveableToServerUrl(originalUrl)) return originalUrl;

		const pathPart = (new URL(path ? `https://example.com/${path}` : originalUrl)).pathname;
		return `${Config.get("import", "localImageDirectoryPath")}/${decodeURI(pathPart)}`.replace(/\/+/g, "/");
	}

	static async pSaveImageToServerAndGetUrl ({originalUrl, blob, force = false, path = null} = {}) {
		if (blob && originalUrl) throw new Error(`"blob" and "originalUrl" arguments are mutually exclusive!`);

		if (!blob && !this._isSaveableToServerUrl(originalUrl)) return originalUrl;

		let out;
		try {
			await Vetools._LOCK_DOWNLOAD_IMAGE.pLock();
			out = await this._pSaveImageToServerAndGetUrl_({originalUrl, blob, force, path});
		} finally {
			Vetools._LOCK_DOWNLOAD_IMAGE.unlock();
		}
		return out;
	}

	static async _pSaveImageToServerAndGetUrl_ ({originalUrl, blob, force = false, path = null} = {}) {
		if (blob && originalUrl) throw new Error(`"blob" and "originalUrl" arguments are mutually exclusive!`);

		const cleanOutPath = this.getImageSavedToServerUrl({originalUrl, path});
		const pathParts = cleanOutPath.split("/");
		const cleanOutDir = pathParts.slice(0, -1).join("/");

		let existingFiles = null;
		let isDirExists = false;
		try {
			existingFiles = await FilePicker.browse("data", cleanOutDir);
			if (existingFiles?.target) isDirExists = true; // If we could browse for it, it exists
		} catch (e) {
			if (!/^Directory .*? does not exist/.test(`${e}`)) {
				const msgStart = `Could not check for existing files when saving imported images to server!`;
				if (!force && blob) throw new Error(msgStart);

				const msg = `${msgStart}${force ? "" : ` The original image URL will be used instead.`}`;
				UtilNotifications.notifyOnce({type: "warn", message: msg});
				return force ? cleanOutPath : originalUrl;
			}
		}

		// If the file already exists, use it
		if (existingFiles?.files && existingFiles?.files.map(it => decodeURI(it)).includes(cleanOutPath)) return cleanOutPath;

		if (!this._canUploadFiles()) {
			if (!force && blob) throw new Error(`Your permission levels do not allow you to upload files!`);

			const msg = `You have the "Save Imported Images to Server" config option enabled, but your permission levels do not allow you to upload files!${force ? "" : ` The original image URL will be used instead.`}`;
			UtilNotifications.notifyOnce({type: "warn", message: msg});
			return force ? cleanOutPath : originalUrl;
		}

		if (!isDirExists) {
			try {
				await this._pSaveImageToServerAndGetUrl_pCreateDirectories(cleanOutPath);
			} catch (e) {
				const msgStart = `Could not create required directories when saving imported images to server!`;
				if (!force && blob) throw new Error(msgStart);

				const msg = `${msgStart}${force ? "" : ` The original image URL will be used instead.`}`;
				UtilNotifications.notifyOnce({type: "warn", message: msg});
				return force ? cleanOutPath : originalUrl;
			}
		}

		try {
			blob = blob || await this._pSaveImageToServerAndGetUrl_pGetBlob(originalUrl);
		} catch (e) {
			const msg = `Failed to download image "${originalUrl}" when saving imported images to server!${force ? "" : ` The original image URL will be used instead.`} ${VeCt.STR_SEE_CONSOLE}`;
			UtilNotifications.notifyOnce({type: "warn", message: msg});
			console.error(...LGT, e);
			return force ? cleanOutPath : originalUrl;
		}

		const name = pathParts.last();
		let mimeType = `image/${(name.split(".").last() || "").trim().toLowerCase()}`;
		// The shortened version isn't valid (see https://www.w3.org/Graphics/JPEG/)
		if (mimeType === "image/jpg") mimeType = "image/jpeg";

		const resp = await FilePicker.upload(
			"data",
			cleanOutDir,
			new File(
				[blob],
				name,
				{
					lastModified: Date.now(),
					type: mimeType,
				},
			),
		);
		if (resp?.path) return decodeURI(resp.path);

		return force ? cleanOutPath : originalUrl;
	}

	static async _pSaveImageToServerAndGetUrl_pGetBlob (originalUrl) {
		const blobResp = await fetch(originalUrl);
		return blobResp.blob();
	}

	static async _pSaveImageToServerAndGetUrl_pCreateDirectories (cleanOutPath) {
		const dirParts = cleanOutPath.split("/").slice(0, -1);
		if (!dirParts.length) return;
		for (let i = 0; i < dirParts.length; ++i) {
			const dirPartSlice = dirParts.slice(0, i + 1);
			try {
				await FilePicker.createDirectory("data", dirPartSlice.join("/"));
			} catch (e) {
				if (`${e}`.startsWith(`EEXIST`)) continue;
				throw new Error(e);
			}
		}
	}

	static _canUploadFiles () {
		return game.isAdmin || (game.user && game.user.can("FILES_UPLOAD"));
	}

	static async pGetAllSpells ({isFilterNonStandard = false, additionalSourcesBrew = [], isIncludeLoadedBrew = false} = {}) {
		const index = await Vetools.pGetSpellIndex();
		const fileData = await Promise.all(
			Object.entries(index)
				.filter(([source]) => !isFilterNonStandard || !SourceUtil.isNonstandardSource(source))
				.map(([_, filename]) => Vetools.pGetWithCache(Vetools.getSpellUrl(filename))),
		);

		if (additionalSourcesBrew?.length) {
			for (const src of additionalSourcesBrew) {
				const brewJson = await DataUtil.pLoadBrewBySource(src);
				if (!brewJson) continue;
				fileData.push(brewJson);
			}
		}

		if (isIncludeLoadedBrew) fileData.push({spell: (BrewUtil.homebrew?.spell || [])});

		const spells = fileData.map(it => MiscUtil.copy(it.spell || [])).flat();
		spells.forEach(sp => {
			sp.__prop = "spell";
			Renderer.spell.initClasses(sp);
		});
		return {spell: spells};
	}

	static async pGetAllCreatures (isFilterNonStandard = false) {
		const index = await Vetools.pGetCreatureIndex();
		const fileData = await Promise.all(
			Object.entries(index)
				.filter(([source]) => !isFilterNonStandard || !SourceUtil.isNonstandardSource(source))
				.map(async ([source, filename]) => ({source: source, json: await Vetools.pGetWithCache(Vetools.getCreatureUrl(filename))})),
		);
		// Filter to prevent duplicates from "otherSources" copies
		return {
			monster: fileData.map(it => {
				const out = MiscUtil.copy(it.json.monster.filter(mon => mon.source === it.source));
				out.forEach(it => it.__prop = "monster");
				return out;
			}).flat(),
		};
	}

	static async _pGetHomebrewIndices () {
		const out = {source: {}, prop: {}, abbreviations: {}};

		try {
			const [sourceIndex, propIndex, abbreviationIndex] = await Promise.all([
				DataUtil.brew.pLoadSourceIndex(Config.get("import", "baseBrewUrl")),
				DataUtil.brew.pLoadPropIndex(Config.get("import", "baseBrewUrl")),
				DataUtil.brew.pLoadAbbreviationIndex(Config.get("import", "baseBrewUrl")),
			]);
			out.source = sourceIndex;
			out.prop = propIndex;
			out.abbreviation = abbreviationIndex;
		} catch (e) {
			ui.notifications.error(`Failed to load homebrew index! ${VeCt.STR_SEE_CONSOLE}`);
			setTimeout(() => { throw e; });
		}

		return out;
	}

	static async pGetHomebrewSources (...dirs) {
		const urlRoot = Config.get("import", "baseBrewUrl");
		const seenPaths = new Set();

		return dirs
			.map(dir => {
				return Object.keys(Vetools.HOMEBREW_INDEX__PROP[BrewUtil.dirToProp(dir)] || {})
					.map((path) => {
						if (seenPaths.has(path)) return null;
						seenPaths.add(path);
						return {
							url: DataUtil.brew.getFileUrl(path, urlRoot),
							name: this._getHomebrewName(path),
							abbreviations: Vetools.HOMEBREW_INDEX__ABBREVIATION[path] || [],
						};
					});
			})
			.flat()
			.filter(Boolean)
			.sort((a, b) => SortUtil.ascSortLower(a.name, b.name));
	}

	static _getHomebrewName (brewPath) { return brewPath.split("/").slice(-1).join("").replace(/\.json$/i, ""); }

	static async pGetLocalHomebrewSources (...dirs) {
		try {
			const listLocal = await Vetools._pGetLocalHomebrewList();

			const allFilenames = [
				...(listLocal || []),
				...Config.get("import", "localHomebrew"),
			];

			if (!allFilenames.length) return [];

			const brews = await allFilenames.pSerialAwaitMap(async name => ({
				url: name,
				data: await Vetools.pGetWithCache(name),
				name: this._getHomebrewName(name),
			}));

			const desiredProps = new Set(dirs.map(dir => BrewUtil.dirToProp(dir)));

			return brews
				.filter(({data}) => {
					const propsInBrew = new Set([
						// Index props
						...Object.keys(data || {})
							.filter(it => !it.startsWith("_")),
						// Index includes
						...Object.keys(data?._meta?.includes || {}),
					]);

					return [...desiredProps].some(it => propsInBrew.has(it));
				})
				.map(it => {
					it.abbreviations = (it.data?._meta?.sources || []).map(it => it.abbreviation).filter(Boolean);
					return it;
				})
				.map(({name, url, abbreviations}) => ({name, url, abbreviations}));
		} catch (e) {
			const msg = `Failed to load local homebrew index!`;
			console.error(...LGT, msg, e);
			ui.notifications.error(`${msg} ${VeCt.STR_SEE_CONSOLE}`);
		}
		return [];
	}

	static async _pGetLocalHomebrewList () {
		if (!Config.get("import", "isLoadLocalHomebrewIndex")) return null;

		const isUseIndexJson = Config.get("import", "isUseLocalHomebrewIndexJson");

		if (isUseIndexJson) {
			const indexUrl = `${Config.get("import", "localHomebrewDirectoryPath")}/index.json`.replace(/\/+/g, "/");
			const index = await Vetools.pGetWithCache(indexUrl);
			if (!index?.toImport) return [];
			return index.toImport.map(it => {
				// For remote files, return as-is
				if (Vetools._RE_HTTP_URL.test(it)) return it;

				// For filenames, construct a path
				return [...indexUrl.split("/").slice(0, -1), it].join("/");
			});
		}

		try {
			const existingFiles = await FilePicker.browse("data", Config.get("import", "localHomebrewDirectoryPath"));
			if (!existingFiles?.files?.length) return null;

			return existingFiles.files.map(it => decodeURIComponent(it));
		} catch (e) {
			const msg = `Failed to load local homebrew${isUseIndexJson ? " index" : ""}! Does the ${isUseIndexJson ? "file" : "directory"} "<data_dir>/${Config.get("import", "localHomebrewDirectoryPath")}${isUseIndexJson ? "/index.json" : ""}" exist?`;
			console.error(...LGT, msg, e);
			ui.notifications.error(`${msg} ${VeCt.STR_SEE_CONSOLE}`);
			return null;
		}
	}

	static getContent (data, props) {
		if (!props) return data;

		return props.map(prop => {
			data[prop] = data[prop] || [];
			data[prop].forEach(it => it.__prop = prop);
			return data[prop];
		}).flat();
	}
	// endregion

	// region Additional data
	static async pGetSpellSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/spells/foundry.json`); }
	static async pGetOptionalFeatureSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-optionalfeatures.json`); }
	static async pGetClassSubclassSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/class/foundry.json`); }
	static async pGetRaceSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-races.json`); }
	static async pGetItemSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-items.json`); }
	static async pGetFeatSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-feats.json`); }
	static async pGetRewardSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-rewards.json`); }
	static async pGetActionSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-actions.json`); }
	static async pGetVehicleUpgradeSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-vehicles.json`); }
	static async pGetCreatureSideData () { return Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/bestiary/foundry.json`); }

	// region TODO(Future) enable these when data is available
	static async pGeBackgroundSideData () { return {} || Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-backgrounds.json`); }
	static async pGetConditionDiseaseSideData () { return {} || Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-conditionsdiseases.json`); }
	static async pGetPsionicsSideData () { return {} || Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-psionics.json`); }
	static async pGetObjectSideData () { return {} || Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-objects.json`); }
	static async pGetVehicleSideData () { return {} || Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-vehicles.json`); }
	static async pGetCharCreationOptionSideData () { return {} || Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-charcreationoptions.json`); }
	static async pGetCultBoonSideData () { return {} || Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-cultsboons.json`); }
	static async pGetTrapHazardSideData () { return {} || Vetools.pGetWithCache(`${Vetools.BASE_SITE_URL}data/foundry-trapshazards.json`); }
	// endregion

	// endregion

	// region Icons
	static async pGetIconLookup (entityType) {
		const filename = `icon-${entityType}s.json`;
		const url = `modules/${SharedConsts.MODULE_NAME}/data/${filename}`;
		return Vetools.pGetWithCache(url);
	}
	// endregion

	static get BASE_SITE_URL () {
		let userOverride = Config.get("import", "baseSiteUrl");
		if (userOverride && userOverride.trim()) {
			// ensure trailing slash
			userOverride = userOverride.replace(/^(.*?)\/*$/, "$1/");
			return userOverride;
		}
		return Vetools._BASE_SITE_URL;
	}

	static get DATA_URL_FEATS () { return `${Vetools.BASE_SITE_URL}data/feats.json`; }
	static get DATA_URL_BACKGROUNDS () { return `${Vetools.BASE_SITE_URL}data/backgrounds.json`; }
	static get DATA_URL_VARIANTRULES () { return `${Vetools.BASE_SITE_URL}data/variantrules.json`; }
	static get DATA_URL_PSIONICS () { return `${Vetools.BASE_SITE_URL}data/psionics.json`; }
	static get DATA_URL_OPTIONALFEATURES () { return `${Vetools.BASE_SITE_URL}data/optionalfeatures.json`; }
	static get DATA_URL_CONDITIONSDISEASES () { return `${Vetools.BASE_SITE_URL}data/conditionsdiseases.json`; }
	static get DATA_URL_VEHICLES () { return `${Vetools.BASE_SITE_URL}data/vehicles.json`; }
	static get DATA_URL_REWARDS () { return `${Vetools.BASE_SITE_URL}data/rewards.json`; }
	static get DATA_URL_OBJECTS () { return `${Vetools.BASE_SITE_URL}data/objects.json`; }
	static get DATA_URL_DEITIES () { return `${Vetools.BASE_SITE_URL}data/deities.json`; }
	static get DATA_URL_RECIPES () { return `${Vetools.BASE_SITE_URL}data/recipes.json`; }
	static get DATA_URL_CHAR_CREATION_OPTIONS () { return `${Vetools.BASE_SITE_URL}data/charcreationoptions.json`; }
	static get DATA_URL_CULTSBOONS () { return `${Vetools.BASE_SITE_URL}data/cultsboons.json`; }
	static get DATA_URL_ACTIONS () { return `${Vetools.BASE_SITE_URL}data/actions.json`; }
	static get DATA_URL_LANGUAGES () { return `${Vetools.BASE_SITE_URL}data/languages.json`; }
	static get DATA_URL_TRAPS_HAZARDS () { return `${Vetools.BASE_SITE_URL}data/trapshazards.json`; }
}
// Global data cache
Vetools.CACHED_REQUESTS = {};
Vetools.CACHE_REQUESTS_IN_FLIGHT = {};
// URLs
Vetools._RE_HTTP_URL = /(^https?:\/\/)/;
// Vetools._BASE_SITE_URL = "https://5e.tools/"; // FIXME(Future) restore?
Vetools._BASE_SITE_URL = "https://5etools-mirror-1.github.io/";
// Preload content
Vetools.BESTIARY_FLUFF_INDEX = null;
Vetools.BESTIARY_TOKEN_LOOKUP = null;
Vetools.HOMEBREW_COLLECTION_INDEX = {};
// Homebrew meta caching
Vetools.HOMEBREW_META_SOURCES = {};
// Patches
Vetools._CACHED_GET_ROLLABLE_ENTRY_DICE = null;
Vetools._PATCHED_GET_ROLLABLE_ENTRY_DICE = null;
Vetools._CACHED_MONSTER_DO_BIND_COMPACT_CONTENT_HANDLERS = null;
Vetools._CACHED_RENDERER_HOVER_CACHE_AND_GET = null;
// Homebrew
Vetools.HOMEBREW_INDEX__SOURCE = {};
Vetools.HOMEBREW_INDEX__PROP = {};
Vetools.HOMEBREW_INDEX__ABBREVIATION = {};
// Other
Vetools._LOCK_DOWNLOAD_IMAGE = new VeLock();
Vetools._VET_SOURCE_LOOKUP = {};

export {Vetools};
