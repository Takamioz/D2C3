import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {UtilActiveEffects} from "./UtilActiveEffects.js";
import {UtilCompat} from "./UtilCompat.js";

class Patcher_ActiveEffectConfig {
	static init () {
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"ActiveEffectConfig.defaultOptions",
			function (fn, ...args) {
				const base = fn(...args);
				if (!Config.get("actor", "isUseExtendedActiveEffectsParser")) return base;
				base.width = 640;
				base.resizable = true;
				return base;
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);

		Hooks.on("renderActiveEffectConfig", (app, $html, opts) => {
			this._onHookActiveEffectConfig(app, $html, opts);
		});
	}

	static _onHookActiveEffectConfig (app, $html, opts) {
		if (!Config.get("ui", "isExpandActiveEffectConfig") || UtilCompat.isDaeActive()) return;

		// Add a spacer to the header row, above our new buttons
		const $rowHeader = $html.find(`.effect-change.effects-header`);
		$rowHeader.find(`.key`).css({marginLeft: 24});
		$rowHeader.find(`.effect-controls`).before(`<div class="priority">Priority</div>`);

		$html.find(`.changes-list .effect-change`)
			.each((i, row) => {
				const $row = $(row);
				const ixChange = Number(row.dataset.index);

				const $iptKey = $row.find(`.key input`)
					.addClass("bbl-0 btl-0 h-27p");
				const $selMode = $row.find(`.mode select`);
				const $iptValue = $row.find(`.value input`)
					.addClass("h-27p");

				$(`<button class="no-grow no-shrink text-center p-0 m-0 btr-0 bbr-0 br-0 aeff__btn-inline" title="Find Active Effect Attribute Key"><i class="fas fa-fw fa-search"></i></button>`)
					.click(evt => {
						evt.preventDefault();
						evt.stopPropagation();

						const availableEffects = UtilActiveEffects.getAvailableEffects(app.object.parent, opts);

						const {$modalInner, doClose} = UiUtil.getShowModal({
							title: `Find Active Effect Attribute Key`,
							isWidth100: true,
							isHeight100: true,
							isUncappedHeight: true,
						});

						const $iptSearch = $(`<input type="search" class="search w-100 form-control" placeholder="Find keys...">`);
						const $btnReset = $(`<button class="btn-5et veapp__btn-list-reset" name="btn-reset">${game.i18n.localize("PLUT.Reset")}</button>`)
							.click(() => list.reset());
						const $wrpBtnsSort = $$`<div class="ve-flex-v-stretch input-group input-group--bottom mb-1">
							<button class="btn-5et col-4-5 sort" data-sort="name">Name</button>
							<button class="btn-5et col-2-5 sort" data-sort="value">Current Value</button>
							<button class="btn-5et col-2-5 sort" data-sort="baseValue" title="The underlying value, without any current effects/etc. applied.">Current Base Value</button>
							<button class="btn-5et col-2-5 sort" data-sort="default">Default Value</button>
						</div>`;
						const $wrpList = $(`<div class="veapp__list h-100 mb-1"></div>`);

						const list = new List({
							isUseJquery: true,
							$iptSearch,
							$wrpList,
						});

						SortUtil.initBtnSortHandlers($wrpBtnsSort, list);

						availableEffects.forEach((ae, ix) => {
							const val = MiscUtil.get(app.object.parent.data, ...ae.path.split("."));
							const _val = MiscUtil.get(app.object.parent.data._source, ...ae.path.split("."));

							const $ele = $$`<label class="ve-flex w-100 veapp__list-row clickable veapp__list-row-hoverable">
								<span class="col-4-5 px-2">${ae.path}</span>
								<span class="col-2-5 text-center code">${JSON.stringify(val)}</span>
								<span class="col-2-5 text-center code">${JSON.stringify(_val)}</span>
								<span class="col-2-5 text-center code">${JSON.stringify(ae.default)}</span>
							</label>`
								.click(() => {
									const cleanDefault = ae.default == null
										? ae.default
										: typeof ae.default === "object" ? JSON.stringify(ae.default) : ae.default;

									$iptKey.val(ae.path);
									$selMode.val(`${CONST.ACTIVE_EFFECT_MODES.OVERRIDE}`);
									if (!($iptValue.val() || "").trim()) $iptValue.val(cleanDefault);

									doClose();
								});

							const listItem = new ListItem(
								ix,
								$ele,
								ae.path,
								{
									value: val ? MiscUtil.copy(val) : val,
									default: ae.default,
									baseValue: _val ? MiscUtil.copy(_val) : _val,
								},
							);
							list.addItem(listItem);
						});
						list.init();
						list.update();

						$$($modalInner)`<div class="ve-flex-col h-100 min-h-0">
							<div class="ve-flex-v-stretch input-group input-group--top">
								${$iptSearch}
								${$btnReset}
							</div>
							${$wrpBtnsSort}
							${$wrpList}
						</div>`;
					})
					.prependTo($row);

				const $wrpControls = $row.find(`.effect-controls`);

				const $iptPriority = $(`<input class="btr-0 bbr-0 h-27p" type="number" name="changes.${ixChange}.priority" value="${app?.object?.data.changes?.[ixChange]?.priority || ""}">`);

				const $btnPriorityHelp = $(`<button class="no-grow no-shrink text-center p-0 m-0 aeff__btn-inline btl-0 bbl-0 bl-0" title="Priority Help"><i class="fas fa-fw fa-question-circle"></i></button>`)
					.click(evt => {
						evt.stopPropagation();
						evt.preventDefault();

						const numModes = Object.keys(CONST.ACTIVE_EFFECT_MODES).length;
						const rows = Object.entries(CONST.ACTIVE_EFFECT_MODES).map(([k, v], i) => {
							return `<div class="ve-flex-v-center py-1 stripe-even">
								<div class="col-4-5 ve-flex-vh-center">${game.i18n.localize(`EFFECT.MODE_${k}`)}</div>
								<div class="col-4-5 text-center">${v * 10}</div>
								<div class="col-3 text-center">${i === 0 || i === (numModes - 1) ? `<i class="ve-muted ml-2">Applied ${i === 0 ? "first" : "last"}</i>` : ""}</div>
							</div>`;
						});

						new Dialog({
							title: "Active Effects Priority Help",
							content: `<div>
								<p>Active Effects are applied with the following priorities by default:</p>
								<div class="ve-flex-v-center">
									<div class="bold col-4-5 text-center">Change Mode</div>
									<div class="bold col-4-5 text-center">Priority</div>
									<div class="bold col-3 text-center"></div>
								</div>
								<div>
									${rows.join("")}
								</div>
								<p>Setting a &quot;priority&quot; value allows you to change this, and apply the effects in any order you choose.</p>
								<p>For example, if you wished to create an Active Effect for your plate armor and an Active Effect for your shield, you could create an &quot;Override&quot; effect for the plate, with 18 AC, and an &quot;Add&quot; effect for the shield, with 2 AC. You would then set the plate's priority to a number in the range 0\u201319, so it is applied before the shield. If you did not, it would default to &quot;50&quot;, and thus be applied after (and override/ignore) your shield.</p>
							</div>`,
							buttons: {
								one: {
									icon: `<i class="fas fa-fw fa-times"></i>`,
									label: "Close",
								},
							},
						}).render(true);
					});

				$$`<div class="ve-flex-v-center">
					${$iptPriority}
					${$btnPriorityHelp}
				</div>`.insertBefore($wrpControls);
			});
	}
}

export {Patcher_ActiveEffectConfig};
