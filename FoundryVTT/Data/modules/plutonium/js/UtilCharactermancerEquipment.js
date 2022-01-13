import {Util} from "./Util.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {AppSourceSelectorMulti} from "./AppSourceSelectorMulti.js";
import {Config} from "./Config.js";
import {UtilActors} from "./UtilActors.js";
import {UtilHooks} from "./UtilHooks.js";
import {UtilDocuments} from "./UtilDocuments.js";
import {UtilKeybinding} from "./UtilKeybinding.js";

class Charactermancer_StartingEquipment extends Application {
	// region External
	static preInit () {
		this._preInit_registerKeybinds();
	}

	static _preInit_registerKeybinds () {
		const doKeybindingOpenForCharacter = () => {
			const actor = UtilKeybinding.getPlayerActor({minRole: Config.get("equipmentShop", "minimumRole")});
			if (!actor) return true;
			this._pOpen({actor});
			return true;
		};

		const doKeybindingOpenForCurrentSheet = () => {
			const meta = UtilKeybinding.getCurrentImportableSheetDocumentMeta({isRequireActor: true, isRequireOwnership: true, minRole: Config.get("equipmentShop", "minimumRole")});
			if (!meta?.actor) return true;
			this._pOpen({...meta});
			return true;
		};

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"Charactermancer_StartingEquipment__openForCharacter",
			{
				name: "Open Equipment Shop Targeting Player Character",
				editable: [],
				onDown: () => doKeybindingOpenForCharacter(),
			},
		);

		game.keybindings.register(
			SharedConsts.MODULE_NAME,
			"Charactermancer_StartingEquipment__openForCurrentSheet",
			{
				name: "Open Equipment Shop Targeting Current Sheet",
				editable: [],
				onDown: () => doKeybindingOpenForCurrentSheet(),
			},
		);
	}

	static init () {
		// When updating the config, close any equipment shop windows if settings have been changed.
		//  We don't otherwise sync the price info, so this is necessary to "update" the shop with the latest values.
		UtilHooks.on(UtilHooks.HK_CONFIG_UPDATE, async (diff) => {
			if (!diff) return;

			const prev = MiscUtil.get(diff, "previous", "equipmentShop");
			const curr = MiscUtil.get(diff, "current", "equipmentShop");

			if (!prev || !curr) return;

			if (CollectionUtil.deepEquals(prev, curr)) return;

			const toClose = Object.values(ui.windows)
				.filter(it => it.constructor === Charactermancer_StartingEquipment);
			if (!toClose.length) return;

			if (!await (InputUiUtil.pGetUserBoolean({
				title: `Existing Shop Windows`,
				htmlDescription: `You have ${toClose.length === 1 ? `an existing shop window` : `existing shop windows`} open, which will not be affected by your updated Equipment Shop config.<br>Would you like to close ${toClose.length === 1 ? "this window" : "these windows"}?`,
				textYes: "Yes",
				textNo: "No",
			}))) return;

			toClose.forEach(it => it.close());
		});
	}

	static async pHandleButtonClick (evt, app, $html, data) {
		return this._pOpen({actor: app.actor});
	}

	static async _pOpen ({actor}) {
		const instance = new this({
			actor,
			isStandalone: true,
		});

		const formData = await instance.pWaitForUserInput();

		if (!formData) return;
		if (formData === VeCt.SYM_UI_SKIP) return; // This should never occur, as the skip button is hidden in "shop" mode

		await this.pImportEquipmentItemEntries(actor, formData);
		await this.pUpdateActorCurrency(actor, formData);
	}

	static async pImportEquipmentItemEntries (actor, formData) {
		if (!formData?.data?.equipmentItemEntries?.length) return;
		const {ImportListItem} = await import("./ImportListItem.js");
		const importListItem = new ImportListItem({actor: actor});
		await importListItem.pInit();
		for (const it of formData.data.equipmentItemEntries) {
			if (it.item && it.name == null && it.source == null) await importListItem.pImportEntry(it.item, {quantity: it.quantity || 1});
			else await importListItem.pImportEntry(it);
		}
	}

	static async pUpdateActorCurrency (actor, formData) {
		if (!formData?.data?.currency) return;

		await UtilDocuments.pUpdateDocument(
			actor,
			{
				data: {
					currency: formData.data.currency,
				},
			},
		);
	}

	/**
	 * @param actor
	 * @param [opts]
	 * @param [opts.itemDatas]
	 * @param [opts.fnDoShowShop]
	 */
	static getComponents (actor, opts) {
		opts = opts || {};

		const compCurrency = actor ? Charactermancer_StartingEquipment.Currency.fromActor(actor) : new Charactermancer_StartingEquipment.Currency();
		compCurrency.init();

		const compDefault = new Charactermancer_StartingEquipment.ComponentDefault({compCurrency, fnDoShowShop: opts.fnDoShowShop});
		const compGold = new Charactermancer_StartingEquipment.ComponentGold({compCurrency, itemDatas: opts.itemDatas});

		return {
			compCurrency,
			compDefault,
			compGold,
		};
	}
	// endregion

	/**
	 * @param [opts]
	 * @param [opts.actor]
	 * @param [opts.startingEquipment] Starting equipment data, in the form used by class data.
	 * @param [opts.appSubTitle]
	 * @param [opts.isStandalone]
	 * @param [opts.equiSpecialSource] The source to be assigned to "special" (i.e. non-statted items).
	 * @param [opts.equiSpecialPage] The page number to be assigned to "special" (i.e. non-statted items).
	 */
	constructor (opts) {
		opts = opts || {};

		const compCurrency = opts.actor ? Charactermancer_StartingEquipment.Currency.fromActor(opts.actor) : new Charactermancer_StartingEquipment.Currency();
		const compDefault = new Charactermancer_StartingEquipment.ComponentDefault({...opts, compCurrency, fnDoShowShop: () => { this._mode = "gold"; this._doHandleModeSwitch(); }});
		const compGold = new Charactermancer_StartingEquipment.ComponentGold({...opts, compCurrency});

		// region Set sub-component data
		if (opts.startingEquipment) compCurrency.startingEquipment = opts.startingEquipment;
		if (opts.equiSpecialSource) compDefault.equiSpecialSource = opts.equiSpecialSource;
		if (opts.equiSpecialPage) compDefault.equiSpecialPage = opts.equiSpecialPage;
		if (opts.isStandalone) compCurrency.isStandalone = true;
		// endregion

		super({
			title: `${compCurrency.rollableExpressionGold ? `Starting ` : ""}Equipment${opts.appSubTitle ? `\u2014${opts.appSubTitle}` : ""}${opts.actor ? ` (Actor "${opts.actor.name}")` : ""}`,
			template: `${SharedConsts.MODULE_LOCATION}/template/ImportListCharacterEquipment.hbs`,
			width: Util.getMaxWindowWidth(1000),
			height: Util.getMaxWindowHeight(),
			resizable: true,
		});

		this._compCurrency = compCurrency;
		this._compDefault = compDefault;
		this._compGold = compGold;

		this._isStandalone = opts.isStandalone;

		this._cntModesAvailable = Number(this._compDefault.isAvailable) + Number(this._compGold.isAvailable);

		if (this._cntModesAvailable) {
			this._resolve = null;
			this._reject = null;
			this._pUserInput = new Promise((resolve, reject) => {
				this._resolve = resolve;
				this._reject = reject;
			});
		}

		this._mode = null;
		this._$wrpTabs = null;
		this._$btnShowTabStandard = null;
		this._$btnShowTabGoldAlternative = null;
	}

	async _pResolveAndClose (resolveAs) {
		this._resolve(resolveAs);
		await this.close();
	}

	activateListeners ($html) {
		if (!this._cntModesAvailable) return; // Should never occur

		const activeComps = [this._compDefault, this._compGold].filter(it => it.isAvailable);

		if (this._cntModesAvailable === 2) {
			this._mode = "default";

			this._$wrpTabs = activeComps.map(it => {
				const $wrpTab = $(`<div class="w-100 h-100 min-h-0 ve-flex-col"></div>`).hideVe();
				this._activateListeners_renderTab($wrpTab, it);
				return $wrpTab;
			});

			this._$btnShowTabStandard = $(`<button class="btn btn-default w-50 btn-5et">${this._compCurrency.rollableExpressionGold ? `Standard Starting Equipment` : `Starting Equipment`}</button>`)
				.click(() => {
					this._mode = "default";
					this._doHandleModeSwitch();
				});

			this._$btnShowTabGoldAlternative = $(`<button class="btn btn-default w-50 btn-5et">${this._compCurrency.rollableExpressionGold ? `Gold Alternative/Shop` : `Shop`}</button>`)
				.click(() => {
					this._mode = "gold";
					this._doHandleModeSwitch();
				});

			this._doHandleModeSwitch();

			$$($html)`<div class="ve-flex-col w-100 h-100">
				<div class="ve-flex no-shrink btn-group mb-1">${this._$btnShowTabStandard}${this._$btnShowTabGoldAlternative}</div>
				${this._$wrpTabs[0]}
				${this._$wrpTabs[1]}
			</div>`;

			return;
		}

		this._activateListeners_renderTab($html, activeComps[0]);
	}

	_doHandleModeSwitch () {
		this._$btnShowTabStandard.toggleClass("active", this._mode === "default");
		this._$btnShowTabGoldAlternative.toggleClass("active", this._mode === "gold");
		this._$wrpTabs[0].toggleVe(this._mode === "default");
		this._$wrpTabs[1].toggleVe(this._mode === "gold");
	}

	_activateListeners_renderTab ($html, comp) {
		comp.pRender($html)
			.then($wrpTabInner => {
				const $btnAccept = $(`<button class="btn btn-default btn-5et ${this._isStandalone ? "mr-3" : "mr-2"}">Confirm</button>`)
					.click(async () => {
						const activeComps = [this._compDefault, this._compGold].filter(it => it.isAvailable);

						const formDatas = await Promise.all(activeComps.map(comp => comp.pGetFormData()));

						for (const formData of formDatas) {
							if (
								!formData.isFormComplete
								&& !(await InputUiUtil.pGetUserBoolean({title: formData.messageInvalid}))
							) return;
						}

						const formDataCurrency = await this._compCurrency.pGetFormData();

						// Merge the form data from both components
						const combinedFormData = {
							isFormComplete: formDatas.every(it => it.isFormComplete),
							data: {
								equipmentItemEntries: formDatas.map(it => it.data?.equipmentItemEntries || []).flat(),
								currency: formDataCurrency?.data?.currency,
							},
						};

						await this._pResolveAndClose(combinedFormData);
					});

				const $btnSkip = this._isStandalone ? null : $(`<button class="btn btn-default mr-3">Skip</button>`)
					.click(() => this._pResolveAndClose(VeCt.SYM_UI_SKIP));

				$wrpTabInner.append(`<hr class=hr-1>`);
				$$`<div class="ve-flex-v-center ve-flex-h-right w-100">${$btnAccept}${$btnSkip}</div>`.appendTo($wrpTabInner);
			});
	}

	async close () {
		await super.close();
		// Forcibly resolve the promise, if it hasn't already been resolved.
		if (this._resolve) this._resolve(null);
	}

	async pWaitForUserInput () {
		if (!this._cntModesAvailable) return VeCt.SYM_UI_SKIP;

		await this.render(true);
		return this._pUserInput;
	}
}

