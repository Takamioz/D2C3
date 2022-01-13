import {DocumentEmbeddedDocumentCleaner} from "./DocumentEmbeddedDocumentCleaner.js";

class TableResultCleaner extends DocumentEmbeddedDocumentCleaner {
	constructor (table) {
		super({
			title: "Row Cleaner",
			doc: table,
			embedType: "TableResult",
			embedProp: "results",
			displayName: "row",
			displayNamePlural: "rows",
			namespace: `tool-table-result-cleaner`,
		});
	}

	static _sortEntities (a, b, opts) {
		return opts.sortBy === "name"
			? (SortUtil.ascSort(a.data.rangeLow, b.data.rangeLow) || super._sortEntities(a, b, opts))
			: super._sortEntities(a, b, opts);
	}

	_getData_getRow (doc, ix) {
		const out = super._getData_getRow(doc, ix);
		out.rangeLow = Math.min(...(doc.data.range || []));
		if (out.rangeLow === Infinity) out.rangeLow = Number.MIN_SAFE_INTEGER;
		return out;
	}

	_getData_getEmbeddedDocName (doc) {
		return [
			(doc.data.range || []).filter(it => it != null).join("\u2012"),
			doc.data.text,
		]
			.filter(Boolean)
			.join(" ");
	}

	_getData_getEmbeddedDocType (doc) {
		switch (doc.data.type) {
			case 0: return `Text`;
			case 1: return `Collection (${doc.data.collection})`;
			case 2: return `Compendium (${doc.data.collection})`;
			default: throw new Error(`Unhandled table result type "${doc.data.type}"`);
		}
	}
}

export {TableResultCleaner};
