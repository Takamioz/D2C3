import {Vetools} from "./Vetools.js";

class UtilAdventureBook {
	static doProcessNode_mutAddMaps (
		{
			availableMaps,
			entryIdToMap,
			entryIdToName,
			entry,
			entryStack,
			source,
			chapterInfo,
		},
	) {
		if (entry.id && entry.name) entryIdToName[entry.id] = entry.name;

		if (entry.type !== "image" || !UtilAdventureBook._IMPORTABLE_IMAGE_TYPES__MAP.has(entry.imageType)) return;

		const url = Vetools.getImageUrl(entry);
		if (!url) return; // Should never occur

		const mapEntry = MiscUtil.getOrSet(availableMaps, entry.imageType, url, MiscUtil.copy(entry));
		mapEntry.title = mapEntry.title || entry.title;

		mapEntry._url = url;

		// Add source for importers, etc. Note that we do not add a name here, as we will add it in `mutMapNames`.
		mapEntry.source = mapEntry.source || source;

		// Add chapter name for importers, etc. (particularly, folder naming)
		if (chapterInfo) {
			mapEntry._chapterName = `${Parser.bookOrdinalToAbv(chapterInfo.ordinal)}${chapterInfo.name || "(Unnamed Chapter)"}`;
		}

		// Add the last entry name, to be used later
		if (entryStack?.length) {
			mapEntry._tmp_parentEntryName = [...entryStack].reverse().find(it => it.name)?.name;
		}

		if (entry.id) entryIdToMap[entry.id] = MiscUtil.copy(entry);
	}

	/**
	 * A post-processing step once all entries have been indexed in the `entryToIdMap`.
	 */
	static mutMapNames ({availableMaps, entryIdToMap, entryIdToName}) {
		Object.values(availableMaps)
			.forEach(urlToEntry => {
				Object.values(urlToEntry)
					.forEach(entry => {
						this._mutMapNames_entry({entryIdToMap, entryIdToName, entry});
					});
			});
	}

	static _mutMapNames_entry ({entryIdToMap, entryIdToName, entry}) {
		// region Add names to map regions
		if (entry.mapRegions) {
			entry.mapRegions.forEach(it => {
				it.name = it.name || entryIdToName[it.area];
			});
		}
		// endregion

		const parentEntry = entry.mapParent?.id ? entryIdToMap[entry.mapParent.id] : null;
		if (parentEntry) this._mutMapNames_entry({entryIdToMap, entryIdToName, entry: parentEntry});

		// Add name for importers, etc.
		entry.name = this._getMapName({entry, parentEntry});

		// Add parent entry, if it exists, for map region import
		entry._parentEntry = parentEntry;
	}

	static _getMapName ({entry, parentEntry}) {
		if (entry.mapName) return entry.mapName;

		const cleanTitle = Renderer.stripTags(entry.title);

		const name = cleanTitle
			// If there's no name, try to use the name of the nearest named parent entry
			|| (entry._tmp_parentEntryName ? `${entry._tmp_parentEntryName}\u2013Map` : UtilAdventureBook._DEFAULT_MAP_NAME);

		if (!parentEntry || !parentEntry.title) return name;

		const cleanParentTitle = Renderer.stripTags(parentEntry.title);

		// If the map's just called "Player Version" (or some similar variant), use the parent name
		const entryTitleClean = (cleanTitle || "").replace(/[^a-zA-Z]+/g, "");
		if (!/^player(?:version)?$/i.test(entryTitleClean)) return name;

		return `${cleanParentTitle} (Player Version)`;
	}
}
UtilAdventureBook._IMPORTABLE_IMAGE_TYPES__MAP = new Set(["map", "mapPlayer"]);
UtilAdventureBook._DEFAULT_MAP_NAME = "(Unnamed Map)";

export {UtilAdventureBook};
