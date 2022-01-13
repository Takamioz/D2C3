import {Config} from "./Config.js";
import {ChooseImporter} from "./ChooseImporter.js";
import {MenuCollectionTools} from "./MenuCollectionTools.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {UtilHooks} from "./UtilHooks.js";

class UtilUi {
	static init () {
		if (game.user.isGM) {
			UtilUi._init_addDirectoryWrapper("renderSceneDirectory");
			UtilUi._init_addDirectoryWrapper("renderActorDirectory");
			UtilUi._init_addDirectoryWrapper("renderItemDirectory");
			UtilUi._init_addDirectoryWrapper("renderJournalDirectory");
			UtilUi._init_addDirectoryWrapper("renderRollTableDirectory");
			UtilUi._init_addDirectoryWrapper("renderCardsDirectory");
			UtilUi._init_addDirectoryWrapper("renderMacroDirectory");
			UtilUi._init_addDirectoryWrapper("renderCompendiumDirectory");
		}
		UtilUi._init_addCompendiumObfuscation();

		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, () => this._handleConfigUpdate());
	}

	static _init_addCompendiumObfuscation () {
		const searchTerm = `(${SharedConsts.MODULE_NAME})`;

		Hooks.on("renderCompendiumDirectory", () => {
			if (!Config.get("ui", "isStreamerMode")) return;

			$(`#compendium`).find(`.compendium-footer`).each((i, e) => {
				$(e).find(`span`).filter((i2, e2) => $(e2).text().trim() === searchTerm).text(` (Expanded SRD)`);
			});
		});

		ui.compendium.render();
	}

	/**
	 * Add a wrapper to the bottom of the directory panes to house Plutonium buttons.
	 */
	static _init_addDirectoryWrapper (hookName) {
		const minRole = Config.get("import", "minimumRole");
		const isAddImportButton = game.user.role >= minRole && this._init_isImportableFvttEntityType(hookName);

		Hooks.on(hookName, (app, $html) => {
			$html.find(`.dir__wrp-header`).remove();

			const $btnImport = ChooseImporter.$getDirButton(hookName);
			const $btnQuick = ChooseImporter.$getDirButtonQuick(hookName);

			const $ptBtnsImport = isAddImportButton ? $$`<div class="btn-group ve-flex-v-center mr-1 w-100">
				${$btnImport ? $btnImport.addClass(`dir__btn-header`) : null}
				${$btnQuick ? $btnQuick.addClass(`dir__btn-header`) : null}
			</div>` : `<div class="w-100"></div>`;

			const $wrp = $$`<div class="ve-flex-col dir__wrp-header w-100 no-shrink min-w-100 dir__control-header ${this._init_isRequireExtraSpacingFvttEntityType(hookName) ? "pb-1" : ""}">
					<div class="ve-flex w-100">
						${$ptBtnsImport}
						${MenuCollectionTools.$getDirButton(hookName).addClass(`dir__btn-header`)}
						${Config.$getDirButton().addClass(`dir__btn-header`)}
					</div>
				</div>`;

			// Ensure we only add the button once; since modules (such as `giffyglyphs-5e-monster-maker`) add another row
			const $insertAfterTarget = $html.find(`.header-actions`);
			if ($insertAfterTarget.length) $wrp.insertAfter($insertAfterTarget[0]);

			MenuCollectionTools.$getDirButton(hookName)
				.addClass(`dir__btn-header dir__control-header--alt`)
				.css({maxWidth: 28})
				.appendTo($html.find(`.header-actions.action-buttons`));
		});

		Hooks.on("renderSettings", (app, $html) => {
			this._doRenderSettings_handleConfigFixEscapeKey(app, $html);
			this._doRenderSettings_handleConfigHidePlutoniumDirectoryButtons(app, $html);
			this._doRenderSettings_addPlayerConfigButton(app, $html);
		});
	}

	static _init_isImportableFvttEntityType (hookName) {
		return !["renderMacroDirectory", "renderCompendiumDirectory", "renderCardsDirectory"].includes(hookName);
	}

	static _init_isRequireExtraSpacingFvttEntityType (hookName) {
		return ["renderMacroDirectory", "renderCompendiumDirectory", "renderCardsDirectory"].includes(hookName);
	}

	static _handleConfigUpdate () {
		if (!ui.settings || !ui.settings.element) return;

		this._doRenderSettings_handleConfigFixEscapeKey(ui.settings, ui.settings.element);
	}

	static _doRenderSettings_handleConfigFixEscapeKey (app, $html) {
		if (!Config.get("ui", "isFixEscapeKey") || !Config.get("ui", "isAddOpenMainMenuButtonToSettings")) {
			return $html.find(`.ui__btn-open-menu`).remove();
		}

		if ($html.find(`.ui__btn-open-menu`).length) return;

		$(`<button class="ui__btn-open-menu"><i class="fas fa-fw fa-bars"></i> Open Game Menu</button>`)
			.click(() => {
				const menu = ui.menu.element;
				if (!menu.length) ui.menu.render(true);
				else menu.slideDown(150);
			})
			.insertBefore($html.find(`button[data-action="configure"]`));
	}

	static _doRenderSettings_handleConfigHidePlutoniumDirectoryButtons (app, $html) {
		if (!Config.get("ui", "isHidePlutoniumDirectoryButtons")) {
			return $html.find(`.cfg__btn-open-alt`).remove();
		}

		if ($html.find(`.cfg__btn-open-alt`).length) return;

		Config.$getDirButton({isGameSettingsButton: true})
			.insertAfter($html.find(`button[data-action="configure"]`));
	}

	static _doRenderSettings_addPlayerConfigButton (app, $html) {
		if (game.user.isGM) return;

		if ($html.find(`.ui__wrp-player-settings`).length) return;

		const $btnOpenPlayerConfig = $(`<button><i class="fas fa-fw fa-cogs"></i> Configure ${Config.get("ui", "isStreamerMode") ? "SRD Module" : "Plutonium "}</button>`)
			.click(evt => Config.pHandleButtonClick(evt));

		$$`<div class="ui__wrp-player-settings">${$btnOpenPlayerConfig}</div>`.insertAfter($html.find(`.game-system`));
	}

	static getModuleFaIcon () {
		return Config.get("ui", "isStreamerMode")
			? `<i class="fab fa-fw fa-d-and-d"></i>`
			: `<i class="fas fa-fw fa-atom"></i>`;
	}
}

export {UtilUi};
