import {ImportListAdventureBook} from "./ImportListAdventureBook.js";
import {Vetools} from "./Vetools.js";
import {DataConverterAdventureBook} from "./DataConverterAdventureBook.js";

class ImportListAdventure extends ImportListAdventureBook {
	constructor (externalData) {
		super(
			{title: "Import Adventure"},
			externalData,
			{
				titleSearch: "adventures",
				defaultFolderPath: ["Adventures"],
				dirsHomebrew: ["adventure"],
				namespace: "adventure",
				isFolderOnly: true,
				configGroup: "importAdventure",
			},
			{
				fnGetIndex: Vetools.pGetAdventureIndex.bind(Vetools),
				dataProp: "adventure",
				brewDataProp: "adventureData",
				title: "Adventure",
			},
		);
	}

	async pPreRender (...args) {
		await super.pPreRender(...args);

		// Pre-load all creatures, so we can add them, as source-appropriate, to the selection being imported.
		if (ImportListAdventure._ALL_CREATURES) return;
		ImportListAdventure._ALL_CREATURES = await Vetools.pGetAllCreatures();
	}

	_getAdditionalContentForTag (tag) {
		if (tag !== ImportListAdventureBook.IMPORTABLE_TAG_CREATURE.tag) return;

		// Only search up additional creatures for official content
		const source = this._content?._contentMetadata?.source;
		if (!Parser.SOURCE_JSON_TO_FULL[source]) return;

		return (ImportListAdventure._ALL_CREATURES?.monster || [])
			.filter(it => {
				if (it.source === source) return true;
				return it.otherSources && it.otherSources.some(os => os.source === source);
			})
			.map(it => ({source: it.source, hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY](it)}));
	}

	_pGetJournalDatas () {
		return DataConverterAdventureBook.pGetAdventureJournals(this._content.data, this._content._contentMetadata, {isAddPermission: true});
	}
}

ImportListAdventure._ALL_CREATURES = null;

export {ImportListAdventure};