Charactermancer_StartingEquipment.Currency = class extends BaseComponent {
	static fromActor (actor) {
		const initialCurrency = UtilActors.getActorCurrency({actor});
		const comp = new this();
		comp.init();
		comp.setCurrencyFromActor(initialCurrency);
		return comp;
	}

	/**
	 * @param [opts]
	 * @param [opts.startingEquipment] Starting equipment data, in the form used by class data.
	 */
	constructor (opts) {
		super();

		opts = opts || {};

		this._prevActorCurrency = null; // Save the original currency, so we can try to mimic it on output
		this.__state.startingEquipment = opts.startingEquipment ? MiscUtil.copy(opts.startingEquipment) : null;
		this._isStandalone = null;
	}

	init () {
		const hkStartingEquipment = () => {
			// Reset rolled gold
			this._state.cpRolled = null;
			this._state.rollableExpressionGold = this.constructor._getRollableExpressionGold(this._state.startingEquipment);
		};
		this._addHookBase("startingEquipment", hkStartingEquipment);
		hkStartingEquipment();
	}

	static _getRollableExpressionGold (startingEquipment) {
		if (!startingEquipment?.goldAlternative) return null;
		const m = /{@dice ([^|]+)/.exec(startingEquipment.goldAlternative);
		return m[1].replace(/×/g, "*");
	}

	get startingEquipment () { return this._state.startingEquipment; }
	set startingEquipment (val) { this._state.startingEquipment = val; }

	get isStandalone () { return this._isStandalone; }
	set isStandalone (val) { this._isStandalone = val; }

	get rollableExpressionGold () { return this._state.rollableExpressionGold; }

	get cpSpent () { return this._state.cpSpent; }
	set cpSpent (val) { this._state.cpSpent = val; }

	get cpRolled () { return this._state.cpRolled; }
	set cpRolled (val) { this._state.cpRolled = val; }

	get hasShownGoldWarning () { return this._state.hasShownGoldWarning; }
	set hasShownGoldWarning (val) { this._state.hasShownGoldWarning = val; }

	set cpFromDefault (val) { this._state.cpFromDefault = val; }

	setCurrencyFromActor (startingCurrency) {
		this._prevActorCurrency = MiscUtil.copy(startingCurrency);

		const out = {};
		Parser.COIN_ABVS.forEach(k => out[k] = startingCurrency[k] || 0);
		this._proxyAssignSimple("state", out);
	}

	_getAvailableCp () {
		return (this._state.cpRolled || 0)
			+ (this._state.cpFromDefault || 0)
			+ CurrencyUtil.getAsCopper({cp: this._state.cp, sp: this._state.sp, gp: this._state.gp, ep: this._state.ep, pp: this._state.pp});
	}

	_getOriginalCurrency () {
		const out = Parser.COIN_ABVS.mergeMap(it => ({[it]: 0}));
		Object.entries(this._prevActorCurrency || {})
			.forEach(([coin, amount]) => out[coin] = (out[coin] || 0) + amount);

		// Add any rolled currency, in gp/sp/cp, to the actor's original currency.
		const fromRolled = CurrencyUtil.doSimplifyCoins({cp: this._state.cpRolled || 0});
		Object.entries(fromRolled || {})
			.forEach(([coin, amount]) => out[coin] = (out[coin] || 0) + amount);

		// Do the same for currency from default starting equipment
		const fromDefault = CurrencyUtil.doSimplifyCoins({cp: this._state.cpFromDefault || 0});
		Object.entries(fromDefault || {})
			.forEach(([coin, amount]) => out[coin] = (out[coin] || 0) + amount);

		return out;
	}

	isStandardStartingEquipmentActive () {
		return Object.keys(this.startingEquipment || {}).length && this.cpRolled == null;
	}

	async pGetFormData () {
		return {
			isFormComplete: true,
			data: {
				currency: CurrencyUtil.doSimplifyCoins(
					{
						cp: this.getRemainingCp(),
					},
					{
						originalCurrency: this._getOriginalCurrency(),
						isPopulateAllValues: true,
						currencyConversionTable: Parser.FULL_CURRENCY_CONVERSION_TABLE,
					},
				),
			},
		};
	}

	getRemainingCp () {
		return this._getAvailableCp() - this._state.cpSpent;
	}

	addHookCurrency (hk) { this._addHookAll("state", hk); }
	addHookCpRolled (hk) { this._addHookBase("cpRolled", hk); }
	addHookStartingEquipment (hk) { this._addHookBase("startingEquipment", hk); }
	addHookRollableExpressionGold (hk) { this._addHookBase("rollableExpressionGold", hk); }

	removeHookCpRolled (hk) { this._removeHookBase("cpRolled", hk); }

	_getDefaultState () {
		return {
			startingEquipment: null,
			rollableExpressionGold: null,

			...Parser.COIN_ABVS.mergeMap(it => ({[it]: 0})),
			cpSpent: 0,
			cpRolled: null,
			cpFromDefault: 0,

			hasShownGoldWarning: false,
		};
	}
};

Charactermancer_StartingEquipment.ComponentBase = class extends BaseComponent {
	/**
	 *
	 * @param opts
	 * @param [opts.compCurrency]
	 */
	constructor (opts) {
		super();
		this._compCurrency = opts.compCurrency;
	}

	static _getHumanReadableCoinage (copper) {
		const asCoins = CurrencyUtil.doSimplifyCoins({cp: copper});
		return [...Parser.COIN_ABVS]
			.reverse().map(coin => asCoins[coin] ? `${asCoins[coin].toLocaleString()} ${coin}` : null)
			.filter(Boolean)
			.join(", ") || "0 gp";
	}

	async _pIsIgnoreGoldWarning () {
		if (!Object.keys(this._compCurrency.startingEquipment || {}).length || this._compCurrency.hasShownGoldWarning) return true;

		const isUseGold = await InputUiUtil.pGetUserBoolean({
			title: `Are you sure?`,
			htmlDescription: `Using gold to buy starting equipment is an alternative to standard starting equipment.<br>Are you sure you want to use gold?`,
			textYes: "Yes",
			textNo: "Cancel",
		});
		if (!isUseGold) return false;

		this._compCurrency.hasShownGoldWarning = true;
		return true;
	}

	_$getBtnRollStartingGold () {
		return $(`<button class="btn btn-default btn-xs btn-5et">Roll Starting Gold</button>`)
			.click(async () => {
				if (!(await this._pIsIgnoreGoldWarning())) return;

				const roll = new Roll(this._compCurrency.rollableExpressionGold);
				await roll.evaluate();
				this._compCurrency.cpRolled = roll.total * 100;
				roll.toMessage(); // Send the message async
			});
	}

	_$getBtnEnterStartingGold () {
		return $(`<button class="btn btn-default btn-xs btn-5et" title="Manually enter a starting gold amount, as an alternate to rolling.">Enter Starting Gold</button>`)
			.click(async () => {
				if (!(await this._pIsIgnoreGoldWarning())) return;

				const opts = {
					min: 0,
					title: "Enter Gold Amount",
					int: true,
				};
				if (this._compCurrency.cpRolled != null) opts.default = Math.round(this._compCurrency.cpRolled / 100);

				const amount = await InputUiUtil.pGetUserNumber(opts);
				if (amount == null) return;

				this._compCurrency.cpRolled = amount * 100;
			});
	}

	_$getDispRolledGold () {
		const $dispRolled = $(`<div></div>`);

		const hkRolled = () => {
			if (this._compCurrency.cpRolled == null && this._compCurrency.rollableExpressionGold != null) $dispRolled.html(`<i class="ve-muted">${this._compCurrency.rollableExpressionGold}</i>`);
			else $dispRolled.html(this.constructor._getHumanReadableCoinage(this._compCurrency.cpRolled || 0));
		};
		hkRolled();
		this._compCurrency.addHookRollableExpressionGold(hkRolled);
		this._compCurrency.addHookCpRolled(hkRolled);

		return $dispRolled;
	}

	_$getWrpRollOrManual ({$btnRoll, $dispRollOrManual, $btnManual, $dispRolled}) {
		const $stgDispRolled = $dispRolled ? $$`<div class="m-1"> = </div>${$dispRolled}` : null;
		return $$`<div class="ve-flex-v-center">${$btnRoll}${$dispRollOrManual}${$btnManual}${$stgDispRolled}</div>`;
	}

	_doBindRollableExpressionHooks ({$dispRollOrManual, $btnRoll, $btnManual, $spcRollOrManual, $wrpRollOrManual}) {
		const hkRollableExpressionGold = () => {
			// Only show the "roll" controls if we have a rollable expression (which implies we also have starting equipment)
			$dispRollOrManual.toggleVe(this._compCurrency.rollableExpressionGold);
			$btnRoll
				.toggleVe(this._compCurrency.rollableExpressionGold)
				.title(`Rolling ${this._compCurrency.rollableExpressionGold}`);

			// Show the manual controls if we have any starting equipment
			$btnManual.toggleVe(this._compCurrency.startingEquipment);

			// Show the roll/manual controls if we have any starting equipment; specific parts may be hidden as per the above
			if ($spcRollOrManual) $spcRollOrManual.toggleVe(!this._isPredefinedItemDatas && this._compCurrency.startingEquipment);
			$wrpRollOrManual.toggleVe(this._compCurrency.startingEquipment);
		};
		this._compCurrency.addHookStartingEquipment(hkRollableExpressionGold);
		this._compCurrency.addHookRollableExpressionGold(hkRollableExpressionGold);
		hkRollableExpressionGold();
	}
};

Charactermancer_StartingEquipment.ComponentDefault = class extends Charactermancer_StartingEquipment.ComponentBase {
	/**
	 * @param opts
	 * @param [opts.compCurrency]
	 * @param [opts.equiSpecialSource] The source to be assigned to "special" (i.e. non-statted items).
	 * @param [opts.equiSpecialPage] The page number to be assigned to "special" (i.e. non-statted items).
	 * @param [opts.fnDoShowShop]
	 */
	constructor (opts) {
		super(opts);

		opts = opts || {};

		this._equiSpecialSource = opts.equiSpecialSource;
		this._equiSpecialPage = opts.equiSpecialPage;
		this._fnDoShowShop = opts.fnDoShowShop;

		this._fnsUnhook = [];
	}

	set equiSpecialSource (val) { this._equiSpecialSource = val; }
	set equiSpecialPage (val) { this._equiSpecialPage = val; }

	get isAvailable () { return !!(this._compCurrency.startingEquipment?.defaultData?.length); }

	async pGetFormData () {
		const equipmentItemEntries = [];

		const itemDatasDefault = await this._pGetItemDatasDefault();
		if (itemDatasDefault) {
			equipmentItemEntries.push(...itemDatasDefault);
		}

		const isValid = this._isValid_standard();
		const messageInvalid = isValid ? null : `You have not made all available choices. Are you sure you want to continue?`;

		return {
			isFormComplete: isValid,
			messageInvalid: messageInvalid,
			data: {
				equipmentItemEntries,
			},
		};
	}

	static _getItemIdWithDisplayName (itemId, displayName) {
		if (!displayName) return itemId;

		const itemIdParts = itemId.split("|");

		// Ensure the ID is of length two (i.e., is of the form `name|source`)
		while (itemIdParts.length > 2) itemIdParts.pop();
		while (itemIdParts.length < 2) itemIdParts.push("");

		itemIdParts.push(displayName);

		return itemIdParts.join("|");
	}

	async pRender ($wrpTab) {
		const $wrpTabInner = $(`<div class="ve-flex-col w-100 h-100 min-h-0"></div>`).appendTo($wrpTab);
		this._render_standard($wrpTabInner);
		return $wrpTabInner;
	}

	/** Iterate over the current default equipment choice state, running a function on each piece of equipment. */
	_iterChosenStartingEquipment (fnEqui) {
		const defaultData = (this._compCurrency.startingEquipment?.defaultData || []);

		for (let ixGroup = 0; ixGroup < defaultData.length; ++ixGroup) {
			const group = defaultData[ixGroup];
			const propGroup = `std__choice__${ixGroup}`;

			const choices = Object.entries(group);
			for (let ixChoice = 0; ixChoice < choices.length; ++ixChoice) {
				const [_, choice] = choices[ixChoice];

				// If this choice is not selected, skip it
				if (this._state[propGroup] !== ixChoice) continue;

				for (let ixEqui = 0; ixEqui < choice.length; ++ixEqui) {
					const equi = choice[ixEqui];

					const out = fnEqui(ixGroup, ixChoice, equi);
					if (out !== undefined) return out;
				}
			}
		}
	}

	_render_standard ($wrpTabStandard) {
		// region Roll/enter starting gold
		const $btnRoll = this._$getBtnRollStartingGold();
		const $dispRollOrManual = $(`<i class="mx-1">\u2013 or \u2013</i>`);
		const $btnManual = this._$getBtnEnterStartingGold();

		const $wrpRollOrManual = this._$getWrpRollOrManual({$dispRollOrManual, $btnRoll, $btnManual});

		this._doBindRollableExpressionHooks({$dispRollOrManual, $btnRoll, $btnManual, $wrpRollOrManual});

		const $rowSkipToShop = $$`<div class="w-100 py-1 ve-flex-v-center">
			<div class="mr-1">Alternatively, </div>
			${$wrpRollOrManual}
			<div class="ml-1">to skip to the shop.</div>
		</div>`.appendTo($wrpTabStandard);

		const $btnResetStartingGold = $(`<button class="btn btn-default btn-xs btn-5et">Reset Starting Gold</button>`)
			.click(async () => {
				const isSure = await InputUiUtil.pGetUserBoolean({
					title: `Are you sure?`,
					htmlDescription: `This will discard your current starting gold roll or value.`,
				});
				if (!isSure) return;
				this._compCurrency.cpRolled = null;
			});
		const $rowHasCpRolled = $$`<div class="w-100 py-1 ve-flex-v-center">
			<div class="mr-2">You have rolled or entered a value for starting gold instead of using starting equipment.</div>
			${$btnResetStartingGold}
			<div class="ml-1">to use the equipment listed below.</div>
		</div>`.appendTo($wrpTabStandard);

		const hkCpRolled = () => {
			$rowSkipToShop.toggleVe(this._compCurrency.cpRolled == null);
			$rowHasCpRolled.toggleVe(this._compCurrency.cpRolled != null);
		};
		this._compCurrency.addHookCpRolled(hkCpRolled);
		hkCpRolled();

		// Bind "switch to shop view" function to fire when we go from "no money rolled" -> "money rolled"
		if (this._fnDoShowShop) {
			const hkOnChangeCurrency = (prop, val, prevVal) => {
				if (prevVal == null && val != null) this._fnDoShowShop();
			};
			this._compCurrency.addHookCpRolled(hkOnChangeCurrency);
		}
		// endregion

		const $wrpRows = $$`<div class="ve-flex-col w-100 h-100 min-h-0 overflow-y-auto"></div>`.appendTo($wrpTabStandard);

		const hkStartingEquipment = () => {
			const defaultData = this._compCurrency.startingEquipment?.defaultData || [];

			// region Cleanup
			this._fnsUnhook.forEach(fn => fn());
			this._fnsUnhook = [];
			Object.keys(this._state).filter(k => k.startsWith(`std__`)).forEach(k => delete this._state[k]);
			$wrpRows.empty();
			// endregion

			const $rows = defaultData.map((group, ixGroup) => {
				const isSingleOption = Object.keys(group).length === 1;
				const propGroup = `std__choice__${ixGroup}`;
				this._state[propGroup] = 0; // Default to the first group

				const choices = Object.entries(group);

				const $wrpsChoices = choices
					.map(([choiceName, choice], ixChoice) => {
						const children = [];
						choice.forEach((equi, ixEqui) => {
							if (typeof equi === "string") children.push(Renderer.get().render(`{@item ${equi}}`));
							else if (equi.item) {
								const itemId = this.constructor._getItemIdWithDisplayName(equi.item, equi.displayName);

								children.push(Renderer.get().render(`${equi.quantity ? `${equi.quantity}× ` : ""}{@item ${itemId}}${equi.containsValue ? ` containing ${this.constructor._getHumanReadableCoinage(equi.containsValue)}` : ""}`));
							} else if (equi.equipmentType) {
								const equiChoices = Charactermancer_StartingEquipment._EQUIPMENT_SETS[equi.equipmentType];
								if (!equiChoices) throw new Error(`Unhandled equipmentType "${equi.equipmentType}"`);

								const num = equi.quantity || 1;
								for (let i = 0; i < num; ++i) {
									const $dispEqui = $(`<div class="inline"></div>`);
									const propEqui = `std__equi__${ixGroup}__${ixChoice}__${i}`;

									const hkDispEqui = () => {
										if (!this._state[propEqui]) {
											$dispEqui.html(`<i class="ve-muted">(select an item)</i>`);
											return;
										}

										$dispEqui.html(Renderer.get().render(`{@item ${this._state[propEqui]}}`));
									};
									this._addHookBase(propEqui, hkDispEqui);
									this._fnsUnhook.push(() => this._removeHookBase(propEqui, hkDispEqui));
									hkDispEqui();

									const $btnPick = $(`<button class="btn btn-default btn-xxs" title="Choose an Item"><span class="fas fa-fw fa-search"></span></button>`)
										.click(() => {
											const equiChoicesName = Charactermancer_StartingEquipment._EQUIPMENT_SET_NAMES[equi.equipmentType];
											const {$modalInner, doClose} = UiUtil.getShowModal({
												title: `Choose Item${equiChoicesName ? ` \u2014 ${equiChoicesName}` : ""}`,
											});

											const $rows = equiChoices.map(itemUid => {
												const $btnChoose = $(`<button class="btn btn-xs btn-default mr-2"><span class="fas fa-fw fa-check"></span></button>`)
													.click(() => {
														this._state[propEqui] = itemUid;
														doClose(true);
													});

												return $$`<div class="ve-flex-v-center py-1 stripe-even">${$btnChoose}${Renderer.get().render(`{@item ${itemUid.uppercaseFirst()}}`)}</div>`;
											});

											$$($modalInner)`<div class="ve-flex-col h-100">${$rows}</div>`;
										});

									children.push($$`<div class="inline">${$dispEqui} ${$btnPick}</div>`);

									if (i < num - 1) children.push(", ");
								}
							} else if (equi.special) {
								children.push(Renderer.get().render(`${equi.quantity ? `${equi.quantity}× ` : ""}${equi.special}${equi.containsValue ? ` containing ${this.constructor._getHumanReadableCoinage(equi.containsValue)}` : ""}${equi.worthValue ? `, worth ${this.constructor._getHumanReadableCoinage(equi.worthValue)}` : ""}`));
							} else if (equi.value != null) {
								children.push(this.constructor._getHumanReadableCoinage(equi.value));
							} else throw new Error(`Unknown equipment data format: ${JSON.stringify(equi)}`);

							if (ixEqui < choice.length - 1) children.push(", ");
						});

						const $btnSelGroup = $(`<button class="btn btn-default btn-sm no-shrink ve-flex-vh-center imp-cls__disp-equi-choice-key mr-2 bold" ${isSingleOption ? "" : `title="Select Equipment Group ${choiceName}"`}>${isSingleOption ? "&nbsp;" : `(${choiceName})`}</button>`)
							.click(async () => {
								if (this._compCurrency.cpRolled != null) {
									const isSure = await InputUiUtil.pGetUserBoolean({
										title: `Are you sure?`,
										htmlDescription: `You have already rolled or set gold for equipment!<br>Selecting default starting equipment will discard this roll or value.`,
									});
									if (!isSure) return;

									this._compCurrency.cpRolled = null;
								}

								if (isSingleOption) return;

								this._state[propGroup] = ixChoice;
							});

						const $wrpChildren = $$`<div class="w-100">${children}</div>`;

						const hkSelGroup = () => {
							$btnSelGroup.toggleClass("ve-muted", this._compCurrency.cpRolled != null);
							$wrpChildren.toggleClass("ve-muted", this._compCurrency.cpRolled != null);

							if (this._compCurrency.cpRolled != null) {
								$btnSelGroup.removeClass("active");
								$btnSelGroup.prop("disabled", false);
								return;
							}

							if (isSingleOption) $btnSelGroup.prop("disabled", true);

							if (this._state[propGroup] === ixChoice) $btnSelGroup.addClass("active");
							else $btnSelGroup.removeClass("active");
						};
						this._addHookBase(propGroup, hkSelGroup);
						this._compCurrency.addHookCpRolled(hkSelGroup);
						this._fnsUnhook.push(() => this._removeHookBase(propGroup, hkSelGroup));
						this._fnsUnhook.push(() => this._compCurrency.removeHookCpRolled(hkSelGroup));
						hkSelGroup();

						if (ixChoice < choices.length - 1) $btnSelGroup.addClass("mb-1");

						return $$`<div class="ve-flex-vh-center">
							${$btnSelGroup}
							${$wrpChildren}
						</div>`;
					});

				return $$`<div class="ve-flex-col w-100 p-1 my-1 imp-cls__wrp-equi-group">${$wrpsChoices}</div>`;
			});

			$rows.forEach($row => $wrpRows.append($row));

			if (!$rows.length) {
				$wrpRows.append(`<div class="ve-flex-vh-center w-100 h-100 italic ve-muted">No starting equipment available.</div>`);
			}
		};
		this._compCurrency.addHookStartingEquipment(hkStartingEquipment);
		hkStartingEquipment();

		const hkSetCoinsFromDefault = () => {
			// Sum all the coinage that the character would gain, to be added to their sheet
			let cpValue = 0;

			const fnEqui = (ixGroup, ixChoice, equi) => {
				if (equi.item) {
					if (equi.containsValue) cpValue += equi.containsValue;
				} else if (equi.special) {
					if (equi.containsValue) cpValue += equi.containsValue;
				} else if (equi.value) {
					cpValue += equi.value;
				}
			};

			this._iterChosenStartingEquipment(fnEqui);

			this._compCurrency.cpFromDefault = cpValue;
		};
		this._addHookAll("state", hkSetCoinsFromDefault);
		hkSetCoinsFromDefault();
	}

	_isValid_standard () {
		if (!this.isAvailable || this._compCurrency.cpRolled != null) return true;

		const fnEqui = (ixGroup, ixChoice, equi) => {
			if (equi.equipmentType) {
				const num = equi.quantity || 1;
				for (let i = 0; i < num; ++i) {
					const propEqui = `std__equi__${ixGroup}__${ixChoice}__${i}`;
					if (this._state[propEqui] == null) return false;
				}
			}
		};

		const out = this._iterChosenStartingEquipment(fnEqui);
		if (out !== undefined) return out;
		return true;
	}

	async _pGetItemDatasDefault () {
		// If gold has been rolled, we assume the user does not want their default items
		if (this._compCurrency.cpRolled) return [];

		const outUidMetas = [];
		const outPreloaded = [];

		/** Find an existing array item if it exists, and add quantity to it. Otherwise, create a new one. */
		const addOutUidMeta = (itemUid, quantity) => {
			const existing = outUidMetas.find(it => it.itemUid === itemUid);
			if (existing) existing.quantity += quantity;
			else outUidMetas.push({itemUid, quantity: quantity});
		};

		const fnEqui = (ixGroup, ixChoice, equi) => {
			if (typeof equi === "string") addOutUidMeta(equi, 1);
			else if (equi.item) {
				addOutUidMeta(this.constructor._getItemIdWithDisplayName(equi.item, equi.displayName), equi.quantity || 1);
			} else if (equi.equipmentType) {
				const num = equi.quantity || 1;
				for (let i = 0; i < num; ++i) {
					const propEqui = `std__equi__${ixGroup}__${ixChoice}__${i}`;
					const itemUid = this._state[propEqui];
					if (itemUid != null) addOutUidMeta(itemUid, 1);
				}
			} else if (equi.special) {
				// Create dummy items
				outPreloaded.push({
					item: {
						name: equi.special.toTitleCase(),
						source: this._equiSpecialSource,
						page: this._equiSpecialPage,
						type: "OTH",
						rarity: "unknown",
					},
					quantity: equi.quantity || 1,
				});
			}
		};

		this._iterChosenStartingEquipment(fnEqui);

		// Load the items, and sort them such that ammo is imported first
		const loadedItems = [];
		for (const itemUidMeta of outUidMetas) {
			const [name, source, displayName] = itemUidMeta.itemUid.split("|");
			const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source});
			const loadedItem = await Renderer.hover.pCacheAndGetHash(UrlUtil.PG_ITEMS, hash);
			if (displayName) loadedItem._displayName = Renderer.stripTags(displayName).toTitleCase();
			loadedItems.push({
				item: loadedItem,
				quantity: itemUidMeta.quantity,
			});
		}
		const {ImportListItem} = await import("./ImportListItem.js");
		const outFromUids = loadedItems.sort((a, b) => ImportListItem.sortEntries(a.item, b.item));

		return [...outFromUids, ...outPreloaded];
	}

	_getDefaultState () { return {}; }
};

