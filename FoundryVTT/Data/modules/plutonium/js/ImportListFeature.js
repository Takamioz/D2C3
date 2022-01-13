import {LGT} from "./Util.js";
import {UtilApplications} from "./UtilApplications.js";
import {DataConverter} from "./DataConverter.js";
import {UtilActors} from "./UtilActors.js";
import {Charactermancer_AdditionalSpellsSelect} from "./UtilCharactermancerAdditionalSpells.js";
import {Consts} from "./Consts.js";
import {
	Charactermancer_AbilityScoreSelect,
	Charactermancer_FeatureOptionsSelect,
	Charactermancer_Util,
} from "./UtilCharactermancer.js";
import {ImportListCharacter} from "./ImportListCharacter.js";
import {ImportedDocument, ImportSummary} from "./ImportList.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {UtilDocuments} from "./UtilDocuments.js";

// TODO merge parts with `ImportListRace`
/**
 * A generic feature importer.
 * Note that effects are generally handled at an "actor" level, not at an "item" level. This is because, should an
 * effect depend on a choice the user made when importing (e.g. selecting "Constitution" as the ability score for the
 * "Resilience" feat), we need to be able to use this variable data. Therefore, side-loaded effects are handled,
 * generally, by the importer, as opposed to directly adding effects to the items we would import.
 * generally, by the importer, as opposed to directly adding effects to the items we would import.
 */
class ImportListFeature extends ImportListCharacter {
	// region External
	static init () {
		throw new Error(`Unimplemented!`);
	}
	// endregion

	constructor (applicationOpts, externalData, subclassOpts, featureImporterOpts) {
		super(applicationOpts, externalData, subclassOpts);

		this._titleLog = featureImporterOpts.titleLog;
	}

	static async _pGetSideData (actor, entity) {
		throw new Error(`Unimplemented!`);
	}

	static async _pGetEntityItem (actor, entity) {
		throw new Error(`Unimplemented!`);
	}

	static async _pHasSideLoadedEffects (actor, entity) {
		throw new Error("Unimplemented!");
	}

	async _pMutActorUpdateFeature (entity, actUpdate, dataBuilderOpts) {
		throw new Error("Unimplemented!");
	}

	static async _pGetDereferencedFeatureItem (feature) {
		throw new Error("Unimplemented!");
	}

	static async _pGetInitFeatureLoadeds (feature) {
		throw new Error("Unimplemented!");
	}

