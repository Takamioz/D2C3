import {Util} from "./Util.js";
import {UtilGameSettings} from "./UtilGameSettings.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";

class UtilCompat {
	static init () {
		if (!game.user.isGM) return;

		const {system, isUnknownVersion, major, minor, patch, version} = Util.Versions.getSystemVersion();

		// Ignore "unknown version" systems, as we assume the user knows what they're doing
		//   (e.g. is running a test version).
		if (isUnknownVersion) return;

		const supportedSystemMeta = this._SYSTEMS_SUPPORTED[system];
		if (!supportedSystemMeta) return; // As above; ignore, and assume user competence :^)

		const isBelowMin = supportedSystemMeta.min
			? major < supportedSystemMeta.min.major
			|| (major === supportedSystemMeta.min.major && minor < supportedSystemMeta.min.minor)
			|| (major === supportedSystemMeta.min.major && minor === supportedSystemMeta.min.minor && patch < supportedSystemMeta.min.patch)
			: false;
		const isAboveMax = supportedSystemMeta.max
			? major > supportedSystemMeta.max.major
			|| (major === supportedSystemMeta.max.major && minor > supportedSystemMeta.max.minor)
			|| (major === supportedSystemMeta.max.major && minor === supportedSystemMeta.max.minor && patch > supportedSystemMeta.max.patch)
			: false;
		if (!isBelowMin && !isAboveMax) return;

		ui.notifications.warn(`Game system "${system}" version ${version} is ${[isBelowMin ? `below the minimum required version (${this._getVersionString(supportedSystemMeta.min)})` : null, isAboveMax ? `above the maximum supported version (${this._getVersionString(supportedSystemMeta.max)})` : null].filter(Boolean).join(" and ")} for use with ${Config.get("ui", "isStreamerMode") ? SharedConsts.MODULE_TITLE_FAKE : SharedConsts.MODULE_TITLE}. Please ${isAboveMax ? "downgrade" : "upgrade"} your system version.`);
	}

	static _getVersionString (versionDict) { return `${versionDict.major}.${versionDict.minor}.${versionDict.patch}`; }

	static isModuleActive (moduleId) { return !!game.modules.get(moduleId)?.active; }

	static isDaeActive () { return this.isModuleActive(UtilCompat.MODULE_DAE); }
	static isDragUploadActive () { return this.isModuleActive(UtilCompat._MODULE_DRAG_UPLOAD); }
	static isBetterRollsActive () { return this.isModuleActive(UtilCompat._MODULE_BETTER_ROLLS); }
	static isPermissionViewerActive () { return this.isModuleActive(UtilCompat.MODULE_PERMISSION_VIEWER); }
	static isSmolFoundryActive () { return this.isModuleActive(UtilCompat.MODULE_SMOL_FOUNDRY); }
	static isTwilightUiActive () { return this.isModuleActive(UtilCompat._MODULE_TWILIGHT_UI); }
	static isTidy5eSheetActive () { return this.isModuleActive(UtilCompat._MODULE_TIDY5E_SHEET); }
	static isObsidianActive () { return this.isModuleActive(UtilCompat._MODULE_OBSIDIAN); }
	static isBabeleActive () { return this.isModuleActive(UtilCompat._MODULE_BABELE); }
	static isMonksLittleDetailsActive () { return this.isModuleActive(UtilCompat._MODULE_MONKS_LITTLE_DETAILS); }

	static isDaeGeneratingArmorEffects () {
		if (!this.isDaeActive()) return false;
		return !!UtilGameSettings.getSafe(UtilCompat.MODULE_DAE, "calculateArmor");
	}

	static getFeatureFlags ({isReaction}) {
		const out = {};

		if (isReaction) {
			// Support "Better NPC Sheets 5e", which is apparently incapable of determining a reaction using the standard
			//   "Action type: reaction" data :^)
			out.adnd5e = {itemInfo: {type: "reaction"}};
		}

		return out;
	}
}
UtilCompat.MODULE_DAE = "dae";
UtilCompat._MODULE_DRAG_UPLOAD = "dragupload";
UtilCompat._MODULE_BETTER_ROLLS = "betterrolls5e";
UtilCompat.MODULE_MIDI_QOL = "midi-qol";
UtilCompat.MODULE_KANKA_FOUNDRY = "kanka-foundry";
UtilCompat.MODULE_SMOL_FOUNDRY = "smol-foundry";
UtilCompat.MODULE_PERMISSION_VIEWER = "permission_viewer";
UtilCompat._MODULE_TWILIGHT_UI = "twilight-ui";
UtilCompat._MODULE_TIDY5E_SHEET = "tidy5e-sheet";
UtilCompat._MODULE_OBSIDIAN = "obsidian";
UtilCompat._MODULE_BABELE = "babele";
UtilCompat._MODULE_MONKS_LITTLE_DETAILS = "monks-little-details";

UtilCompat._SYSTEMS_SUPPORTED = {
	"dnd5e": {
		min: {
			major: 1,
			minor: 5,
			patch: 2,
		},
		max: {
			major: 1,
			minor: 5,
			patch: Number.MAX_SAFE_INTEGER,
		},
	},
};

export {UtilCompat};
