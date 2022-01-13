import {SharedConsts} from "../shared/SharedConsts.js";
import {GameStorage} from "./GameStorage.js";
import {UtilFolders} from "./UtilFolders.js";

/**
 * @mixin
 */
const MixinFolderPathBuilder = cls => class extends cls {
	// region To be implemented
	_getFullFolderPathSpecKey () { throw new Error("Unimplemented!"); }
	getFolderPathMeta () { throw new Error("Unimplemented!"); }
	// endregion

	constructor (...args) {
		super(...args);
		this._folderPathSpec = [];
		this._defaultFolderPath = [];
		this._mxFolderPathBuilder_textOnlyMode = false;
	}

	get folderPathSpec () { return this._folderPathSpec; }

	async _pInit_folderPathSpec () {
		this._folderPathSpec = MiscUtil.get((await GameStorage.pGetClient(this._getFullFolderPathSpecKey())), "path");
		if (this._folderPathSpec == null) {
			const folderPathMeta = this.getFolderPathMeta();
			const defaultSpec = (this._defaultFolderPath || [])
				.map(it => (this._mxFolderPathBuilder_textOnlyMode ? FolderPathBuilderRowTextOnly : FolderPathBuilderRow).getStateFromDefault_(it, {folderPathMeta}));
			await this.pSetFolderPathSpec(defaultSpec);
		}
	}

	async pSetFolderPathSpec (folderPathSpec) {
		this._folderPathSpec = folderPathSpec;
		return GameStorage.pSetClient(this._getFullFolderPathSpecKey(), {path: this._folderPathSpec});
	}

	async pHandleEditFolderPathClick () {
		await this._pInit_folderPathSpec();
		const builderApp = new FolderPathBuilderApp(this);
		builderApp.render(true);
	}

	async _pGetCreateFoldersGetIdFromObject ({folderType, obj, sorting = "a"}) {
		if (!this._folderPathSpec.length || !folderType) return null;

		const pathStrings = this._getFolderPathStrings({obj});

		return UtilFolders.pCreateFoldersGetId({folderType, folderNames: pathStrings, sorting});
	}

	static async pGetCreateFoldersGetIdFromPathStrings ({folderType, pathStrings, sorting = "a"}) {
		return UtilFolders.pCreateFoldersGetId({folderType, folderNames: pathStrings, sorting});
	}

	_getFolderPathStrings ({obj}) {
		return FolderPathBuilder.getFolderPathStrings({obj, folderPathSpec: this._folderPathSpec, folderPathMeta: this.getFolderPathMeta()});
	}
};

class FolderPathBuilder extends BaseComponent {
	constructor ({fpApp = null, defaultFolderPathSpec = null, fnOnRowKeydown = null}) {
		super();
		this._fpApp = fpApp;
		this._ClsRow = fpApp ? FolderPathBuilderRow : FolderPathBuilderRowTextOnly;
		this._initialFolderPathSpec = FolderPathBuilder._getInitialFolderPathSpec({fpApp, ClsRow: this._ClsRow, defaultFolderPathSpec, fnOnRowKeydown});
		this._fnOnRowKeydown = fnOnRowKeydown;

		this._lock = new VeLock();
		this._childComps = [];
		this._$wrpRows = null;
	}

	static _getInitialFolderPathSpec ({fpApp, defaultFolderPathSpec, ClsRow, fnOnRowKeydown}) {
		if (defaultFolderPathSpec) {
			return defaultFolderPathSpec
				.map(it => ClsRow.getStateFromDefault_(it, {fnOnKeydown: fnOnRowKeydown}));
		}

		return fpApp ? MiscUtil.copy(fpApp.folderPathSpec) : [];
	}

