import {Vetools} from "./Vetools.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {LGT, Util} from "./Util.js";
import {UtilList2} from "./UtilList2.js";
import {Config} from "./Config.js";
import {MiscUtil} from "../art-js/Util.js";

class ImportSpecialPackages extends Application {
	static getNonLegacyNoteHtml () {
		return `<p>Note that core worlds have been removed from the default index. These worlds were/are community-created, and discussing them in relation to this module is prohibited, for the safety of both communities.</p>
		<p class="mb-0">Please <a href="${this._SUPPORT_URL}">visit the Worlds Discord server</a> to get answers for your questions, concerns, and support requests.</p>
		<p>Alternatively, you may switch to an alternate index, by setting the &quot;Package Index URL&quot; in your <a class="veapp__lnk imp-pkg__lnk-config">config</a>.</p>`;
	}

	static bindNonLegacyNoteHandlers ($html) {
		$html.find(`.imp-pkg__lnk-config`)
			.click(evt => {
				evt.preventDefault();
				evt.stopPropagation();
				Config.pHandleButtonClick(evt, "importAdventure");
			});
	}

	constructor () {
		super({
			title: "Package Importer",
			template: `${SharedConsts.MODULE_LOCATION}/template/ImportSpecialPackages.hbs`,
			height: Util.getMaxWindowHeight(),
			width: 800,
			resizable: true,
		});

		this._packageIndex = null;
		this._pageFilter = null;

		this._rows = null;
	}

	async pInit () {
		const packageIndex = await this.constructor._getPackageIndex();
		this._packageIndex = await this.constructor.getMergedPackageIndex(packageIndex);
		this._pageFilter = new ImportSpecialPackages.PageFilter();
	}

	static async _getPackageIndex () {
		try {
			let index;
			index = await Vetools.pGetPackageIndex();
			return index;
		} catch (e) {
			return {
				supportURL: ImportSpecialPackages._SUPPORT_URL,
			};
		}
	}

	static async getMergedPackageIndex (packageIndex = null) {
		packageIndex = packageIndex || await this._getPackageIndex();
		packageIndex = MiscUtil.copy(packageIndex);

		// A list of modules and a list of worlds are presented in the index; stitch these together where they match
		const packages = [];

		(packageIndex.module || [])
			.filter(Boolean)
			.forEach(moduleMeta => {
				packages.push(moduleMeta);

				moduleMeta.manifesturlModule = moduleMeta.manifesturl;
				delete moduleMeta.manifesturl;

				const baseManifestUrl = (moduleMeta.manifesturlModule || "").split("/").slice(0, -1).join("/");

				const ixWorld = (packageIndex.world || []).findIndex(it => {
					if (it.source !== moduleMeta.source) return false;
					const baseWorldManifestUrl = this._getBaseManifestUrl(it.manifesturl);
					return baseWorldManifestUrl === baseManifestUrl;
				});

				if (!~ixWorld) return;

				const [worldMeta] = (packageIndex.world || []).splice(ixWorld, 1);
				worldMeta.manifesturlWorld = worldMeta.manifesturl;
				delete worldMeta.manifesturl;

				// Copy over any other data
				Object.entries(worldMeta)
					.forEach(([k, v]) => {
						if (moduleMeta[k]) return;
						moduleMeta[k] = v;
					});
				// endregion
			});

		// Add any worlds which did not have matching modules
		(packageIndex.world || [])
			.filter(Boolean)
			.forEach(worldMeta => {
				worldMeta.manifesturlWorld = worldMeta.manifesturl;
				delete worldMeta.manifesturl;
				packages.push(worldMeta);
			});

		packages.forEach(it => {
			it._lAuthor = [it.author || "", it.authors || []]
				.flat()
				.map(it => it.name ?? it)
				.map(it => `${it}`.trim())
				.filter(Boolean);
			if (it.size) {
				it._sizeHumanReadable = Parser.bytesToHumanReadable(it.size, {fixedDigits: 0});
				it._sizeHumanReadableTitle = Parser.bytesToHumanReadable(it.size, {fixedDigits: 3});
			}
		});

		return {
			supportURL: packageIndex.supportURL,
			packages,
		};
	}

	getData () {
		this._rows = this._packageIndex.packages;
		return {
			packages: this._rows,
			isLegacy: Config.get("importAdventure", "isUseLegacyImporter"),
			nonLegacyHeader: this.constructor.getNonLegacyNoteHtml(),
			supportUrl: this._packageIndex.supportURL,
		};
	}

