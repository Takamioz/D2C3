import {initNetwork, MESSAGES, onMessageReceived, sendMessage} from './net.js';
import {initApi} from './api.js';
import createPingsGui from './pings-gui.js';
import setupSettings from './settings/settings.js';
import Ping from './ping.js';


async function preRequisitesReady() {
	return Promise.all([areSettingsLoaded(), isCanvasReady()]);
}

async function areSettingsLoaded() {
	return new Promise(resolve => {
		Hooks.once('ready', () => {
			resolve(setupSettings(game));
		});
	});
}

async function isCanvasReady() {
	return new Promise(resolve => {
		Hooks.once('canvasReady', resolve);
	});
}

function addNetworkBehavior(pingsGui) {
	initNetwork();

	onMessageReceived(MESSAGES.USER_PING, ({id, position, moveCanvas}) => {
		pingsGui.displayUserPing(position, id, moveCanvas)
	});

	onMessageReceived(MESSAGES.TEXT_PING, ({id, position, text, color, moveCanvas}) => {
		pingsGui.displayTextPing(position, id, text, color, moveCanvas);
	});

	onMessageReceived(MESSAGES.REMOVE_PING, ({id}) => {
		pingsGui.removePing(id);
	});
}

(async () => {
	const [Settings] = await preRequisitesReady();
	const pingsGui = createPingsGui(window,
		canvas,
		game,
		Hooks,
		Settings,
		(...args) => new Ping(canvas, CONFIG, ...args),
		sendMessage.bind(null, MESSAGES.USER_PING)
	);
	addNetworkBehavior(pingsGui);
	const api = initApi(pingsGui);
	Hooks.callAll('pingsReady', api);
})();
