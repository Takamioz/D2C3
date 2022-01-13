import {ImportedDocument, ImportList, ImportSummary} from "./ImportList.js";
import {DataConverter} from "./DataConverter.js";
import {Vetools} from "./Vetools.js";
import {Config} from "./Config.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilActors} from "./UtilActors.js";
import {LGT} from "./Util.js";
import {Consts} from "./Consts.js";
import {UtilCompendium} from "./UtilCompendium.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {DataConverterItem} from "./DataConverterItem.js";
import {UtilGameSettings} from "./UtilGameSettings.js";
import {ConfigConsts} from "./ConfigConsts.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {UtilDocuments} from "./UtilDocuments.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";

class ImportListActor extends ImportList {
	static get FOLDER_TYPE () { return "Actor"; }

	/**
	 * @param applicationOpts
	 * @param externalData
	 * @param subclassOpts
	 * @param actorImporterOpts Options object.
	 * @param actorImporterOpts.actorType
	 */
	constructor (applicationOpts, externalData, subclassOpts, actorImporterOpts) {
		super(applicationOpts, externalData, subclassOpts);
		this._actorType = actorImporterOpts.actorType;
	}

	// region Shared
	/**
	 * @param imp
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.isDataOnly] If the item should not be imported, but its data should be returned.
	 * @param [importOpts.isImportToTempDirectory]
	 *
	 * @param [importOpts.isSkipFolder] If the folder-setting step should be skipped.
	 */
	async _pImportEntry (imp, importOpts) {
		importOpts = importOpts || {};

		if ((importOpts.isTemp || importOpts.isDataOnly) && importOpts.isImportToTempDirectory) throw new Error(`Incompatible options "isTemp"/"isDataOnly" and "isImportToTempDirectory" supplied!`);
		if (this._pack && importOpts.isImportToTempDirectory) throw new Error(`Option "isImportToTempDirectory" cannot be used in conjunction with compendium imports!`);

		console.log(...LGT, `Importing ${this._actorType} "${imp.name}" (from "${Parser.sourceJsonToAbv(imp.source)}")`);

		if (this._actor) throw new Error(`Cannot import ${this._actorType} to actor!`);

		let actor;
		const duplicateMeta = this._getDuplicateMeta({entity: imp, importOpts});
		if (duplicateMeta.isSkip) {
			return new ImportSummary({
				status: UtilApplications.TASK_EXIT_SKIPPED_DUPLICATE,
				imported: [
					new ImportedDocument({
						isExisting: true,
						document: duplicateMeta.existing,
					}),
				],
			});
		} else if (duplicateMeta.isOverwrite) {
			importOpts.isSkipFolder = true;
			actor = duplicateMeta.existing;
		} else {
			actor = this._pack
				? null
				// Create the entity, so we have access to its ID
				: await Actor.create(
					{name: Consts.ACTOR_TEMP_NAME, type: this._actorType, flags: {[SharedConsts.MODULE_NAME_FAKE]: {isImporterTempActor: true}}},
					{renderSheet: !!importOpts.isTemp, temporary: !!importOpts.isTemp},
				);
		}

		const {dataBuilderOpts, actorData} = await this._pImportEntry_pGetImportMetadata(actor, imp, importOpts);

		const additionalData = await this._pGetAdditionalData(imp);
		if (additionalData) Object.assign(actorData.data || {}, additionalData);

		const additionalFlags = await this._pGetAdditionalFlags(imp);
		if (additionalFlags) Object.assign(actorData.flags || {}, additionalFlags);

		const imgEffects = actorData.img ?? actorData.token?.img;

		if (importOpts.isTemp) {
			actor = await Actor.create({...actorData, type: this._actorType}, {renderSheet: !importOpts.isDataOnly, temporary: true});
			dataBuilderOpts.actor = actor;

			const additionalEffects = await this._pGetAdditionalEffects(imp, dataBuilderOpts.actor, imgEffects);
			if (additionalEffects?.length) dataBuilderOpts.effects.push(...additionalEffects);

			await this._pImportEntry_pFillItems(imp, actorData, dataBuilderOpts, importOpts);
			await this._pImportEntry_pApplyEffects(dataBuilderOpts, importOpts);

			// Handle any post-item item updates
			await this._pImportEntry_pHandlePostItemItemUpdates(actor, importOpts, dataBuilderOpts);

			if (importOpts.isDataOnly) {
				return new ImportSummary({
					status: UtilApplications.TASK_EXIT_COMPLETE_DATA_ONLY,
					imported: [
						new ImportedDocument({
							document: actor,
						}),
					],
				});
			}

			return new ImportSummary({
				status: UtilApplications.TASK_EXIT_COMPLETE,
				imported: [
					new ImportedDocument({
						document: actor,
					}),
				],
			});
		} else if (this._pack) {
			if (duplicateMeta.isOverwrite) {
				dataBuilderOpts.actor = actor;

				const additionalEffects = await this._pGetAdditionalEffects(imp, dataBuilderOpts.actor, imgEffects);
				if (additionalEffects?.length) dataBuilderOpts.effects.push(...additionalEffects);

				await actor.deleteEmbeddedDocuments("Item", actor.items.map(it => it.id));
				await actor.deleteEmbeddedDocuments("ActiveEffect", actor.effects.map(it => it.id));

				await this._pImportEntry_pFillItems(imp, actorData, dataBuilderOpts, importOpts);
				await this._pImportEntry_pApplyEffects(dataBuilderOpts, importOpts);

				await UtilDocuments.pUpdateDocument(actor, actorData);

				// Handle any post-item item updates (use the new actor reference, just in case)
				await this._pImportEntry_pHandlePostItemItemUpdates(actor, importOpts, dataBuilderOpts);

				await this._pImportEntry_pAddToTargetTableIfRequired([actor], duplicateMeta);

				return new ImportSummary({
					status: UtilApplications.TASK_EXIT_COMPLETE_UPDATE_OVERWRITE,
					imported: [
						new ImportedDocument({
							document: actor,
						}),
					],
				});
			} else {
				actor = await Actor.create({...actorData, type: this._actorType}, {temporary: true});
				dataBuilderOpts.actor = actor;

				const additionalEffects = await this._pGetAdditionalEffects(imp, dataBuilderOpts.actor, imgEffects);
				if (additionalEffects?.length) dataBuilderOpts.effects.push(...additionalEffects);

				await this._pImportEntry_pFillItems(imp, actorData, dataBuilderOpts, importOpts);
				await this._pImportEntry_pApplyEffects(dataBuilderOpts, importOpts);

				const actorImported = await this._pack.importDocument(actor);

				// Handle any post-item item updates; switch to using the "real" actor, which has IDs populated on items
				await this._pImportEntry_pHandlePostItemItemUpdates(actorImported, importOpts, dataBuilderOpts);

				await this._pImportEntry_pAddToTargetTableIfRequired([actor], duplicateMeta);

				return new ImportSummary({
					status: UtilApplications.TASK_EXIT_COMPLETE,
					imported: [
						new ImportedDocument({
							document: actor,
						}),
					],
				});
			}
		} else {
			const additionalEffects = await this._pGetAdditionalEffects(imp, dataBuilderOpts.actor, imgEffects);
			if (additionalEffects?.length) dataBuilderOpts.effects.push(...additionalEffects);

			// If we're updating an existing entity, strip its embedded documents, as passing in an updated
			//   `items`/`effects` array only adds items.
			if (duplicateMeta.isOverwrite) {
				await actor.deleteEmbeddedDocuments("Item", actor.items.map(it => it.id));
				await actor.deleteEmbeddedDocuments("ActiveEffect", actor.effects.map(it => it.id));
			}

			await this._pImportEntry_pFillItems(imp, actorData, dataBuilderOpts, importOpts);
			await this._pImportEntry_pApplyEffects(dataBuilderOpts, importOpts);

			// Set the actor's data
			await UtilDocuments.pUpdateDocument(actor, actorData);

			await actor.unsetFlag(SharedConsts.MODULE_NAME_FAKE, "isImporterTempActor");

			await game.actors.set(actor.id, actor);

			// Handle any post-item item updates
			await this._pImportEntry_pHandlePostItemItemUpdates(actor, importOpts, dataBuilderOpts);

			return new ImportSummary({
				status: duplicateMeta.isOverwrite ? UtilApplications.TASK_EXIT_COMPLETE_UPDATE_OVERWRITE : UtilApplications.TASK_EXIT_COMPLETE,
				imported: [
					new ImportedDocument({
						isExisting: duplicateMeta.isOverwrite,
						document: actor,
					}),
				],
			});
		}
	}