	activateListeners ($html) {
		super.activateListeners($html);

		this.constructor.bindNonLegacyNoteHandlers($html);

		this._activateListeners_initBtnRun($html);
		this._activateListeners_initBtnReset($html);
		this._activateListeners_pInitListAndFilters($html);
	}

	_activateListeners_getSelectedRow () {
		const selItem = this._list.items.find(it => it.data.cbSel.checked);
		if (!selItem) {
			ui.notifications.warn(`Please select something to import!`);
			return null;
		}

		selItem.ele.classList.remove("list-multi-selected");
		selItem.data.cbSel.checked = false;

		return this._rows[selItem.ix];
	}

	static async _activateListeners_pGetManifestData (manifestUrl) {
		let manifestData;
		try {
			manifestData = await Vetools.pGetWithCache(manifestUrl);
		} catch (e) {
			ui.notifications.error(`Failed to load manifest file! ${VeCt.STR_SEE_CONSOLE}`);
			throw e;
		}
		return manifestData;
	}

	static async _pInstallManifest (manifest) {
		const respCheck = await fetch(
			Config.backendEndpoint,
			{
				method: "post",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "checkPackage",
					manifest,
				}),
			},
		);
		const checkJson = await respCheck.json();
		if (checkJson?.errors?.length) {
			const msg = `Could not install manifest:\n${checkJson.errors.join("\n")}`;
			ui.notifications.error(msg);
			console.error(msg);
			return false;
		}

		const resp = await fetch(
			Config.backendEndpoint,
			{
				method: "post",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "installPackage",
					manifest,
				}),
			},
		);
		await resp.json();

		return true;
	}

	static async _activateListeners_pInstallDependencies (installType, manifestData) {
		if (!manifestData.dependencies) return;

		const toBeInstalledDependencies = (manifestData.dependencies || []).filter(x => !game.data.modules.some(m => m.id === x.name));

		if (!toBeInstalledDependencies.length) return;

		const isUserInstall = await InputUiUtil.pGetUserBoolean({
			title: `${installType} "${manifestData.name}" has ${toBeInstalledDependencies.length} module dependenc${toBeInstalledDependencies.length === 1 ? "y" : "ies"}. Would you like to install them?`,
		});
		if (!isUserInstall) return;

		let cntErrors = 0;
		SceneNavigation._onLoadProgress(`Installing (1/${toBeInstalledDependencies.length})`, 0);
		for (let i = 0; i < toBeInstalledDependencies.length; ++i) {
			try {
				const isInstallSuccess = await this._pInstallManifest({
					type: "module",
					name: manifestData.name,
					manifest: toBeInstalledDependencies[i].manifest,
				});
				if (!isInstallSuccess) cntErrors++;
			} catch (e) {
				cntErrors++;
				console.error(e);
			}
			SceneNavigation._onLoadProgress(`Installing (${i + 2}/${toBeInstalledDependencies.length})`, ((i + 1) / toBeInstalledDependencies.length) * 100);
		}
		const cntInstalled = toBeInstalledDependencies.length - cntErrors;
		ui.notifications[cntErrors ? "error" : "info"](`${cntInstalled} module${cntInstalled === 1 ? "" : "s"} installed.${cntErrors ? ` ${cntErrors} error${cntErrors === 1 ? "" : "s"}. ${VeCt.STR_SEE_CONSOLE}` : ""}`);

		// Reload the game in order for the modules to be available
		if (!cntErrors && cntInstalled) game.shutDown();
	}

	static async pImportManifesturlModule (manifesturlModule) {
		const manifestData = await this._activateListeners_pGetManifestData(manifesturlModule);
		if (!manifestData) return;

		if (!(await Config.P_GET_BACKEND_VERSION) || !Config.get("importAdventure", "isUseModdedInstaller")) return this._displayManualLinks(manifestData);

		if (ImportSpecialPackages._ACTIVE_INSTALLATION) return ui.notifications.warn(`Please wait until the currently running installation completes!`);
		ImportSpecialPackages._ACTIVE_INSTALLATION = true;

		try {
			const isInstallSuccess = await this._pInstallManifest({
				type: "module",
				name: manifestData.name,
				manifest: manifesturlModule,
			});
			if (!isInstallSuccess) ui.notifications.error(`Failed to install module!`);
		} catch (e) {
			ui.notifications.error(`Failed to install module! ${VeCt.STR_SEE_CONSOLE}`);
			throw e;
		} finally {
			ImportSpecialPackages._ACTIVE_INSTALLATION = false;
		}

		// This may restart the game
		await this._activateListeners_pInstallDependencies("Module", manifestData);

		try {
			game.shutDown();
		} catch (e) {
			ui.notifications.info(`Module "${manifestData.name}" installed successfully. You must return to setup for this change to take effect!`);
			console.error(...LGT, e);
		}
	}

	static async pImportManifesturlWorld (manifesturlWorld) {
		const manifestData = await this._activateListeners_pGetManifestData(manifesturlWorld);
		if (!manifestData) return;

		if (!(await Config.P_GET_BACKEND_VERSION) || !Config.get("importAdventure", "isUseModdedInstaller")) return this._displayManualLinks(manifestData);

		if (ImportSpecialPackages._ACTIVE_INSTALLATION) return ui.notifications.warn(`Please wait until the currently running installation completes!`);
		ImportSpecialPackages._ACTIVE_INSTALLATION = true;

		try {
			const isInstallSuccess = await this._pInstallManifest({
				type: "world",
				name: manifestData.name,
				manifest: manifesturlWorld,
			});
			if (!isInstallSuccess) ui.notifications.error(`Failed to install world!`);
		} catch (e) {
			ui.notifications.error(`Failed to install world! ${VeCt.STR_SEE_CONSOLE}`);
			throw e;
		} finally {
			ImportSpecialPackages._ACTIVE_INSTALLATION = false;
		}

		/* This is disabled, as *something* seems to already run and attempt to install dependencies? Foundry itself? */
		// This may restart the game
		// await this._activateListeners_pInstallDependencies("World", manifestData);

		try {
			game.shutDown();
		} catch (e) {
			ui.notifications.info(`World "${manifestData.name}" installed successfully. You must return to setup for this change to take effect!`);
			console.error(...LGT, e);
		}
	}

	static _displayManualLinks (manifestData) {
		const {$modalInner, doClose} = UiUtil.getShowModal({
			title: `Manual Installation${manifestData.title ? `\u2014${manifestData.title}` : ""}`,
			isHeaderBorder: true,
		});

		const $btnClose = $(`<button class="btn btn-default btn-sm">Close</button>`)
			.click(() => doClose());

		const $btnCopyAll = $(`<button class="btn btn-primary mr-2">Copy Links</button>`)
			.click(async () => {
				const txt = `# Manifest URL:
${manifestData.manifest}

${manifestData.dependencies && manifestData.dependencies.length ? `# Dependency Manifest URLs:
${manifestData.dependencies.map(it => it.manifest).join("\n")}` : ""}`.trim();

				await MiscUtil.pCopyTextToClipboard(txt);
				JqueryUtil.showCopiedEffect($btnCopyAll);
			});

		const ptDeps = manifestData.dependencies && manifestData.dependencies.length
			? manifestData.dependencies.map(meta => {
				const $dispUrl = $(`<code class="copyable">${meta.manifest}</code>`)
					.click(async () => {
						await MiscUtil.pCopyTextToClipboard(meta.manifest);
						JqueryUtil.showCopiedEffect($dispUrl);
					});

				return $$`<div class="py-1 split-v-center">
					<div class="mr-1">&quot;${meta.name || "(Unnamed)"}&quot;${meta._lAuthor ? ` <i>by</i> ${meta._lAuthor.joinConjunct(", ", " and ")}` : ""}:</div>
					${$dispUrl}
				</div>`;
			})
			: null;

		const $dispUrl = $(`<code class="copyable">${manifestData.manifest}</code>`)
			.click(async () => {
				await MiscUtil.pCopyTextToClipboard(manifestData.manifest);
				JqueryUtil.showCopiedEffect($dispUrl);
			});

		const $dispZip = $(`<code class="copyable">${manifestData.download}</code>`)
			.click(async () => {
				await MiscUtil.pCopyTextToClipboard(manifestData.download);
				JqueryUtil.showCopiedEffect($dispZip);
			});

		$$($modalInner)`<div class="ve-flex-col h-100">
			<div class="mt-1 mb-2 italic">For manual installation, the following links should be copy-pasted into the appropriate input forms in Foundry's &quot;Setup&quot; UI. For automatic installation, you must install and enable the backend mod. Instructions on how to do so are included in the module README, or can be found on the <a href="https://wiki.5e.tools/index.php/FoundryTool_Install" target="_blank">wiki</a>.</div>

			<div class="py-1 split-v-center">
				<div class="mr-1 bold">Manifest:</div>
				${$dispUrl}
			</div>

			${ptDeps ? `<hr class="hr-1"><h4 class="my-1">Dependencies</h4>` : ""}
			${ptDeps}

			<hr class="hr-1">
			<div class="py-1 split-v-center ve-muted">
				<div class="mr-1 bold help--hover" title="If you wish to download the zip manually and add it to your Foundry data directory, use this link. Otherwise, use the above manifest link(s) via Foundry's &quot;Setup&quot; UI">ZIP:</div>
				${$dispZip}
			</div>

			<div class="mt-auto">
				<div class="ve-flex-h-right ve-small mb-2">
					<i class="w-50 block text-right">We recommended that you paste the links into a notepad before closing this window and returning to setup.</i>
				</div>
				<div class="ve-flex-h-right">${$btnCopyAll}${$btnClose}</div>
			</div>
		</div>`;
	}

	_activateListeners_initBtnRun ($html) {
		$html.find(`[name="btn-run--module"]`).click(async () => {
			if (!this._list) return;

			const row = this._activateListeners_getSelectedRow();
			if (!row) return;

			if (!row.manifesturlModule) return ui.notifications.warn(`Please select a package which includes a module!`);

			await this.constructor.pImportManifesturlModule(row.manifesturlModule);
		});

		$html.find(`[name="btn-run--world"]`).click(async () => {
			if (!this._list) return;

			const row = this._activateListeners_getSelectedRow();
			if (!row) return;

			if (!row.manifesturlWorld) return ui.notifications.warn(`Please select a package which includes a module!`);

			await this.constructor.pImportManifesturlWorld(row.manifesturlWorld);
		});
	}

	_activateListeners_initBtnReset ($html) {
		this._$btnReset = $html.find(`[name="btn-reset"]`).click(() => {
			$html.find(`.search`).val("");
			if (this._list) this._list.reset();
		});
	}

	_activateListeners_pInitListAndFilters ($html) {
		this._$iptSearch = $html.find(`.search`);

		// Init list library
		this._list = new List({
			$iptSearch: this._$iptSearch,
			$wrpList: $html.find(`.veapp__list`),
		});
		SortUtil.initBtnSortHandlers($html.find(`[data-name="wrp-btns-sort"]`), this._list);

		return this._pageFilter.pInitFilterBox({
			$iptSearch: this._$iptSearch,
			$btnReset: this._$btnReset,
			$btnOpen: $html.find(`[name=btn-filter]`),
			$btnToggleSummaryHidden: $html.find(`[name=btn-toggle-summary]`),
			$wrpMiniPills: $html.find(`.fltr__mini-view`),
			namespace: `ImportSpecialPackages`,
		}).then(() => {
			this._rows.forEach(it => this._pageFilter.addToFilters(it));

			this._list.doAbsorbItems(
				this._rows,
				{
					fnGetName: it => it.name,
					fnGetValues: it => ({
						name: it.name,
						author: it._lAuthor,
						module: !!it.manifesturlModule,
						world: !!it.manifesturlWorld,
					}),
					fnGetData: UtilList2.absorbFnGetData,
					fnBindListeners: it => UtilList2.absorbFnBindListenersRadio(this._list, it),
				},
			);

			this._list.init();

			this._pageFilter.trimState();
			this._pageFilter.filterBox.render();

			this._pageFilter.filterBox.on(
				FilterBox.EVNT_VALCHANGE,
				this._handleFilterChange.bind(this),
			);

			this._handleFilterChange();
		});
	}

	_handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(li => this._pageFilter.toDisplay(f, this._rows[li.ix]));
	}

	static _getBaseManifestUrl (manifestUrl) { return (manifestUrl || "").split("/").slice(0, -1).join("/"); }
}
ImportSpecialPackages._SUPPORT_URL = "https://discord.gg/tTeWvUHev4";
ImportSpecialPackages._ACTIVE_INSTALLATION = null;

ImportSpecialPackages.PageFilter = class extends PageFilter {
	constructor () {
		super();

		this._typeFilter = new Filter({header: "Type"});
		this._authorFilter = new Filter({header: "Author"});
	}

	static mutateForFilters (it) {
		it._fType = [];
		if (it.manifesturlModule) it._fType.push("Module");
		if (it.manifesturlWorld) it._fType.push("World");

		it._fAuthor = it._lAuthor || ["Unknown"];
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._typeFilter.addItem(it._fType);
		this._authorFilter.addItem(it._fAuthor);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._typeFilter,
			this._authorFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it._fType,
			it._fAuthor,
		);
	}
};

export {ImportSpecialPackages};
