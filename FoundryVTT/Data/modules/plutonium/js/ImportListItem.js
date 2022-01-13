import {ImportCustomizer, ImportedDocument, ImportList, ImportSummary} from "./ImportList.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {DataConverterItem} from "./DataConverterItem.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {UtilActors} from "./UtilActors.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilDocuments} from "./UtilDocuments.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class ImportListItem extends ImportList {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "item",
			importerName: "Item",
		});

		this._initCreateSheetItemHook_currency();
	}
	// endregion

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Items"},
			externalData,
			{
				dirsHomebrew: ["item", "baseitem", "magicvariant"],
				namespace: "item",
				titleSearch: "items",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Items"],
				fnListSort: PageFilterItems.sortItems,
				pageFilter: new PageFilterItems(),
				page: UrlUtil.PG_ITEMS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importItem",
			},
		);

		this._fluffLookup = null;
	}

	async pGetSources () {
		const nonVetoolsOpts = {
			pPostLoad: async json => {
				return Renderer.item.pGetItemsFromHomebrew(json);
			},
		};

		return [
			new UtilDataSource.DataSourceSpecial(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				async () => (await Vetools.pGetItems()).item,
				{
					cacheKey: "5etools-items",
					filterTypes: [UtilDataSource.SOURCE_TYP_OFFICIAL_ALL],
					isDefault: true,
				},
			),
			new UtilDataSource.DataSourceUrl(
				"Custom URL",
				"",
				{
					...nonVetoolsOpts,
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			new UtilDataSource.DataSourceFile(
				"Upload File",
				{
					...nonVetoolsOpts,
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			...(await this._pGetSourcesHomebrew(nonVetoolsOpts)),
		];
	}

	getData () {
		return {
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			buttonsAdditional: [
				{
					name: "btn-run-mods",
					text: "Import with Custom Types",
				},
			],
			cols: [
				{
					name: "Name",
					width: 3,
					field: "name",
				},
				{
					name: "Type",
					width: "3-2",
					field: "type",
				},
				{
					name: "Cost",
					width: "1-4",
					field: "cost",
					rowClassName: "text-center",
				},
				{
					name: "Weight",
					width: "1-4",
					field: "weight",
					rowClassName: "text-center",
				},
				{
					name: "A.",
					width: "0-5",
					field: "attunement",
					rowClassName: "text-center",
				},
				{
					name: "Rarity",
					width: "1-5",
					field: "rarity",
					rowClassName: "text-center",
				},
				{
					name: "Source",
					width: 1,
					field: "source",
					titleProp: "sourceLong",
					displayProp: "sourceShort",
					classNameProp: "sourceClassName",
					styleProp: "sourceStyle",
					rowClassName: "text-center",
				},
			],
			rows: this._content.map((it, ix) => {
				this._pageFilter.constructor.mutateForFilters(it);

				// region Re-used in fnGetValues
				it._vType = it._typeListText.join(", ").uppercaseFirst();
				// endregion

				return {
					name: it.name,
					type: it._vType,
					cost: it.value || it.valueMult ? Parser.itemValueToFull(it, {isShortForm: true}).replace(/ +/g, "\u00A0") : "\u2014",
					weight: Parser.itemWeightToFull(it, true) || "\u2014",
					rarity: (it.rarity || "Unknown").toTitleCase(),
					attunement: it._attunementCategory === "No" ? "" : "×",
					source: it.source,
					sourceShort: Parser.sourceJsonToAbv(it.source),
					sourceLong: Parser.sourceJsonToFull(it.source),
					sourceClassName: Parser.sourceJsonToColor(it.source),
					sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),
					ix,
				};
			}),
		};
	}

	_activateListeners_absorbListItems () {
		this._list.doAbsorbItems(
			this._content,
			{
				fnGetName: it => it.name,
				// values used for sorting/search
				fnGetValues: it => ({
					source: it.source,
					type: it._vType,
					cost: it.value || 0,
					rarity: it.rarity,
					attunement: it._attunementCategory !== "No",
					weight: Parser.weightValueToNumber(it.weight),
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	_activateListeners_initRunButtonsAdditional () { this._activateListeners_initRunButtonsAdditional_genericMods(); }

	_pFnPostProcessEntries (entries, {isUseMods = false} = {}) {
		if (!isUseMods) return entries;

		return new Promise(resolve => {
			const detailer = new ImportListItem.ImportCustomizer(entries, resolve, {titleSearch: this._titleSearch, isActor: !!this._actor});
			detailer.render(true);
		});
	}

	async pInit () {
		await super.pInit();

		this._fluffLookup = {};

		const fluff = await Vetools.pGetItemFluff();
		fluff.itemFluff.forEach(it => (this._fluffLookup[it.source] = this._fluffLookup[it.source] || {})[it.name] = it);

		await Renderer.item.populatePropertyAndTypeReference();
	}

	getFolderPathMeta () {
		return {
			...super.getFolderPathMeta(),
			rarity: {
				label: "Rarity",
				getter: it => ((!it.rarity || it.rarity === "Unknown") ? "Unknown Rarity" : it.rarity).toTitleCase(),
			},
			type: {
				label: "Type",
				getter: it => {
					if (it.type) return Renderer.item.getItemTypeName(it.type).toTitleCase();
					else if (it.typeText) return it.typeText;
					else if (it.wondrous) return "Wondrous Item";
					else if (it.poison) return "Poison";
					else return "Unknown Type";
				},
			},
		};
	}

	/**
	 * @param item
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.quantity]
	 * @param [importOpts.filterValues] Saved filter values to be used instead of our own.
	 * @param [importOpts.isDataOnly] If this import should simply return the data, rather than import anything.
	 * @param [importOpts.folderId] The folder ID to import to.
	 * @return *
	 */
	async _pImportEntry (item, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing item "${item.name}" (from "${Parser.sourceJsonToAbv(item.source)}")`);

		const fluff = item.fluff || MiscUtil.get(this._fluffLookup, item.source, item.name);
		const opts = {fluff};
		if (importOpts.quantity != null) opts.quantity = importOpts.quantity;

		await this._pImportEntry_pDoLoadBrewMeta(item);

		if (importOpts.isDataOnly) {
			return new ImportSummary({
				status: UtilApplications.TASK_EXIT_COMPLETE_DATA_ONLY,
				imported: (await this._pImportEntry_pImportToDataOnly(item, importOpts, opts))
					.map(doc => new ImportedDocument({
						document: doc,
						actor: this._actor,
					})),
			});
		}

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(item, importOpts, opts);
		if (this._actor) return this._pImportEntry_pImportToActor(item, importOpts, opts);
		return this._pImportEntry_pImportToDirectoryGeneric(item, importOpts, opts);
	}

	/**
	 * When importing an item, if it is homebrew drag-dropped from the items directory, we may not have initialised
	 * metadata (item properties, etc.) for it. Ensure we do so before attempting to process it further.
	 */
	async _pImportEntry_pDoLoadBrewMeta (item) {
		if (BrewUtil.hasSourceJson(item.source)) return;
		if (SourceUtil.isSiteSource(item.source)) return;

		if (!Vetools.HOMEBREW_INDEX__SOURCE[item.source]) return;
		const brewUrl = DataUtil.brew.getFileUrl(Vetools.HOMEBREW_INDEX__SOURCE[item.source], Config.get("import", "baseBrewUrl"));
		await BrewUtil.pDoHandleBrewJson((await DataUtil.loadJSON(brewUrl)), UrlUtil.getCurrentPage());

		// This adds the properties/etc to the items cache
		await Renderer.item.pGetItemsFromHomebrew((await DataUtil.loadJSON(brewUrl)));
	}

	async _pImportEntry_pImportToDataOnly (item, importOpts, opts) {
		if (!this._actor || !this._isPackSplitImport(item)) return [await DataConverterItem.pGetItemItem(item)];
		const packItemsMetas = await this._pGetPackItemMetas(item, importOpts, opts);
		return packItemsMetas.map(({itemData}) => itemData);
	}

	_isPackSplitImport (item) {
		return item.packContents
			&& Config.get(this._configGroup, "isSplitPacksActor")
			&& (!item.atomicPackContents || Config.get(this._configGroup, "isSplitAtomicPacksActor"));
	}

	async _pImportEntry_pImportToActor (item, importOpts, opts) {
		opts = {...opts, isActorItem: true};

		opts.filterValues = importOpts.filterValues;

		// Pass actor ammo items in, so bows/etc. can link to ammo consumables
		opts.sheetItemsAmmo = this._pImportEntry_getSheetItemsAmmo(item);

		let embeddedDocuments;
		if (this._isPackSplitImport(item)) {
			embeddedDocuments = await this._pImportEntry_pImportToActor_pImportPackItem(item, importOpts, opts);
		} else {
			const itemData = await DataConverterItem.pGetItemItem(item, opts);
			const embeddedDocument = await this._pImportEntry_pImportToActor_pAddItem({item, itemData});
			embeddedDocuments = [embeddedDocument];
		}

		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: embeddedDocuments.map(it => new ImportedDocument({
				name: item.name,
				actor: this._actor,
				embeddedDocument: it,
			})),
		});
	}

	async _pGetPackItemMetas (item, importOpts, opts) {
		const packErrors = [];

		const packContentsItems = await Promise.all(item.packContents.map(async it => {
			const quantity = it.quantity || 1;
			if (it.item || typeof it === "string") {
				let [name, source] = (it.item || it).split("|");
				if (!source) source = SRC_DMG;
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source});

				const packItem = await Renderer.hover.pCacheAndGet(UrlUtil.PG_ITEMS, source, hash);

				return {
					item: packItem,
					itemData: await DataConverterItem.pGetItemItem(packItem, {filterValues: importOpts.filterValues, ...opts, quantity}),
				};
			} else if (it.special) {
				const fauxItem = {
					name: it.special.toTitleCase(),
					type: "G",
					source: item.source,
					page: item.page,
					srd: item.srd,
				};
				Renderer.item.enhanceItem(fauxItem);

				return {
					item: fauxItem,
					itemData: await DataConverterItem.pGetItemItem(fauxItem, {filterValues: importOpts.filterValues, ...opts, quantity}),
				};
			} else {
				packErrors.push(`Unhandled pack contents type "${JSON.stringify(it)}"`);
			}
		}));

		if (packErrors.length) {
			ui.notifications.error(`Item "${item.name}" (from "${Parser.sourceJsonToAbv(item.source)}") could not be broken down into constituent items! ${VeCt.STR_SEE_CONSOLE}`);
			console.error(...LGT, `Error(s) when breaking ${item.name} (${item.source}) into constituent items: ${packErrors.join("; ")}`);
		}

		return packContentsItems.filter(Boolean);
	}

	async _pImportEntry_pImportToActor_pImportPackItem (item, importOpts, opts) {
		const packItemMetas = await this._pGetPackItemMetas(item, importOpts, opts);

		// Do these sequentially, so we can set throwable usage if required
		return packItemMetas.pSerialAwaitMap(({item, itemData}) => this._pImportEntry_pImportToActor_pAddItem({item, itemData}));
	}

	async _pImportEntry_pImportToActor_pAddItem ({item, itemData}) {
		const embeddedDocument = await this._pImportEntry_pImportToActor_pAddOrUpdateItem({item, itemData});
		return this._pImportEntry_pImportToActor_pUpdateItemPostAdd({itemData, embeddedDocument});
	}

	async _pImportEntry_pImportToActor_pAddOrUpdateItem ({item, itemData}) {
		const existingItem = this._pImportEntry_pImportToActor_getExistingStackableItem({item, itemData});
		if (!existingItem) {
			return (await UtilActors.pAddActorItems(this._actor, [itemData]))[0].document;
		}

		const update = {
			_id: existingItem.id,
			data: {
				quantity: (existingItem.data.data.quantity || 0)
					+ (itemData.data.quantity || 0),
			},
		};

		await UtilDocuments.pUpdateEmbeddedDocuments(this._actor, [update], {ClsEmbed: Item});
	}

	_pImportEntry_pImportToActor_getExistingStackableItem ({item, itemData}) {
		if (Config.get("importItem", "inventoryStackingMode") === ConfigConsts.C_ITEM_ATTUNEMENT_NEVER) return null;

		// Use the first item found (i.e. `.find` rather than `.filter`)
		const matchingItem = this._actor.items.contents.find(sheetItem => {
			const isMatchingSource = !Config.get("import", "isStrictMatching")
				|| (UtilDataConverter.getItemSource(sheetItem) || "").toLowerCase() === (UtilDataConverter.getItemSource(itemData) || "").toLowerCase();
			if (!isMatchingSource) return false;

			if (sheetItem.name.toLowerCase().trim() === itemData.name.toLowerCase().trim()) return true;

			return DataConverterItem.getItemSrdAliases(item)
				.some(alias => alias.toLowerCase().trim() === sheetItem.name.toLowerCase().trim());
		});
		if (!matchingItem) return null;

		if (Config.get("importItem", "inventoryStackingMode") === ConfigConsts.C_ITEM_ATTUNEMENT_ALWAYS) return matchingItem;

		if (
			Config.get("importItem", "inventoryStackingMode") === ConfigConsts.C_ITEM_ATTUNEMENT_SMART
			&& (
				this._pImportEntry_pImportToActor_isThrowableItem({itemData})
				|| this._pImportEntry_pImportToActor_isSmartStackableItem({itemData})
			)
		) return matchingItem;

		return null;
	}

	_pImportEntry_pImportToActor_isThrowableItem ({itemData}) {
		const throwableSet = new Set((Config.get(this._configGroup, "throwables") || []).map(it => it.trim().toLowerCase()));
		return throwableSet.has((itemData.name || "").toLowerCase().trim());
	}

	_pImportEntry_pImportToActor_isSmartStackableItem ({itemData}) {
		return new Set(DataConverterItem.STACKABLE_FOUNDRY_ITEM_TYPES_IMPORT).has(itemData.type);
	}

	async _pImportEntry_pImportToActor_pUpdateItemPostAdd ({itemData, embeddedDocument}) {
		if (!embeddedDocument) return;

		// If the item is throwable, set it to use itself as ammo. This has to be done post-creation, as an update.
		if (this._pImportEntry_pImportToActor_isThrowableItem({itemData})) {
			await UtilDocuments.pUpdateEmbeddedDocuments(
				this._actor,
				[
					{
						_id: embeddedDocument.id,
						data: {
							consume: {
								type: "ammo",
								target: embeddedDocument.id,
								amount: 1,
							},
						},
					},
				],
				{
					propData: "items",
					ClsEmbed: Item,
				},
			);
		}

		return embeddedDocument;
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterItem.pGetItemItem(it, getItemOpts);
	}

	_pImportEntry_getSheetItemsAmmo (item) {
		if (!item.ammoType) return null;
		if (!this._actor) return null;
		return this._actor.items.filter(it => it.type === "consumable" && it.data.data.consumableType === "ammo");
	}

	static sortEntries (a, b) {
		// Ensure weapons with ammo types are always imported last.
		//   This allows us to attempt to link up weapons with an appropriate ammo type on an actor.
		if (a.ammoType && !b.ammoType) return 1;
		if (!a.ammoType && b.ammoType) return -1;
		return SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(Parser.sourceJsonToFull(a.source), Parser.sourceJsonToFull(b.source));
	}

	// region Currency import
	/**
	 * @param currency
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.folderId] The folder ID to import to.
	 * @return *
	 */
	async pImportCurrency (currency, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing currency "${Parser.getDisplayCurrency(currency)}"`);

		const itemData = await DataConverterItem.pGetCurrencyItem(currency, {isAddPermission: !this._actor});

		const fauxItem = {name: "Currency", source: VeCt.STR_GENERIC};

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(fauxItem, importOpts, null, {docData: itemData, isSkipDuplicateHandling: true});
		if (this._actor) return this._pImportEntry_pImportToActor(fauxItem, importOpts, null, {docData: itemData});
		return this._pImportEntry_pImportToDirectoryGeneric(fauxItem, importOpts, null, {docData: itemData, isSkipDuplicateHandling: true});
	}

	static _initCreateSheetItemHook_currency () {
		Hooks.on("preCreateItem", (item, itemData, options, itemId) => {
			if (item.parent?.documentName !== "Actor") return;

			const flags = itemData.flags?.[SharedConsts.MODULE_NAME_FAKE] || itemData.flags?.[SharedConsts.MODULE_NAME];
			if (flags?.type !== DataConverterItem.FLAG_TYPE_CURRENCY || !flags?.currency) return;

			const actor = item.parent;

			UtilActors.pAddCurrencyToActor({currency: flags.currency, actor})
				.then(null)
				.catch(e => {
					ui.notifications.error(`Failed to apply currency to actor! ${VeCt.STORAGE_DMSCREEN_TEMP_SUBLIST}`);
					throw e;
				});

			return false;
		});
	}
	// endregion
}

ImportListItem.ImportCustomizer = class extends ImportCustomizer {
	/**
	 * @param dataList
	 * @param resolve
	 * @param opts Options object.
	 * @param opts.titleSearch Used in prompt text in the search bar.
	 * @param opts.isActor
	 */
	constructor (dataList, resolve, opts) {
		super(
			dataList,
			resolve,
			{
				...opts,
				title: "Customize Import",
				template: `${SharedConsts.MODULE_LOCATION}/template/ImportListItemCustomizer.hbs`,
			},
		);
	}

	getData () {
		return {
			...super.getData(),
			rows: this._dataList.map((it, ix) => ({
				name: it.name,
				source: it.source,
				sourceShort: Parser.sourceJsonToAbv(it.source),
				sourceLong: Parser.sourceJsonToFull(it.source),
				sourceClassName: Parser.sourceJsonToColor(it.source),
				sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),

				// Based on `Localization.initialize`
				foundryTypes: DataConverterItem.VALID_FOUNDRY_ITEM_TYPES_IMPORT.map((it, ix) => ({
					ix,
					type: it,
					displayName: game.i18n.localize(`ITEM.Type${it.titleCase()}`),
				})),

				ix,
			})),
		};
	}

	_activateListeners_initList ({$html}) {
		// Init list library
		this._list = new List({
			$iptSearch: $html.find(`.search`),
			$wrpList: $html.find(`.veapp__list`),
			valueNames: ["name", "source", "ix"],
		});
		this._list.doAbsorbItems(
			this._dataList,
			{
				fnGetName: it => it.name,
				fnGetValues: it => ({source: it.source}),
				fnGetData: it => {
					const $e = $(it.ele);
					return {
						$selFoundryType: $e.find(`[name="sel-foundry-type"]`),
					};
				},
			},
		);
		this._list.init();
	}

	_activateListeners_bindControls ({$html, $wrpBtnsSort}) {
		this._$btnReset = $html.find(`[name="btn-reset"]`).click(() => {
			$html.find(`.search`).val("");
			if (this._list) this._list.reset();
		});

		$html.find(`[name="btn-run"]`).click(async () => {
			const toImport = this._list.items.map(it => {
				const ixType = Number(it.data.$selFoundryType.val());
				if (!~ixType) return this._dataList[it.ix];

				const out = MiscUtil.copy(this._dataList[it.ix]);
				out.foundryType = DataConverterItem.VALID_FOUNDRY_ITEM_TYPES_IMPORT[ixType];
				return out;
			});

			this._resolve(toImport);
			this.close();
		});
	}
};

export {ImportListItem};
