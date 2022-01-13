import {ImportListActor} from "./ImportListActor.js";
import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {UtilActors} from "./UtilActors.js";
import {DataConverter} from "./DataConverter.js";
import {DataConverterItem} from "./DataConverterItem.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterCreature} from "./DataConverterCreature.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {DataConverterActor} from "./DataConverterActor.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {ImportListSpell} from "./ImportListSpell.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {ImportCustomizer} from "./ImportList.js";
import {UtilDocuments} from "./UtilDocuments.js";
import {UtilCompat} from "./UtilCompat.js";

class ImportListCreature extends ImportListActor {
	constructor (externalData, applicationOptsOverride, subclassOptsOverride, actorImporterOptsOverride) {
		externalData = externalData || {};
		applicationOptsOverride = applicationOptsOverride || {};
		subclassOptsOverride = subclassOptsOverride || {};
		actorImporterOptsOverride = actorImporterOptsOverride || {};
		super(
			{
				title: "Import Creatures",
				...applicationOptsOverride,
			},
			externalData,
			{
				props: ["monster"],
				dirsHomebrew: ["creature"],
				propsBrewAdditionalData: ["foundryMonster"],
				fnLoadSideData: Vetools.pGetCreatureSideData,
				titleSearch: "creatures",
				sidebarTab: "actors",
				gameProp: "actors",
				defaultFolderPath: ["Creatures"],
				fnListSort: PageFilterBestiary.sortMonsters,
				pageFilter: new PageFilterBestiary(),
				isActorRadio: true,
				page: UrlUtil.PG_BESTIARY,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importCreature",
				...subclassOptsOverride,
			},
			{
				actorType: "npc",
				...actorImporterOptsOverride,
			},
		);
	}

	async pInit () {
		await super.pInit();
		await DataUtil.monster.pPreloadMeta();
	}

