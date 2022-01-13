import {Config} from "./Config.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Consts} from "./Consts.js";
import {UtilApplications} from "./UtilApplications.js";

class JournalSheet_Plutonium extends JournalSheet {
	static handleConfigUpdate ({isInit = false} = {}) {
		try {
			return this._handleConfigUpdate_();
		} catch (e) {
			if (!isInit) throw e;
			Config.handleFailedInitConfigApplication("journalEntries", "isEnableUrlEmbeds", e);
		}
	}

	static _handleConfigUpdate_ () {
		const isEnabled = Config.get("journalEntries", "isEnableUrlEmbeds");

		if (JournalSheet_Plutonium._LAST_IS_ENABLED === isEnabled) return;
		JournalSheet_Plutonium._LAST_IS_ENABLED = isEnabled;

		if (isEnabled) JournalSheet_Plutonium.doApplyPatch();
		else JournalSheet_Plutonium.doRemovePatch();
	}

	static doApplyPatch () {
		JournalSheet_Plutonium._HAS_PATCHED = true;

		JournalSheet = JournalSheet_Plutonium;
		CONFIG.JournalEntry.sheetClass = JournalSheet_Plutonium;
	}

	static doRemovePatch () {
		// Avoid clobbering other modules that modify journal sheets if we're not in use
		if (!JournalSheet_Plutonium._HAS_PATCHED) return;

		JournalSheet = JournalSheet_Plutonium._CACHED_CLASS;
		CONFIG.JournalEntry.sheetClass = JournalSheet_Plutonium._CACHED_CLASS;

		// Close any lingering open modded windows
		Object.values(ui.windows).forEach(app => {
			if (app.constructor === JournalSheet_Plutonium && app.object.getFlag(SharedConsts.MODULE_NAME, Consts.FLAG_IFRAME_URL)) {
				app.forceClose();
			}
		});
	}

	// Maintain class/hook names
	static get name () { return "JournalSheet"; }

	static get defaultOptions () {
		return {
			...super.defaultOptions,
			template: `${SharedConsts.MODULE_LOCATION}/mod-template/journal/sheet.hbs`,
		};
	}

	get template () {
		if (this._sheetMode === "image") return ImagePopout.defaultOptions.template;
		return `${SharedConsts.MODULE_LOCATION}/mod-template/journal/sheet.hbs`;
	}

	close (...args) {
		if (this.object && this.object.getFlag(SharedConsts.MODULE_NAME, Consts.FLAG_IFRAME_URL)) {
			this.element.hideVe();
			// Flag as "not rendered" so the directory click manager (`_onClickEntityName`) doesn't skip opening the sheet
			//   on next click.
			this._state = Application.RENDER_STATES.CLOSED;
			return;
		}

		return super.close(...args);
	}

	forceClose () {
		return super.close();
	}

	render (...args) {
		// On switching sheet mode, force a re-render
		if (args[1] && args[1].sheetMode !== this._sheetMode) return super.render(...args);

		if (
			this.element && this.element.length // re-open the existing render rather than creating a new one
		) {
			this.element.showVe();
			this.maximize();
			UtilApplications.bringToFront(this);
			this._state = Application.RENDER_STATES.RENDERED;
			return;
		}

		return super.render(...args);
	}
}
JournalSheet_Plutonium._DID_PATCH = false;
JournalSheet_Plutonium._CACHED_CLASS = JournalSheet;
JournalSheet_Plutonium._LAST_IS_ENABLED = null;

export {JournalSheet_Plutonium};