	/** Run after any item effects have been applied. */
	async _pImportEntry_pApplyEffects (dataBuilderOpts, importOpts) {
		if (!dataBuilderOpts.effects?.length) return;
		const isTemporary = importOpts.isTemp || this._pack != null;
		await UtilActors.pAddActorEffects(dataBuilderOpts.actor, dataBuilderOpts.effects, {isTemporary});
	}

	async _pImportEntry_pHandlePostItemItemUpdates (actor, importOpts, dataBuilderOpts) {
		if (!dataBuilderOpts.postItemItemUpdates) return;

		for (const pFnUpdate of dataBuilderOpts.postItemItemUpdates) {
			await pFnUpdate({
				actor,
				isTemp: importOpts.isTemp,
				isPack: this._pack != null,
				pack: this._pack,
			});
		}
	}

	_pImportEntry_pGetImportMetadata () { throw new Error(`Unimplemented!`); }

	_pImportEntry_pFillItems () { throw new Error(`Unimplemented!`); }

	_pImportEntry_pHasTokenImage (it) { return this._props.pSerialAwaitSome(prop => Vetools.pHasTokenUrl(prop, it)); }

	async _pImportEntry_pGetTokenImage (it) {
		const getters = [
			this._pImportEntry_pGetTokenImage_fromPlutonium.bind(this, it),
			this._pImportEntry_pGetTokenImage_fromFoundry.bind(this, it),
		];
		if (Config.get("import", "isPreferFoundryTokens")) getters.reverse();

		for (const getter of getters) {
			const url = await getter();
			if (url) return url;
		}

		return Vetools.getBlankTokenUrl();
	}

