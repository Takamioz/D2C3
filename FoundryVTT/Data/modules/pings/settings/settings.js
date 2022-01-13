import Constants from '../constants.js';
import {migrate, MigrationResult} from './migration.js';
import extraTypes from '../../settings-extender/settings-extender.js';

window.Azzu = window.Azzu || {};

/**
 * May only be called after the foundry game.settings object is fully initialized
 * @returns {Promise<GuiOptions>}
 */
export default async function setupSettings(foundryGame) {
	const settings = {};
	registerPingsSettings(foundryGame, settings);
	const migrationResult = await migrate(foundryGame);
	if (migrationResult === MigrationResult.FAILED) {
		alert('The settings of the "Pings" module could not be updated after you or your GM installed a new ' +
			'version. If you encounter any issues or this message keeps showing up, please disable the module ' +
			'and contact me on Discord (Azzurite#2004) or file an issue at ' +
			'https://gitlab.com/foundry-azzurite/pings/issues');
	} else if (typeof migrationResult === 'string' && migrationResult !== '1.2.2') {
		ChatMessage.create({
			speaker: {alias: 'Pings Module Notification'},
			content: `You have updated the Pings module to at least v${migrationResult}. The module settings ` +
				'structure has changed, so the settings were successfully migrated. You may have to reload this ' +
				'page for the settings menu to work correctly.',
			whisper: [game.user.id],
			timestamp: Date.now()
		});
	}
	return settings;
}


function registerPingsSettings(foundryGame, settings) {

	function localize(key) {
		return foundryGame.i18n.localize(Constants.PINGS + '.' + key);
	}


	function register(settings, key, data) {
		const dataWithDefaults = {
			scope: 'client',
			type: String,
			config: true,
			...data
		};
		defineSetting(settings, key, dataWithDefaults.type);
		foundryGame.settings.register(Constants.PINGS, key, dataWithDefaults);
	}

	function defineSetting(settings, key, type) {
		const get = () => foundryGame.settings.get(Constants.PINGS, key);
		const set = (val) => foundryGame.settings.set(Constants.PINGS, key, val);
		let getset;
		if (type.parse && Object.values(extraTypes).includes(type)) {
			getset = {
				get: () => type.parse(get()),
				set: (val) => set(type.format(val))
			};
		} else {
			getset = {
				get,
				set
			};
		}
		if (!settings.hasOwnProperty(key)) Object.defineProperty(settings, key, getset);
	}

	function registerMovePermissionSetting(settings) {
		const choices = Object.entries(CONST.USER_ROLES)
			.filter(([key, val]) => val !== 0)
			.reduce((choices, [permission, val]) => {
				choices[val] = permission;
				return choices;
			}, {});
		register(settings, Constants.MINIMUM_PERMISSION, {
			name: localize('settings.minMovePermission.title'),
			hint: localize('settings.minMovePermission.hint'),
			default: 1,
			isSelect: true,
			choices: choices,
			type: Number,
			scope: "world"
		});
		return settings[Constants.MINIMUM_PERMISSION];
	}

	function registerPingDisplaySettings(settings) {
		register(settings, 'showName', {
			name: localize('settings.showName.title'),
			hint: localize('settings.showName.hint'),
			default: true,
			type: Boolean
		});
		register(settings, 'image', {
			name: localize('settings.image.title'),
			hint: localize('settings.image.hint'),
			default: '',
			type: extraTypes.FilePickerImage
		});
		register(settings, 'scale', {
			name: localize('settings.scale.title'),
			hint: localize('settings.scale.hint'),
			default: 1,
			type: Number
		});
		register(settings, 'duration', {
			name: localize('settings.duration.title'),
			hint: localize('settings.duration.hint'),
			default: 6,
			type: Number
		});
		register(settings, 'rotate', {
			name: localize('settings.rotate.title'),
			hint: localize('settings.rotate.hint'),
			default: true,
			type: Boolean
		});
		register(settings, 'rotateSpeed', {
			name: localize('settings.rotateSpeed.title'),
			hint: localize('settings.rotateSpeed.hint'),
			default: 6,
			type: Number
		});
		register(settings, 'sizeChange', {
			name: localize('settings.sizeChange.title'),
			hint: localize('settings.sizeChange.hint'),
			default: true,
			type: Boolean
		});
		register(settings, 'sizeChangeAmount', {
			name: localize('settings.sizeChangeAmount.title'),
			hint: localize('settings.sizeChangeAmount.hint'),
			default: 0.125,
			type: Number
		});
		register(settings, 'sizeChangeSpeed', {
			name: localize('settings.sizeChangeSpeed.title'),
			hint: localize('settings.sizeChangeSpeed.hint'),
			default: 3,
			type: Number
		});
	}

	function registerPingBindsSettings(settings, minMovePermission) {
		register(settings, 'mouseButton', {
			name: localize('settings.mouseButton.title'),
			hint: localize('settings.mouseButton.hint'),
			default: 'LeftClick',
			type: extraTypes.MouseButtonBinding
		});
		if (game.user.hasRole(minMovePermission)) {
			register(settings, 'mouseButtonMove', {
				name: localize('settings.mouseButtonMove.title'),
				hint: localize('settings.mouseButtonMove.hint'),
				default: 'Shift + LeftClick',
				type: extraTypes.MouseButtonBinding
			});
		}
		register(settings, 'mouseButtonDuration', {
			name: localize('settings.mouseButtonDuration.title'),
			hint: localize('settings.mouseButtonDuration.hint'),
			default: 350,
			type: Number
		});
		register(settings, 'key', {
			name: localize('settings.key.title'),
			hint: localize('settings.key.hint'),
			default: '',
			type: extraTypes.KeyBinding
		});
		if (game.user.hasRole(minMovePermission)) {
			register(settings, 'keyMove', {
				name: localize('settings.keyMove.title'),
				hint: localize('settings.keyMove.hint'),
				default: '',
				type: extraTypes.KeyBinding
			});
		}
	}

	const minMovePermission = registerMovePermissionSetting(settings);
	registerPingBindsSettings(settings, minMovePermission);
	registerPingDisplaySettings(settings);
	return settings;
}
