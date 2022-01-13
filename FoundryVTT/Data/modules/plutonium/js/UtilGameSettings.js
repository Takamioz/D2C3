class UtilGameSettings {
	static getSafe (module, key) {
		try {
			return game.settings.get(module, key);
		} catch (e) {
			return null;
		}
	}
}

export {UtilGameSettings};