Charactermancer_StartingEquipment.ComponentGold = class extends Charactermancer_StartingEquipment.ComponentBase {
	/**
	 * @param opts
	 * @param [opts.compCurrency]
	 * @param [opts.itemDatas]
	 */
	constructor (opts) {
		super(opts);
		this._isPredefinedItemDatas = !!opts.itemDatas;
		if (opts.itemDatas) this._state.itemDatas = opts.itemDatas;

		this._modalFilter = null;
	}

	get isAvailable () { return true; }

	async pGetFormData () {
		const equipmentItemEntries = [];

		const itemDatas = await this._pGetItemEntries();
		if (itemDatas) {
			equipmentItemEntries.push(...itemDatas);
		}

		const isValid = await this._isValid_gold();
		const messageInvalid = isValid ? null : `You have spent more gold than you possess. Are you sure you want to go into debt?`;

		return {
			isFormComplete: isValid,
			messageInvalid,
			data: {
				equipmentItemEntries,
			},
		};
	}

	async pRender ($wrpTab) {
		const $wrpTabInner = $(`<div class="ve-flex-col w-100 h-100 min-h-0"><div class="ve-flex-vh-center w-100 h-100 italic">Loading...</div></div>`).appendTo($wrpTab);
		await this._render_pGoldAlternative($wrpTabInner);
		return $wrpTabInner;
	}

	async _render_pGoldAlternative ($wrpTabGoldAlternative) {
		await Renderer.item.populatePropertyAndTypeReference();

		const {ImportListItem} = await import("./ImportListItem.js");
		const importListItemSources = await (new ImportListItem()).pGetSources();
		const appSourceSelector = new AppSourceSelectorMulti({
			title: `Select Item Sources`,
			filterNamespace: `ImportListCharacter_StartingEquipment_filter`,
			savedSelectionKey: `ImportListCharacter_StartingEquipment_savedSelection`,
			sourcesToDisplay: importListItemSources,
		});

		const $btnChooseSources = this._isPredefinedItemDatas ? null : $(`<button class="btn btn-xs btn-default btn-5et">Choose Item Sources</button>`)
			.click(async () => {
				appSourceSelector.render(true);
				const choices = await appSourceSelector.pWaitForUserInput();
				if (choices == null) return;

				this._state.itemDatas = choices;
			});

		if (!this._isPredefinedItemDatas) {
			// Load any previous selection the user has made
			appSourceSelector.pLoadInitialSelection()
				.then(choices => {
					if (!choices) return;
					this._state.itemDatas = choices;
				});
		}

		const $dispCurrencyRemaining = $(`<div class="ml-auto ve-flex-v-center"></div>`);
		const hkCurrency = () => {
			const remainingCp = this._compCurrency.getRemainingCp();
			$dispCurrencyRemaining.html(`
				<div title="The total cost of all items in the &quot;shopping basket,&quot; listed below.">
					<b class="mr-1">Total:</b>
					<span>${this.constructor._getHumanReadableCoinage(this._compCurrency.cpSpent)}</span>
				</div>
				<div class="vr-1"></div>
				<span>(</span>
				<div title="The total remaining gold available to this character. This amount is a combination of the currency on their sheet, plus any contextual modifiers (such as class starting gold when importing a class).">
					<b class="mr-1">Remaining:</b>
					<span ${remainingCp < 0 ? `class="veapp__msg-error bold"` : ""}>${this.constructor._getHumanReadableCoinage(remainingCp)}</span>
				</div>
				<span>)</span>
			`);
		};
		this._compCurrency.addHookCurrency(hkCurrency);
		hkCurrency();

		const $dispRollOrManual = $(`<i class="mx-1">\u2013 or \u2013</i>`);
		const $btnRoll = this._$getBtnRollStartingGold();
		const $btnManual = this._$getBtnEnterStartingGold();
		const $dispRolled = this._$getDispRolledGold();

		const $spcRollOrManual = $(`<div class="vr-1"></div>`);
		const $wrpRollOrManual = this._$getWrpRollOrManual({$dispRollOrManual, $btnRoll, $btnManual, $dispRolled}).addClass("mr-3");

		this._doBindRollableExpressionHooks({$dispRollOrManual, $btnRoll, $btnManual, $spcRollOrManual, $wrpRollOrManual});

		const isStandaloneGmInstance = game.user.isGM && this._compCurrency.isStandalone;
		const $btnEditPriceMultiplier = !isStandaloneGmInstance ? null : $(`<button class="btn btn-xs btn-default btn-5et">Edit Config</button>`)
			.click(evt => Config.pHandleButtonClick(evt, "equipmentShop"));
		const $wrpGmPriceMultiplier = !isStandaloneGmInstance ? null : $$`<div class="ml-auto">
			${$btnEditPriceMultiplier}
		</div>`;

		this._modalFilter = new Charactermancer_StartingEquipment.ModalFilterEquipment(this);

		const $wrpItemList = $(`<div class="ve-flex-col w-50 h-100 min-h-0"><div class="ve-flex-vh-center italic w-100 h-100">Loading...</div></div>`);

		// Don't await, as it will load in.
		// Override the default filter controls, to provide our own styling.
		this._modalFilter.pPopulateWrapper(
			$wrpItemList,
			{
				isBuildUi: true,
				$btnOpen: $(`<button class="btn-5et veapp__btn-filter" name="btn-filter">Filter</button>`),
				$btnToggleSummaryHidden: $(`<button class="btn btn-5et" title="Toggle Filter Summary Display" name="btn-toggle-summary"><span class="glyphicon glyphicon-resize-small"></span></button>`),
				$btnReset: $(`<button class="btn-5et veapp__btn-list-reset" name="btn-reset">Reset</button>`),
			},
		).then(meta => {
			const {list, $btnSendAllToRight} = meta;
			$btnSendAllToRight
				.addClass("btn-5et ve-grow")
				.click(async evt => {
					if (list.visibleItems.length > 10 && !(await InputUiUtil.pGetUserBoolean({title: `You are about to add ${list.visibleItems.length} items. Are you sure?`}))) return;

					const quantity = evt.shiftKey ? 5 : 1;
					list.visibleItems.forEach(it => this.addBoughtItem(`${it.name}|${it.values.source}`, {quantity, isTriggerUpdate: false}));
					this._triggerCollectionUpdate("itemPurchases");
				});

			hkItemDatas();
		});

		const $wrpBoughtList = $(`<div class="w-100 h-100 min-h-0 overflow-y-auto"></div>`);

		const hkGoldItemUids = () => {
			this._renderCollection({
				prop: "itemPurchases",
				fnUpdateExisting: (renderedMeta, itemPurchase) => {
					renderedMeta.comp._proxyAssignSimple("state", itemPurchase.data, true);
				},
				fnGetNew: (itemPurchase) => {
					const comp = BaseComponent.fromObject(itemPurchase.data);
					comp._addHookAll("state", () => {
						itemPurchase.data = comp.toObject();
						this._triggerCollectionUpdate("itemPurchases");
					});

					const [name, source] = itemPurchase.data.uid.split("|");
					Renderer.hover.pCacheAndGetHash(UrlUtil.PG_ITEMS, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source}))
						.then(item => {
							comp._state.name = item.name;
							comp._state.value = item.value * Config.get("equipmentShop", "priceMultiplier");
						});

					const hkNoQuantity = () => {
						if (comp._state.quantity > 0) return;
						this._state.itemPurchases = this._state.itemPurchases.filter(it => it !== itemPurchase);
					};
					comp._addHookBase("quantity", hkNoQuantity);

					const $btnSubtract = $(`<button class="btn btn-xxs btn-5et btn-danger" title="Remove One (SHIFT to remove  5)"><span class="glyphicon glyphicon-minus"></span></button>`)
						.click(evt => {
							if (evt.shiftKey) comp._state.quantity -= 5;
							else comp._state.quantity--;
						});

					const $btnAdd = $(`<button class="btn btn-xxs btn-5et btn-success" title="Add Another (SHIFT to add 5)"><span class="glyphicon glyphicon-plus"></span></button>`)
						.click(evt => {
							if (evt.shiftKey) comp._state.quantity += 5;
							else comp._state.quantity++;
						});

					const $dispQuantity = $(`<div class="text-center no-shrink imp-cls__disp-equi-count"></div>`);
					const hkQuantity = () => $dispQuantity.text(comp._state.quantity);
					comp._addHookBase("quantity", hkQuantity);
					hkQuantity();

					const $dispName = $(`<div class="w-100"></div>`);
					const hkName = () => $dispName.html(Renderer.get().render(`{@item ${comp._state.uid}|${comp._state.name || ""}}`));
					comp._addHookBase("name", hkName);
					hkName();

					const $dispCostIndividual = $(`<div class="no-shrink text-right imp-cls__disp-equi-cost px-1"></div>`);
					const hkCostIndividual = () => $dispCostIndividual.html(comp._state.isIgnoreCost ? `<span class="ve-muted" title="Cost Ignored">\u2014</span>` : this.constructor._getHumanReadableCoinage(comp._state.value));
					comp._addHookBase("value", hkCostIndividual);
					hkCostIndividual();

					const $dispCostTotal = $(`<div class="no-shrink text-right imp-cls__disp-equi-cost px-1"></div>`);
					const hkCostTotal = () => {
						if (comp._state.value == null || comp._state.quantity == null) return;
						$dispCostTotal.html(comp._state.isIgnoreCost ? `<span class="ve-muted" title="Cost Ignored">\u2014</span>` : this.constructor._getHumanReadableCoinage(comp._state.value * comp._state.quantity));
					};
					comp._addHookBase("value", hkCostTotal);
					comp._addHookBase("quantity", hkCostTotal);
					hkCostTotal();

					const $wrpRow = $$`<div class="py-1p my-0 veapp__list-row ve-flex-v-center w-100">
						<div class="btn-group ve-flex-vh-center no-shrink imp-cls__wrp-equi-btns">
							${$btnSubtract}
							${$btnAdd}
						</div>
						${$dispQuantity}
						${$dispName}
						${$dispCostIndividual}
						${$dispCostTotal}
					</div>`.appendTo($wrpBoughtList);

					return {
						comp,
						$wrpRow,
					};
				},
			});
		};
		this._addHookBase("itemPurchases", hkGoldItemUids);
		hkGoldItemUids();

		const pHkItemsPurchased = async () => {
			try {
				await this._pLock("pHkItemsPurchased");
				// Update the currency component
				this._compCurrency.cpSpent = await this._pGetCpSpent();
			} finally {
				this._unlock("pHkItemsPurchased");
			}
		};
		this._addHookBase("itemPurchases", pHkItemsPurchased);
		pHkItemsPurchased();

		const hkItemDatas = () => {
			this._modalFilter.setDataList(this._state.itemDatas);
		};
		this._addHookBase("itemDatas", hkItemDatas);

		const $btnClearPurchases = $(`<button class="btn btn-xxs btn-5et btn-danger" title="Remove All Purchases"><span class="glyphicon glyphicon-minus"></span></button>`)
			.click(async () => {
				if (!(await InputUiUtil.pGetUserBoolean({title: `Are you sure you want to remove all purchased items from the list?`}))) return;
				this._state.itemPurchases = [];
			});

		$$($wrpTabGoldAlternative.empty())`
		<div class="ve-flex-v-center">
			<div class="w-50 ve-flex-v-center">
				${$btnChooseSources}
				${$spcRollOrManual}
				${$wrpRollOrManual}
				${$wrpGmPriceMultiplier}
			</div>

			<div class="vr-1"></div>

			<div class="w-50 split-v-center">
				${$dispCurrencyRemaining}
			</div>
		</div>

		<hr class="hr-1">

		<div class="ve-flex h-100 min-h-0 w-100">
			${$wrpItemList}

			<div class="vr-1"></div>

			<div class="w-50 min-h-0 ve-flex-col">
				<div class="ve-flex-v-center pb-1">
					<div class="imp-cls__wrp-equi-btns no-shrink ve-flex-vh-center">${$btnClearPurchases}</div>
					<div class="imp-cls__disp-equi-count no-shrink text-center" title="Quantity">Qt.</div>
					<div class="w-100">Name</div>
					<div class="imp-cls__disp-equi-cost no-shrink text-center">Cost</div>
					<div class="imp-cls__disp-equi-cost no-shrink text-center">Line Total</div>
				</div>

				${$wrpBoughtList}
			</div>
		</div>`;
	}

	_isValid_gold () {
		return this._compCurrency.getRemainingCp() >= 0; // Ensure we're not in debt
	}

	async _pGetCpSpent () {
		const expenses = await Promise.all(this._state.itemPurchases.map(async itemMeta => {
			if (itemMeta.data.isIgnoreCost) return 0;

			const [name, source] = itemMeta.data.uid.split("|");
			const item = await Renderer.hover.pCacheAndGetHash(UrlUtil.PG_ITEMS, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source}));
			return item.value * Config.get("equipmentShop", "priceMultiplier") * (itemMeta.data.quantity || 1);
		}));
		return expenses.reduce((a, b) => a + b, 0);
	}

	async _pGetItemEntries () {
		if (!this._state.itemPurchases.length) return null;

		const combinedItems = {};

		for (const itemPurchase of this._state.itemPurchases) {
			combinedItems[itemPurchase.data.uid] = combinedItems[itemPurchase.data.uid] || 0;
			combinedItems[itemPurchase.data.uid] += itemPurchase.data.quantity || 1;
		}

		const out = [];
		const entries = Object.entries(combinedItems);
		for (const [uid, quantity] of entries) {
			const [name, source] = uid.split("|");
			const item = await Renderer.hover.pCacheAndGetHash(UrlUtil.PG_ITEMS, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source}));
			out.push({
				item,
				quantity,
			});
		}

		return out;
	}

	/**
	 * @param itemUid
	 * @param [opts]
	 * @param [opts.quantity]
	 * @param [opts.isTriggerUpdate]
	 * @param [opts.isIgnoreCost]
	 */
	addBoughtItem (itemUid, opts) {
		opts = opts || {};
		opts.quantity = opts.quantity === undefined ? 1 : opts.quantity;
		opts.isTriggerUpdate = opts.isTriggerUpdate === undefined ? true : opts.isTriggerUpdate;
		opts.isIgnoreCost = opts.isIgnoreCost === undefined ? false : opts.isIgnoreCost;

		itemUid = itemUid.toLowerCase();
		const collectionId = `${itemUid}__${opts.isIgnoreCost}`;

		const existing = this._state.itemPurchases.find(it => it.id === collectionId);
		if (existing) {
			existing.data.quantity += opts.quantity;
		} else {
			this._state.itemPurchases.push({
				id: collectionId,
				data: {
					uid: itemUid,
					quantity: opts.quantity,
					isIgnoreCost: opts.isIgnoreCost,
				},
			});
		}

		if (opts.isTriggerUpdate) this._triggerCollectionUpdate("itemPurchases");
	}

	_getDefaultState () {
		return {
			itemPurchases: [],

			itemDatas: [],
		};
	}
};

