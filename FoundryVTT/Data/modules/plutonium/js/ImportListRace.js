import {LGT} from "./Util.js";
import {Vetools} from "./Vetools.js";
import {UtilActors} from "./UtilActors.js";
import {DataConverter} from "./DataConverter.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {DataConverterRace} from "./DataConverterRace.js";
import {UtilApplications} from "./UtilApplications.js";
import {Charactermancer_AbilityScoreSelect} from "./UtilCharactermancer.js";
import {
	Charactermancer_Race_SizeSelect,
	Charactermancer_Race_Util,
} from "./UtilCharactermancerRace.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListCharacter} from "./ImportListCharacter.js";
import {ImportedDocument, ImportSummary, ImportCustomizer} from "./ImportList.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilDocuments} from "./UtilDocuments.js";

// TODO merge parts with `ImportListFeature`
class ImportListRace extends ImportListCharacter {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "race",
			importerName: "Race",
		});
	}
	// endregion

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Races"},
			externalData,
			{
				props: ["race"],
				dirsHomebrew: ["race", "subrace"],
				titleSearch: "races",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Races"],
				pageFilter: new PageFilterRaces(),
				isActorRadio: true,
				page: UrlUtil.PG_RACES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importRace",
			},
		);
	}

	async _pPostLoad (raceList, fileData) {
		return Charactermancer_Race_Util.pPostLoadBrew(fileData);
	}

	async pGetSources () {
		const nonVetoolsOpts = {pPostLoad: this._pPostLoad.bind(this)};

		return [
			new UtilDataSource.DataSourceSpecial(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				async () => (await Vetools.pGetRaces()).race,
				{
					cacheKey: `5etools-races`,
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
			isRadio: this._isRadio,
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			buttonsAdditional: [
				this._content.some(it => it._versions) ? {
					name: "btn-run-mods",
					text: "Import Version",
				} : null,
			].filter(Boolean),
			cols: [
				{
					name: "Name",
					width: 4,
					field: "name",
				},
				{
					name: "Ability",
					width: 5,
					field: "ability",
				},
				{
					name: "Size",
					width: 1,
					field: "size",
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
				it._vAbility = it.ability ? Renderer.getAbilityData(it.ability).asTextShort : "None";
				it._vSize = (it.size || [SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/");
				// endregion

				return {
					name: it.name,
					ability: it._vAbility,
					size: it._vSize,
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

	_activateListeners_absorbListItems () {
		this._list.doAbsorbItems(
			this._content,
			{
				fnGetName: it => it.name,
				// values used for sorting/search
				fnGetValues: it => ({
					source: it.source,
					ability: it._vAbility,
					size: it._vSize,
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
			const detailer = new ImportListRace.ImportCustomizer(entries, resolve, {titleSearch: this._titleSearch, isActor: !!this._actor});
			detailer.render(true);
		});
	}

	/**
	 * @param race
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.filterValues] Saved filter values to be used instead of our own.
	 * @param [importOpts.isCharactermancer]
	 * @return *
	 */
	async _pImportEntry (race, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing race "${race.name}" (from "${Parser.sourceJsonToAbv(race.source)}")`);

		if (DataConverterRace.isStubRace(race)) return ImportSummary.completedStub();

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(race, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(race, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(race, importOpts);
	}

	async _pImportEntry_pImportToActor (race, importOpts) {
		race = await this._pImportEntry_getUserVersion(race);

		// Build actor update
		const actUpdate = {
			data: {
				details: {
					race: race.name,
				},
			},
			token: {},
		};

		const level = MiscUtil.get(this._actor, "data", "data", "details", "level", "value") || 1;
		const dataBuilderOpts = new ImportListRace.ImportEntryOpts({
			isCharactermancer: importOpts.isCharactermancer,
			pb: Math.floor((level - 1) / 4) + 2,
		});

		this._pImportEntry_fillFlags(race, actUpdate, dataBuilderOpts);
		await this._pImportEntry_pFillAbilities(race, actUpdate, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();
		this._pImportEntry_fillAttributes(race, actUpdate.data, dataBuilderOpts);
		await this._pImportEntry_pFillSkillsAndTraits(race, actUpdate.data, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();
		await this._pImportEntry_fillToken(race, actUpdate.token, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		// Add actor items
		await this._pImportEntry_pFillItems(race, actUpdate, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		// Update actor
		await UtilDocuments.pUpdateDocument(this._actor, actUpdate);

		if (this._actor.isToken) this._actor.sheet.render();

		// Handle feats
		await this._pImportActorAdditionalFeats(race, importOpts, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: race.name,
					actor: this._actor,
				}),
			],
		});
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterRace.pGetRaceItem(it, getItemOpts);
	}

	_pImportEntry_fillFlags (race, act, dataBuilderOpts) {
		const flags = {};
		const flagsDnd5e = {};

		const hasPowerfulBuild = (race.traitTags && race.traitTags.includes("Powerful Build"))
			|| race.entries.some(it => it.name === "Powerful Build");
		if (hasPowerfulBuild) flagsDnd5e.powerfulBuild = true;

		if (race.entries.some(it => it.name === "Savage Attacks")) flagsDnd5e.savageAttacks = true;
		if (race.entries.some(it => it.name === "Lucky") && race._baseName === "Halfling") flagsDnd5e.halflingLucky = true;

		if (Object.keys(flagsDnd5e).length) flags.dnd5e = flagsDnd5e;
		if (Object.keys(flags).length) act.flags = flags;
	}

	async _pImportEntry_pFillAbilities (race, actUpdate, dataBuilderOpts) {
		await Charactermancer_AbilityScoreSelect.pFillActorAbilityData(this._actor, race.ability, actUpdate, dataBuilderOpts);
	}

	_pImportEntry_fillAttributes (race, data, dataBuilderOpts) {
		const out = {};

		if (race.speed != null) out.movement = DataConverter.getMovement(race.speed, {configGroup: "importRace"});

		if (race.darkvision && race.darkvision > (this._actor.data.data.attributes?.senses?.darkvision || 0)) {
			out.senses = {
				darkvision: race.darkvision,
				units: "ft",
			};
		}

		data.attributes = out;
	}

	async _pImportEntry_pFillSkillsAndTraits (race, data, dataBuilderOpts) {
		data.traits = {};

		await this._pImportEntry_pHandleSize(race, data, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return;

		// region Skills, tools, and languages
		// Run these as distinct steps
		await DataConverter.pFillActorSkillToolLanguageData(
			{
				existingProficienciesSkills: MiscUtil.get(this._actor, "data", "data", "skills"),
				existingProficienciesTools: MiscUtil.get(this._actor, "data", "data", "traits", "toolProf"),
				existingProficienciesLanguages: MiscUtil.get(this._actor, "data", "data", "traits", "languages"),
				skillToolLanguageProficiencies: race.skillToolLanguageProficiencies,
				actorData: data,
				importOpts: dataBuilderOpts,
			},
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorSkillData(
			MiscUtil.get(this._actor, "data", "data", "skills"),
			race.skillProficiencies,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorLanguageData(
			MiscUtil.get(this._actor, "data", "data", "traits", "languages"),
			race.languageProficiencies,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorToolProfData(
			MiscUtil.get(this._actor, "data", "data", "traits", "toolProf"),
			race.toolProficiencies,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorArmorProfData(
			MiscUtil.get(this._actor, "data", "data", "traits", "armorProf"),
			race.armorProficiencies,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorWeaponProfData(
			MiscUtil.get(this._actor, "data", "data", "traits", "weaponProf"),
			race.weaponProficiencies,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorImmunityData(
			MiscUtil.get(this._actor, "data", "data", "traits", "di"),
			race.immune,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorResistanceData(
			MiscUtil.get(this._actor, "data", "data", "traits", "dr"),
			race.resist,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorVulnerabilityData(
			MiscUtil.get(this._actor, "data", "data", "traits", "dv"),
			race.vulnerable,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorConditionImmunityData(
			MiscUtil.get(this._actor, "data", "data", "traits", "ci"),
			race.conditionImmune,
			data,
			dataBuilderOpts,
		);

		await DataConverter.pFillActorExpertiseData(
			{
				existingProficienciesSkills: MiscUtil.get(this._actor, "data", "data", "skills"),
				existingProficienciesTools: MiscUtil.get(this._actor, "data", "data", "traits", "toolProf"),
				expertise: race.expertise,
				actorData: data,
				importOpts: dataBuilderOpts,
			},
		);
	}

	_pImportEntry_fillToken (race, token, dataBuilderOpts) {
		let {dimSight: curDimSight} = this._actor.data.token || {};
		if (curDimSight === 999) curDimSight = 0; // This is the default for newly created actors--override it
		if (!curDimSight) curDimSight = 0;
		if (isNaN(curDimSight)) curDimSight = 0;
		curDimSight = Number(curDimSight);

		// Ensure token sight is reset if it's a junk value
		if (!curDimSight) token.dimSight = curDimSight;
		token.vision = true;

		// Upgrade dim sight if there's an existing value, and ours beats it
		if (race.darkvision) {
			if (curDimSight < race.darkvision) token.dimSight = race.darkvision;
		}
	}

	static _isSkippableFeature (ent) {
		if (typeof ent === "string") return true; // Skip pure string entries; these are notes.
		if (!ent.name) return true; // Skip un-named entries, e.g. Tortle "AL" note
		if (ent.name === "Size") return true; // Skip "Size" entries
		return false;
	}

	async _pImportEntry_pFillItems (race, actUpdate, dataBuilderOpts) {
		const spellHashToItemPosMap = {};

		const raceFeaturesRequiresEffects = [];

		await this._pApplyAllAdditionalSpellsToActor({entity: race, dataBuilderOpts, spellHashToItemPosMap});
		if (dataBuilderOpts.isCancelled) return;

		// region Race Features
		for (const ent of race.entries) {
			if (this.constructor._isSkippableFeature(ent)) continue;

			const fauxRaceFeature = DataConverterRace.getFauxRaceFeature(race, ent);
			await DataConverterRace.pMutActorUpdateRaceFeature(this._actor, actUpdate, fauxRaceFeature, dataBuilderOpts);
			if (dataBuilderOpts.isCancelled) return;
		}

		const tagHashItemIdMap = {};
		Object.entries(spellHashToItemPosMap)
			.forEach(([hash, id]) => MiscUtil.set(tagHashItemIdMap, "spell", hash, id));

		await UtilDataConverter.pGetWithDescriptionPlugins(
			async () => {
				for (const ent of race.entries) {
					if (this.constructor._isSkippableFeature(ent)) continue;

					const fauxRaceFeature = DataConverterRace.getFauxRaceFeature(race, ent);

					const raceFeatureItem = await DataConverterRace.pGetRaceFeatureItem(race, fauxRaceFeature, {actor: this._actor});
					dataBuilderOpts.items.push(raceFeatureItem);

					if (await DataConverterRace.pHasRaceFeatureSideLoadedEffects(this._actor, fauxRaceFeature)) {
						raceFeaturesRequiresEffects.push(
							new ImportListRace.RaceFeatureRequiresEffects({
								actor: this._actor,
								raceFeature: fauxRaceFeature,
								itemData: raceFeatureItem,
							}),
						);
					}
				}
			},
			{
				actorId: this._actor.id,
				tagHashItemIdMap,
			},
		);
		// endregion

		const importedEmbeds = await UtilActors.pAddActorItems(this._actor, dataBuilderOpts.items);

		// region Add item effects
		const effectsToAdd = [];
		if (raceFeaturesRequiresEffects.length) {
			for (const raceFeatureRequiresEffects of raceFeaturesRequiresEffects) {
				const importedEmbed = DataConverter.getImportedEmbed(importedEmbeds, raceFeatureRequiresEffects.itemData);

				if (!importedEmbed) continue;

				effectsToAdd.push(...(await DataConverterRace.pGetRaceFeatureItemEffects(this._actor, race, raceFeatureRequiresEffects.raceFeature, importedEmbed.document)));
			}
		}

		await UtilActors.pAddActorEffects(this._actor, effectsToAdd);
		// endregion
	}

	async _pImportEntry_pHandleSize (race, actUpdate, dataBuilderOpts) {
		const formData = await Charactermancer_Race_SizeSelect.pGetUserInput({
			sizes: race.size,
		});

		if (formData == null) return dataBuilderOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		actUpdate.traits.size = UtilActors.VET_SIZE_TO_ABV[formData.data || SZ_MEDIUM] || "med";
	}
}

ImportListRace.ImportEntryOpts = class extends ImportListCharacter.ImportEntryOpts {
	constructor (opts) {
		opts = opts || {};
		super(opts);

		this.pb = opts.pb;
	}
};

ImportListRace.RaceFeatureRequiresEffects = class {
	/**
	 * Represents a tuple of: <loaded 5etools raceFeature>, <raw Foundry sheet item data>
	 * @param actor
	 * @param raceFeature
	 * @param itemData Sheet item data, which we expect will be loaded as an embedded item.
	 */
	constructor ({actor, raceFeature, itemData}) {
		this.actor = actor;
		this.raceFeature = raceFeature;
		this.itemData = itemData;
	}
};

ImportListRace.ImportCustomizer = class extends ImportCustomizer {
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
				template: `${SharedConsts.MODULE_LOCATION}/template/ImportListRaceCustomizer.hbs`,
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

				hasVersions: it._versions?.length,
				availableVersions: DataUtil.proxy.getVersions(it.__prop, it).map((ver, ix) => ({ix, name: ver.name})),

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
						$selVersion: $e.find(`[name="sel-version"]`),
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
				const ixVersion = it.data.$selVersion.length
					? Number(it.data.$selVersion.val()) === -1 ? null : Number(it.data.$selVersion.val())
					: null;

				if (!~ixVersion) return this._dataList[it.ix];

				const versions = DataUtil.proxy.getVersions(this._dataList[it.ix]?.__prop, this._dataList[it.ix]);
				return versions[ixVersion];
			});

			this._resolve(toImport);
			this.close();
		});
	}
};

export {ImportListRace};
