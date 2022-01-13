import {Vetools} from "./Vetools.js";
import {UtilApplications} from "./UtilApplications.js";

class Charactermancer_Race_Util {
	static async pPostLoadBrew (fileData) {
		const out = [];

		if (fileData.race) out.push(...Renderer.race.mergeSubraces(fileData.race, {isAddBaseRaces: true}));

		if (fileData.subrace) {
			const baseListSite = MiscUtil.copy((await Vetools.pGetRaces({isAddBaseRaces: true})).race);
			baseListSite.forEach(it => PageFilterRaces.mutateForFilters(it));

			const baseListBrew = MiscUtil.copy([...fileData.race || []]);
			baseListBrew.forEach(it => PageFilterRaces.mutateForFilters(it));
			const baseList = [...baseListBrew, ...baseListSite];

			const nxtData = Renderer.race.adoptSubraces(baseList, fileData.subrace);
			const mergedNxtData = Renderer.race.mergeSubraces(nxtData);

			out.push(...mergedNxtData);
		}

		return out;
	}
}

class Charactermancer_Race_SizeSelect extends BaseComponent {
	// region External
	static async pGetUserInput ({sizes}) {
		if (!sizes || !sizes.length) return {isFormComplete: true, data: SZ_MEDIUM};
		const comp = new this({sizes});
		if (comp.isNoChoice()) return comp.pGetFormData();
		return UtilApplications.pGetImportCompModalFormData({comp});
	}
	// endregion

	/**
	 * @param opts
	 * @param opts.sizes
	 */
	constructor (opts) {
		opts = opts || {};
		super();

		this._sizes = opts.sizes || [SZ_MEDIUM];
	}

	get modalTitle () { return `Choose Size`; }

	render ($wrp) {
		if (this._sizes.length === 1) {
			$wrp.append(`<div>${Parser.sizeAbvToFull(this._sizes[0])}</div>`);
			return;
		}

		ComponentUiUtil.$getSelEnum(
			this,
			"size",
			{
				values: this._sizes,
				isAllowNull: true,
				fnDisplay: Parser.sizeAbvToFull,
			},
		)
			.appendTo($wrp);
	}

	isNoChoice () { return this._sizes.length <= 1; }

	pGetFormData () {
		return {
			isFormComplete: this._state.size != null,
			data: this._sizes.length === 1 ? this._sizes[0] : this._state.size,
		};
	}
}

export {
	Charactermancer_Race_Util,
	Charactermancer_Race_SizeSelect,
};
