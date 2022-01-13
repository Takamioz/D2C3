import {DocumentEmbeddedDocumentCleaner} from "./DocumentEmbeddedDocumentCleaner.js";

class ActorItemCleaner extends DocumentEmbeddedDocumentCleaner {
	constructor (actor) {
		super({
			title: "Item Cleaner",
			doc: actor,
			embedType: "Item",
			embedProp: "items",
			displayName: "item",
			displayNamePlural: "items",
			namespace: `tool-actor-item-cleaner`,
		});
	}

	_getData_getEmbeddedDocName (doc) { return doc.name; }
	_getData_getEmbeddedDocType (doc) { return (doc.data.type || "").toTitleCase(); }
}

export {ActorItemCleaner};