	async pGetSources () {
		const creatureIndex = await Vetools.pGetCreatureIndex();

		return [
			new UtilDataSource.DataSourceSpecial(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				async () => (await Vetools.pGetAllCreatures()).monster,
				{
					cacheKey: `5etools-creatures`,
					filterTypes: [UtilDataSource.SOURCE_TYP_OFFICIAL_ALL],
					isDefault: true,
				},
			),
			new UtilDataSource.DataSourceUrl(
				"Custom URL",
				"",
				{
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			new UtilDataSource.DataSourceFile(
				"Upload File",
				{
					filterTypes: [UtilDataSource.SOURCE_TYP_CUSTOM],
				},
			),
			...Object.entries(creatureIndex).map(([src, filename]) => new UtilDataSource.DataSourceUrl(
				Parser.sourceJsonToFull(src),
				Vetools.getCreatureUrl(filename),
				{
					source: src,
					pPostLoad: ImportListCreature._postLoadVetools.bind(ImportListCreature, src),
					filterTypes: SourceUtil.isNonstandardSource(src) ? [UtilDataSource.SOURCE_TYP_ARCANA] : [UtilDataSource.SOURCE_TYP_OFFICIAL_SINGLE],
				},
			)),
			...(await this._pGetSourcesHomebrew()),
		];
	}

	static _postLoadVetools (src, monList) {
		return monList.filter(it => it.source === src);
	}

	async pGetChooseImporterUserDataForSources (sources) {
		return {
			isSingletonSource_officialAdventure: sources.length === 1 && sources[0].source && Parser.SOURCES_ADVENTURES.has(sources[0].source),
		};
	}

	async _pPostFilterRender () {
		if (!this._userData) return;

		// If we're loading an official adventure, and this is the only source, wipe the "Adventure NPC" denial filter
		const isSingletonSourceOfficialAdventure = this._userData.isSingletonSource_officialAdventure;
		this._userData = null;
		if (!isSingletonSourceOfficialAdventure) return;

		const KEY_MISC = "Miscellaneous";
		const miscValues = this._pageFilter.filterBox.getValues()[KEY_MISC];
		this._pageFilter.filterBox.setFromValues({
			[KEY_MISC]: {
				...Object.entries(miscValues)
					.filter(([k]) => !k.startsWith("_"))
					.mergeMap(([k, v]) => ({[k]: v})),
				"Adventure NPC": 0,
			},
		});
	}

	getData () {
		return {
			isRadio: this._isRadio,
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			buttonsAdditional: [
				{
					name: "btn-run-mods",
					text: "Import with Scaling/Renames/Variants",
				},
			],
			cols: [
				{
					name: "Name",
					width: 4,
					field: "name",
				},
				{
					name: "Type",
					width: 5,
					field: "type",
				},
				{
					name: "CR",
					width: 1,
					field: "cr",
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
				it._vCr = it._pCr || "\u2014";
				// endregion

				return {
					name: it.name,
					type: it._pTypes.asText.uppercaseFirst(),
					cr: it._vCr,
					source: it.source,
					sourceShort: Parser.sourceJsonToAbv(it.source),
					sourceLong: Parser.sourceJsonToFull(it.source),
					sourceClassName: Parser.sourceJsonToColor(it.source),
					sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),
					isVersion: !!it._versionBase_isVersion,
					ix,
				};
			}),
		};
	}

	_getAbsorbListItemOpts () {
		return {
			fnGetName: it => it.name,
			// values used for sorting/search
			fnGetValues: it => ({
				source: it.source,
				type: it._pTypes.asText,
				cr: it._vCr,
				group: it.group || "",
				alias: (it.alias || []).map(it => `"${it}"`).join(","),
				hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
			}),
			fnGetData: UtilList2.absorbFnGetData,
			fnBindListeners: it => this._isRadio
				? UtilList2.absorbFnBindListenersRadio(this._list, it)
				: UtilList2.absorbFnBindListeners(this._list, it),
		};
	}

	_activateListeners_absorbListItems () { this._list.doAbsorbItems(this._content, this._getAbsorbListItemOpts()); }

	getFolderPathMeta () {
		return {
			...super.getFolderPathMeta(),
			cr: {
				label: "Challenge Rating",
				getter: it => this.constructor._getFolderCr(it),
			},
			type: {
				label: "Type",
				getter: it => this.constructor._getFolderType(it),
			},
			typeTags: {
				label: "Type (With Tags)",
				getter: it => this.constructor._getFolderTypeWithTags(it),
			},
		};
	}

	static _getFolderCr (it) { return it.cr ? (it.cr.cr || it.cr) : "Unknown CR"; }
	static _getFolderType (it) { return Parser.monTypeToFullObj(it.type).type.toTitleCase(); }
	static _getFolderTypeWithTags (it) { return Parser.monTypeToFullObj(it.type).asText.uppercaseFirst(); }

	_activateListeners_initRunButtonsAdditional () { this._activateListeners_initRunButtonsAdditional_genericMods(); }

	_pFnPostProcessEntries (entries, {isUseMods = false} = {}) {
		if (!isUseMods) return entries;

		return new Promise(resolve => {
			const scaler = new ImportListCreature.ScaleRename(entries, resolve, {titleSearch: this._titleSearch});
			scaler.render(true);
		});
	}

	async _pImportEntry_pGetImportMetadata (actor, mon, importOpts) {
		const act = {};

		const fluff = await Renderer.utils.pGetFluff({
			entity: mon,
			pFnPostProcess: Renderer.monster.postProcessFluff.bind(null, mon),
			fluffBaseUrl: `data/bestiary/`,
			fluffProp: "monsterFluff",
		});

		const dataBuilderOpts = new ImportListCreature.ImportEntryOpts({actor, mon, fluff});

		await this._pImportEntry_pFillBase(mon, act, dataBuilderOpts.fluff, {isUseTokenImageAsPortrait: Config.get(this._configGroup, "isUseTokenImageAsPortrait")});

		act.data = {};

		await this._pImportEntry_pFillFolder(mon, act, importOpts);

		if (importOpts.defaultPermission != null) act.permission = {default: importOpts.defaultPermission};
		else act.permission = {default: Config.get(this._configGroup, "permissions")};

		this._pImportEntry_fillData_Abilities(mon, act.data, dataBuilderOpts);
		await this._pImportEntry_pFillData_Attributes(mon, act, dataBuilderOpts);
		await this._pImportEntry_pFillData_Details(mon, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Skills(mon, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Traits(mon, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Currency(mon, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Spells(mon, act.data, dataBuilderOpts);
		this._pImportEntry_fillData_Resources(mon, act.data, dataBuilderOpts);

		await this._pImportEntry_pFillToken({importable: mon, actor: act});

		return {dataBuilderOpts: dataBuilderOpts, actorData: act};
	}

	_getActorSheetName (it) {
		const out = [UtilDataConverter.getNameWithSourcePart(it)];

		const tagsToAdd = Config.get(this._configGroup, "nameTags");

		Object.entries(tagsToAdd)
			.filter(([, v]) => v)
			.forEach(([k]) => {
				switch (Number(k)) {
					case ConfigConsts.C_CREATURE_NAMETAGS_CR: out.push(`[${this.constructor._getFolderCr(it)}]`); break;
					case ConfigConsts.C_CREATURE_NAMETAGS_TYPE: out.push(`[${this.constructor._getFolderType(it)}]`); break;
					case ConfigConsts.C_CREATURE_NAMETAGS_TYPE_WITH_TAGS: out.push(`[${this.constructor._getFolderTypeWithTags(it)}]`); break;
				}
			});

		return out.join(" ");
	}

	_getActorFlags (mon) {
		const out = super._getActorFlags(mon);

		if (UtilCompat.isMonksLittleDetailsActive() && mon.soundClip) {
			out["monks-little-details"] = {"sound-effect": Renderer.utils.getMediaUrl(mon, "soundClip", "audio")};
		}

		return out;
	}

	async _pImportEntry_pFillData_Attributes (mon, act, monOpts) {
		const data = act.data;

		const out = {};

		const acMeta = mon.ac && mon.ac.length ? (await this._pImportEntry_getAcMeta(mon, monOpts)) : null;

		out.ac = {
			flat: acMeta?.flat,
			min: 0,
			calc: acMeta?.calc || "default",
			formula: acMeta?.formula,
			value: acMeta?.value,
		};

		let hpMax = 0;
		let hpFormula = "";
		if (mon.hp) {
			// Try to parse the "special" value, in case it is either a number, or starts with "<number> + ..."
			if (mon.hp.special) {
				mon.hp.special.replace(/^(?<hp>\d+)\s*(?:[-+]|$)/, (...m) => {
					hpMax = Number(m.last().hp);
				});
			}

			if (mon.hp.average) hpMax = mon.hp.average;
			if (mon.hp.formula) hpFormula = mon.hp.formula;
		}

		out.hp = {
			value: hpMax,
			min: 0,
			max: hpMax,
			temp: 0,
			tempmax: 0,
			formula: hpFormula,
		};

		out.init = {
			value: 0,
			mod: 0,
			bonus: 0,
			total: Parser.getAbilityModNumber(mon.dex),
			prof: 0,
		};

		out.prof = monOpts.pb;

		out.movement = DataConverter.getMovement(mon.speed, {configGroup: "importCreature"});

		out.spellcasting = monOpts.spellAbility;

		out.spelldc = monOpts.spellDc;

		out.senses = {
			darkvision: 0,
			blindsight: 0,
			tremorsense: 0,
			truesight: 0,
			units: "ft",
			special: "",
		};

		out.senses.special = (mon.senses || []).filter(sens => {
			sens = sens.replace(Parser._numberCleanRegexp, "");

			const mSense = /(blindsight|darkvision|tremorsense|truesight)\s*(\d+)/i.exec(sens);
			if (!mSense) return true;

			const num = Number(mSense[2]);
			switch (mSense[1]) {
				case "darkvision": out.senses.darkvision = num; break;
				case "blindsight": out.senses.blindsight = num; break;
				case "tremorsense": out.senses.tremorsense = num; break;
				case "truesight": out.senses.truesight = num; break;
			}
			return false;
		}).join(", ");

		data.attributes = out;
	}

	/**
	 * Convert excess AC (beyond that which is provided by equipped items) into an active effect.
	 *   This allows compatibility with e.g. the Dynamic Active Effects module.
	 */
	async _pImportEntry_getAcMeta (mon, monOpts) {
		const ac0 = mon.ac[0];
		const acVal = this.constructor._pImportEntry_getAcMeta_getAcVal({ac0});

		if (Config.get("importCreature", "isUseStaticAc")) {
			const acValStatic = acVal == null ? 10 : acVal;
			return {calc: "custom", formula: `${acValStatic}`, value: acValStatic};
		}

		const acHashes = this.constructor._getItemHashesFromAcItem(ac0);

		if (!acHashes.length) {
			if (acVal == null || (10 + Parser.getAbilityModNumber(mon.dex)) === acVal) return {calc: "default", formula: null, value: null};
		}

		const {ac: acFromItemEffects, isDexIncluded: isDexAlreadyIncluded, isAnyItemIncluded} = await this._pImportEntry_pFillData_Attributes_Ac_getAcFromItems(mon, acHashes);

		// If we, for whatever reason, have AC items but no defined AC score, use the default and assume it will turn out correct
		if (acVal == null) return {calc: "default", formula: null, value: null};

		const delta = acVal - (acFromItemEffects + (isDexAlreadyIncluded ? 0 : Parser.getAbilityModNumber(mon.dex)));
		// If the final AC is exactly equal to our expected value, allow the auto-calculation to do its job.
		if (!delta) return {calc: "default", formula: null, value: null};

		if (!isAnyItemIncluded) {
			// If we have a natural armor item, use it
			if (!Config.get("importCreature", "isUseCustomNaturalAc") && (ac0.from || []).some(it => /^natural armor$/i.test(`${it}`.trim()))) {
				return {calc: "natural", formula: null, value: null, flat: acVal};
			}

			// Otherwise, if we have no item AC, create a custom formula
			return {calc: "custom", formula: `10 + @abilities.dex.mod ${UiUtil.intToBonus(delta)}`, value: null};
		}

		// If we can't use active effects (i.e. DAE compatibility), set a static value
		if (!Config.get("importItem", "isAddActiveEffects")) return {calc: "custom", formula: null, value: acVal};

		// If we *do* have AC from items, and the total doesn't line up with our expected AC (for e.g. Cambion), then,
		//   create an active effect to bridge the gap, and use the base formula.
		// N.B.: We *could* add a post-import step where we use a `preCreateItem` hook to then go back and
		//   update this effect by trying to find some sheet item (e.g. Cambion's "Fiendish Blessing") to connect
		//   this effect to. So the flow would be:
		//   - Create "Importing..." actor
		//   - Build data and update (which includes setting the effects)
		//   - Bind hook
		//   - Create sheet items, during which our hook fires and we may update the effect we previously created,
		//     by trying to match on the text in our items for "AC bonus"/etc.
		//   - Unbind hook
		//   - Update the actor again, to persist our changes to the effect (if we made any)
		//  This is a massive amount of complexity (not to mention performance loss) for something so
		//    trivial, however.
		monOpts.effects.push({
			label: "Other AC Bonus",
			icon: `modules/${SharedConsts.MODULE_NAME}/media/icon/mighty-force.svg`,
			changes: [
				{
					key: "data.attributes.ac.bonus",
					value: delta,
					mode: CONST.ACTIVE_EFFECT_MODES.ADD,
					priority: UtilActiveEffects.PRIORITY_BONUS,
				},
			],
			disabled: false,
			duration: {
				startTime: null,
				seconds: null,
				rounds: null,
				turns: null,
				startRound: null,
				startTurn: null,
			},
			origin: null,
			tint: "",
			transfer: false,
			flags: {},
		});

		return {calc: "default", formula: null, value: null};
	}

	static _pImportEntry_getAcMeta_getAcVal ({ac0}) {
		if (ac0.ac != null) return ac0.ac;
		if (ac0.special == null) return typeof ac0 === "number" ? ac0 : null;
		const mSpecial = /^(?<number>\d+)\s*([-+])/gi.exec(ac0.special);
		if (!mSpecial) return null;
		return Number(mSpecial.groups.number);
	}

	async _pImportEntry_pFillData_Attributes_Ac_getAcFromItems (mon, acHashes) {
		let isAnyItem = false;
		let acBase = 10;
		let acBonusShield = 0; // Only one shield can be used at a time--take the highest value we find
		let acBonusOther = 0;
		let isDexIncluded = false;

		for (const acHash of acHashes) {
			const item = await Renderer.hover.pCacheAndGetHash(UrlUtil.PG_ITEMS, acHash);
			if (!item) continue;

			let bonusAc = Number(item.bonusAc || 0);
			if (isNaN(bonusAc)) bonusAc = 0;

			switch (item.bardingType || item.type) {
				case "HA": { // Heavy armor
					isAnyItem = true;
					acBase = Math.max(acBase, (item.ac || 10) + bonusAc);
					isDexIncluded = true;
					break;
				}

				case "MA": { // Medium armor
					isAnyItem = true;
					const maxDex = item.dexterityMax === null ? Number.MAX_SAFE_INTEGER : item.dexterityMax != null ? item.dexterityMax : 2;
					acBase = Math.max(acBase, (item.ac || 10) + Math.min(maxDex, Parser.getAbilityModNumber(mon.dex || 10)) + bonusAc);
					isDexIncluded = true;
					break;
				}

				case "LA": { // Light armor
					isAnyItem = true;
					acBase = Math.max(acBase, (item.ac || 10) + Parser.getAbilityModNumber(mon.dex || 10) + bonusAc);
					isDexIncluded = true;
					break;
				}

				case "S": { // Shield
					isAnyItem = true;
					acBonusShield = Math.max(acBonusShield, 2 + bonusAc);
					break;
				}

				default: {
					// If we're using Plutonium item effects (and so not in e.g. DAE compatibility mode), we can add our
					//   extra bonus AC defined on non-armor items here.
					// DAE won't/can't pick up non-armor items, so otherwise avoid adding this bonus to maintain
					//   compatibility.
					if (Config.get("importItem", "isAddActiveEffects")) {
						isAnyItem = true;
						acBonusOther += bonusAc;
					}
				}
			}
		}

		return {
			ac: acBase + acBonusShield + acBonusOther,
			isDexIncluded,
			isAnyItemIncluded: isAnyItem,
		};
	}

	async _pImportEntry_pFillData_Details (mon, data, monOpts) {
		const out = {};

		out.alignment = mon.alignment ? Parser.alignmentListToFull(mon.alignment).toLowerCase() : "";

		out.biography = {
			value: await this._pGetBiographyValue(
				mon,
				monOpts.fluff,
				{
					isImportText: Config.get(this._configGroup, "isImportBio"),
					isImportImages: Config.get(this._configGroup, "isImportBioImages"),
					additionalHtml: Config.get(this._configGroup, "isImportBioVariants") ? Renderer.monster.getRenderedVariants(mon) : null,
				},
			),
		};

		if (monOpts.spellLevel || monOpts.spellClass) {
			out.class = {
				level: monOpts.spellLevel,
				name: monOpts.spellClass,
			};
		} else {
			out.class = {};
		}

		out.spellLevel = monOpts.spellLevel;

		out.race = "";

		ImportListCreature._CREATURE_TYPES = ImportListCreature._CREATURE_TYPES || new Set(Object.keys(CONFIG.DND5E.creatureTypes));

		const typeInfo = Parser.monTypeToFullObj(mon.type);
		if (ImportListCreature._CREATURE_TYPES.has(typeInfo.type)) {
			out.type = {
				value: typeInfo.type,
				subtype: typeInfo.tags.join(", "),
				swarm: typeInfo.swarmSize ? UtilActors.VET_SIZE_TO_ABV[typeInfo.swarmSize] : null,
			};
		} else {
			out.type = {
				custom: Parser.monTypeToFullObj(mon.type).asText,
			};
		}

		out.environment = mon.environment ? mon.environment.sort(SortUtil.ascSortLower).map(it => it.toTitleCase()).join(", ") : "";

		const crNum = Parser.crToNumber(mon.cr);
		out.cr = crNum >= VeCt.CR_CUSTOM ? 0 : crNum;

		out.xp = {
			value: mon.cr ? (Parser.crToXpNumber(mon.cr) || 0) : 0,
		};

		out.source = UtilDataConverter.getSourceWithPagePart(mon);

		data.details = out;
	}

	_pImportEntry_fillData_Skills (mon, data, dataBuilderOpts) {
		data.skills = DataConverterCreature.getDataSkills(mon, data, dataBuilderOpts);
	}

	_pImportEntry_fillData_Traits (mon, data, monOpts) {
		const out = {};

		out.size = UtilActors.VET_SIZE_TO_ABV[mon.size] || "med";

		const allLangs = new Set();
		let customLangs = [];

		if (mon.languages) {
			mon.languages.forEach(l => {
				const lClean = l.toLowerCase().trim();
				const lMapped = UtilActors.VALID_LANGUAGES[lClean];

				if (lMapped) allLangs.add(lMapped);
				else if (lClean === "all") {
					Object.values(UtilActors.VALID_LANGUAGES).forEach(vl => allLangs.add(vl));
				} else {
					customLangs.push(l);
				}
			});
		}

		// Add any valid languages found in tags, as e.g. "Common plus any four languages" is treated as "custom"
		//  This may produce duplicate text in the "special" field, but this is preferable to the alternatives, which are:
		//  - storing well-formatted language data for all creatures in the bestiary
		//  - find-replacing strings in the "special" field, as this may result in garbled text
		if (mon.languageTags) {
			mon.languageTags
				.map(lt => Parser.monLanguageTagToFull(lt))
				.map(fl => UtilActors.VALID_LANGUAGES[fl.toLowerCase()])
				.filter(Boolean)
				.forEach(ml => allLangs.add(ml));
		}

		out.languages = {
			value: [...allLangs],
			custom: customLangs.filter(Boolean).join("; "),
		};

		this._pImportEntry_fillConditionsDamage(mon, out);

		data.traits = out;
	}

	_pImportEntry_fillData_Currency (mon, data, monOpts) {
		// Dummy data
		data.currency = {
			pp: 0,
			gp: 0,
			ep: 0,
			sp: 0,
			cp: 0,
		};
	}

	_pImportEntry_fillData_Spells (mon, data, monOpts) {
		data.spells = DataConverterCreature.getDataSpells(mon, data, monOpts);
	}

	_pImportEntry_fillData_Resources (mon, data, monOpts) {
		const out = {};

		let legAct = 0;
		if (mon.legendary || mon.mythic) legAct = mon.legendaryActions || 3;

		out.legact = {
			value: legAct,
			max: legAct,
		};

		let legRes = 0;
		if (mon.trait) {
			const legResTrait = mon.trait.find(it => /legendary resistance/gi.test(it.name || ""));
			if (legResTrait) {
				const m = /\((\d+)\/Day\)/i.exec(legResTrait.name);
				if (m) legRes = Number(m[1]);
			}
		}

		out.legres = {
			value: legRes,
			max: legRes,
		};

		out.lair = {
			value: !!(monOpts.legendaryMeta && monOpts.legendaryMeta.lairActions),
			initiative: 20, // is this always correct?
		};

		data.resources = out;
	}

	async _pImportEntry_pFillItems (mon, act, monOpts, importOpts) {
		// Do actions first, as they set the prof bonus if the creature has no CR
		await this._pImportEntry_pFillItems_pActions(mon, act, monOpts);
		await this._pImportEntry_pFillItems_pTraitsReactionsLegendaries(
			mon,
			act,
			monOpts,
			{
				prop: "trait",
				fnPreProcess: trait => {
					if (!/legendary resistance/gi.test(trait.name || "")) return;
					trait._plut_isLegendaryResistance = true;
				},
			},
			{
				consumeType: trait => trait._plut_isLegendaryResistance ? "attribute" : null,
				consumeTarget: trait => trait._plut_isLegendaryResistance ? "resources.legres.value" : null,
				consumeAmount: trait => trait._plut_isLegendaryResistance ? 1 : null,
			},
		);
		await this._pImportEntry_pFillItems_pTraitsReactionsLegendaries(mon, act, monOpts, {prop: "bonus"}, {
			activationType: "bonus",
			activationCost: 1,
		});
		await this._pImportEntry_pFillItems_pTraitsReactionsLegendaries(mon, act, monOpts, {prop: "reaction"}, {
			activationType: "reaction",
			activationCost: 1,
		});
		const legendaryItems = await this._pImportEntry_pFillItems_pTraitsReactionsLegendaries(
			mon,
			act,
			monOpts,
			{
				prop: "legendary",
				fnPreProcess: legEnt => {
					this.constructor._mutLegendaryActionNameAndCost(legEnt);
				},
			},
			{
				activationType: "legendary",
				activationCost: legEnt => legEnt._plut_legActions,
				consumeType: "attribute",
				consumeTarget: "resources.legact.value",
				consumeAmount: legEnt => legEnt._plut_legActions,
			},
		);
		await this._pImportEntry_pFillItems_pLegendaryHeader(mon, act, monOpts, legendaryItems);
		const mythicItems = await this._pImportEntry_pFillItems_pTraitsReactionsLegendaries(
			mon,
			act,
			monOpts,
			{
				prop: "mythic",
				fnPreProcess: legEnt => {
					this.constructor._mutLegendaryActionNameAndCost(legEnt);
				},
			},
			{
				activationType: "legendary",
				activationCost: legEnt => legEnt._plut_legActions,
				consumeType: "attribute",
				consumeTarget: "resources.legact.value",
				consumeAmount: legEnt => legEnt._plut_legActions,
			},
		);
		await this._pImportEntry_pFillItems_pMythicHeader(mon, act, monOpts, mythicItems);
		await this._pImportEntry_pFillItems_pLairActions(mon, act, monOpts);
		await this._pImportEntry_pFillItems_pRegionalEffects(mon, act, monOpts);
		await this._pImportEntry_pFillItems_pVariants(mon, act, monOpts);

		await this._pImportEntry_pFillItems_pInventory(mon, act, monOpts);

		const isTemporary = importOpts.isTemp || this._pack != null;
		await this._pImportEntry_pFillItems_pSpellcasting(mon, act, isTemporary, monOpts);

		await UtilActors.pAddActorItems(monOpts.actor, monOpts.items, {isTemporary});
	}

	static _mutLegendaryActionNameAndCost (legEnt) {
		if (!legEnt) return;

		legEnt._plut_legActions = legEnt._plut_legActions || 1;
		if (!legEnt.name) return;

		legEnt.name = legEnt.name.replace(/\(costs (\d+) actions?\)/i, (...m) => {
			legEnt._plut_legActions = Number(m[1]);
			return "";
		}).trim();
	}

	/**
	 * @param mon Monster.
	 * @param monOpts Import options.
	 * @param act Actor update data.
	 * @param it Entry to process.
	 * @param opts Options object.
	 * @param opts.fvttType Foundry type.
	 * @param [opts.activationType] Foundry activation type.
	 * @param [opts.activationCost] Foundry action type (getter function or static value)
	 * @param opts.img Image path.
	 * @param [opts.description] Pre-rendered description.
	 */
	async _pImportEntry_pFillItems_pAddTextOnlyItem (mon, monOpts, act, it, opts) {
		const item = await DataConverter.pGetItemActorPassive(
			it,
			{
				...opts,
				mode: "creature",
				pb: monOpts.assumedPb,
				entity: mon,
				source: mon.source,
				summonSpellLevel: mon._summonedBySpell_level ?? mon._summonedBySpell_levelBase,
				actor: {data: act}, // wrap our update data to give the appearance of a real actor
			},
		);
		monOpts.items.push(item);
		return item;
	}

	async _pImportEntry_pFillItems_pLegendaryHeader (mon, act, monOpts, legendaryItems) {
		return this._pImportEntry_pFillItems_pLegendaryMythicHeader({
			mon,
			act,
			monOpts,
			addedItems: legendaryItems,
			prop: "legendary",
			itemName: "Legendary Actions",
			renderedEntries: await UtilDataConverter.pGetWithDescriptionPlugins(() => Renderer.monster.getLegendaryActionIntro(mon)),
		});
	}

	async _pImportEntry_pFillItems_pMythicHeader (mon, act, monOpts, mythicItems) {
		return this._pImportEntry_pFillItems_pLegendaryMythicHeader({
			mon,
			act,
			monOpts,
			addedItems: mythicItems,
			prop: "mythic",
			itemName: "Mythic Actions",
			renderedEntries: await UtilDataConverter.pGetWithDescriptionPlugins(() => Renderer.monster.getMythicActionIntro(mon)),
		});
	}

	async _pImportEntry_pFillItems_pLegendaryMythicHeader (
		{
			mon,
			act,
			monOpts,
			addedItems,
			prop,
			itemName,
			renderedEntries,
		},
	) {
		if (!mon[prop]) return;

		const legendaryItemTags = addedItems
			.map(it => `@ActorEmbeddedItem[${monOpts.actor.id}][${it.name}]`);

		const description = `<div>
			<div>${renderedEntries}</div>
			${legendaryItemTags.length ? `<div>${Renderer.get().render({type: "list", items: legendaryItemTags})}</div>` : ""}
		</div>`;

		const img = await DataConverterCreature.pGetTraitReactionLegendaryImage(mon, {name: itemName}, monOpts);

		monOpts.items.push(await DataConverter.pGetItemActorPassive(
			{name: itemName},
			{
				fvttType: "feat",
				description,
				mode: "creature",
				pb: monOpts.assumedPb,
				entity: mon,
				source: mon.source,
				summonSpellLevel: mon._summonedBySpell_level ?? mon._summonedBySpell_levelBase,
				actor: {data: act}, // wrap our update data to give the appearance of a real actor
				img,
			},
		));
	}

	/**
	 * @param mon Monster.
	 * @param act Actor data.
	 * @param monOpts Import metadata.
	 * @param opts Options object.
	 * @param opts.prop Monster property to loop through (if it exists)
	 * @param opts.img Image path.
	 * @param [opts.fnPreProcess]
	 * @param [optsFoundryData] Properties can be either values of functions.
	 * @param [optsFoundryData.activationType]
	 * @param [optsFoundryData.activationCost]
	 * @param [optsFoundryData.consumeType]
	 * @param [optsFoundryData.consumeTarget]
	 * @param [optsFoundryData.consumeAmount]
	 */
	async _pImportEntry_pFillItems_pTraitsReactionsLegendaries (mon, act, monOpts, opts, optsFoundryData) {
		optsFoundryData = optsFoundryData || {};

		if (!mon[opts.prop]) return;

		const out = [];

		for (let ent of mon[opts.prop]) {
			if (opts.fnPreProcess) {
				ent = MiscUtil.copy(ent);
				opts.fnPreProcess(ent);
			}

			const nxtOpts = {};
			Object.entries(optsFoundryData)
				.forEach(([k, v]) => {
					if (typeof v === "function") nxtOpts[k] = v(ent);
					else nxtOpts[k] = MiscUtil.copy(v);
				});

			const img = await DataConverterCreature.pGetTraitReactionLegendaryImage(mon, ent, monOpts, {isLegendary: opts.prop === "legendary" || opts.prop === "mythic"});

			const addedItem = await this._pImportEntry_pFillItems_pAddTextOnlyItem(
				mon,
				monOpts,
				act,
				ent,
				{
					...nxtOpts,
					fvttType: "feat",
					img,
				},
			);

			out.push(addedItem);
		}

		return out;
	}

	static _getLairActionName (strEnt) {
		const stripped = Renderer.stripTags(strEnt);

		let truncatedName = "Lair: ";
		const spl = stripped.split(" ");
		for (const pt of spl) {
			if ((truncatedName.length + pt.length) < 50) {
				truncatedName += `${pt} `;
			} else break;
		}
		if (stripped.length > truncatedName.trim().length) truncatedName += "...";
		else truncatedName = truncatedName.trim();

		return truncatedName;
	}

	async _pImportEntry_pFillItems_pLairActions (mon, act, monOpts) {
		if (!monOpts.legendaryMeta?.lairActions) return;

		const lairPart = monOpts.legendaryMeta.lairActions;

		// Lair actions are _usually_ in lists, with each list item being a single lair action.
		const listItems = this._pImportEntry_pFillItems_lairActions_getListItems(lairPart);
		if (listItems.length) {
			for (const listItem of listItems) {
				const ent = this._pImportEntry_pFillItems_lairActions_getLairActionEntryFromListItem(listItem);
				await this._pImportEntry_pFillItems_lairActions_addLairAction(mon, act, monOpts, ent);
			}
			return;
		}

		// If we can't find any list items, import the whole lair action section as one item
		const entry = this._pImportEntry_pFillItems_lairActions_getLairActionEntry(lairPart);
		await this._pImportEntry_pFillItems_lairActions_addLairAction(mon, act, monOpts, entry);
	}

	_pImportEntry_pFillItems_lairActions_getListItems (ent) {
		const out = [];
		MiscUtil.getWalker({isNoModification: true}).walk(
			ent,
			{
				object: obj => {
					if (obj.type !== "list") return;
					out.push(...(obj.items || []));
				},
			},
		);
		return out;
	}

	_pImportEntry_pFillItems_lairActions_getLairActionEntryFromListItem (ent) {
		// Handle plain string list items
		if (typeof ent === "string") {
			return {
				type: "entries",
				name: this.constructor._getLairActionName(ent),
				entries: [
					ent,
				],
			};
		}

		// Handle `"type": "item"` list items
		if (ent.name && (ent.entry || ent.entries)) {
			const entries = ent.entries || [ent.entry];
			return {
				type: "entries",
				name: this.constructor._getLairActionName(ent.name.replace(/\s*[.?!]$/, "")),
				entries,
			};
		}

		throw new Error(`Unhandled lair action format!`);
	}

	_pImportEntry_pFillItems_lairActions_getLairActionEntry (ent) {
		if (typeof ent[0] === "string") {
			return {
				type: "entries",
				name: this.constructor._getLairActionName(ent[0]),
				entries: ent,
			};
		}

		// Fallback on making a generically-named lair action
		return {
			type: "entries",
			name: `Lair Actions`,
			entries: ent,
		};
	}

	async _pImportEntry_pFillItems_lairActions_addLairAction (mon, act, monOpts, ent) {
		const strEntries = JSON.stringify(ent);

		const {
			saveAbility,
			saveScaling,
			saveDc,
		} = this._getSavingThrowData(mon, monOpts.assumedPb, strEntries);

		const damageTuples = [];
		let formula = "";
		if (typeof ent.entries[0] === "string") {
			const {damageTupleMetas} = DataConverter.getDamageTupleMetas(ent.entries[0], {summonSpellLevel: mon._summonedBySpell_level ?? mon._summonedBySpell_levelBase});
			const {damageParts, formula: formula_} = DataConverter.getDamagePartsAndOtherFormula(damageTupleMetas);
			damageTuples.push(...damageParts);
			formula = formula_;
		}

		const damageParts = this._getDamageTuplesWithMod(damageTuples);

		// Always name the action "Lair Actions" to match the SRD content
		const img = await DataConverterCreature.pGetLairActionImage(mon, {name: "Lair Actions"}, monOpts);

		await this._pImportEntry_pFillItems_pAddTextOnlyItem(
			mon,
			monOpts,
			act,
			ent,
			{
				fvttType: "feat",
				activationType: "lair",
				activationCost: 1,
				img,
				saveAbility,
				saveDc,
				saveScaling,
				damageParts,
				formula,
			},
		);
	}

	async _pImportEntry_pFillItems_pRegionalEffects (mon, act, monOpts) {
		if (!monOpts.legendaryMeta?.regionalEffects) return;

		const regionalEntry = {
			type: "entries",
			name: "Regional Effects",
			entries: MiscUtil.copy(monOpts.legendaryMeta.regionalEffects),
		};

		const img = await DataConverterCreature.pGetLairActionImage(mon, regionalEntry, monOpts);

		await this._pImportEntry_pFillItems_pAddTextOnlyItem(
			mon,
			monOpts,
			act,
			regionalEntry,
			{
				fvttType: "feat",
				img,
			},
		);
	}

	async _pImportEntry_pFillItems_pVariants (mon, act, monOpts) {
		if (!Config.get("importCreature", "isImportVariantsAsFeatures")) return;

		const dragonVariants = Renderer.monster.dragonCasterVariant.getVariantEntries(mon);

		const allVariants = [
			...(dragonVariants || []),
			...(mon.variant || []),
		];

		if (!allVariants.length) return;

		for (const variant of allVariants) {
			const img = await DataConverterCreature.pGetVariantImage(mon, variant, monOpts);

			await this._pImportEntry_pFillItems_pAddTextOnlyItem(
				mon,
				monOpts,
				act,
				variant,
				{
					fvttType: "feat",
					img,
				},
			);
		}
	}

	async _pImportEntry_pFillItems_pActions (mon, act, monOpts) {
		if (!mon.action) return;
		for (const action of mon.action) {
			// Split actions into multiple (fake) sub-actions in the case of e.g. multi-modal breath weapons.
			//   For any other action, a single sub-action, which is simply the original action, will be processed.
			const subActions = this._pImportEntry_pFillItems_getSubActions(action, monOpts);

			let img = null;
			for (let i = 0; i < subActions.length; ++i) {
				const subAction = subActions[i];
				const result = await this._pImportEntry_pFillItems_pAction(mon, act, subAction, monOpts, {img});

				// Use the image of the first action as the image for sub-actions
				if (i === 0) img = result?.img;
			}
		}
	}

	_pImportEntry_pFillItems_getSubActions (action, monOpts) {
		if (!action.name || !action.entries) return [action];

		// region Breath weapons
		if (this.constructor._isActionBreathWeapon(action)) {
			const out = [];
			const tmpItemIdParent = CryptUtil.uid();

			const breathActions = action.entries[1].items.map(li => {
				const cleanName = li.name.replace(/\.\s*$/, "");
				const itemName = `Breath Weapons: ${cleanName}`;
				const tmpItemId = CryptUtil.uid();

				monOpts.postItemItemUpdates.push(async ({actor, isTemp, isPack, pack}) => {
					// Temp items don't have IDs, so we can't link anything up
					if (isTemp) return;

					const parentSheetItem = actor.items.find(it => it.data.flags?.[SharedConsts.MODULE_NAME_FAKE]?._tmpItemId === tmpItemIdParent);
					if (!parentSheetItem) return console.warn(...LGT, `Failed to find parent sheet item for item "${li.name}"`);

					const sheetItem = actor.items.find(it => it.data.flags?.[SharedConsts.MODULE_NAME_FAKE]?._tmpItemId === tmpItemId);
					if (!sheetItem) return console.warn(...LGT, `Failed to find sheet item for item "${li.name}"`);

					const update = {
						_id: sheetItem.id,
						data: {consume: {target: parentSheetItem.id}},
					};
					await UtilDocuments.pUpdateEmbeddedDocuments(
						actor,
						[update],
						{
							propData: "items",
							ClsEmbed: Item,
						},
					);
				});

				return {
					name: itemName,
					_plut_cleanName: cleanName,
					entries: li.entry ? [li.entry] : li.entries,
					_foundryData: {
						"consume.type": "charges",
						"consume.amount": 1,
					},
					_foundryFlags: {
						[SharedConsts.MODULE_NAME_FAKE]: {
							_tmpItemId: tmpItemId,
						},
					},
				};
			});

			out.push({
				name: action.name,
				entries: [
					`${action.entries[0].trim().replace(/[.,!?:]$/, "")}: ${breathActions.map(it => it._plut_cleanName).joinConjunct(", ", " or ")}`,
				],
				_foundryFlags: {
					[SharedConsts.MODULE_NAME_FAKE]: {
						_tmpItemId: tmpItemIdParent,
					},
				},
			});

			breathActions.forEach(it => delete it._plut_cleanName);
			out.push(...breathActions);

			return out;
		}
		// endregion

		// region Eye rays
		if (this.constructor._isActionEyeRay(action)) {
			const out = [];

			const cpy = MiscUtil.copy(action);
			const ixList = action.entries.findIndex(it => it.type === "list" && (it.items || []).every(li => li.type === "item"));
			const lst = action.entries[ixList];
			cpy.entries.splice(ixList, 1);

			out.push(cpy);
			lst.items.forEach(it => {
				const entRay = {
					...it,
					type: "entries",
					name: `Eye Ray: ${it.name.replace(/[.,!:?]\\s*$/, "")}`,
				};

				if (entRay.entry) {
					entRay.entries = [entRay.entry];
					delete entRay.entry;
				}

				delete entRay.style;

				out.push(entRay);
			});

			return out;
		}
		// endregion

		return [action];
	}

	static _isActionBreathWeapon (action) {
		return action.entries.length === 2
			&& typeof action.entries[0] === "string"
			&& action.entries[0].includes("following breath weapon")
			&& action.entries[1].type === "list"
			&& action.entries[1].items.every(li => li.name && (li.entry || li.entries));
	}

	static _isActionEyeRay (action) {
		return /^eye ray/gi.test(action.name) && action.entries.find(it => it.type === "list" && (it.items || []).every(li => li.type === "item"));
	}

	/**
	 * @param mon
	 * @param act
	 * @param action
	 * @param monOpts
	 * @param [opts]
	 * @param [opts.img] Image to use
	 */
	async _pImportEntry_pFillItems_pAction (mon, act, action, monOpts, opts) {
		if (!action.entries?.length) return console.warn(...LGT, `${mon.name} (${mon.source}) action "${action?.name}" had no entries!`);

		const description = await DataConverter.pGetEntryDescription(action, {summonSpellLevel: mon._summonedBySpell_level ?? mon._summonedBySpell_levelBase});
		const strEntries = action.entries ? JSON.stringify(action.entries) : null;

		const {
			damageTuples,
			formula,
			offensiveAbility,
			isAttack,
			rangeShort,
			rangeLong,
			actionType,
			isProficient,
			attackBonus,
			_foundryData,
			foundryData,
			_foundryFlags,
			foundryFlags,
			img,
		} = await DataConverterCreature.pGetParsedAction(mon, action, monOpts);

		const damageParts = [];
		damageParts.push(...this._getDamageTuplesWithMod(damageTuples, mon[offensiveAbility]));

		// region Saving throw
		const {
			saveAbility,
			saveScaling,
			saveDc,
		} = this._getSavingThrowData(mon, monOpts.assumedPb, strEntries);
		// endregion

		// If it was an attack, treat is as a weapon. Otherwise, treat it as a generic action.
		if (isAttack) {
			return this._pFillWeaponItem(
				mon,
				act,
				action,
				monOpts,
				{
					offensiveAbility,
					damageParts,
					formula,
					rangeShort,
					rangeLong,
					actionType,
					isProficient,
					description: this._getAttackDescription({mon, action, description}),
					saveAbility,
					saveDc,
					saveScaling,
					attackBonus,
					_foundryData,
					foundryData,
					_foundryFlags,
					foundryFlags,
					img: opts?.img ?? img,
					isMagical: (mon.traitTags || []).includes("Magic Weapons"),
				},
			);
		}

		return this._pImportEntry_pFillItems_pAddTextOnlyItem(
			mon,
			monOpts,
			act,
			action,
			{
				fvttType: "feat",
				activationType: "action",
				activationCost: 1,
				description,
				saveAbility,
				saveDc,
				saveScaling,
				damageParts,
				formula,
				attackBonus,
				_foundryData,
				foundryData,
				_foundryFlags,
				foundryFlags,
				img: opts?.img ?? img,
			},
		);
	}

	_getAttackDescription ({mon, action, description}) {
		if (!Config.get(this._configGroup, "isSecretWrapAttacks")) return description;

		const shortName = Renderer.monster.getShortName(mon, true);

		return `<section class="secret py-1">${description}</section>
		<p>${shortName} attacks with their ${action.name}.</p>`;
	}

	_getSavingThrowData (mon, assumedMonProf, strEntries) {
		let {
			saveAbility,
			saveScaling,
			saveDc,
			isFoundParse,
		} = super._getSavingThrowData(strEntries);

		if (isFoundParse) {
			// Try to find an ability to link the scaling to
			//   Order of preference: cha > wis > int > str > dex > con
			//   (Rough heuristic of which saving throw sources are the most common)
			if (assumedMonProf) {
				const fromAbil = saveDc - assumedMonProf - 8;
				for (const abil of ["cha", "wis", "int", "str", "dex", "con"]) {
					const mod = Parser.getAbilityModNumber(mon[abil]);
					if (mod === fromAbil) {
						saveScaling = abil;
						break;
					}
				}
			}
		}

		return {saveAbility, saveScaling, saveDc};
	}

	_getDamageTuplesWithMod (damageTuples, abilityScore) {
		if (!damageTuples.length) return [];

		damageTuples = MiscUtil.copy(damageTuples);

		if (abilityScore) {
			// Try to switch generic +damage for +@mod if the value match
			damageTuples.forEach(dmgTuple => {
				const abMod = Parser.getAbilityModNumber(abilityScore);
				const mBonus = /(\d+d\d+\s*)([-+]\s*\d+)([ -+].*)?$/.exec(dmgTuple[0]);
				if (!mBonus) return;

				const fromAbil = Number(mBonus[2].replace(/\s*/g, ""));
				if (fromAbil === abMod) dmgTuple[0] = `${mBonus[1]} + @mod${mBonus[3] || ""}`;
			});
		}

		return damageTuples.filter(it => it.length);
	}

	static _getItemHashesFromAcItem (ac) {
		const out = []; // Use a list to maintain order

		if (!ac.from || !ac.from.length) return out;

		ac.from.forEach(from => {
			const hashes = this._getItemHashesFromString(from);
			hashes.forEach(hash => {
				if (!out.includes(hash)) out.push(hash);
			});
		});

		return out;
	}

	static _getItemHashesFromString (str) {
		const out = []; // Use a list to maintain order

		str.replace(/{@item ([^}]+)}/gi, (...m) => {
			const [name, source] = m[1].trim().toLowerCase().split("|");

			const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({
				name,
				source: source || SRC_DMG,
			});

			if (!out.includes(hash)) out.push(hash);
		});

		return [...out];
	}

	async _pImportEntry_pFillItems_pInventory (mon, act, dataBuilderOpts) {
		const itemHashes = new Set();
		const itemHashesEquipped = new Set();

		(mon.ac || [])
			.forEach((ac, i) => {
				const acHashes = this.constructor._getItemHashesFromAcItem(ac);
				acHashes.forEach(hash => itemHashes.add(hash));
				if (i === 0 && !Config.get("importCreature", "isUseStaticAc")) acHashes.forEach(hash => itemHashesEquipped.add(hash)); // Assume the creature has its first listed armor set equipped
			});

		for (const itemHash of itemHashes) {
			const item = await Renderer.hover.pCacheAndGetHash(UrlUtil.PG_ITEMS, itemHash);
			if (!item) continue;

			await this._pImportEntry_pFillItems_pAddItem(mon, act, item, dataBuilderOpts, {isEquipped: itemHashesEquipped.has(itemHash)});
		}

		// Do these after, to avoid duplicating AC items
		const itemHashesFromTraits = (mon.trait || [])
			.filter(it => it.name && it.entries && /equipment/i.test(it.name.trim()))
			.map(it => this.constructor._getItemHashesFromString(JSON.stringify(it.entries)))
			.flat()
			.filter(hash => !itemHashes.has(hash));
		for (const itemHash of itemHashesFromTraits) {
			const item = await Renderer.hover.pCacheAndGetHash(UrlUtil.PG_ITEMS, itemHash);
			if (!item) continue;

			// Skip any weapons, as we assume the actions step will take care of these.
			if (item.type === "S" || item.type === "R" || item.weaponCategory) continue;

			await this._pImportEntry_pFillItems_pAddItem(mon, act, item, dataBuilderOpts, {isEquipped: true});
		}
	}

	/**
	 * @param mon
	 * @param act
	 * @param item
	 * @param dataBuilderOpts
	 * @param [opts]
	 * @param [opts.isEquipped]
	 */
	async _pImportEntry_pFillItems_pAddItem (mon, act, item, dataBuilderOpts, opts) {
		opts = opts || {};

		const fluff = await Renderer.item.pGetFluff(item);
		const itemData = await DataConverterItem.pGetItemItem(item, {isActorItem: true, fluff, size: mon.size, isEquipped: opts.isEquipped, dexMod: Parser.getAbilityModNumber(mon.dex)});

		dataBuilderOpts.items.push(itemData);
	}

	async _pImportEntry_pFillItems_pSpellcasting (mon, act, isTemporary, monOpts) {
		if (!mon.spellcasting) return;

		const importListSpells = new ImportListSpell({actor: monOpts.actor});
		await importListSpells.pInit();

		const hashToIdMap = {};

		// Assume creatures (i.e. npcs) always prepare all their spells
		const isPrepared = true;

		const spellcastingsUnknownProps = [];
		for (const spellcasting of mon.spellcasting) {
			const cpySpellcasting = MiscUtil.copy(spellcasting);

			// region Remove properties which we have no interest in
			// General entry properties
			delete cpySpellcasting.name;
			delete cpySpellcasting.type;
			delete cpySpellcasting.page;
			delete cpySpellcasting.id;
			delete cpySpellcasting.source;
			delete cpySpellcasting.data;

			// Spellcasting-specific properties
			delete cpySpellcasting.headerEntries;
			delete cpySpellcasting.hidden;
			delete cpySpellcasting.footerEntries;
			delete cpySpellcasting.displayAs;
			// endregion

			// region Handle slot-based/pact casters
			if (cpySpellcasting.spells) {
				const spellLevels = Object.keys(cpySpellcasting.spells);

				for (const spellLevel of spellLevels) {
					const levelMeta = cpySpellcasting.spells[spellLevel];

					const preparationMode = levelMeta.lower != null ? "pact" : "prepared";

					await this.constructor._pGetSpellHashToItemPosMapAndFillSpells(
						monOpts.actor,
						JSON.stringify(levelMeta.spells),
						{
							importListSpells,
							hashToIdMap,
							isTemporary,
							optsGetSpellItem: {
								abilityAbv: cpySpellcasting.ability || monOpts.spellAbility,
								isPrepared,
								preparationMode,
							},
						},
					);
				}

				delete cpySpellcasting.spells;
			}
			// endregion

			// region Handle recharge-based casters
			if (cpySpellcasting.weekly) {
				await this._pImportEntry_pFillItems_pSpellcasting_recharge(
					monOpts,
					cpySpellcasting,
					"weekly",
					{
						importListSpells,
						hashToIdMap,
						isTemporary,
						isPrepared,
						usesPer: "charges", // Convert "weekly" to "charges" as Foundry doesn't have "weekly"
					},
				);
			}

			if (cpySpellcasting.yearly) {
				await this._pImportEntry_pFillItems_pSpellcasting_recharge(
					monOpts,
					cpySpellcasting,
					"yearly",
					{
						importListSpells,
						hashToIdMap,
						isTemporary,
						isPrepared,
						usesPer: "charges", // Convert "yearly" to "charges" as Foundry doesn't have "yearly"
					},
				);
			}

			if (cpySpellcasting.daily) {
				await this._pImportEntry_pFillItems_pSpellcasting_recharge(
					monOpts,
					cpySpellcasting,
					"daily",
					{
						importListSpells,
						hashToIdMap,
						isTemporary,
						isPrepared,
						usesPer: "day",
					},
				);
			}

			if (cpySpellcasting.rest) {
				await this._pImportEntry_pFillItems_pSpellcasting_recharge(
					monOpts,
					cpySpellcasting,
					"daily",
					{
						importListSpells,
						hashToIdMap,
						isTemporary,
						isPrepared,
						usesPer: "sr", // Convert "rest" to "short rest," as this is a subset of a long rest
					},
				);
			}

			if (cpySpellcasting.will) {
				await this.constructor._pGetSpellHashToItemPosMapAndFillSpells(
					monOpts.actor,
					JSON.stringify(cpySpellcasting.will),
					{
						importListSpells,
						hashToIdMap,
						isTemporary,
						optsGetSpellItem: {
							abilityAbv: cpySpellcasting.ability || monOpts.spellAbility,
							isPrepared,
							preparationMode: "innate",
						},
					},
				);

				delete cpySpellcasting.will;
			}

			if (cpySpellcasting.constant) {
				await this.constructor._pGetSpellHashToItemPosMapAndFillSpells(
					monOpts.actor,
					JSON.stringify(cpySpellcasting.constant),
					{
						importListSpells,
						hashToIdMap,
						isTemporary,
						optsGetSpellItem: {
							abilityAbv: cpySpellcasting.ability || monOpts.spellAbility,
							isPrepared,
							preparationMode: "innate",
							// Give "constant" effects a permanent duration
							durationAmount: null,
							durationUnit: "perm",
						},
					},
				);

				delete cpySpellcasting.constant;
			}

			if (cpySpellcasting.ritual) {
				await this.constructor._pGetSpellHashToItemPosMapAndFillSpells(
					monOpts.actor,
					JSON.stringify(cpySpellcasting.ritual),
					{
						importListSpells,
						hashToIdMap,
						isTemporary,
						optsGetSpellItem: {
							abilityAbv: cpySpellcasting.ability || monOpts.spellAbility,
							isPrepared: false, // Set rituals as "not prepared"
							preparationMode: "innate",
							nameSuffix: " (R)", // Add a suffix to the name of the sheet item
						},
					},
				);

				delete cpySpellcasting.ritual;
			}
			// endregion

			const remainingKeys = Object.keys(cpySpellcasting).filter(it => it !== "ability");
			if (remainingKeys.length) {
				console.warn(...LGT, `No handling defined for the following spellcasting properties: ${remainingKeys.map(it => `"${it}"`).join(", ")}. Spells belonging to these properties will be imported as generic "spell list" spells.`);
				spellcastingsUnknownProps.push(cpySpellcasting);
			}
		}

		// Handle any leftover spells that we didn't pick up above
		for (const spellcastingUnknownProps of spellcastingsUnknownProps) {
			await this.constructor._pGetSpellHashToItemPosMapAndFillSpells(
				monOpts.actor,
				JSON.stringify(spellcastingUnknownProps),
				{
					importListSpells,
					hashToIdMap,
					isTemporary,
					optsGetSpellItem: {
						abilityAbv: spellcastingUnknownProps.ability || monOpts.spellAbility,
					},
				},
			);
		}

		// region Spellcasting traits
		const tagHashItemIdMap = {};
		Object.entries(hashToIdMap)
			.forEach(([hash, id]) => MiscUtil.set(tagHashItemIdMap, "spell", hash, id));

		await UtilDataConverter.pGetWithDescriptionPlugins(
			async () => {
				const traits = Renderer.monster.getSpellcastingRenderedTraits(Renderer.get(), mon);
				for (const trait of traits) {
					const img = await DataConverterCreature.pGetSpellcastingImage(mon, trait, monOpts);
					await this._pImportEntry_pFillItems_pAddTextOnlyItem(
						mon,
						monOpts,
						act,
						trait,
						{
							fvttType: "feat",
							img,
							description: trait.rendered,
						},
					);
				}
			},
			{
				actorId: monOpts.actor.id,
				tagHashItemIdMap,
			},
		);
		// endregion
	}

	async _pImportEntry_pFillItems_pSpellcasting_recharge (monOpts, cpySpellcasting, prop, {importListSpells, hashToIdMap, isTemporary, isPrepared, usesPer}) {
		const preparationMode = "innate";

		for (let uses = 1; uses <= 9; ++uses) {
			const keyEach = `${uses}e`;

			// Note that Foundry doesn't yet (2020-05-01) support groups of multiple "X/Time" spells having a single
			//   charge between them, so just treat them all as being independent.
			const allSpells = [
				...((cpySpellcasting[prop] || {})[uses] || []),
				...((cpySpellcasting[prop] || {})[keyEach] || []),
			];

			if (!allSpells.length) continue;

			await this.constructor._pGetSpellHashToItemPosMapAndFillSpells(
				monOpts.actor,
				JSON.stringify(allSpells),
				{
					importListSpells,
					hashToIdMap,
					isTemporary,
					optsGetSpellItem: {
						abilityAbv: cpySpellcasting.ability || monOpts.spellAbility,
						isPrepared,
						preparationMode,
						usesCurrent: uses,
						usesMax: uses,
						usesPer,
					},
				},
			);
		}

		delete cpySpellcasting[prop];
	}

	static _getCasterLevelFromEntry (casting) {
		let casterLevel = 0;
		if (casting.headerEntries) {
			JSON.stringify(casting.headerEntries).replace(/an? (\d+)[A-Za-z]+-level/i, (...m) => {
				const lvl = Number(m[1]);
				if (!isNaN(lvl)) casterLevel = lvl;
			});
		}
		return casterLevel;
	}

	static _getCasterClassFromEntry (casting) {
		let casterClass = "";
		if (casting.headerEntries) {
			JSON.stringify(casting.headerEntries).replace(/(?:^| )(bard|cleric|druid|paladin|ranger|sorcerer|warlock|wizard)(?:\W|$)?/i, (...m) => {
				casterClass = m[1];
			});
		}
		return casterClass;
	}

	// region Add spells from strings
	/**
	 * @param actor The actor.
	 * @param strEntries Stringified entries to search for spell tags.
	 * @param [opts] Options object.
	 * @param [opts.hashToIdMap] A pre-made hash-to-item-ID map to use.
	 * @param [opts.isTemporary] If the actor is a temporary one, so cannot gain Items.
	 * @param [opts.optsGetSpellItem] Options to pass to the spell entity -> FVTT item converter.
	 * @return {Promise}
	 */
	static async _pGetSpellHashToItemPosMapAndFillSpells (actor, strEntries, {importListSpells, hashToIdMap, isTemporary, optsGetSpellItem} = {}) {
		const spellUids = new Set();
		strEntries.replace(/{@spell ([^}]+)}/gi, (...m) => {
			let [name, source] = m[1].toLowerCase().trim().split("|").map(it => it.trim());
			if (!source) source = SRC_PHB.toLowerCase();

			spellUids.add(`${name}|${source}`);
		});

		for (const uid of spellUids) {
			const [name, source] = uid.split("|");
			const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_SPELLS]({name, source});

			let spell;
			try {
				spell = await Renderer.hover.pCacheAndGet(UrlUtil.PG_SPELLS, source, hash);
			} catch (e) {
				console.error(...LGT, `Failed to import spell with hash "${hash}"!`, e);
				continue;
			}

			if (!spell) continue;

			const importSummary = await importListSpells.pImportEntry(
				spell,
				{
					opts_pGetSpellItem: {
						...(await UtilActors.pGetActorSpellItemOpts({actor})),
						...(optsGetSpellItem || {}),
					},
				},
			);

			const id = importSummary.imported[0]?.embeddedDocument?.id;

			if (id == null) continue;
			if (hashToIdMap[hash]) continue; // TODO(Future) support multiple insertions of the same spell
			hashToIdMap[hash] = id;
		}
	}
	// endregion
}

ImportListCreature._CREATURE_TYPES = null;

ImportListCreature.ImportEntryOpts = class extends ImportListActor.ImportEntryOpts {
	constructor (opts) {
		opts = opts || {};
		super(opts);
		this.mon = opts.mon;

		this.pb = Parser.crToPb(this.mon.cr);
		this.assumedPb = this.pb;
		this.legendaryMeta = DataUtil.monster.getMetaGroup(this.mon);

		this.spellAbility = "";
		this.spellDc = 8;
		this.spellLevel = 0;
		this.spellClass = "";
		this._initSpellcasterData(this.mon);

		this._initAssumedPb(this.mon);
	}

	_initAssumedPb (mon) {
		if (!mon.action) return;
		// This will update the `assumedPb` data if required.
		mon.action.forEach(action => DataConverterActor.getParsedActionEntryData(mon, action, this, {mode: "creature", summonSpellLevel: mon._summonedBySpell_level ?? mon._summonedBySpell_levelBase}));
	}

	_initSpellcasterData (mon) {
		if (!mon.spellcasting) return;

		const withAbils = mon.spellcasting
			.filter(it => it.ability)
			.map(it => {
				if (Parser.ABIL_ABVS.includes(it.ability)) return it;

				// If e.g. badly-written homebrew
				const abv = it.ability.substring(0, 3);
				if (Parser.ABIL_ABVS.includes(abv)) {
					it.ability = abv;
					return it;
				}

				return null;
			})
			.filter(Boolean);

		if (withAbils.length) {
			let withAbil = withAbils[0];

			// As the sheet does not support multiple spellcasting traits with different abilities (e.g. Zephyros
			//   from SKT), choose a spellcasting trait to be used as the single representative.
			if (withAbils.length > 1) {
				switch (Config.get("importCreature", "spellcastingPrimaryTraitMode")) {
					// "Most spells" mode
					case 1: {
						withAbil = withAbils.sort((a, b) => {
							const spellCountA = this.constructor._getSpellCount(a);
							const spellCountB = this.constructor._getSpellCount(b);
							return SortUtil.ascSort(spellCountB, spellCountA);
						})[0];

						break;
					}

					// "Maximum ability score" mode
					case 2: {
						withAbil = withAbils.sort((a, b) => SortUtil.ascSort(Parser.getAbilityModNumber(mon[b.ability]), Parser.getAbilityModNumber(mon[a.ability])))[0];

						break;
					}
				}
			}

			const ab = withAbil.ability;
			const abMod = Parser.getAbilityModNumber(mon[ab]);

			this.spellAbility = ab;
			this.spellDc = abMod + this.pb;
		}

		this.spellLevel = mon.spellcasting.map(sc => ImportListCreature._getCasterLevelFromEntry(sc)).find(Boolean) || 0;
		this.spellClass = mon.spellcasting.map(sc => ImportListCreature._getCasterClassFromEntry(sc)).find(Boolean) || "";
	}

	static _getSpellCount (spellcastingItem) {
		// A hacky heuristic--simply count the number of @spell tags in the spell block. Future-proof, and
		//   mostly accurate!
		let cnt = 0;
		JSON.stringify(spellcastingItem).replace(/{@spell [^}]+}/g, () => {
			cnt++;
			return "";
		});
		return cnt;
	}
};

ImportListCreature.ScaleRename = class extends ImportCustomizer {
	/**
	 * @param dataList
	 * @param resolve
	 * @param opts Options object.
	 * @param opts.titleSearch Used in prompt text in the search bar.
	 */
	constructor (dataList, resolve, opts) {
		super(
			dataList,
			resolve,
			{
				...opts,
				title: "Scale and Rename Creatures",
				template: `${SharedConsts.MODULE_LOCATION}/template/ImportListCreatureScaleRename.hbs`,
			});
	}

	getData () {
		return {
			...super.getData(),
			rows: this._dataList.map((it, ix) => {
				const variants = this._getData_getVariants(it);

				return {
					name: it.name,
					source: it.source,
					sourceShort: Parser.sourceJsonToAbv(it.source),
					sourceLong: Parser.sourceJsonToFull(it.source),
					sourceClassName: Parser.sourceJsonToColor(it.source),
					sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),
					cr: Parser.monCrToFull(it.cr),
					isAdjustableCr: Parser.crToNumber(it.cr) < VeCt.CR_CUSTOM,
					isAdjustableSummonSpellLevel: it._summonedBySpell_levelBase != null,
					availableSummonSpellLevels: it._summonedBySpell_levelBase != null
						? [...Renderer.monster.getSelSummonSpellLevel(it).options].map(it => Number(it.value)).filter(it => ~it)
						: null,
					isAdjustableSummonClassLevel: it.summonedByClass != null,
					availableSummonClassLevels: it.summonedByClass != null
						? [...new Array(VeCt.LEVEL_MAX)].map((_, i) => ({level: i + 1, className: it.summonedByClass.split("|")[0].toTitleCase()}))
						: null,

					hasVariants: variants.length > 0,
					availableVariants: variants,

					ix,
				};
			}),
		};
	}

