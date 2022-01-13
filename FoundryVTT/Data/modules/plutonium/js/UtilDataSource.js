import {Vetools} from "./Vetools.js";

class UtilDataSource {
	static async pGetFileOutputs (appSourceSelector, source, props) {
		const allContent = await Promise.all(appSourceSelector.uploadedFiles.map(f => {
			const data = Vetools.getContent(f, props);
			return source.pPostLoad ? source.pPostLoad(data, f, source.userData) : data;
		}));

		return {
			contents: allContent.filter(it => it != null),
		};
	}

	static async pGetUrlOutputs (appSourceSelector, source, props) {
		if (source.url === "") {
			const customUrls = appSourceSelector.getCustomUrls();

			let loadedDatas;
			try {
				loadedDatas = await Promise.all(customUrls.map(async url => {
					const data = await Vetools.pGetWithCache(url);
					return source.pPostLoad ? source.pPostLoad(Vetools.getContent(data, props), data, source.userData) : Vetools.getContent(data, props);
				}));
			} catch (e) {
				ui.notifications.error(`Failed to load one or more URLs! ${VeCt.STR_SEE_CONSOLE}`);
				throw e;
			}

			return {
				cacheKeys: customUrls,
				contents: loadedDatas,
			};
		}

		let loadedData;
		try {
			const data = await Vetools.pGetWithCache(source.url);
			loadedData = Vetools.getContent(data, props);
			if (source.pPostLoad) loadedData = await source.pPostLoad(loadedData, data, source.userData);
		} catch (e) {
			ui.notifications.error(`Failed to load URL! ${VeCt.STR_SEE_CONSOLE}`);
			throw e;
		}
		return {
			cacheKeys: [source.url],
			contents: [loadedData],
		};
	}

	static async pGetSpecialOutput (source, props) {
		let loadedData;
		try {
			const json = await Vetools.pLoadImporterSourceSpecial(source);
			loadedData = json;
			if (source.isUseProps) loadedData = Vetools.getContent(loadedData, props);
			if (source.pPostLoad) loadedData = await source.pPostLoad(loadedData, json, source.userData);
		} catch (e) {
			ui.notifications.error(`Failed to load pre-defined source "${source.cacheKey}"! ${VeCt.STR_SEE_CONSOLE}`);
			throw e;
		}
		return {
			cacheKeys: [source.cacheKey],
			contents: [loadedData],
		};
	}
}

UtilDataSource.SOURCE_TYP_OFFICIAL_BASE = "Official";
UtilDataSource.SOURCE_TYP_OFFICIAL_ALL = `${UtilDataSource.SOURCE_TYP_OFFICIAL_BASE} (All)`;
UtilDataSource.SOURCE_TYP_OFFICIAL_SINGLE = `${UtilDataSource.SOURCE_TYP_OFFICIAL_BASE} (Single Source)`;
UtilDataSource.SOURCE_TYP_CUSTOM = "Custom/User";
UtilDataSource.SOURCE_TYP_ARCANA = "UA/Etc.";
UtilDataSource.SOURCE_TYP_BREW = "Homebrew";
UtilDataSource.SOURCE_TYP_BREW_LOCAL = "Local Homebrew";
UtilDataSource.SOURCE_TYP_UNKNOWN = "Unknown";

UtilDataSource.SOURCE_TYPE_ORDER = [
	UtilDataSource.SOURCE_TYP_OFFICIAL_ALL,
	UtilDataSource.SOURCE_TYP_CUSTOM,
	UtilDataSource.SOURCE_TYP_OFFICIAL_SINGLE,
	UtilDataSource.SOURCE_TYP_ARCANA,
	UtilDataSource.SOURCE_TYP_BREW_LOCAL,
	UtilDataSource.SOURCE_TYP_BREW,
	UtilDataSource.SOURCE_TYP_UNKNOWN,
];

UtilDataSource.SOURCE_TYPE_ORDER__FILTER = [ // Order used in filter sorting
	UtilDataSource.SOURCE_TYP_OFFICIAL_ALL,
	UtilDataSource.SOURCE_TYP_OFFICIAL_SINGLE,
	UtilDataSource.SOURCE_TYP_ARCANA,
	UtilDataSource.SOURCE_TYP_BREW_LOCAL,
	UtilDataSource.SOURCE_TYP_BREW,
	UtilDataSource.SOURCE_TYP_CUSTOM,
	UtilDataSource.SOURCE_TYP_UNKNOWN,
];

UtilDataSource.DataSourceBase = class {
	/**
	 * @param name Source name.
	 * @param [opts] Options object.
	 * @param [opts.pPostLoad] Data modifier.
	 * @param [opts.filterTypes]
	 * @param [opts.isDefault]
	 * @param [opts.abbreviations]
	 */
	constructor (name, opts) {
		this.name = name;

		this.pPostLoad = opts.pPostLoad;
		this.filterTypes = opts.filterTypes || [UtilDataSource.SOURCE_TYP_UNKNOWN];
		this.isDefault = !!opts.isDefault;
		this.abbreviations = opts.abbreviations;
	}

	get identifier () { throw new Error(`Unimplemented!`); }
};

UtilDataSource.DataSourceUrl = class extends UtilDataSource.DataSourceBase {
	/**
	 * @param name Source name.
	 * @param url Source URL.
	 * @param [opts] Options object.
	 * @param [opts.source] Source JSON.
	 * @param [opts.pPostLoad] Data modifier.
	 * @param [opts.userData] Additional data to pass through to the loadee.
	 * @param [opts.filterTypes]
	 * @param [opts.icon]
	 * @param [opts.isDefault]
	 * @param [opts.abbreviations]
	 */
	constructor (name, url, opts) {
		opts = opts || {};

		super(name, opts);

		this.url = url;
		this.source = opts.source;
		this.userData = opts.userData;
	}

	get identifier () { return this.url === "" ? `VE_SOURCE_CUSTOM_URL` : this.url; }
};

UtilDataSource.DataSourceFile = class extends UtilDataSource.DataSourceBase {
	/**
	 * @param name Source name.
	 * @param [opts] Options object.
	 * @param [opts.source] Source JSON.
	 * @param [opts.pPostLoad] Data modifier.
	 * @param [opts.filterTypes]
	 * @param [opts.isDefault]
	 * @param [opts.abbreviations]
	 */
	constructor (name, opts) {
		opts = opts || {};

		super(name, opts);

		this.isFile = true;
		this.source = opts.source;
	}

	get identifier () { return `VE_SOURCE_CUSTOM_FILE`; }
};

UtilDataSource.DataSourceSpecial = class extends UtilDataSource.DataSourceBase {
	/**
	 * @param name Source name.
	 * @param pGet Data getter.
	 * @param opts Options object.
	 * @param opts.cacheKey Cache key to store the pGet data under.
	 * @param [opts.pPostLoad] Data modifier.
	 * @param [opts.isUseProps] If the prop info should be applied to the loaded data.
	 * @param [opts.filterTypes]
	 * @param [opts.isDefault]
	 * @param [opts.abbreviations]
	 */
	constructor (name, pGet, opts) {
		opts = opts || {};

		super(name, opts);

		this.special = {pGet};
		if (!opts.cacheKey) throw new Error(`No cache key specified!`);
		this.cacheKey = opts.cacheKey;
		this.isUseProps = opts.isUseProps;
	}

	get identifier () { return this.cacheKey; }
};

export {UtilDataSource};
