import {SharedConsts} from "../shared/SharedConsts.js";
import {Util} from "./Util.js";

/**
 * @mixin
 */
const MixinModalFilterFvtt = clazz => class extends clazz {
	constructor (...args) {
		super(...args);

		this._prevApp = null;
	}

	// @Override
	_getNameStyle () { return ""; }

	// @Override
	_getShowModal (resolve) {
		if (this._prevApp) this._prevApp.close();

		const self = this;

		const app = new class TempApplication extends Application {
			constructor () {
				super({
					title: `Filter/Search for ${self._modalTitle}`,
					template: `${SharedConsts.MODULE_LOCATION}/template/_Generic.hbs`,
					width: Util.getMaxWindowWidth(900),
					height: Util.getMaxWindowHeight(),
					resizable: true,
				});

				this._$wrpHtmlInner = $(`<div class="ve-flex-col w-100 h-100"></div>`);
			}

			get $modalInner () { return this._$wrpHtmlInner; }

			async close (...args) {
				self._filterCache.$wrpModalInner.detach();
				await super.close(...args);
				resolve([]);
			}

			activateListeners ($html) {
				this._$wrpHtmlInner.appendTo($html);
			}
		}();

		app.render(true);
		this._prevApp = app;

		return {$modalInner: app.$modalInner, doClose: app.close.bind(app)};
	}

	getDataFromSelected (selected) { return this._allData[selected.ix]; }
};

class ModalFilterBackgroundsFvtt extends MiscUtil.mix(ModalFilterBackgrounds).with(MixinModalFilterFvtt) {}

class ModalFilterClassesFvtt extends MiscUtil.mix(ModalFilterClasses).with(MixinModalFilterFvtt) {}

class ModalFilterFeatsFvtt extends MiscUtil.mix(ModalFilterFeats).with(MixinModalFilterFvtt) {}

class ModalFilterRacesFvtt extends MiscUtil.mix(ModalFilterRaces).with(MixinModalFilterFvtt) {}

class ModalFilterSpellsFvtt extends MiscUtil.mix(ModalFilterSpells).with(MixinModalFilterFvtt) {}

class ModalFilterItemsFvtt extends MiscUtil.mix(ModalFilterItems).with(MixinModalFilterFvtt) {}

export {
	ModalFilterBackgroundsFvtt,
	ModalFilterClassesFvtt,
	ModalFilterFeatsFvtt,
	ModalFilterRacesFvtt,
	ModalFilterSpellsFvtt,
	ModalFilterItemsFvtt,
};
