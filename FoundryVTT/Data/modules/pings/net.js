
const SOCKET_NAME= 'module.pings';

const callbacks = {};

function messageCallbacks(message) {
	const prop = `_funcs${message}`;
	if (!callbacks[prop]) {
		callbacks[prop] = [];
	}
	return callbacks[prop];
}

function runMessageCallbacks(message, pingData) {
	messageCallbacks(message).forEach(func => func(pingData));
}

export function initNetwork() {
	game.socket.on(SOCKET_NAME, (data) => {
		if (canvas.scene.id !== data.sceneId) {
			return;
		}

		runMessageCallbacks(data.message, data.pingData);
	});
}


export function onMessageReceived(message, func) {
	messageCallbacks(message.name).push(func);
}


function emit(...args) {
	game.socket.emit(SOCKET_NAME, ...args)
}


export function sendMessage(message, pingData) {
	message.dataProperties.forEach(prop => {
		if (!pingData.hasOwnProperty(prop)) {
			throw new Error(`Missing data for message "${message.name}": ${prop}`);
		}
	});
	emit({
		message: message.name,
		sceneId: canvas.scene.id,
		pingData
	});
}

const defaultPingProperties = [
	'id',
	'position',
	'moveCanvas'
];
export const MESSAGES = {

		USER_PING: {
			name: 'UserPing',
			dataProperties: [
				...defaultPingProperties
			]
		},
		TEXT_PING: {
			name: 'TextPing',
			dataProperties: [
				'text',
				'color',
				...defaultPingProperties
			]
		},
		REMOVE_PING: {
			name: 'RemovePing',
			dataProperties: [
				'id'
			]
		}
};
