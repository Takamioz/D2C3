import {MouseButtonBinding, KeyBinding} from '../settings-extender/settings-extender.js';

function isWithinPx(p1, p2, px) {
	return Math.abs(p1.x - p2.x) <= px && Math.abs(p1.y - p2.y) <= px;
}

const DEFAULT_PING_COLOR = 0xAAAAAA;

function getUserColor(user) {
	return user.color.replace("#", "0x") || DEFAULT_PING_COLOR;
}

function getMousePos(foundryCanvas) {
	const mouse = foundryCanvas.app.renderer.plugins.interaction.mouse.global;
	const t = foundryCanvas.stage.worldTransform;

	function calcCoord(axis) {
		return (mouse[axis] - t['t' + axis]) / foundryCanvas.stage.scale[axis];
	}

	return {
		x: calcCoord('x'),
		y: calcCoord('y')
	};
}

/**
 * @typedef {PingOptions} GuiOptions
 * @property minMovePermission a permission from CONST.USER_ROLES for which user permissions are allowed to move the
 *     canvas
 * @property {boolean} showName if the user name should be shown under the ping
 * @property {string} mouseButton the settings-extender mouse button binding for which mouse button triggers a ping
 * @property {string} mouseButtonMove the settings-extender mouse button binding for which mouse button triggers a ping
 *     that moves the canvas
 * @property {number} mouseButtonDuration how long the mouse button has to be held down in milliseconds
 * @property {string} key the settings-extender key binding for which key triggers a ping
 * @property {string} keyMove the settings-extender key binding for which key triggers a ping that moves the canvas
 */

/**
 * @function PingCreateFunction
 * @param {PingPosition} pos
 * @param {*} id
 * @param {string} text
 * @param {ColorString} color
 * @param {PingOptions} options
 */

/**
 * @typedef {Object} UserPingedCallbackArg
 * @property {PingPosition} position the position on the canvas the ping is shown on
 * @property {*} id an id uniquely identifying the created ping
 * @property {boolean} moveCanvas if the ping moved the canvas
 */

/**
 * Creates the ping gui, registering appropriate listeners on the given window & foundryCanvas.stage
 *
 * @param window a JS window object
 * @param foundryCanvas
 * @param foundryGame
 * @param foundryHooks
 * @param {GuiOptions} options
 * @param {PingCreateFunction} createPing
 * @param {function(UserPingedCallbackArg)} userPingedCallback
 * @returns {{displayUserPing: displayUserPing, displayTextPing: displayTextPing, removePing: removePing}}
 */
export default function createPingsGui(window, foundryCanvas, foundryGame, foundryHooks, options, createPing, userPingedCallback = () => {}) {
	let mouseOnCanvas = false;
	function onMouseOverStage() {
		mouseOnCanvas = true;
	}
	function onMouseOutStage() {
		mouseOnCanvas = false;
	}
	function registerStageListeners() {
		[
			['mouseover', onMouseOverStage],
			['mouseout', onMouseOutStage]
		].forEach(l => foundryCanvas.stage.on(...l));
	}

	function isPressed(e, option, bindingType) {
		const userIsMissingPermission = !option;
		if (userIsMissingPermission) return false;

		const type = bindingType === 'mouse' ? MouseButtonBinding : KeyBinding;
		return type.eventIsForBinding(e, option);
	}
	function onKeyDownGlobal(e) {
		if (!mouseOnCanvas) return;
		const bindingType = 'keyboard';
		const shouldPingMove = isPressed(e, options.keyMove, bindingType);
		const shouldPingNoMove = isPressed(e, options.key, bindingType);
		if (!shouldPingMove && !shouldPingNoMove) return;

		triggerPing(shouldPingMove);
	}
	function addWindowListener(event, listener) {
		window.addEventListener(event, (e) => {
			listener(e.originalEvent || e);
		})
	}
	function onMouseDownGlobal(e) {
		if (!mouseOnCanvas) return;
		const bindingType = 'mouse';
		const shouldPingMove = isPressed(e, options.mouseButtonMove, bindingType);
		const shouldPingNoMove = isPressed(e, options.mouseButton, bindingType);
		if (!shouldPingMove && !shouldPingNoMove) return;

		const mouseDownStart = getMousePos(foundryCanvas);
		const mouseDownOption = 'mouseButton' + (shouldPingMove ? 'Move' : '');
		const mouseDownTimeout = setTimeout(() => {
			if (mouseOnCanvas && isWithinPx(mouseDownStart, getMousePos(foundryCanvas), 5)) {
				triggerPing(shouldPingMove);
			}
		}, options.mouseButtonDuration);
		addWindowListener('mouseup', (e) => {
			if (!isPressed(e, options[mouseDownOption], 'mouse')) return;

			clearTimeout(mouseDownTimeout);
		}, {once: true});
	}
	function registerGlobalListeners() {
		[
			['keydown', onKeyDownGlobal],
			['mousedown', onMouseDownGlobal],
		].forEach((l) => addWindowListener(...l));
	}

	function registerListeners() {
		registerGlobalListeners();
		registerStageListeners();
	}

	function displayPing(ping, moveCanvas = false) {
		if (moveCanvas) {
			foundryCanvas.animatePan({x: ping.x, y: ping.y});
		}

		foundryCanvas.stage.addChild(ping);
	}

	/**
	 * Triggers a ping from the current user at the current mouse location
	 *
	 * @param moveCanvas if the canvas should be moved
	 */
	function triggerPing(moveCanvas) {
		let position = getMousePos(foundryCanvas);
		userPingedCallback({
			position,
			id: foundryGame.user.id,
			moveCanvas
		});
		displayUserPing(position, foundryGame.user.id, moveCanvas);
	}

	/**
	 * Displays a ping from a user on the canvas
	 *
	 * @param {{x: Number, y: Number}} position
	 * @param {String} senderId The player who sent the ping
	 * @param {Boolean} [moveCanvas=false] if the ping should also move the canvas so the ping is centered
	 */
	function displayUserPing(position, senderId, moveCanvas = false) {
		const user = foundryGame.users.get(senderId);
		removePing(senderId);

		const text = options.showName ? user.name : undefined;
		const ping = createPing(position, senderId, text, getUserColor(user), options);
		moveCanvas = moveCanvas && user.hasRole(options.minMovePermission);
		displayPing(ping, moveCanvas)
	}

	/**
	 * Displays a text ping on the canvas
	 *
	 * @param {{x: Number, y: Number}} position
	 * @param {*} id id for the ping
	 * @param {String} text text to show for the ping
	 * @param {Number} color a 6-digit hexadecimal RBG value
	 * @param {Boolean} [moveCanvas=false] if the ping should also move the canvas so the ping is centered
	 */
	function displayTextPing(position, id, text, color, moveCanvas = false) {
		const ping = createPing(position, id, text, color, options);
		displayPing(ping, moveCanvas);
	}

	function removePing(id) {
		foundryCanvas.stage.children.filter((ping) => ping.id === id).forEach((ping) => ping.destroy());
	}

	registerListeners();
	// when canvas is drawn again, the listeners to the stage get cleared, so register them again
	foundryHooks.on('canvasReady', () => registerStageListeners());

	return {
		displayTextPing,
		displayUserPing,
		removePing
	}
}

