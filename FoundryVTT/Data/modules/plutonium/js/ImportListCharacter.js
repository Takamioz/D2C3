import {ImportList} from "./ImportList.js";
import {Charactermancer_AdditionalSpellsSelect} from "./UtilCharactermancerAdditionalSpells.js";
import {UtilActors} from "./UtilActors.js";
import {Consts} from "./Consts.js";
import {UtilDocuments} from "./UtilDocuments.js";
import {Charactermancer_AdditionalFeatsSelect} from "./UtilCharactermancerAdditionalFeats.js";

class ImportListCharacter extends ImportList {
	// FIXME(Future) this does't actually track spell IDs
	async _pApplyAllAdditionalSpellsToActor ({entity, dataBuilderOpts}) {
		const formData = await Charactermancer_AdditionalSpellsSelect.pGetUserInput({
			additionalSpells: entity.additionalSpells,
			sourceHintText: entity.name,

			// Force all levels to be added
			curLevel: 0,
			targetLevel: Consts.CHAR_MAX_LEVEL,
			spellLevelLow: 0,
			spellLevelHigh: 9,
		});

		if (formData == null) return dataBuilderOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		await Charactermancer_AdditionalSpellsSelect.pApplyFormDataToActor(this._actor, formData);
	}

	// region Update merging
	/** Ensure any proficiencies that have been added during an import are maintained. */
	async _pDoMergeAndApplyActorUpdate (actorUpdate) {
		if (!Object.keys(actorUpdate).length) return;

		this._doMergeExistingSkillData({actorUpdate});
		this._doMergeExistingOtherProficiencyData({actorUpdate});
		this._doMergeExistingDiDrDvCiData({actorUpdate});
		await UtilDocuments.pUpdateDocument(this._actor, actorUpdate);
	}

	_doMergeExistingSkillData ({actorUpdate}) {
		if (actorUpdate?.data?.skills) {
			Object.entries(actorUpdate.data.skills)
				.forEach(([skl, meta]) => {
					meta.value = Math.max(this._actor.data?.data?.skills?.[skl]?.value, meta.value, 0);
				});
		}
	}

	_doMergeExistingOtherProficiencyData ({actorUpdate}) {
		const actorDataPaths = [
			["data", "data", "traits", "languages"],
			["data", "data", "traits", "toolProf"],
			["data", "data", "traits", "weaponProf"],
			["data", "data", "traits", "armorProf"],
		];
		return this._doMergeExistingGenericTraitsData({actorUpdate, actorDataPaths});
	}

	_doMergeExistingDiDrDvCiData ({actorUpdate}) {
		const actorDataPaths = [
			["data", "data", "traits", "di"],
			["data", "data", "traits", "dr"],
			["data", "data", "traits", "dv"],
			["data", "data", "traits", "ci"],
		];
		return this._doMergeExistingGenericTraitsData({actorUpdate, actorDataPaths});
	}

	_doMergeExistingGenericTraitsData ({actorUpdate, actorDataPaths}) {
		actorDataPaths.forEach(actorDataPath => {
			const actorUpdatePath = actorDataPath.slice(1);
			const fromActor = MiscUtil.get(this._actor, ...actorDataPath);
			const fromUpdate = MiscUtil.get(actorUpdate, ...actorUpdatePath);
			if (!fromActor && !fromUpdate) return;
			if (!fromActor && fromUpdate) return;
			if (fromActor && !fromUpdate) return MiscUtil.set(actorUpdate, ...actorUpdatePath, MiscUtil.copy(fromActor));

			if (fromActor.value && fromUpdate.value) {
				MiscUtil.set(actorUpdate, ...actorUpdatePath, "value", [...new Set([...fromActor.value, ...fromUpdate.value])]);
			} else {
				MiscUtil.set(actorUpdate, ...actorUpdatePath, "value", MiscUtil.copy(fromActor.value || fromUpdate.value));
			}

			if (fromActor.custom && fromActor.custom.trim().length && fromUpdate.custom && fromUpdate.custom.trim().length) {
				const allCustom = fromActor.custom.trim().split(";").map(it => it.trim()).filter(Boolean);
				fromUpdate.custom.trim().split(";")
					.map(it => it.trim())
					.filter(Boolean)
					.filter(it => !allCustom.some(ac => ac.toLowerCase() === it.toLowerCase()))
					.forEach(it => allCustom.push(it));

				MiscUtil.set(actorUpdate, ...actorUpdatePath, "custom", allCustom.join(";"));
			} else {
				MiscUtil.set(actorUpdate, ...actorUpdatePath, "custom", fromActor.custom || fromUpdate.custom);
			}
		});
	}
	// endregion

	async _pImportActorAdditionalFeats (ent, importOpts, dataBuilderOpts) {
		if (!ent.feats) return;

		const formData = await Charactermancer_AdditionalFeatsSelect.pGetUserInput({available: ent.feats, actor: this._actor});
		if (!formData) return dataBuilderOpts.isCancelled = true;
		if (formData === VeCt.SYM_UI_SKIP) return;

		if (!(formData.data || []).length) return;

		const {ImportListFeat} = await import("./ImportListFeat.js");
		const importListFeat = new ImportListFeat({actor: this._actor});
		await importListFeat.pInit();

		for (const {page, source, hash} of (formData.data || [])) {
			const feat = await Renderer.hover.pCacheAndGet(page, source, hash);
			await importListFeat.pImportEntry(feat, importOpts);
		}
	}
}

/**
 * Generic import options for use in any application which imports data to a character sheet.
 */
ImportListCharacter.ImportEntryOpts = class {
	constructor (opts) {
		opts = opts || {};

		this.isCharactermancer = !!opts.isCharactermancer;

		this.isCancelled = false;

		this.items = [];
		this.effects = [];
		this.equipmentItemEntries = []; // 5etools item data to be imported as equipment
	}
};

export {ImportListCharacter};
