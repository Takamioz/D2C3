import {LGT} from "./Util.js";
import {UtilApplications} from "./UtilApplications.js";
import {Config} from "./Config.js";
import {UtilEvents} from "./UtilEvents.js";
import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";

/**
 * N.B.: KaKaRoTo already did this, albeit differently: https://github.com/kakaroto/fvtt-module-popout
 */
class PopoutSheet {
	// region External
	static init () {
		PopoutSheet._POPOUT_HOOKS.forEach(hookName => {
			Hooks.on(hookName, (app, $html, data) => {
				PopoutSheet._doAddButtonSheet(app, $html, data);
				PopoutSheet._doHandleSubPopout(app, $html, data);
			});
		});

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"Application.prototype.bringToTop",
			function (fn, ...args) {
				const out = fn(...args);
				if (this._plut_popoutWindow) {
					try {
						this._plut_popoutWindow.focus();
					} catch (e) {
						// Should never occur
					}
				}
				return out;
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);
	}

	static _doAddButtonSheet (app, $html, data) {
		const $sheetHeader = UtilApplications.$getAppElement(app).closest(`.app`).find(`.window-header`);
		$sheetHeader.find(`.pop__btn-open`).remove();

		$(`<a class="pop__btn-open" title="Pop Out"><span class="fas fa-fw fa-external-link-alt"></span></a>`)
			.click(evt => this.pHandleButtonClick(evt, app, $html, data))
			.insertBefore($sheetHeader.find(`.close`));
	}

	static pHandleButtonClick (evt, app, $html, data) {
		evt.preventDefault();
		this.doPopout(app, data);
	}
	// endregion

	static _getDocumentStyleHtml () {
		const out = [];

		const addAsRules = (sheet) => {
			const rules = "cssRules" in sheet ? sheet.cssRules : sheet.rules;
			if (!rules) return;

			const css = [];

			[...(rules || [])].forEach(rule => {
				let str = "cssText" in rule ? rule.cssText : `${rule.selectorText} {\n${rule.style.cssText}\n}\n`;

				// resolve all fonts to absolute paths
				if (str.includes("@font-face")) {
					str = str.replace(/(url\(")([^"]+)("\))/g, (...m) => {
						if (m[2].startsWith("/") || !sheet.href) return `${m[1]}${m[2]}${m[3]}`;
						else {
							const path = (new URL(sheet.href)).pathname.split("/").slice(0, -1).join("/");
							return `${m[1]}${path}/${m[2]}${m[3]}`;
						}
					});
				}
				css.push(str);
			});

			out.push(`<style>
				${css.join("\n")}
			</style>`);
		};

		[...(document.styleSheets || [])].forEach(sheet => {
			try {
				// Attempt to read and modify the styles, to preserve fonts
				addAsRules(sheet);
			} catch (e) {
				console.error(...LGT, e);
				// If we can't read the styles, it's probably a CORS issue--just link the sheet
				if (sheet.href) out.push(`<link rel="stylesheet" href="${sheet.href}">`);
			}
		});

		return out.join("\n");
	}

	static doPopout (app, data) {
		const name = app.title || UtilApplications.getDataName(data);

		// Take the classes of the main body in case a game-wide class (such as "dark-mode") has been applied
		const win = open(
			"",
			name,
			`width=800,height=800,location=0,menubar=0,status=0,titlebar=0,toolbar=0,directories=0`,
		);

		if (win == null) {
			ui.notifications.error(`Could not open pop-up window! Please check your browser settings, and allow this site to open (multiple) pop-up windows.`);
			throw new Error(`Could not open popout window!`);
		}

		win.document.write(`
		<!DOCTYPE html>
		<html lang="en"><head>
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>${name}</title>

			${this._getDocumentStyleHtml()}
		</head><body class="ve-flex-col overflow-overlay ${document.body.className}"></body></html>
		`);

		const $body = $(win.document.body);

		// Track the popout window on the application, so we can focus it on any bring-to-front calls.
		// This is also used as a flag to avoid closing the application on ESC press.
		app._plut_popoutWindow = win;

		// No-op the minimize for when the user e.g. clicks a spell with a template
		const cachedMinimize = app.minimize;
		app.minimize = async () => {};

		// We use `.closest` here as a compatibility fix for modules which, for whatever reason, don't have the app's
		// top-level element as the `app.element`. "Monk's Enhanced Journal" is one such offender.
		// :(
		const $appElement = UtilApplications.$getAppElement(app).closest(`.app`);

		$appElement.addClass("pop__window");
		$body.append($appElement);

		const $drgResize = $appElement.find(`.window-resizable-handle`)
			.addClass("ve-hidden");

		UtilEvents.bindDocumentHandlers({element: win.document.body});

		win.addEventListener("unload", () => {
			UtilEvents.unbindDocumentHandlers({element: win.document.body});
			$(document.body).append($appElement);
			$appElement.removeClass("pop__window");
			$drgResize.removeClass("ve-hidden");
			delete app._plut_popoutWindow;
			app.minimize = cachedMinimize;
			app.close();
		});

		// When closing/reloading the main browser window, close any sub-windows
		window.addEventListener("beforeunload", () => {
			win.close();
		});
	}

	static _doHandleSubPopout (app, $html, data) {
		if (!Config.get("ui", "isEnableSubPopouts")) return;

		if (app._plut_popoutWindow) return;

		const parentApps = app?.object?.parent?.apps || {};
		if (!parentApps) return;

		const isParentPopped = Object.values(parentApps).some(parentApp => !!parentApp._plut_popoutWindow);
		if (!isParentPopped) return;

		this.doPopout(app, data);
	}
}
PopoutSheet._POPOUT_HOOKS = [
	"renderSceneConfig",
	"renderActorSheet",
	"renderItemSheet",
	"renderJournalSheet",
	"renderRollTableConfig",
	"renderCardsConfig",
	"renderCardConfig",

	"renderArtBrowserApp",

	"renderCombatTracker",
	"renderSceneDirectory",
	"renderActorDirectory",
	"renderItemDirectory",
	"renderJournalDirectory",
	"renderRollTableDirectory",
	"renderCardsDirectory",
	"renderPlaylistDirectory",
	"renderCompendiumDirectory",
	"renderSettings",
	"renderMacroDirectory",
];

export {PopoutSheet};