Charactermancer_StartingEquipment.ModalFilterEquipment = class extends ModalFilter {
	static _$getFilterColumnHeaders (btnMeta) {
		return super._$getFilterColumnHeaders(btnMeta).map($btn => $btn.addClass(`btn-5et`));
	}

	constructor (compStartingEquipment) {
		super({
			pageFilter: new PageFilterEquipment(),
			namespace: "ImportListCharacter_modalFilterEquipment",
		});
		this._compParent = compStartingEquipment;
	}

	_$getColumnHeaders () {
		const btnMeta = [
			{sort: "name", text: "Name", width: "3-2"},
			{sort: "type", text: "Type", width: "3-2"},
			{sort: "cost", text: "Cost", width: "1-8"},
			{sort: "source", text: "Source", width: "1-8"},
		];
		return this.constructor._$getFilterColumnHeaders(btnMeta);
	}

	async _pLoadAllData () { return []; }

	_$getWrpList () { return $(`<div class="veapp__list mb-1 h-100 min-h-0"></div>`); }

	_$getColumnHeaderPreviewAll (opts) {
		return super._$getColumnHeaderPreviewAll(opts).addClass(["btn-5et", "ve-muted"]);
	}

	_getListItem (pageFilter, item, itI) {
		if (item.noDisplay) return null;

		Renderer.item.enhanceItem(item);
		pageFilter.mutateAndAddToFilters(item);

		const eleRow = document.createElement("div");
		eleRow.className = "px-0 w-100 veapp__list-row ve-flex-col no-shrink";

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](item);
		const source = Parser.sourceJsonToAbv(item.source);
		const type = item._typeListText.join(", ");

		eleRow.innerHTML = `<div class="w-100 veapp__list-row-hoverable ve-flex-v-center">
			<div class="col-1 ve-flex-vh-center">
				<div class="ui-list__btn-inline" title="Toggle Preview (SHIFT to Toggle Info Preview)">${ListUiUtil.HTML_GLYPHICON_EXPAND}</div>
			</div>

			<span class="col-3-2">${item.name}</span>
			<span class="col-3-2">${item._typeListText.join(", ").toTitleCase()}</span>
			<span class="col-1-8 text-right px-1">${Parser.itemValueToFullMultiCurrency(item, {isShortForm: true, multiplier: Config.get("equipmentShop", "priceMultiplier")}).replace(/ +/g, "\u00A0")}</span>
			<span class="col-1-8 text-center ${Parser.sourceJsonToColor(item.source)} pr-0" title="${Parser.sourceJsonToFull(item.source)}" ${BrewUtil.sourceJsonToStyle(item.source)}>${source}</span>
			<div class="col-1 ve-flex-vh-center"><button class="btn btn-xxs btn-default btn-5et" title="Add (SHIFT to add 5; CTRL to ignore price)"><span class="glyphicon glyphicon-arrow-right"></span></button></div>
		</div>`;

		const btnShowHidePreview = eleRow.firstElementChild.firstElementChild.firstElementChild;
		btnShowHidePreview.addEventListener("click", evt => {
			evt.stopPropagation();
			evt.preventDefault();

			const elePreviewWrp = ListUiUtil.getOrAddListItemPreviewLazy(listItem);

			ListUiUtil.handleClickBtnShowHideListPreview(
				evt,
				UrlUtil.PG_ITEMS,
				item,
				btnShowHidePreview,
				elePreviewWrp,
			);
		});

		const listItem = new ListItem(
			itI,
			eleRow,
			item.name,
			{
				hash,
				source,
				sourceJson: item.source,
				cost: (item.value || 0) * Config.get("equipmentShop", "priceMultiplier"),
				type,
			},
			{
				btnSendToRight: eleRow.firstElementChild.lastElementChild.lastElementChild,
				btnShowHidePreview,
			},
		);

		return listItem;
	}

	setDataList (allData) {
		this._list.removeAllItems();

		this._allData = allData.filter(it => it.value != null && it.type !== "$");

		this._allData.forEach((it, i) => {
			this._pageFilter.mutateAndAddToFilters(it);
			const filterListItem = this._getListItem(this._pageFilter, it, i);
			this._list.addItem(filterListItem);
			const itemUid = `${it.name}|${it.source}`;
			filterListItem.data.btnSendToRight.addEventListener("click", evt => {
				const isIgnoreCost = evt.ctrlKey;
				if (evt.shiftKey) this._compParent.addBoughtItem(itemUid, {quantity: 5, isIgnoreCost});
				else this._compParent.addBoughtItem(itemUid, {isIgnoreCost});
			});
		});

		// Wipe the source filter, as we assume the user should be able to see everything they either selected
		//   or were given (in the case of a predefined item list)
		this._pageFilter.sourceFilter.setFromValues({"Source": {}});

		this._pageFilter.filterBox.render();
		this._list.update();
	}
};