	_getData_getVariants (mon) {
		return this._getAvailableVariants(mon).map((it, ix) => ({ix, name: it.name}));
	}

	_getAvailableVariants (mon) {
		if (
			!mon._versions?.length
			&& !(mon.variants || []).some(it => it?._version)
			&& !Renderer.monster.dragonCasterVariant.hasCastingColorVariant(mon)
		) return [];

		const dragonCasterMeta = Renderer.monster.dragonCasterVariant.hasCastingColorVariant(mon) ? Renderer.monster.dragonCasterVariant.getMeta(mon) : null;

		return [
			...DataUtil.proxy.getVersions(mon.__prop, mon),
			dragonCasterMeta?.exampleSpellsFtd?.length
				? {
					name: "Dragons as Innate Spellcasters (FTD)",
					fnApplyVariant: this.constructor._getVariant_dragonInnateSpellcaster_ftd.bind(this.constructor),
				}
				: null,
			dragonCasterMeta?.exampleSpellsUnofficial?.length
				? {
					name: "Dragons as Innate Spellcasters (MM)",
					fnApplyVariant: this.constructor._getVariant_dragonInnateSpellcaster_mm.bind(this.constructor),
				}
				: null,
		]
			.filter(Boolean);
	}

	static _getVariant_dragonInnateSpellcaster_ftd (mon) {
		mon = MiscUtil.copy(mon);
		mon.spellcasting = [
			...(mon.spellcasting || []),
			this._getCastingColorVariantSpellcastingTrait(mon, {propExampleSpells: "exampleSpellsUnofficial"}),
		];
		return mon;
	}

