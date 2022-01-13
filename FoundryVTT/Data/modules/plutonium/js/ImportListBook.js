import {ImportListAdventureBook} from "./ImportListAdventureBook.js";
import {Vetools} from "./Vetools.js";
import {DataConverterAdventureBook} from "./DataConverterAdventureBook.js";

class ImportListBook extends ImportListAdventureBook {
	constructor (externalData) {
		super(
			{title: "Import Book"},
			externalData,
			{
				titleSearch: "books",
				defaultFolderPath: ["Books"],
				dirsHomebrew: ["book"],
				namespace: "book",
				isFolderOnly: true,
				configGroup: "importBook",
			},
			{
				fnGetIndex: Vetools.pGetBookIndex.bind(Vetools),
				dataProp: "book",
				brewDataProp: "bookData",
				title: "Book",
			},
		);
	}

	_pGetJournalDatas () {
		return DataConverterAdventureBook.pGetBookJournals(this._content.data, this._content._contentMetadata, {isAddPermission: true});
	}
}

export {ImportListBook};
