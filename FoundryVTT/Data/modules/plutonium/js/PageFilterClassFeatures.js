class PageFilterClassFeatures extends PageFilter {
	// region static
	static sortClassFeatures (a, b, o) {
		switch (o.sortBy) {
			case "name": return SortUtil.compareListNames(a, b) || SortUtil.ascSort(a.values.className, b.values.className) || SortUtil.ascSort(a.values.subclassShortName, b.values.subclassShortName) || SortUtil.ascSort(a.values.level, b.values.level);
			case "className": return SortUtil.ascSort(a.values.className, b.values.className) || SortUtil.ascSort(a.values.subclassShortName, b.values.subclassShortName) || SortUtil.ascSort(a.values.level, b.values.level) || SortUtil.compareListNames(a, b);
			case "subclassShortName": return SortUtil.ascSort(a.values.subclassShortName, b.values.subclassShortName) || SortUtil.ascSort(a.values.className, b.values.className) || SortUtil.ascSort(a.values.level, b.values.level) || SortUtil.compareListNames(a, b);
			case "level": return SortUtil.ascSort(a.values.level, b.values.level) || SortUtil.ascSort(a.values.className, b.values.className) || SortUtil.ascSort(a.values.subclassShortName, b.values.subclassShortName) || SortUtil.compareListNames(a, b);
			case "source": return SortUtil.ascSort(a.values.source, b.values.source) || SortUtil.ascSort(a.values.className, b.values.className) || SortUtil.ascSort(a.values.subclassShortName, b.values.subclassShortName) || SortUtil.ascSort(a.values.level, b.values.level) || SortUtil.compareListNames(a, b);
		}
	}
	// endregion

	constructor () {
		super();

		this._classFilter = new Filter({
			header: "Class",
			groupFn: it => it.userData.group,
		});
		this._subclassFilter = new Filter({
			header: "Subclass",
			nests: {},
			groupFn: it => it.userData.group,
		});
		this._levelFilter = new Filter({
			header: "Level",
			displayFn: it => `Level ${it}`,
		});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["SRD"], isSrdFilter: true});
	}

	static mutateForFilters (feature) {
		feature._fClass = this._getClassFilterItem({
			className: feature.className,
			classSource: feature.classSource,
		});
		if (feature.subclassShortName && feature.subclassSource) {
			feature._fSubclass = this._getSubclassFilterItem({
				className: feature.className,
				classSource: feature.classSource,
				subclassShortName: feature.subclassShortName,
				subclassSource: feature.subclassSource,
			});
		}
		feature._fMisc = feature.srd ? ["SRD"] : [];
	}

	addToFilters (feature, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(feature.source);
		this._classFilter.addItem(feature._fClass);
		if (feature._fSubclass) {
			this._subclassFilter.addNest(feature._fSubclass.nest, {isHidden: true});
			this._subclassFilter.addItem(feature._fSubclass);
		}
		this._levelFilter.addItem(feature.level);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._classFilter,
			this._subclassFilter,
			this._levelFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, ft) {
		return this._filterBox.toDisplay(
			values,
			ft.source,
			ft._fClass,
			ft._fSubclass,
			ft.level,
			ft._fMisc,
		);
	}
}

export {PageFilterClassFeatures};