Charactermancer_StartingEquipment._EQUIPMENT_SET_NAMES = {
	weaponSimple: "Simple Weapon",
	weaponSimpleMelee: "Simple Melee Weapon",
	weaponMartial: "Martial Weapon",
	weaponMartialMelee: "Martial Melee Weapon",
	instrumentMusical: "Musical Instrument",
	armorLight: "Light Armor",
	armorMedium: "Medium Armor",
	armorHeavy: "Heavy Armor",
	weaponMelee: "Melee Weapon",
	weaponRanged: "Ranged Weapon",
	focusSpellcasting: "Spellcasting Focus",
	setGaming: "Gaming Set",
	toolArtisan: "Artisan's Tool",
};
Charactermancer_StartingEquipment._EQUIPMENT_SETS = {
	weaponSimple: [
		...UtilActors.WEAPONS_SIMPLE,
	],
	weaponSimpleMelee: [
		"club|phb",
		"dagger|phb",
		"greatclub|phb",
		"handaxe|phb",
		"javelin|phb",
		"light hammer|phb",
		"mace|phb",
		"quarterstaff|phb",
		"sickle|phb",
		"spear|phb",
	],
	weaponMartial: [
		...UtilActors.WEAPONS_MARTIAL,
	],
	weaponMartialMelee: [
		"battleaxe|phb",
		"flail|phb",
		"glaive|phb",
		"greataxe|phb",
		"greatsword|phb",
		"halberd|phb",
		"lance|phb",
		"longsword|phb",
		"maul|phb",
		"morningstar|phb",
		"pike|phb",
		"rapier|phb",
		"scimitar|phb",
		"shortsword|phb",
		"trident|phb",
		"war pick|phb",
		"warhammer|phb",
		"whip|phb",
	],
	instrumentMusical: [
		"bagpipes|phb",
		"drum|phb",
		"dulcimer|phb",
		"flute|phb",
		"horn|phb",
		"lute|phb",
		"lyre|phb",
		"pan flute|phb",
		"shawm|phb",
		"viol|phb",
	],
	armorLight: [
		"leather armor|phb",
		"padded armor|phb",
		"studded leather armor|phb",
	],
	armorMedium: [
		"hide armor|phb",
		"chain shirt|phb",
		"scale mail|phb",
		"breastplate|phb",
		"half plate armor|phb",
	],
	armorHeavy: [
		"ring mail|phb",
		"chain mail|phb",
		"splint armor|phb",
		"plate armor|phb",
	],
	weaponMelee: [
		"battleaxe|phb",
		"club|phb",
		"dagger|phb",
		"flail|phb",
		"glaive|phb",
		"greataxe|phb",
		"greatclub|phb",
		"greatsword|phb",
		"halberd|phb",
		"handaxe|phb",
		"javelin|phb",
		"lance|phb",
		"light hammer|phb",
		"longsword|phb",
		"mace|phb",
		"maul|phb",
		"morningstar|phb",
		"pike|phb",
		"quarterstaff|phb",
		"rapier|phb",
		"scimitar|phb",
		"shortsword|phb",
		"sickle|phb",
		"spear|phb",
		"staff|phb",
		"trident|phb",
		"war pick|phb",
		"warhammer|phb",
		"whip|phb",
	],
	weaponRanged: [
		"blowgun|phb",
		"dart|phb",
		"hand crossbow|phb",
		"heavy crossbow|phb",
		"light crossbow|phb",
		"longbow|phb",
		"net|phb",
		"shortbow|phb",
		"sling|phb",
	],
	focusSpellcasting: [
		"crystal|phb",
		"orb|phb",
		"rod|phb",
		"staff|phb",
		"wand|phb",
	],
	setGaming: [
		"dice set|phb",
		"dragonchess set|phb",
		"playing card set|phb",
		"three-dragon ante set|phb",
	],
	toolArtisan: [
		"alchemist's supplies|phb",
		"brewer's supplies|phb",
		"calligrapher's supplies|phb",
		"carpenter's tools|phb",
		"cartographer's tools|phb",
		"cobbler's tools|phb",
		"cook's utensils|phb",
		"glassblower's tools|phb",
		"jeweler's tools|phb",
		"leatherworker's tools|phb",
		"mason's tools|phb",
		"painter's supplies|phb",
		"potter's tools|phb",
		"smith's tools|phb",
		"tinker's tools|phb",
		"weaver's tools|phb",
		"woodcarver's tools|phb",
	],
};

export {
	Charactermancer_StartingEquipment,
};
