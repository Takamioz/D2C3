import Constants from '../constants.js';

export const MigrationResult = {
	UNNECESSARY: 0,
	FAILED: 1,
	SUCCESS: 2
};

function createMigrations(foundryGame) {
	return [
		{
			version: '1.2.2',
			func: async (lastVersion) => {
				if (lastVersion) {
					return MigrationResult.UNNECESSARY;
				}

				if (foundryGame.settings.get(Constants.PINGS, Constants.MINIMUM_PERMISSION) === 0) {
					await foundryGame.settings.set(Constants.PINGS, Constants.MINIMUM_PERMISSION, 1);
				}

				await foundryGame.settings.set(Constants.PINGS, Constants.LAST_VERSION, '1.2.2');
				return MigrationResult.SUCCESS;
			}
		}
	];
}

export async function migrate(foundryGame) {
	try {
		foundryGame.settings.register(Constants.PINGS, 'lastVersion', {
			config: false,
			scope: 'client',
			type: String,
			default: ''
		});
		let finalResult = undefined;
		let lastVersion = foundryGame.settings.get(Constants.PINGS, Constants.LAST_VERSION);
		for (const migration of createMigrations(foundryGame)) {
			const result = await migration.func(lastVersion);
			if (result === MigrationResult.FAILED) {
				finalResult = result;
				break;
			} else if (finalResult !== MigrationResult.SUCCESS) {
				finalResult = result;
			}
			lastVersion = migration.version;
		}
		return finalResult === MigrationResult.SUCCESS ? lastVersion : finalResult;
	} catch (e) {
		console.error('Pings MigrationResult failed:', e);
		return MigrationResult.FAILED;
	}
}
