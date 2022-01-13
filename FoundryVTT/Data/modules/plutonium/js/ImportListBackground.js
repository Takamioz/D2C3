import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {UtilActors} from "./UtilActors.js";
import {DataConverter} from "./DataConverter.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilApplications} from "./UtilApplications.js";
import {ImportListCharacter} from "./ImportListCharacter.js";
import {DataConverterBackground} from "./DataConverterBackground.js";
import {Charactermancer_StartingEquipment} from "./UtilCharactermancerEquipment.js";
import {
	Charactermancer_Background_Characteristics,
	Charactermancer_Background_Features,
} from "./UtilCharactermancerBackground.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ModalFilterBackgroundsFvtt} from "./UtilModalFilter.js";
import {ImportedDocument, ImportSummary} from "./ImportList.js";
import {UtilDataConverter} from "./UtilDataConverter.js";
import {UtilDocuments} from "./UtilDocuments.js";
import {AppSourceSelectorMulti} from "./AppSourceSelectorMulti.js";

class ImportListBackground extends ImportListCharacter {
	// region External
	static init () {
		this._initCreateSheetItemHook({
			prop: "background",
			importerName: "Background",
		});
	}
	// endregion

	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Backgrounds"},
			externalData,
			{
				props: ["background"],
				dirsHomebrew: ["background"],
				titleSearch: "backgrounds",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Backgrounds"],
				pageFilter: new PageFilterBackgrounds(),
				isActorRadio: true,
				page: UrlUtil.PG_BACKGROUNDS,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importBackground",
			},
		);

		this._modalFilterBackgrounds = null;
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_BACKGROUNDS,
				{
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
			...(await this._pGetSourcesHomebrew()),
		];
	}

	getData () {
		const out = {
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			cols: [
				{
					name: "Name",
					width: 4,
					field: "name",
				},
				{
					name: "Skills",
					width: 6,
					field: "skills",
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

				return {
					name: it.name,
					skills: it._skillDisplay,
					source: it.source,
					sourceShort: Parser.sourceJsonToAbv(it.source),
					sourceLong: Parser.sourceJsonToFull(it.source),
					sourceClassName: Parser.sourceJsonToColor(it.source),
					sourceStyle: BrewUtil.sourceJsonToStylePart(it.source),
					ix,
				};
			}),
		};

		if (this._actor) {
			out.isRadio = true;
		}

		return out;
	}

	_activateListeners_absorbListItems () {
		this._list.doAbsorbItems(
			this._content,
			{
				fnGetName: it => it.name,
				// values used for sorting/search
				fnGetValues: it => ({
					source: it.source,
					skills: it._skillDisplay,
					normalisedTime: it._normalisedTime,
					normalisedRange: it._normalisedRange,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._actor
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	async pSetContent (val) {
		await super.pSetContent(val);

		// Create a modal background filter such that we can handle swapping in features from other backgrounds
		this._modalFilterBackgrounds = new ModalFilterBackgroundsFvtt({
			namespace: "ImportListBackground.customFeatures",
			isRadio: true,
			allData: this._content,
		});
		await this._modalFilterBackgrounds.pPreloadHidden();
	}

	/**
	 * @param bg
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.filterValues] Saved filter values to be used instead of our own.
	 */
	async _pImportEntry (bg, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing background "${bg.name}" (from "${Parser.sourceJsonToAbv(bg.source)}")`);

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(bg, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(bg, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(bg, importOpts);
	}

	async _pImportEntry_pImportToActor (bg, importOpts) {
		// Build actor update
		const actUpdate = {
			data: {
				details: {
					background: bg.name,
				},
			},
		};

		const dataBuilderOpts = new ImportListBackground.ImportEntryOpts({
			fluff: await Renderer.background.pGetFluff(bg),
		});

		await this._pImportEntry_pImportToActor_pLoadModalFilter({bg, dataBuilderOpts});

		const formDataFeatures = bg._foundryFormDataFeatures ??
			await Charactermancer_Background_Features.pGetUserInput({
				background: bg,
				modalFilter: this._modalFilterBackgrounds,
				isUnskippable: true,
			});
		if (!formDataFeatures) return dataBuilderOpts.isCancelled = true;
		const {data: {background: bgCustomized}} = formDataFeatures;

		await this._pImportEntry_pFillProficiencies(bgCustomized, actUpdate.data, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();
		await this._pImportEntry_pFillDetails(bgCustomized, actUpdate, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();
		await this._pApplyAllAdditionalSpellsToActor({entity: bgCustomized, dataBuilderOpts});
		if (dataBuilderOpts.isCancelled) return;
		await this._pImportEntry_pFillItems(bgCustomized, actUpdate, formDataFeatures, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		// Handle starting equipment, if present
		const formDataEquipment = await this._pImportEntry_pImportToActor_pImportStartingEquipment(bg, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		// Copy over equipment's actor currency update, as required
		if (formDataEquipment?.data?.currency) MiscUtil.set(actUpdate, "data", "currency", formDataEquipment.data.currency);

		// Update actor
		await UtilDocuments.pUpdateDocument(this._actor, actUpdate);

		// Import equipment
		await Charactermancer_StartingEquipment.pImportEquipmentItemEntries(this._actor, formDataEquipment);

		// Handle feats
		await this._pImportActorAdditionalFeats(bgCustomized, importOpts, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: bg.name,
					actor: this._actor,
				}),
			],
		});
	}

	async _pImportEntry_pImportToActor_pLoadModalFilter ({bg, dataBuilderOpts}) {
		if (this._modalFilterBackgrounds) return;
		if (bg._foundryFormDataFeatures) return;

		// If we're using the importer in e.g. freestanding mode, ensure we have background data available to pull custom
		//   features from.
		const importListBackgroundSources = await this.pGetSources();
		const appSourceSelector = new AppSourceSelectorMulti({
			title: `Select Background Sources for Customizing Features`,
			filterNamespace: `ImportListBackground_filter`,
			savedSelectionKey: `ImportListBackground_savedSelection`,
			sourcesToDisplay: importListBackgroundSources,
		});

		appSourceSelector.render(true);
		const choices = await appSourceSelector.pWaitForUserInput();
		if (choices == null) return dataBuilderOpts.isCancelled = true;

		const backgroundDatas = choices.map(it => it.background || []).flat();

		this._modalFilterBackgrounds = new ModalFilterBackgroundsFvtt({
			namespace: "ImportListBackground.customFeatures",
			isRadio: true,
			allData: backgroundDatas,
		});
		await this._modalFilterBackgrounds.pPreloadHidden();
	}

	async _pImportEntry_pImportToActor_pImportStartingEquipment (bg, opts) {
		if (!bg.startingEquipment) return;

		const clsStyleData = {
			defaultData: bg.startingEquipment,
		};
		const startingEquipment = new Charactermancer_StartingEquipment({
			actor: this._actor,
			startingEquipment: clsStyleData,
			appSubTitle: bg.name,
			equiSpecialSource: bg.source,
			equiSpecialPage: bg.page,
		});
		const formData = await startingEquipment.pWaitForUserInput();
		if (formData == null) {
			opts.isCancelled = true;
			return null;
		}
		return formData;
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterBackground.pGetBackgroundItem(it, getItemOpts);
	}

	async _pImportEntry_pFillProficiencies (bg, data, dataBuilderOpts) {
		const isCustomizeSkills = !bg._foundryIsSkipCustomizeSkills && await InputUiUtil.pGetUserBoolean({
			title: `Customize Background: Skills`,
			htmlDescription: `<div class="w-640p">${Renderer.get().render(`Would you like to {@book customize your skill selection|phb|4|backgrounds|customizing a background}?<br>This allows you to choose any two skills to gain from your background, rather than gaining the defaults.`)}</div>`,
			textNo: "Use Default",
			textYes: "Customize",
		});
		dataBuilderOpts.isCustomize = dataBuilderOpts.isCustomize || !!isCustomizeSkills;

		if (isCustomizeSkills) {
			await DataConverter.pFillActorSkillData(
				MiscUtil.get(this._actor, "data", "data", "skills"),
				UtilActors.BG_SKILL_PROFS_CUSTOMIZE,
				data,
				dataBuilderOpts,
			);
		} else {
			await DataConverter.pFillActorSkillData(
				MiscUtil.get(this._actor, "data", "data", "skills"),
				bg.skillProficiencies,
				data,
				dataBuilderOpts,
			);
		}
		if (dataBuilderOpts.isCancelled) return;

		const isCustomizeLangsTools = !bg._foundryIsSkipCustomizeLanguagesTools && await InputUiUtil.pGetUserBoolean({
			title: `Customize Background: Languages & Tools`,
			htmlDescription: `<div class="w-640p">${Renderer.get().render(`Would you like to {@book customize your language and tool selection|phb|4|backgrounds|customizing a background}?<br>This allows you to choose a total of any two languages and/or tool proficiencies to gain from your background, rather than gaining the defaults.`)}</div>`,
			textNo: "Use Default",
			textYes: "Customize",
		});
		dataBuilderOpts.isCustomize = dataBuilderOpts.isCustomize || !!isCustomizeLangsTools;

		if (isCustomizeLangsTools) {
			await DataConverter.pFillActorLanguageOrToolData(
				MiscUtil.get(this._actor, "data", "data", "traits", "languages"),
				MiscUtil.get(this._actor, "data", "data", "traits", "toolProf"),
				UtilActors.LANG_TOOL_PROFS_CUSTOMIZE,
				data,
				dataBuilderOpts,
			);
		} else {
			await DataConverter.pFillActorLanguageData(
				MiscUtil.get(this._actor, "data", "data", "traits", "languages"),
				bg.languageProficiencies,
				data,
				dataBuilderOpts,
			);
			if (dataBuilderOpts.isCancelled) return;

			dataBuilderOpts.isCancelled = await DataConverter.pFillActorToolProfData(
				MiscUtil.get(this._actor, "data", "data", "traits", "toolProf"),
				bg.toolProficiencies,
				data,
			);
		}
	}

	async _pImportEntry_pFillDetails (bg, actUpdate, opts) {
		if (bg._foundryIsSkipImportCharacteristics) return;
		if (bg._foundryFormDataCharacteristics) return Charactermancer_Background_Characteristics.applyFormDataToActorUpdate(actUpdate, bg._foundryFormDataCharacteristics);
		await Charactermancer_Background_Characteristics.pFillActorCharacteristicsData(bg.entries, actUpdate, opts);
	}

	async _pImportEntry_pFillItems (bg, data, formDataFeatures, dataBuilderOpts) {
		await UtilDataConverter.pGetWithDescriptionPlugins(
			async () => {
				dataBuilderOpts.isCustomize = dataBuilderOpts.isCustomize || formDataFeatures.data?.isCustomize;

				for (const entry of formDataFeatures?.data?.entries || []) {
					dataBuilderOpts.items.push(await DataConverterBackground.pGetBackgroundFeatureItem(bg, entry, this._actor, dataBuilderOpts));
				}
			},
			{
				actorId: this._actor.id,
			},
		);

		if (dataBuilderOpts.isCancelled) return;
		await UtilActors.pAddActorItems(this._actor, dataBuilderOpts.items);
	}
}

ImportListBackground.ImportEntryOpts = class extends ImportListCharacter.ImportEntryOpts {
	constructor (opts) {
		opts = opts || {};
		super(opts);

		this.fluff = opts.fluff;
		this.isCustomize = false;
	}
};

export {ImportListBackground};