	/**
	 * @param entity
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.isDataOnly] If this import should simply return the data, rather than import anything.
	 * @param [importOpts.filterValues] Saved filter values to be used instead of our own.
	 * @param [importOpts.isCharactermancer]
	 * @return {*}
	 */
	async _pImportEntryBasic (entity, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing ${this._titleLog} "${entity.name}" (from "${Parser.sourceJsonToAbv(entity.source)}")`);

		if (importOpts.isDataOnly) {
			return new ImportSummary({
				status: UtilApplications.TASK_EXIT_COMPLETE_DATA_ONLY,
				imported: [
					new ImportedDocument({
						document: await this.constructor._pGetEntityItem(this._actor, entity),
						actor: this._actor,
					}),
				],
			});
		}

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(entity, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(entity, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(entity, importOpts);
	}

	/**
	 * @param feature
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.isDataOnly] If this import should simply return the data, rather than import anything.
	 * @param [importOpts.filterValues] Saved filter values to be used instead of our own.
	 * @param [importOpts.isCharactermancer]
	 *
	 * @param [importOpts.isLeaf] If this feature should be loaded directly, without any sub-loading applied.
	 * @param [importOpts.isSkippableLeaf] If this leaf feature's entries can (optionally) be skipped.
	 *
	 * @param [importOpts.isPreLoadedFeature] If the feature has already been loaded by e.g. the Class Importer.
	 * @param [importOpts.featureEntriesPageFilter]
	 * @param [importOpts.featureEntriesPageFilterValues]
	 * @param [importOpts.existingFeatureChecker]
	 * @param [importOpts.spellcastingAbilityAbv] Optional spellcasting ability for attached "additional spells."
	 *
	 * @return {*}
	 */
	async _pImportEntry (feature, importOpts) {
		importOpts = importOpts || {};

		// If there's no actor, simply de-reference all the references and use the basic import flow.
		if (!this._actor) {
			const dereferenced = await this.constructor._pGetDereferencedFeatureItem(feature);
			return this._pImportEntryBasic(dereferenced, importOpts);
		}

		// If we're a "leaf" feature, there is nothing more to load, so use the basic import flow.
		if (importOpts.isLeaf) {
			// If this is a stub feature that just contains more options, avoid importing it.
			if (importOpts.isSkippableLeaf && feature.entries?.[0]?.type === "options" && feature.entries?.length === 1) {
				return new ImportSummary({
					status: UtilApplications.TASK_EXIT_SKIPPED_OTHER,
				});
			}

			return this._pImportEntryBasic(feature, importOpts);
		}

		const pageFilter = importOpts.isPreLoadedFeature
			? importOpts.featureEntriesPageFilter
			: this._pageFilter;
		const filterValues = importOpts.isPreLoadedFeature
			? (importOpts.featureEntriesPageFilterValues)
			: (importOpts.filterValues || (await this._pGetPageFilterValues()));

		// If we're using the advanced flow, dredge up all the loadable features
		let allFeatures;
		if (importOpts.isPreLoadedFeature) {
			allFeatures = [feature];
		} else {
			const wrappedFeature = await this.constructor._pGetInitFeatureLoadeds(feature);
			allFeatures = [wrappedFeature];
		}

		// Filter down the `.loadeds` according to our current filter settings
		allFeatures = Charactermancer_Util.getFilteredFeatures(
			allFeatures,
			pageFilter,
			filterValues,
		);

		// (Should never occur)
		if (!allFeatures.length) return ImportSummary.cancelled();

		allFeatures = Charactermancer_Util.getImportableFeatures(allFeatures);

		Charactermancer_Util.doApplyFilterToFeatureEntries(
			allFeatures,
			pageFilter,
			filterValues,
		);

		const allFeaturesGrouped = Charactermancer_Util.getFeaturesGroupedByOptionsSet(allFeatures);
		const actorUpdate = {};

		for (const topLevelFeatureMeta of allFeaturesGrouped) {
			const {topLevelFeature, optionsSets} = topLevelFeatureMeta;

			for (let ixOptionSet = 0; ixOptionSet < optionsSets.length; ++ixOptionSet) {
				const optionsSet = optionsSets[ixOptionSet];

				const formDataOptionSet = await Charactermancer_FeatureOptionsSelect.pGetUserInput({
					actor: this._actor,
					optionsSet,
					level: topLevelFeature.level,
					existingFeatureChecker: importOpts.existingFeatureChecker,
					isSkipCharactermancerHandled: importOpts.isCharactermancer,
				});

				if (!formDataOptionSet) return ImportSummary.cancelled();
				if (formDataOptionSet === VeCt.SYM_UI_SKIP) continue;

				await Charactermancer_FeatureOptionsSelect.pDoApplyResourcesFormDataToActor({
					actor: this._actor,
					formData: formDataOptionSet,
				});

				for (const loaded of (formDataOptionSet.data?.features || [])) {
					const {entity, type} = loaded;

					// Remove properties which are handled in the options selection component
					const cpyEntity = MiscUtil.copy(entity);
					delete cpyEntity.additionalSpells;

					const isSkippableLeaf = ixOptionSet === 0 && optionsSets.length > 1;

					switch (type) {
						case "classFeature":
						case "subclassFeature": {
							const importResult = await this.pImportEntry(cpyEntity, {...importOpts, isLeaf: true, isSkippableLeaf});
							if (importResult?.status === UtilApplications.TASK_EXIT_CANCELLED) return importResult;
							break;
						}

						case "optionalfeature": {
							const importResult = await this._pImportEntry_pHandleGenericFeatureIndirect({
								ClassName: "ImportListOptionalFeature",
								propInstance: "_IMPORT_LIST_OPTIONAL_FEATURE",
								importOpts,
								cpyEntity,
								isSkippableLeaf,
							});
							if (importResult?.status === UtilApplications.TASK_EXIT_CANCELLED) return importResult;
							break;
						}

						case "feat": {
							const importResult = await this._pImportEntry_pHandleGenericFeatureIndirect({
								ClassName: "ImportListFeat",
								propInstance: "_IMPORT_LIST_FEAT",
								importOpts,
								cpyEntity,
								isSkippableLeaf,
							});
							if (importResult?.status === UtilApplications.TASK_EXIT_CANCELLED) return importResult;
							break;
						}

						case "reward": {
							const importResult = await this._pImportEntry_pHandleGenericFeatureIndirect({
								ClassName: "ImportListReward",
								propInstance: "_IMPORT_LIST_REWARD",
								importOpts,
								cpyEntity,
								isSkippableLeaf,
							});
							if (importResult?.status === UtilApplications.TASK_EXIT_CANCELLED) return importResult;
							break;
						}

						case "charoption": {
							const importResult = await this._pImportEntry_pHandleGenericFeatureIndirect({
								ClassName: "ImportListCharCreationOption",
								propInstance: "_IMPORT_LIST_CHAR_CREATION_OPTION",
								importOpts,
								cpyEntity,
								isSkippableLeaf,
							});
							if (importResult?.status === UtilApplications.TASK_EXIT_CANCELLED) return importResult;
							break;
						}
					}

					// Track which features we add as we import them, to warn the user against double-dipping e.g. fighting styles
					if (importOpts.existingFeatureChecker) importOpts.existingFeatureChecker.addImportFeature(loaded.page, loaded.source, loaded.hash);
				}

				await Charactermancer_FeatureOptionsSelect.pDoApplyProficiencyFormDataToActorUpdate(
					this._actor,
					actorUpdate,
					formDataOptionSet,
				);

				await Charactermancer_FeatureOptionsSelect.pDoApplyAdditionalSpellsFormDataToActor({
					actor: this._actor,
					formData: formDataOptionSet,
					abilityAbv: importOpts.spellcastingAbilityAbv,
				});
			}
		}

		await this._pDoMergeAndApplyActorUpdate(actorUpdate);

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: feature.name,
					actor: this._actor,
				}),
			],
		});
	}

	async _pImportEntry_pHandleGenericFeatureIndirect (
		{
			ClassName,
			propInstance,
			importOpts,
			cpyEntity,
			isSkippableLeaf,
		},
	) {
		const isDirectCall = this.constructor.name === ClassName;

		if (!isDirectCall && (!ImportListFeature[propInstance] || ImportListFeature[propInstance].actor !== this._actor)) {
			const name = `./${ClassName}.js`;
			const {[ClassName]: Clazz} = await import(name);
			ImportListFeature[propInstance] = new Clazz({actor: this._actor});
			await ImportListFeature[propInstance].pInit();
		}

		const importer = isDirectCall ? this : ImportListFeature[propInstance];

		const nxtOpts = {...importOpts, isLeaf: true, isSkippableLeaf};
		if (importer !== this) {
			delete nxtOpts.filterValues;
			delete nxtOpts.existingFeatureChecker;
		}

		return importer.pImportEntry(cpyEntity, nxtOpts);
	}

	async _pGetPageFilterValues () {
		// If we are importing from e.g. Rivet, we won't have the UI state
		if (!this._pageFilter.filterBox) await this._pageFilter.pInitFilterBox();
		return this._pageFilter.filterBox.getValues();
	}

	async _pImportEntry_pImportToActor (entity, importOpts) {
		// Build actor update
		const actUpdate = {data: {}};

		const dataBuilderOpts = new ImportListFeature.ImportEntryOpts({
			chosenAbilityScoreIncrease: entity._foundryChosenAbilityScoreIncrease,
			isCharactermancer: !!importOpts.isCharactermancer,
		});

		await this._pImportEntry_pImportToActor_fillFlags(entity, actUpdate, importOpts);
		await this._pImportEntry_pFillAbilities(entity, actUpdate, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();
		await this._pImportEntry_pFillTraits(entity, actUpdate.data, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		// Add actor items
		await this._pImportEntry_pFillItems(entity, actUpdate, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		// Update actor
		if (Object.keys(actUpdate.data).length) await UtilDocuments.pUpdateDocument(this._actor, actUpdate);

		// region Add any sub-entities
		// E.g. Monk's "Unarmed Strike" sub-entity for the "Martial Arts" feature
		await this._pImportEntry_pAddSubEntities(entity);
		// endregion

		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: entity.name,
					actor: this._actor,
				}),
			],
		});
	}

	_pImportEntry_pImportToActor_fillFlags (feature, actor, importOpts) {
		const flags = {};
		const flagsDnd5e = {};

		this._doPopulateFlags({feature, actor, importOpts});

		if (Object.keys(flagsDnd5e).length) flags.dnd5e = flagsDnd5e;
		if (Object.keys(flags).length) actor.flags = flags;
	}

	_doPopulateFlags ({feature, actor, importOpts, flags, flagsDnd5e}) { /* Implement as required */ }

	async _pImportEntry_pFillAbilities (feature, actUpdate, dataBuilderOpts) {
		const formData = await Charactermancer_AbilityScoreSelect.pFillActorAbilityData(this._actor, feature.ability, actUpdate, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return;

		// Pull out the chosen ability scores, so we can pass the maximum one into any potential spell population
		if (formData == null) return;
		dataBuilderOpts.chosenAbilityScoreIncrease = formData.data;
	}

	async _pImportEntry_pFillTraits (feature, data, dataBuilderOpts) {
		data.traits = {};

		await DataConverter.pFillActorImmunityData(
			MiscUtil.get(this._actor, "data", "data", "traits", "di"),
			feature.immune,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorResistanceData(
			MiscUtil.get(this._actor, "data", "data", "traits", "dr"),
			feature.resist,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorVulnerabilityData(
			MiscUtil.get(this._actor, "data", "data", "traits", "dv"),
			feature.vulnerable,
			data,
			dataBuilderOpts,
		);
		if (dataBuilderOpts.isCancelled) return;

		await DataConverter.pFillActorConditionImmunityData(
			MiscUtil.get(this._actor, "data", "data", "traits", "ci"),
			feature.conditionImmune,
			data,
			dataBuilderOpts,
		);
	}

	async _pImportEntry_pFillItems (feature, actUpdate, dataBuilderOpts) {
		await this._pMutActorUpdateFeature(feature, actUpdate, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return;

		const spellHashToItemPosMap = {};

		await this._pImportEntry_pHandleAdditionalSpells(feature, actUpdate, dataBuilderOpts, spellHashToItemPosMap);
		if (dataBuilderOpts.isCancelled) return;

		const tagHashItemIdMap = {};
		Object.entries(spellHashToItemPosMap)
			.forEach(([hash, id]) => MiscUtil.set(tagHashItemIdMap, "spell", hash, id));

		const featItem = await UtilDataConverter.pGetWithDescriptionPlugins(
			async () => {
				const featureItem = await this.constructor._pGetEntityItem(this._actor, feature);
				dataBuilderOpts.items.push(featureItem);
				return featureItem;
			},
			{
				actorId: this._actor.id,
				tagHashItemIdMap,
			},
		);

		const importedEmbeds = await UtilActors.pAddActorItems(this._actor, dataBuilderOpts.items);

		// region Add item effects
		const effectsToAdd = [];
		if (await this.constructor._pHasSideLoadedEffects(this._actor, feature)) {
			const importedEmbed = DataConverter.getImportedEmbed(importedEmbeds, featItem);

			if (importedEmbed) effectsToAdd.push(...(await this.constructor._pGetItemEffects(this._actor, feature, importedEmbed.document, dataBuilderOpts)));
		}

		await UtilActors.pAddActorEffects(this._actor, effectsToAdd);
		// endregion
	}

	async _pImportEntry_pHandleAdditionalSpells (feature, actUpdate, dataBuilderOpts, spellHashToItemPosMap) {
		const maxAbilityScoreIncrease = Object.entries(dataBuilderOpts.chosenAbilityScoreIncrease || {})
			.sort(([, vA], [, vB]) => SortUtil.ascSort(vB, vA));
		const parentAbilityAbv = maxAbilityScoreIncrease?.[0]?.[0] || null;

		const formData = await Charactermancer_AdditionalSpellsSelect.pGetUserInput({
			additionalSpells: feature.additionalSpells,
			sourceHintText: feature.name,

			// Force all levels to be added
			curLevel: 0,
			targetLevel: Consts.CHAR_MAX_LEVEL,
			spellLevelLow: 0,
			spellLevelHigh: 9,
		});

		if (formData == null) return dataBuilderOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		const totalClassLevels = UtilActors.getTotalClassLevels(this._actor);
		await Charactermancer_AdditionalSpellsSelect.pApplyFormDataToActor(
			this._actor,
			formData,
			{
				parentAbilityAbv: parentAbilityAbv,
			},
		);
	}

	async _pImportEntry_pAddSubEntities (entity) {
		await this.constructor._pGetClassSubclassFeatureAdditionalEntities(this._actor, entity);
	}

	/** Note that we assume that anything in this sub-entity data is to be imported as an item on the actor. */
	static async _pGetClassSubclassFeatureAdditionalEntities (actor, entity) {
		const sideData = await this._pGetSideData(actor, entity);
		if (!sideData) return [];
		if (!sideData.subEntities) return [];

		const {ChooseImporter} = await import("./ChooseImporter.js");

		for (const prop in sideData.subEntities) {
			if (!sideData.subEntities.hasOwnProperty(prop)) continue;

			const arr = sideData.subEntities[prop];
			if (!(arr instanceof Array)) continue;

			const importer = ChooseImporter.getImporter(prop, actor);
			await importer.pInit();
			for (const ent of arr) {
				await importer.pImportEntry(ent);
			}
		}
	}
}
ImportListFeature._IMPORT_LIST_FEAT = null;
ImportListFeature._IMPORT_LIST_OPTIONAL_FEATURE = null;
ImportListFeature._IMPORT_LIST_REWARD = null;
ImportListFeature._IMPORT_LIST_CHAR_CREATION_OPTION = null;

ImportListFeature.ImportEntryOpts = class extends ImportListCharacter.ImportEntryOpts {
	constructor (opts) {
		opts = opts || {};
		super(opts);

		this.chosenAbilityScoreIncrease = opts.chosenAbilityScoreIncrease;
	}
};

export {ImportListFeature};
