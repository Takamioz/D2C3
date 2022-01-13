class UtilMigrate {
	// FIXME(Future) replace `owner` with `isOwner` if `ActorSheet5e.getData` is changed to match new `isOwner` convention
	static isOwner (doc) {
		return doc.owner || doc.isOwner;
	}
}

export {UtilMigrate};
