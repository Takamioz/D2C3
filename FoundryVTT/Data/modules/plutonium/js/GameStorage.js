import {UtilGameSettings} from "./UtilGameSettings.js";

class GameStorage {
	static _registerClient (key) {
		return this._register(key, "client");
	}

	static _registerWorld (key) {
		return this._register(key, "world");
	}

	static _register (key, type) {
		const keyPrefix = type === "world" ? GameStorage._STORE_KEY_WORLD : GameStorage._STORE_KEY_CLIENT;
		key = `${keyPrefix}_${key}`;
		game.settings.register(
			GameStorage.SETTINGS_KEY,
			key,
			{
				name: key,
				hint: key,
				scope: type,
				config: false,
				default: {},
				type: Object,
			},
		);
		return key;
	}

	static async pGetClient (key) {
		const fullKey = this._registerClient(key);
		return (UtilGameSettings.getSafe(GameStorage.SETTINGS_KEY, fullKey) || {})._;
	}

	static async pSetClient (key, value) {
		const fullKey = this._registerClient(key);
		await game.settings.set(GameStorage.SETTINGS_KEY, fullKey, {_: value});
	}

	static async pGetWorld (key) {
		const fullKey = this._registerWorld(key);
		return (UtilGameSettings.getSafe(GameStorage.SETTINGS_KEY, fullKey) || {})._;
	}

	static async pSetWorld (key, value) {
		const fullKey = this._registerWorld(key);
		await game.settings.set(GameStorage.SETTINGS_KEY, fullKey, {_: value});
	}
}
GameStorage.SETTINGS_KEY = "plutonium";
GameStorage._STORE_KEY_CLIENT = "plutonium_client";
GameStorage._STORE_KEY_WORLD = "plutonium_world";

export {GameStorage};
