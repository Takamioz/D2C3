import {Vetools} from "./Vetools.js";
import {UtilList2} from "./UtilList2.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportList} from "./ImportList.js";
import {LGT} from "./Util.js";
import {UtilAdventureBook} from "./UtilAdventureBook.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilImage} from "./UtilImage.js";
import {NoteImageCreator} from "./NoteImageCreator.js";
import {UtilCanvas} from "./UtilCanvas.js";
import {Config} from "./Config.js";

class PageFilterMaps extends PageFilter {
	constructor () {
		super();
		this._sourceFilter = new SourceFilter();
		this._typeFilter = new Filter({
			header: "Type",
			items: ["map", "mapPlayer"],
			displayFn: Parser.imageTypeToFull,
		});
	}

	static mutateForFilters (g) {
		// No-op
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
		this._typeFilter.addItem(it.imageType);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it.imageType,
		);
	}
}

class ImportListMap extends ImportList {
	static get FOLDER_TYPE () { return "Scene"; }

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Maps"},
			externalData,
			{
				titleSearch: "maps",
				defaultFolderPath: [],
				dirsHomebrew: ["adventure", "book"],
				namespace: "map",
				configGroup: "importMap",
				sidebarTab: "scenes",
				gameProp: "scenes",
				pageFilter: new PageFilterMaps(),
			},
		);
	}

	async pGetSources () {
		const adventureIndex = await Vetools.pGetAdventureIndex();
		const bookIndex = await Vetools.pGetBookIndex();

		const vetIndex = [
			...adventureIndex.adventure,
			...bookIndex.book,
		]
			.sort((a, b) => SortUtil.ascSortDate(b._pubDate, a._pubDate) || SortUtil.ascSortLower(a.name, b.name));

		return [
			...vetIndex.map(it => new UtilDataSource.DataSourceUrl(
				it.name,
				it._url,
				{
					pPostLoad: this._pPostLoadVetools.bind(this),
					userData: it,
					filterTypes: [UtilDataSource.SOURCE_TYP_OFFICIAL_SINGLE],
				}),
			),
			new UtilDataSource.DataSourceUrl(
				"Custom URL",
				"",
				{
					pPostLoad: this._pPostLoadOther.bind(this),
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			new UtilDataSource.DataSourceFile(
				"Upload File",
				{
					pPostLoad: this._pPostLoadOther.bind(this),
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			...(await this._pGetSourcesHomebrew({pPostLoad: this._pPostLoadOther.bind(this)})),
		];
	}

	_pPostLoadVetools (data, file, userData) {
		return this._pPostLoadShared({head: userData, body: data});
	}

	_pPostLoadOther (data) {
		return [
			{propData: "adventureData", prop: "adventure"},
			{propData: "bookData", prop: "book"},
		]
			.map(({prop, propData}) => {
				if (!data[prop] || !data[propData]) return null;

				const tuples = data[prop]
					.map(head => {
						const body = data[propData].find(it => it.id === head.id);
						if (!body) return null;
						return {
							head,
							body,
						};
					})
					.filter(Boolean);

				return tuples
					.map(it => this._pPostLoadShared({head: it.head, body: it.body}));
			})
			.filter(Boolean)
			.flat(2);
	}

	_pPostLoadShared ({body, head}) {
		const mapEntries = [];

		const availableMaps = {}; // Map of `imageType` -> `url` -> `entry`
		const entryIdToMap = {};
		const entryIdToName = {};

		const walker = MiscUtil.getWalker({isNoModification: true});

		body.data.forEach((ch, ixCh) => {
			walker.walk(
				ch,
				{
					object: (obj, lastKey, stack) => {
						UtilAdventureBook.doProcessNode_mutAddMaps({
							availableMaps,
							entryIdToMap,
							entryIdToName,
							entry: obj,
							entryStack: stack,
							source: head.source,
							chapterInfo: head.contents?.[ixCh],
						});
						return obj;
					},
				},
			);
		});

		// Post-processing step to add names to maps
		UtilAdventureBook.mutMapNames({availableMaps, entryIdToMap, entryIdToName});

		// Flatten the found maps into an importable list
		Object.values(availableMaps)
			.forEach(urlToEntry => {
				Object.values(urlToEntry)
					.forEach(entry => {
						mapEntries.push(entry);
					});
			});

		return mapEntries;
	}

	_activateListeners_absorbListItems () {
		this._list.doAbsorbItems(
			this._content,
			{
				fnGetName: it => it.name,
				// values used for sorting/search
				fnGetValues: it => ({
					type: it.imageType,
					source: it.source,
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	getFolderPathMeta () {
		return {
			...super.getFolderPathMeta(),
			chapterName: {
				label: "Chapter Name",
				getter: it => it._chapterName || "(Unnamed Chapter)",
			},
			type: {
				label: "Type",
				getter: it => Parser.imageTypeToFull(it.imageType),
			},
		};
	}

	/**
	 * @param ent
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.entryIdToJournalId] A map of 5etools entryId -> Foundry journal ID.
	 */
	async _pImportEntry (ent, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing map "${ent.name}" (from "${Parser.sourceJsonToAbv(ent.source)}")`);

		if (this._actor) throw new Error(`Cannot import map content to actor!`);

		const importMeta = await this._pImportEntry_pImportToDirectoryGeneric(ent, importOpts);

		if (importMeta.status === UtilApplications.TASK_EXIT_SKIPPED_DUPLICATE) return importMeta;

		// const scene = await Scene.create(createData, {renderSheet: false});

		const scene = importMeta.imported?.[0]?.document;
		if (!scene) return importMeta;

		// region Based on `SCENES.GenerateThumb`
		const dataThumbnail = await scene.createThumbnail();
		await scene.update({thumb: dataThumbnail.thumb}, {diff: false});
		// endregion

		await this._pImportScene_pFillScene({entry: ent, entryIdToJournalId: importOpts.entryIdToJournalId, scene});

		return importMeta;
	}

	async _pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return this._pGetMapScene({entry: it});
	}

	async _pGetMapScene ({entry}) {
		let url = Vetools.getImageUrl(entry);
		url = await Vetools.pOptionallySaveImageToServerAndGetUrl(url);

		const {width, height} = await this.constructor._pGetImageDimensions({entry, url});

		return {
			name: entry.name,
			active: false,
			navigation: Config.get("importMap", "isSceneAddToNavigation"),
			img: encodeURL(url),
			width: Math.round(width),
			height: Math.round(height),

			padding: Config.get("importMap", "scenePadding"),
			backgroundColor: Config.get("importMap", "sceneBackgroundColor"),
			tokenVision: Config.get("importMap", "isSceneTokenVision"),
			fogExploration: Config.get("importMap", "isSceneFogExploration"),

			gridDistance: this._getGridDistance({entry}),
			gridUnits: this._getGridUnits({entry}),
			grid: this._getGridSize({entry}),
			shiftX: this._getGridOffsetX({entry}),
			shiftY: this._getGridOffsetY({entry}),
			gridType: this._getGridType({entry}),
		};
	}

	_getGridDistance ({entry}) {
		const distance = entry.grid?.distance ?? 5;
		const unit = entry.grid?.units ?? "ft";
		return Config.getMetricNumber({configGroup: "importMap", originalValue: distance, originalUnit: unit, configKey: "isSceneGridMetric"});
	}

	_getGridUnits ({entry}) {
		const unit = entry.grid?.units ?? "ft";
		return Config.getMetricUnit({configGroup: "importMap", originalUnit: unit, configKey: "isSceneGridMetric"});
	}

	_getGridSize ({entry}) { return entry.grid?.size ?? 100; }
	_getGridOffsetX ({entry}) { return entry.grid?.offsetX ?? 0; }
	_getGridOffsetY ({entry}) { return entry.grid?.offsetY ?? 0; }

	_getGridType ({entry}) {
		if (!entry.grid?.type) return 1;
		switch (entry.grid.type) {
			case "none": return 0;
			case "square": return 1;
			case "hexRowsOdd": return 2;
			case "hexRowsEven": return 3;
			case "hexColsOdd": return 4;
			case "hexColsEven": return 5;
			default: throw new Error(`Unknown image grid type: "${entry.grid.type}"`);
		}
	}

	static async _pGetImageDimensions ({entry, url}) {
		// If the entry specifies dimensions, trust them
		if (entry.width && entry.height) return {width: entry.width, height: entry.height};

		// Otherwise, load the image, and read its size
		const image = await UtilImage.pLoadImage(url);
		return {width: image.naturalWidth, height: image.naturalHeight};
	}

	async _pImportScene_pFillScene ({entry, entryIdToJournalId, scene}) {
		const parentEntry = entry._parentEntry;
		const mapRegions = entry.mapRegions || parentEntry?.mapRegions;

		if (!mapRegions?.length) return;

		const imageWidth = scene.data.width;
		const imageHeight = scene.data.height;

		const noteDatas = [];
		for (const mapRegion of mapRegions) {
			if (!mapRegion.area || !mapRegion.points?.length) continue;

			const areaJournalId = entryIdToJournalId?.[mapRegion.area];
			if (!areaJournalId) continue;

			const name = mapRegion.name || "-";
			const puckName = this.constructor._getPuckName({name});

			const puckUrl = await NoteImageCreator.pCreateImageGetUrl({name: puckName});

			const mapRegionPoints = await this.constructor._pGetMapRegionPoints({mapRegion, entry, imageWidth, imageHeight, parentEntry});
			const position = UtilCanvas.getCentroid(mapRegionPoints);

			noteDatas.push(
				{
					entryId: areaJournalId,
					icon: puckUrl,
					iconSize: Math.ceil((scene.data?.grid ?? 100) / 2),
					text: name,
					// Even if we're using a parent map's regions, we have scaled the positions to _our_ map's coordinate
					//   system, so we use _our_ grid offset.
					x: position[0] + (entry.grid?.offsetX || 0),
					y: position[1] + (entry.grid?.offsetY || 0),
				},
			);
		}

		await scene.createEmbeddedDocuments("Note", noteDatas);
	}

	static _getPuckName ({name}) {
		// Try to capture e.g. "5A" from "5a. Halaster's Coin"
		const nameSplit = name.split(/[.;:!]/g);
		return nameSplit.length === 1
			// For anything which doesn't have an obvious ID, turn it into an abbreviation
			? nameSplit[0].replace(/[()"']/g, "").split(/ /g).map(it => it[0]).join(".")
			: nameSplit[0];
	}

	static async _pGetMapRegionPoints ({mapRegion, entry, imageWidth, imageHeight, parentEntry}) {
		if (!parentEntry) return mapRegion.points;

		const parentUrl = Vetools.getImageUrl(parentEntry);
		const {width: imageWidthParent, height: imageHeightParent} = await this._pGetImageDimensions({entry: parentEntry, url: parentUrl});

		const offsetX = entry.mapParent.offsetX || 0;
		const offsetY = entry.mapParent.offsetY || 0;
		const scaleX = entry.mapParent.scaleX ?? (entry.mapParent.scaleAuto ? (imageWidthParent / imageWidth) : 1);
		const scaleY = entry.mapParent.scaleY ?? (entry.mapParent.scaleAuto ? (imageHeightParent / imageHeight) : 1);

		return mapRegion.points.map(([x, y]) => {
			return [
				Math.round((x * (1 / scaleX)) + offsetX),
				Math.round((y * (1 / scaleY)) + offsetY),
			];
		});
	}
}

export {ImportListMap};
