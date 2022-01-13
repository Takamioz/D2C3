class AppFilter {
	constructor () {
		this._filterBox = null;
	}

	get filterBox () { return this._filterBox; }

	mutateAndAddToFilters (entity, isExcluded, opts) {
		this.constructor.mutateForFilters(entity, opts);
		this.addToFilters(entity, isExcluded, opts);
	}

	static mutateForFilters (entity, opts) { throw new Error("Unimplemented!"); }
	addToFilters (entity, isExcluded, opts) { throw new Error("Unimplemented!"); }
	toDisplay (values, entity) { throw new Error("Unimplemented!"); }
	async _pPopulateBoxOptions () { throw new Error("Unimplemented!"); }

	async pInitFilterBox (opts) {
		opts = opts || {};
		await this._pPopulateBoxOptions(opts);
		this._filterBox = new FilterBox(opts);
		await this._filterBox.pDoLoadState();
		return this._filterBox;
	}

	trimState () { return this._filterBox.trimState_(); }

	teardown () { this._filterBox.teardown(); }
}

class AppFilterBasic extends AppFilter {
	constructor () {
		super();

		this._typeFilter = new Filter({header: "Type"});
	}

	addToFilters (entity, isExcluded) {
		if (isExcluded) return;

		this._typeFilter.addItem(entity.type);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._typeFilter,
		];
	}

	toDisplay (values, ent) {
		return this._filterBox.toDisplay(
			values,
			ent.type,
		);
	}
}

class AppFilterCompendiumList extends AppFilter {
	constructor () {
		super();

		this._entityTypeFilter = new Filter({header: "Entity Type"});
		this._packageFilter = new Filter({header: "Package"});
		this._systemFilter = new Filter({header: "System"});
	}

	addToFilters (entity, isExcluded) {
		if (isExcluded) return;

		this._entityTypeFilter.addItem(entity.entity);
		this._packageFilter.addItem(entity.package);
		this._systemFilter.addItem(entity.system);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._entityTypeFilter,
			this._packageFilter,
			this._systemFilter,
		];
	}

	toDisplay (values, ent) {
		return this._filterBox.toDisplay(
			values,
			ent.entity,
			ent.package,
			ent.system,
		);
	}
}

export {AppFilter, AppFilterBasic, AppFilterCompendiumList};