	static _getVariant_dragonInnateSpellcaster_mm (mon) {
		mon = MiscUtil.copy(mon);
		mon.spellcasting = [
			...(mon.spellcasting || []),
			this._getCastingColorVariantSpellcastingTrait(mon, {propExampleSpells: "exampleSpellsFtd"}),
		];
		return mon;
	}

	_activateListeners_initList ({$html}) {
		// Init list library
		this._list = new List({
			$iptSearch: $html.find(`.search`),
			$wrpList: $html.find(`.veapp__list`),
			valueNames: ["name", "source", "cr", "ix"],
		});
		this._list.doAbsorbItems(
			this._dataList,
			{
				fnGetName: it => it.name,
				fnGetValues: it => ({source: it.source, cr: Parser.monCrToFull(it.cr)}),
				fnGetData: it => {
					const $e = $(it.ele);
					return {
						$selCr: $e.find(`[name="sel-cr"]`),
						$selSummonSpellLevel: $e.find(`[name="sel-summon-spell-level"]`),
						$selSummonClassLevel: $e.find(`[name="sel-summon-class-level"]`),
						$selVariant: $e.find(`[name="sel-variant"]`),
						$iptRename: $e.find(`[name="ipt-rename"]`),
						$cbIsNamedCreature: $e.find(`[name="cb-is-named"]`),
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
			const listValues = this._list.items.map(it => {
				return {
					ix: it.ix,
					targetCr: it.data.$selCr.length
						? Number(it.data.$selCr.val()) === -1 ? null : Number(it.data.$selCr.val())
						: null,
					targetSpellLevel: it.data.$selSummonSpellLevel.length
						? Number(it.data.$selSummonSpellLevel.val()) === -1 ? null : Number(it.data.$selSummonSpellLevel.val())
						: null,
					targetClassLevel: it.data.$selSummonClassLevel.length
						? Number(it.data.$selSummonClassLevel.val()) === -1 ? null : Number(it.data.$selSummonClassLevel.val())
						: null,
					ixVariant: it.data.$selVariant.length
						? Number(it.data.$selVariant.val()) === -1 ? null : Number(it.data.$selVariant.val())
						: null,
					rename: it.data.$iptRename.val().trim(),
					isNamedCreature: it.data.$cbIsNamedCreature.prop("checked"),
				};
			});

			const scaledMons = await Promise.all(listValues.map(async ({ix, targetCr, targetSpellLevel, targetClassLevel, ixVariant, rename, isNamedCreature}) => {
				let mon = this._dataList[ix];

				if (ixVariant != null) {
					const variants = this._getAvailableVariants(mon);

					const variant = variants[ixVariant];
					if (variant.fnApplyVariant) mon = variant.fnApplyVariant(mon);
					else mon = variant;
				}

				if (targetCr != null && targetCr !== Parser.crToNumber(mon.cr)) mon = await ScaleCreature.scale(mon, targetCr);
				else if (targetSpellLevel != null) mon = await ScaleSpellSummonedCreature.scale(mon, targetSpellLevel);
				else if (targetClassLevel != null) mon = await ScaleClassSummonedCreature.scale(mon, targetClassLevel);

				if (rename) mon = await ImportListCreature.ScaleRename._pGetRenamedMon(mon, {newName: rename, isNamedCreature});

				return mon;
			}));

			this._resolve(scaledMons);
			await this.close();
		});
	}

	static _getCastingColorVariantSpellcastingTrait (mon, {propExampleSpells}) {
		const meta = Renderer.monster.dragonCasterVariant.getMeta(mon);
		const scEntry = Renderer.monster.dragonCasterVariant.getSpellcasterDetailsPart(meta);

		return {
			name: "Innate Spellcasting",
			headerEntries: [
				scEntry,
			],
			daily: {
				"1e": meta[propExampleSpells].map(it => `{@spell ${it}}`),
			},
			ability: "cha",
		};
	}

	static _pGetRenamedMon (mon, {newName, isNamedCreature}) {
		ImportListCreature.ScaleRename._WALER_RENAME = ImportListCreature.ScaleRename._WALER_RENAME || MiscUtil.getWalker();

		mon = MiscUtil.copy(mon);

		const possibleShortName = this._getPossibleMonShortName(mon);

		const newJsonName = newName
			.replace(/\\/g, `\\\\`) // escape backslashes
			.replace(/"/g, `\\"`) // escape quotes
		;

		const reName = new RegExp(`\\b${isNamedCreature && !mon.isNamedCreature ? `the ` : ""}${mon.name.escapeRegexp()}\\b`, "gi");
		const rePossibleShortName = possibleShortName && (possibleShortName.trim() !== mon.name.toLowerCase().trim())
			? new RegExp(`\\b${isNamedCreature && !mon.isNamedCreature ? `the ` : ""}${possibleShortName.escapeRegexp()}\\b`, "g")
			: null;

		const applyTo = (prop) => {
			if (!mon[prop]) return;

			mon[prop].forEach(it => {
				ImportListCreature.ScaleRename._PROPS_SUB.forEach(propSub => {
					if (!it[propSub]) return;

					it[propSub] = ImportListCreature.ScaleRename._WALER_RENAME.walk(
						it[propSub],
						{
							string: (str) => {
								str = str.replace(reName, (...m) => {
									if (this._pGetRenamedMon_isSkipReplace({str, m, isNamedCreature})) return m[0];
									return newJsonName;
								});
								if (rePossibleShortName) {
									str = str.replace(rePossibleShortName, (...m) => {
										if (this._pGetRenamedMon_isSkipReplace({str, m, isNamedCreature})) return m[0];
										return newJsonName;
									});
								}
								return str;
							},
						},
					);
				});
			});
		};

		ImportListCreature.ScaleRename._PROPS.forEach(prop => applyTo(prop));

		mon._displayName = isNamedCreature
			? newName
			// Only adjust caps if the first character is not already caps, as a guess at the user's intentions
			: ((newName[0] === (newName[0] || "").toUpperCase()) ? newName : newName.toTitleCase());
		if (isNamedCreature) mon.isNamedCreature = true;

		return mon;
	}

	static _pGetRenamedMon_isSkipReplace ({str, m, isNamedCreature}) {
		const ixStart = m[m.length - 2];
		if (isNamedCreature && /^ lycanthropy\b/.test(str.slice(ixStart + m[0].length))) return true;
		return false;
	}

	static _getPossibleMonShortName (mon) {
		if (mon.isNamedCreature) return null;
		if (mon.shortName) return mon.shortName === true ? null : mon.shortName;

		let shortName = null;

		ImportListCreature.ScaleRename._PROPS.forEach(prop => {
			if (!mon[prop]) return;

			mon[prop].forEach(it => {
				ImportListCreature.ScaleRename._PROPS_SUB.forEach(propSub => {
					if (!it[propSub]) return;

					it[propSub] = ImportListCreature.ScaleRename._WALER_RENAME.walk(
						it[propSub],
						{
							string: (str) => {
								if (shortName) return str;

								ImportListCreature.ScaleRename._RES_SHORTNAME
									.forEach(re => {
										str.replace(re, (...m) => {
											const name = m.last().name;
											if (ImportListCreature.ScaleRename._RES_SHORTNAME_BLACKLIST.some(it => it.test(name))) return;
											shortName = name;
										});
									});

								return str;
							},
						},
					);
				});
			});
		});

		return shortName;
	}
};
ImportListCreature.ScaleRename._WALER_RENAME = null;
ImportListCreature.ScaleRename._PROPS = [
	"action",
	"bonus",
	"reaction",
	"trait",
	"legendary",
	"mythic",
	"variant",
];
ImportListCreature.ScaleRename._PROPS_SUB = [
	"entries",
	"headerEntries",
];
ImportListCreature.ScaleRename._RE_SHORTNAME_PT_VERB = `(?:is|can|starts|has|takes|targets|exhales|fails|makes)`;
ImportListCreature.ScaleRename._RE_SHORTNAME_PT_NAME = `(?<name>[a-z ]+)`;
ImportListCreature.ScaleRename._RE_SHORTNAME__IF_THE = new RegExp(`If the ${ImportListCreature.ScaleRename._RE_SHORTNAME_PT_NAME} ${ImportListCreature.ScaleRename._RE_SHORTNAME_PT_VERB}`);
ImportListCreature.ScaleRename._RE_SHORTNAME__THE = new RegExp(`The ${ImportListCreature.ScaleRename._RE_SHORTNAME_PT_NAME} ${ImportListCreature.ScaleRename._RE_SHORTNAME_PT_VERB}`);
ImportListCreature.ScaleRename._RES_SHORTNAME = [
	ImportListCreature.ScaleRename._RE_SHORTNAME__IF_THE,
	ImportListCreature.ScaleRename._RE_SHORTNAME__THE,
];
ImportListCreature.ScaleRename._RES_SHORTNAME_BLACKLIST = [
	/^target$/i,
];

export {ImportListCreature};
