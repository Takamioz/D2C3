class UtilDocuments {
	static async pUpdateDocument (doc, docUpdate, {isTemporary = false} = {}, updateDocOpts) {
		// Foundry crashes when attempting to update temporary documents (as of 2021-11-23), so, handle it manually
		if (this.isTempDocument({doc, isTemporary})) {
			// If the document update is using non-standard options, error out
			if (updateDocOpts?.diff === false || updateDocOpts?.recursive === false) {
				// (Implement if required)
				throw new Error(`Non-diff and non-recursive temporary document updates are unsupported!`);
			}

			// Manually merge the data into the existing doc
			foundry.utils.mergeObject(doc.data, docUpdate);

			// `Document.update` seems to return the document, so, mirror that here
			return doc;
		}

		return doc.update(docUpdate, updateDocOpts);
	}

	static isTempDocument ({isTemporary, doc}) {
		// If we're passing in a forced "isTemporary" flag, always treat it as temporary
		return isTemporary
			// Temporary documents (as of 2021-11-23) have no IDs
			|| doc.id == null;
	}

	static async pCreateEmbeddedDocuments (doc, embedArray, {isTemporary = false, propData = null, ClsEmbed, embedName = null}, createEmbeddedDocOpts = {}) {
		if (!embedArray?.length) return [];

		propData = propData || ClsEmbed.metadata.collection;
		embedName = embedName || ClsEmbed.name;

		let createdEmbeds;

		if (this.isTempDocument({doc, isTemporary})) {
			createdEmbeds = await ClsEmbed.create(embedArray, {temporary: true});

			createdEmbeds.forEach(createdEmbed => {
				// Create fake IDs for our temp entities, so we can add them to the actor
				createdEmbed.data._id = createdEmbed.data._id || foundry.utils.randomID();
				createdEmbed.data._source._id = createdEmbed.data._source._id || createdEmbed.data._id;
				doc[propData].set(createdEmbed.id, createdEmbed);

				// If we have attached effects to the embeds, manually attach them to the doc, because (as of 2021-05-02)
				//   it doesn't do this itself...
				(createdEmbed.effects || []).forEach(effect => {
					effect.data._id = effect.data._id || foundry.utils.randomID();
					effect.data._source._id = effect.data._source._id || effect.data._id;
					doc.effects.set(effect.id, effect);
				});
			});
		} else {
			createdEmbeds = await doc.createEmbeddedDocuments(embedName, embedArray, {...createEmbeddedDocOpts});
		}

		if (embedArray.length !== createdEmbeds.length) throw new Error(`Number of returned items did not match number of input items!`); // Should never occur
		return embedArray.map((raw, i) => new UtilDocuments.ImportedEmbeddedDocument({raw, document: createdEmbeds[i]}));
	}

	static async pUpdateEmbeddedDocuments (doc, updateArray, {isTemporary = false, propData = null, ClsEmbed, embedName = null}, createEmbeddedDocOpts = {}) {
		if (!updateArray?.length) return [];

		propData = propData || ClsEmbed.metadata.collection;
		embedName = embedName || ClsEmbed.name;

		let updatedEmbeds;

		if (this.isTempDocument({doc, isTemporary})) {
			const updateTuples = updateArray.map(update => {
				if (!update._id) throw new Error(`Update had no "_id"!`);
				const embed = doc[propData].get(update._id);
				if (!embed) throw new Error(`${embedName} with id "${update._id}" not found in parent document!`);
				return {update, embed};
			});

			updateTuples.forEach(({update, embed}) => {
				// Manually merge the data into the existing doc
				foundry.utils.mergeObject(embed.data, MiscUtil.copy(update));
				foundry.utils.mergeObject(embed.data._source, MiscUtil.copy(update));
			});

			updatedEmbeds = updateTuples.map(it => it.embed);
		} else {
			const updatedEmbedsRaw = await doc.updateEmbeddedDocuments(embedName, updateArray, {...createEmbeddedDocOpts});
			if (updateArray.length === updatedEmbedsRaw.length) {
				updatedEmbeds = updatedEmbedsRaw;
			} else {
				// If there are no-op updates, Foundry does not return these as "updated" documents in the return value. Assemble our own versions instead.
				updatedEmbeds = updateArray.map(({_id}) => updateArray.find(it => it.id === _id) || doc[propData].get(_id));
			}
		}

		if (updateArray.length !== updatedEmbeds.length) throw new Error(`Number of returned items did not match number of input items!`); // Should never occur
		return updateArray.map((raw, i) => new UtilDocuments.ImportedEmbeddedDocument({raw, document: updatedEmbeds[i], isUpdate: true}));
	}
}

UtilDocuments.ImportedEmbeddedDocument = class {
	constructor ({raw, document, isUpdate = false}) {
		this.raw = raw;
		this.document = document;
		this.isUpdate = isUpdate;
	}
};

export {UtilDocuments};