	async _pImportEntry_pGetTokenImage_fromPlutonium (it) {
		const prop = await this._props.pSerialAwaitFind(prop => Vetools.pHasTokenUrl(prop, it));
		if (prop) return Vetools.pGetTokenUrl(prop, it);
	}

	async _pImportEntry_pGetTokenImage_fromFoundry (it) {
		return this._pGetCompendiumToken(it);
	}
	// endregion

	// region Base data
	/**
	 * @param imp
	 * @param act
	 * @param fluff
	 * @param [opts]
	 * @param [opts.isUseTokenImageAsPortrait]
	 * @param [opts.img]
	 */
	async _pImportEntry_pFillBase (imp, act, fluff, opts) {
		opts = opts || {};

		act.name = this._getActorSheetName(imp);

		act.img = opts.img || (await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await this._pImportEntry_pFillBase_pGetPortraitImagePath(imp, fluff, opts),
		));
		act.type = this._actorType;

		act.flags = this._getActorFlags(imp);
	}

	async _pImportEntry_pFillBase_pGetPortraitImagePath (imp, fluff, opts) {
		if (imp.foundryImg) return imp.foundryImg;

		const getters = [
			this._pImportEntry_pFillBase_pGetPortraitImagePath_fromPlutonium.bind(this, imp, fluff, opts),
			this._pImportEntry_pFillBase_pGetPortraitImagePath_fromFoundry.bind(this, imp, opts),
		];
		if (Config.get("import", "isPreferFoundryImages")) getters.reverse();

		for (const getter of getters) {
			const url = await getter();
			if (url) return url;
		}

		return this._pImportEntry_pGetTokenImage(imp); // fallback on 5etools default "blank token"
	}

	async _pImportEntry_pFillBase_pGetPortraitImagePath_fromPlutonium (it, fluff, opts) {
		const fromFluff = opts.isUseTokenImageAsPortrait ? null : await Vetools.pGetImageUrlFromFluff(fluff);
		if (fromFluff) return fromFluff;

		if (await this._pImportEntry_pHasTokenImage(it)) return this._pImportEntry_pGetTokenImage(it);
	}

	async _pImportEntry_pFillBase_pGetPortraitImagePath_fromFoundry (it, opts) {
		const fromCompendium = opts.isUseTokenImageAsPortrait ? null : await this._pImportEntry_pFillBase_pGetCompendiumImage(it);
		if (fromCompendium) return fromCompendium;

		return this._pGetCompendiumToken(it);
	}

	async _pImportEntry_pFillFolder (it, act, importOpts) {
		if (importOpts.isSkipFolder) return;

		if (importOpts.isImportToTempDirectory) {
			const folderId = await this._pImportEntry_pCreateTempDirectoryGetId();
			if (folderId) act.folder = folderId;
			return;
		}

		if (importOpts.isTemp || this._pack) return;

		const folderId = await this._pImportEntry_pGetFolderId(it);
		if (folderId) act.folder = folderId;
	}

	_getActorSheetName (it) {
		return UtilDataConverter.getNameWithSourcePart(it);
	}

	_getActorFlags (it) {
		return {
			[SharedConsts.MODULE_NAME_FAKE]: {
				page: this._page,
				source: it.source,
				hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
			},
		};
	}

	async _pImportEntry_pFillBase_pGetCompendiumImage (it) {
		for (const prop of this._props) {
			const fromCompendium = await UtilCompendium.pGetCompendiumImage(prop, it);
			// Avoid using the default "mystery-man" image
			if (fromCompendium && !fromCompendium.toLowerCase().includes("mystery-man.svg")) return fromCompendium;
		}
		return null;
	}

	async _pGetCompendiumToken (it) {
		for (const prop of this._props) {
			const dataFromCompendium = await UtilCompendium.getSrdCompendiumEntity(prop, it);
			const tokenUrl = dataFromCompendium?.token?.img;
			// Avoid using the default "mystery-man" image
			if (tokenUrl && !tokenUrl.toLowerCase().includes("mystery-man.svg")) return tokenUrl;
		}
		return null;
	}
	// endregion

	// region Token data
	async _pImportEntry_pFillToken ({importable, actor, img = null}) {
		let dimensions = 1;
		switch (importable.size || SZ_MEDIUM) {
			case "T": dimensions = 0.5; break;
			case "L": dimensions = 2; break;
			case "H": dimensions = 3; break;
			case "G": dimensions = 4; break;
		}

		let maxDimSight = 0;
		let maxBrightSight = 0;
		(importable.senses || []).forEach(sens => {
			sens = sens.replace(Parser._numberCleanRegexp, "");
			const mSense = /(blindsight|darkvision|tremorsense|truesight)\s*(\d+)/i.exec(sens);
			if (mSense) {
				const num = Number(mSense[2]);
				switch (mSense[1]) {
					case "darkvision": maxDimSight = Math.max(maxDimSight, num); break;
					case "blindsight":
					case "tremorsense":
					case "truesight": maxBrightSight = Math.max(maxBrightSight, num); break;
				}
			}
		});

		maxDimSight = Config.getMetricNumber({configGroup: this._configGroup, configKey: "isTokenMetric", originalValue: maxDimSight || 0, originalUnit: "ft"});
		maxBrightSight = Config.getMetricNumber({configGroup: this._configGroup, configKey: "isTokenMetric", originalValue: maxBrightSight || 0, originalUnit: "ft"});

		actor.token = {
			...this.constructor._getMergedTokenData({configGroup: this._configGroup, maxDimSight, maxBrightSight}),
			name: UtilApplications.getCleanEntityName(importable._displayName || importable.name),
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				img || (await this._pImportEntry_pGetTokenImage(importable)),
				{imageType: "token"},
			),
			width: dimensions,
			height: dimensions,
			elevation: 0,
			rotation: 0,

			actorLink: false,
			actorData: {},
			flags: {},
			effects: [],
			randomImg: false,
		};
	}

	static _getMergedTokenData ({configGroup, maxDimSight, maxBrightSight}) {
		const out = UtilGameSettings.getSafe("core", "defaultToken") || {};

		if (Config.get(configGroup, "tokenNameDisplay") !== ConfigConsts.C_USE_GAME_DEFAULT) out.displayName = Config.get(configGroup, "tokenNameDisplay");

		if (Config.get(configGroup, "tokenIsAddVision") !== ConfigConsts.C_USE_GAME_DEFAULT) out.vision = Config.get(configGroup, "tokenIsAddVision") === ConfigConsts.C_BOOL_ENABLED;

		if (Config.get(configGroup, "tokenDisposition") !== ConfigConsts.C_USE_GAME_DEFAULT) out.disposition = Config.get(configGroup, "tokenDisposition");

		if (Config.get(configGroup, "tokenBarDisplay") !== ConfigConsts.C_USE_GAME_DEFAULT) out.displayBars = Config.get(configGroup, "tokenBarDisplay");
		if (Config.get(configGroup, "tokenBar1Attribute") !== ConfigConsts.C_USE_GAME_DEFAULT) MiscUtil.set(out, "bar1", "attribute", Config.get(configGroup, "tokenBar1Attribute"));
		if (Config.get(configGroup, "tokenBar2Attribute") !== ConfigConsts.C_USE_GAME_DEFAULT) MiscUtil.set(out, "bar2", "attribute", Config.get(configGroup, "tokenBar2Attribute"));

		if (Config.get(configGroup, "tokenDimSight") !== ConfigConsts.C_USE_GAME_DEFAULT) out.dimSight = maxDimSight;
		if (Config.get(configGroup, "tokenBrightSight") !== ConfigConsts.C_USE_GAME_DEFAULT) out.brightSight = maxBrightSight;

		// region No default setting available
		if (Config.get(configGroup, "tokenScale") != null) out.scale = Config.get(configGroup, "tokenScale");
		// endregion

		// region Unused/use sensible defaults

		// lockRotation: false,
		// dimLight: 0,
		// brightLight: 0,
		// sightAngle: 360,
		// lightAngle: 360,

		// endregion

		return out;
	}
	// endregion

	// region Ability data
	_pImportEntry_fillData_Abilities (imp, data, impOpts) {
		const out = {};

		Parser.ABIL_ABVS.forEach(ab => {
			const score = imp[ab] ?? 0;

			const mod = Parser.getAbilityModNumber(score);

			const {profType, bonusCheck} = this._pImportEntry_fillData_getAbilitySaveMeta({imp, impOpts, score, ab});

			out[ab] = {
				value: score,
				proficient: profType ?? 0,
				mod,
				bonuses: {
					check: bonusCheck ?? "",
					save: "",
				},
			};
		});

		data.abilities = out;
	}

	_pImportEntry_fillData_getAbilitySaveMeta ({imp, impOpts, score, ab}) {
		if (!imp.save?.[ab]) return {};

		const mSave = /^\s*(?<number>[-+]?\s*\d+)\s*(?:[-+]|$)/.exec(`${imp.save[ab]}`);
		if (!mSave) return {};

		const saveNum = Number(mSave.groups.number.replace(/\s+/g, ""));

		const abMod = Parser.getAbilityModNumber(score);

		// If the bonus matches the expected ability mod number exactly, it's not really a bonus, so bail out
		if (saveNum === abMod) return {};

		const profValue = abMod + (impOpts.assumedPb || impOpts.pb);
		const expertValue = abMod + (2 * (impOpts.assumedPb || impOpts.pb));

		if (profValue === saveNum) return {profType: 1};
		if (expertValue === saveNum) return {profType: 2};

		// region If no proficiency matches exactly with our expected output, fill in the gap with a bonus
		// Default to the closest value, and fill the missing difference with a bonus
		const profType = saveNum >= expertValue ? 2 : saveNum >= profValue ? 1 : 0;
		return {
			profType,
			bonusCheck: profType === 0 ? saveNum : profType === 1 ? saveNum - profValue : saveNum - expertValue,
		};
		// endregion
	}
	// endregion

	// region Details
	async _pGetBiographyValue (entity, fluff, {isImportText, isImportImages, additionalHtml} = {}) {
		if (
			(!isImportText && !isImportImages && !additionalHtml)
			|| ![fluff?.entries && isImportText, fluff?.images && isImportImages, additionalHtml].some(Boolean)
		) return "";

		return UtilDataConverter.pGetWithDescriptionPlugins(() => {
			return [
				isImportImages && fluff?.images?.length
					? Renderer.get().setFirstSection(true).render({type: "entries", entries: [fluff.images[0]]})
					: null,
				isImportText && fluff?.entries?.length
					? Renderer.utils.getFluffTabContent({entity, fluff, isImageTab: false})
					: null,
				additionalHtml || null,
				isImportImages && fluff?.images && fluff?.images.length > 1
					? Renderer.get().setFirstSection(true).render({type: "entries", entries: [...fluff.images.slice(1)]})
					: null,
			].filter(Boolean).join("");
		});
	}
	// endregion

	// region Traits
	_pImportEntry_fillConditionsDamage (ent, dataTraits) {
		Object.assign(dataTraits, DataConverter.getActorDamageResImmVulnConditionImm(ent));
	}
	// endregion

	// region Items
	async _pFillWeaponItem (
		entity,
		act,
		action,
		dataBuilderOpts,
		{
			offensiveAbility,
			damageParts,
			formula,
			rangeShort,
			rangeLong,
			actionType,
			isProficient,
			description,
			saveAbility,
			saveDc,
			saveScaling,
			attackBonus,
			_foundryData,
			foundryData,
			_foundryFlags,
			foundryFlags,
			img,
			isSiegeWeapon,
			isMagical,
		},
	) {
		const weaponDetails = await DataConverterItem.pGetActionWeaponDetails({size: entity.size, action, damageParts, isSiegeWeapon, isMagical});
		const combinedFoundryData = DataConverter.getCombinedFoundryData(foundryData, _foundryData);
		const combinedFoundryFlags = DataConverter.getCombinedFoundryFlags(foundryFlags, _foundryFlags);

		const itemData = {
			name: UtilApplications.getCleanEntityName(Renderer.stripTags(action.name || "") || " "),
			type: "weapon",
			data: {
				source: UtilDataConverter.getSourceWithPagePart(entity),
				description: {value: description},

				damage: {
					parts: weaponDetails.damageParts,
					versatile: weaponDetails.damageVersatile,
				},

				range: {
					value: rangeShort,
					long: rangeLong,
					units: "ft",
				},
				actionType: actionType,
				proficient: isProficient,

				quantity: 1,
				weight: weaponDetails.weight,
				price: weaponDetails.price,
				rarity: weaponDetails.rarity,

				weaponType: weaponDetails.weaponType,
				baseItem: weaponDetails.weaponBaseItem,
				properties: weaponDetails.itemProperties,

				attuned: weaponDetails.attuned,
				// Force attune items if they have attunement requirements
				attunement: weaponDetails.attunement ? CONFIG.DND5E.attunementTypes.ATTUNED : weaponDetails.attunement,
				ability: offensiveAbility,
				equipped: true,
				identified: weaponDetails.identified,
				activation: {
					type: "action",
					cost: 1,
					condition: "",
				},
				duration: {
					value: null,
					units: "",
				},
				target: {
					value: null,
					units: "",
					type: "",
				},
				uses: {
					value: 0,
					max: 0,
					per: null,
				},
				attackBonus: attackBonus || weaponDetails.attackBonus || null, // Prefer a custom bonus, if we have one
				chatFlavor: "",
				critical: {
					damage: weaponDetails.damageCritical,
					threshold: weaponDetails.critThreshold,
				},

				formula,
				save: {
					ability: saveAbility,
					dc: saveDc,
					scaling: saveScaling,
				},

				...(combinedFoundryData || {}),
			},
			img: await Vetools.pOptionallySaveImageToServerAndGetUrl(
				weaponDetails.img || img,
			),
			flags: {
				...(combinedFoundryFlags || {}),
			},
			effects: [],
		};

		dataBuilderOpts.items.push(itemData);

		return itemData;
	}

	_getSavingThrowData (strEntries) {
		if (!strEntries) return MiscUtil.copy(ImportListActor._DEFAULT_SAVING_THROW_DATA);

		let isFoundParse = false;
		let {
			saveAbility,
			saveScaling,
			saveDc,
		} = MiscUtil.copy(ImportListActor._DEFAULT_SAVING_THROW_DATA);

		const mDc = /(?:{@dc (\d+)}|DC\s*(\d+))\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i.exec(strEntries);
		if (mDc) {
			saveDc = Number(mDc[1] || mDc[2]);
			saveAbility = mDc[3].toLowerCase().substring(0, 3);

			saveScaling = "flat";

			isFoundParse = true;
		}

		return {saveAbility, saveScaling, saveDc, isFoundParse};
	}
	// endregion

	// region Additional data/flags
	async _pGetAdditionalData (ent) { return this._pGetAdditionalDataOrFlags(ent, "data"); }
	async _pGetAdditionalFlags (ent) { return this._pGetAdditionalDataOrFlags(ent, "flags"); }

	async _pGetAdditionalDataOrFlags (ent, mode) {
		if (!this._propsBrewAdditionalData?.length || !this._fnLoadSideData) return null;

		const out = {};

		for (const {prop, propBrewAdditionalData} of this._propGroups) {
			const outSub = mode === "data"
				? await DataConverter.pGetAdditionalData_(ent, {propBrew: propBrewAdditionalData, fnLoadJson: this._fnLoadSideData, propJson: prop})
				: await DataConverter.pGetAdditionalFlags_(ent, {propBrew: propBrewAdditionalData, fnLoadJson: this._fnLoadSideData, propJson: prop});
			if (outSub) Object.assign(out, outSub);
		}

		return Object.keys(out).length ? out : null;
	}
	// endregion

	// region Additional effects
	async _pGetAdditionalEffects (imp, actor, img) {
		if (!this._propsBrewAdditionalData?.length || !this._fnLoadSideData) return null;

		const out = [];

		for (const {prop, propBrewAdditionalData} of this._propGroups) {
			const outSubRaw = await DataConverter.pGetAdditionalEffectsRaw_(imp, {propBrew: propBrewAdditionalData, fnLoadJson: this._fnLoadSideData, propJson: prop});
			if (outSubRaw?.length) {
				const outSub = UtilActiveEffects.getExpandedEffects(outSubRaw || [], {actor, parentName: imp._displayName || imp.name, img});
				if (outSub?.length) out.push(...outSub);
			}
		}

		return out.length ? out : null;
	}
	// endregion
}
ImportListActor._DEFAULT_SAVING_THROW_DATA = {
	saveAbility: "",
	saveScaling: "spell",
	saveDc: null,
};

ImportListActor.ImportEntryOpts = class {
	constructor (opts) {
		opts = opts || {};

		this.actor = opts.actor;
		this.fluff = opts.fluff;

		this.items = []; // To be filled
		this.effects = []; // To be filled
		this.postItemItemUpdates = []; // Update that will be applied after all item updates have been made.
	}
};

export {ImportListActor};