	render ($parent) {
		$parent.empty();

		const pod = this.getPod();

		this._$wrpRows = $$`<div class="ve-flex-col w-100 h-100 overflow-y-auto relative"></div>`;
		this._childComps.forEach(it => it.render(this._$wrpRows, pod));
		this._render_checkAddEmptyMessage();

		const $btnAdd = $(`<button class="btn btn-5et btn-xs"><span class="fas fa-fw fa-folder-plus"></span> Add Path Part</button>`)
			.click(() => {
				const maxDepth = CONST.FOLDER_MAX_DEPTH__ORIGINAL ?? CONST.FOLDER_MAX_DEPTH;
				if (this._childComps.length >= maxDepth) return ui.notifications.warn(`Foundry currently supports a maximum of ${Parser.numberToText(maxDepth)} levels of directory nesting. T-too deep!`);
				this._render_addRow(pod);
			});

		this._initialFolderPathSpec.forEach(state => this._render_addRow(pod, state));

		$$($parent)`
			<div class="w-100 split-v-center mb-1"><div>Folder Path:</div>${$btnAdd}</div>
			${this._$wrpRows}
		`;
	}

	_getFolderPathSpec () { return this._childComps.map(it => MiscUtil.copy(it._state)); }

	static getFolderPathStrings ({obj = null, folderPathSpec = null, folderPathMeta = null} = {}) {
		return folderPathSpec
			.filter(it => it.isFreeText ? it.text && it.text.trim() : it.selectedProp)
			.map(it => it.isFreeText ? it.text : folderPathMeta[it.selectedProp].getter(obj));
	}

	getFolderPathStrings ({obj = null, folderPathSpec = null, folderPathMeta = null} = {}) {
		folderPathSpec = folderPathSpec || this._getFolderPathSpec();
		folderPathMeta = folderPathMeta || (this._fpApp ? this._fpApp.getFolderPathMeta() : null);
		return this.constructor.getFolderPathStrings({obj, folderPathSpec, folderPathMeta});
	}

	async _render_updateParentPath () {
		if (!this._fpApp) return;

		await (this._lock.pLock());
		await this._fpApp.pSetFolderPathSpec(this._getFolderPathSpec());
		this._lock.unlock();
	}

	_render_addRow (pod, state) {
		const folderMeta = this._fpApp ? this._fpApp.getFolderPathMeta() : {};
		const comp = new this._ClsRow(folderMeta, {fnOnKeydown: this._fnOnRowKeydown});
		if (state) Object.assign(comp.__state, state);

		comp._addHookAll("state", () => this._render_updateParentPath());

		if (!this._childComps.length) this._$wrpRows.empty();

		this._childComps.push(comp);
		comp.render(this._$wrpRows, pod);
		this._render_updateParentPath();
	}

	_swapRowPositions (ixA, ixB) {
		const a = this._childComps[ixA];
		this._childComps[ixA] = this._childComps[ixB];
		this._childComps[ixB] = a;

		this._childComps.forEach(it => it.$row.detach().appendTo(this._$wrpRows));
		this._render_updateParentPath();
	}

	_removeRow (comp) {
		const ix = this._childComps.indexOf(comp);
		if (~ix) {
			this._childComps.splice(ix, 1);
			comp.$row.remove();
			this._render_updateParentPath();
		}

		this._render_checkAddEmptyMessage();
	}

	_render_checkAddEmptyMessage () {
		if (!this._childComps.length) this._$wrpRows.append(`<div class="ve-flex-v-center w-100 my-1"><i>(Directory root)</i></div>`);
	}

	getPod () {
		const pod = super.getPod();
		pod.swapRowPositions = this._swapRowPositions.bind(this);
		pod.removeRow = this._removeRow.bind(this);
		pod.$getChildren = () => this._childComps.map(it => it.$row);
		return pod;
	}
}

class FolderPathBuilderRowTextOnly extends BaseComponent {
	constructor (folderMeta, {fnOnKeydown} = {}) {
		super();
		this._folderMeta = folderMeta;
		this._$row = null;
		this._fnOnKeydown = fnOnKeydown;
	}

	get $row () { return this._$row; }

	render ($parent, parent) {
		this._parent = parent;

		const $iptName = ComponentUiUtil.$getIptStr(this, "text").attr("type", "text").addClass("mr-2");
		if (this._fnOnKeydown) $iptName.keydown(evt => this._fnOnKeydown(evt));

		const $btnRemove = $(`<button class="btn btn-danger btn-xs"><span class="fas fa-fw fa-trash"></span></button>`)
			.click(() => {
				const {removeRow} = this._parent;
				removeRow(this);
			});

		this._$row = $$`<div class="ve-flex-v-center w-100 my-1 imp-folder__row">
			${$iptName}
			${DragReorderUiUtil.$getDragPad2(() => this._$row, $parent, this._parent)}
			${$btnRemove}
		</div>`.appendTo($parent);
	}

