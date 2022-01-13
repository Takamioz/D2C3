import {Vetools} from "./Vetools.js";
import {LGT} from "./Util.js";
import {Config} from "./Config.js";
import {UtilList2} from "./UtilList2.js";
import {UtilApplications} from "./UtilApplications.js";
import {UtilDataSource} from "./UtilDataSource.js";
import {ImportListCharacter} from "./ImportListCharacter.js";
import {UtilActors} from "./UtilActors.js";
import {DataConverter} from "./DataConverter.js";
import {DataConverterVehicleUpgrade} from "./DataConverterVehicleUpgrade.js";
import {ImportedDocument, ImportSummary} from "./ImportList.js";
import {UtilDocuments} from "./UtilDocuments.js";

class ImportListVehicleUpgrade extends ImportListCharacter {
	constructor (externalData) {
		externalData = externalData || {};
		super(
			{title: "Import Vehicle Upgrades"},
			externalData,
			{
				props: ["vehicleUpgrade"],
				dirsHomebrew: ["vehicleUpgrade"],
				titleSearch: "vehicle upgrades",
				sidebarTab: "items",
				gameProp: "items",
				defaultFolderPath: ["Vehicles Upgrades"],
				pageFilter: new PageFilterVehicles(),
				page: UrlUtil.PG_VEHICLES,
				isPreviewable: true,
				isDedupable: true,
				configGroup: "importVehicleUpgrade",
			},
		);
	}

	async pGetSources () {
		return [
			new UtilDataSource.DataSourceUrl(
				Config.get("ui", "isStreamerMode") ? "SRD" : "5etools",
				Vetools.DATA_URL_VEHICLES,
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
		return {
			isPreviewable: this._isPreviewable,
			titleButtonRun: this._titleButtonRun,
			titleSearch: this._titleSearch,
			cols: [
				{
					name: "Name",
					width: 8,
					field: "name",
				},
				{
					name: "Type",
					width: 2,
					field: "type",
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

				return {
					name: it.name,
					type: it.upgradeType,
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
					type: it.upgradeType,
					hash: UrlUtil.URL_TO_HASH_BUILDER[this._page](it),
				}),
				fnGetData: UtilList2.absorbFnGetData,
				fnBindListeners: it => this._isRadio
					? UtilList2.absorbFnBindListenersRadio(this._list, it)
					: UtilList2.absorbFnBindListeners(this._list, it),
			},
		);
	}

	/**
	 * @param optFeature
	 * @param importOpts Options object.
	 * @param [importOpts.isTemp] if the item should be temporary, and displayed.
	 * @param [importOpts.isCharactermancer]
	 */
	async _pImportEntry (optFeature, importOpts) {
		importOpts = importOpts || {};

		console.log(...LGT, `Importing vehicle upgrade "${optFeature.name}" (from "${Parser.sourceJsonToAbv(optFeature.source)}")`);

		if (importOpts.isTemp) return this._pImportEntry_pImportToDirectoryGeneric(optFeature, importOpts);
		if (this._actor) return this._pImportEntry_pImportToActor(optFeature, importOpts);
		return this._pImportEntry_pImportToDirectoryGeneric(optFeature, importOpts);
	}

	async _pImportEntry_pImportToActor (vehUpgrade, importOpts) {
		const actUpdate = {data: {}};
		const dataBuilderOpts = new ImportListCharacter.ImportEntryOpts({isCharactermancer: importOpts.isCharactermancer});

		// Add actor items
		await this._pImportEntry_pFillItems(vehUpgrade, actUpdate, dataBuilderOpts);
		if (dataBuilderOpts.isCancelled) return ImportSummary.cancelled();

		// Update actor
		if (Object.keys(actUpdate.data).length) await UtilDocuments.pUpdateDocument(this._actor, actUpdate);

		if (this._actor.isToken) this._actor.sheet.render();

		return new ImportSummary({
			status: UtilApplications.TASK_EXIT_COMPLETE,
			imported: [
				new ImportedDocument({
					name: vehUpgrade.name,
					actor: this._actor,
				}),
			],
		});
	}

	async _pImportEntry_pFillItems (vehUpgrade, actUpdate, dataBuilderOpts) {
		const vehUpgradeItem = await DataConverterVehicleUpgrade.pGetVehicleUpgradeItem(vehUpgrade, {isActorItem: true});
		dataBuilderOpts.items.push(vehUpgradeItem);

		const importedEmbeds = await UtilActors.pAddActorItems(this._actor, dataBuilderOpts.items);

		// region Add item effects
		const effectsToAdd = [];
		if (await DataConverterVehicleUpgrade.pHasVehicleUpgradeSideLoadedEffects(this._actor, vehUpgrade)) {
			const importedEmbed = DataConverter.getImportedEmbed(importedEmbeds, vehUpgradeItem);

			if (importedEmbed) effectsToAdd.push(...(await DataConverterVehicleUpgrade.pGetVehicleUpgradeItemEffects(this._actor, vehUpgrade, importedEmbed.document)));
		}

		await UtilActors.pAddActorEffects(this._actor, effectsToAdd);
		// endregion
	}

	_pImportEntry_pImportToDirectoryGeneric_pGetImportableData (it, getItemOpts) {
		return DataConverterVehicleUpgrade.pGetVehicleUpgradeItem(it, getItemOpts);
	}
}

export {ImportListVehicleUpgrade};