	_getDefaultState () { return {...FolderPathBuilderRowTextOnly._DEFAULT_STATE}; }

	static getStateFromDefault_ (val, {...rest} = {}) {
		const comp = new FolderPathBuilderRowTextOnly({...rest});
		comp.__state.text = val;
		return comp.__state;
	}
}
FolderPathBuilderRowTextOnly._DEFAULT_STATE = {
	text: "",
	isFreeText: true,
};

class FolderPathBuilderRow extends FolderPathBuilderRowTextOnly {
	render ($parent, parent) {
		this._parent = parent;

		const $btnToggleFreeText = ComponentUiUtil.$getBtnBool(this, "isFreeText", {$ele: $(`<button class="btn btn-xs mr-1 imp-folder__btn-mode">Custom</button>`)});

		const $iptName = ComponentUiUtil.$getIptStr(this, "text").attr("type", "text");
		if (this._fnOnKeydown) $iptName.keydown(evt => this._fnOnKeydown(evt));
		const $wrpFreeText = $$`<div class="ve-flex mr-1 w-100">${$iptName}</div>`;

		const folderMetaKeys = Object.keys(this._folderMeta)
			.sort((a, b) => SortUtil.ascSortLower(this._folderMeta[a].label, this._folderMeta[b].label));
		const $selProp = ComponentUiUtil.$getSelEnum(
			this,
			"selectedProp",
			{
				values: folderMetaKeys,
				isAllowNull: true,
				fnDisplay: (k) => this._folderMeta[k].label,
			},
		);
		const $wrpSelProp = $$`<div class="ve-flex mr-1 w-100">${$selProp}</div>`;

		const hookFreeText = () => {
			$wrpFreeText.toggleClass("ve-hidden", !this._state.isFreeText);
			$wrpSelProp.toggleClass("ve-hidden", this._state.isFreeText);
		};
		hookFreeText();
		this._addHookBase("isFreeText", hookFreeText);

		const $btnRemove = $(`<button class="btn btn-danger btn-xs"><span class="fas fa-fw fa-trash"></span></button>`)
			.click(() => {
				const {removeRow} = this._parent;
				removeRow(this);
			});

		this._$row = $$`<div class="ve-flex-v-center w-100 my-1 imp-folder__row">
			${$btnToggleFreeText}
			${$wrpFreeText}
			${$wrpSelProp}
			${DragReorderUiUtil.$getDragPad2(() => this._$row, $parent, this._parent)}
			${$btnRemove}
		</div>`.appendTo($parent);
	}

	_getDefaultState () { return {...FolderPathBuilderRow._DEFAULT_STATE}; }

	static getStateFromDefault_ (val, {folderPathMeta, ...rest} = {}) {
		const comp = new FolderPathBuilderRow({...rest});
		if (val?.metaKey) {
			if (!folderPathMeta?.[val.metaKey]) throw new Error(`Folder path meta key "${val.metaKey}" was not found in the available values!`);
			comp.__state.isFreeText = false;
			comp.__state.selectedProp = val.metaKey;
		} else {
			comp.__state.text = val;
		}
		return comp.__state;
	}
}
FolderPathBuilderRow._DEFAULT_STATE = {
	isFreeText: true,
	text: "",
	selectedProp: null,
};

/**
 * A window-based wrapper around the full component.
 */
class FolderPathBuilderApp extends Application {
	constructor (fpApp) {
		super({
			width: 480,
			height: 480,
			title: "Edit Folder Path",
			template: `${SharedConsts.MODULE_LOCATION}/template/FolderPathBuilder.hbs`,
			resizable: true,
		});
		this._comp = new FolderPathBuilder({fpApp});
	}

	activateListeners ($html) {
		super.activateListeners($html);
		this._comp.render($html);
	}
}

export {MixinFolderPathBuilder, FolderPathBuilder};
