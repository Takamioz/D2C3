import {MESSAGES, sendMessage} from './net.js';

let layer;
export function initApi(pingsLayer) {
	layer = pingsLayer;
	window.Azzu = window.Azzu || {};
	return window.Azzu.Pings = {
		remove,
		perform,
		performText,
		send,
		sendText,
		show,
		showText
	}
}

function getId() {
	// An incremental number was considered,
	// but that has more chance of collision between multiple users.
	// A more sophisticated approach is probably unnecessary.
	return Math.random().toString(36).substr(2);
}

function throwErrorNoNumber(num, name) {
	if (typeof num !== `number` || isNaN(num)) {
		throw new Error(`${name} is not a valid number!`);
	}
}

function throwOnUserMissing(userId) {
	if (!game.users.get(userId)) {
		throw new Error(`Given userId "${userId}" does not represent a player!`);
	}
}

function throwErrorNoColor(color) {
	throwErrorNoNumber(color, `color`);
	if (color < 0 || color > 0xFFFFFF) {
		throw new Error(`The color is not between 0x000000 and 0xFFFFFF`);
	}
}

/**
 * Perform a ping on the canvas as if the given user had performed a ping for all users in the game.
 *
 * @param {{x: Number, y: Number}} position the position of the ping on the canvas
 * @param {String} [userId=game.user.id] userId of the user the ping should originate from
 * @param {Boolean} [moveCanvas=false] if the ping should also move the canvas so the ping is centered.
 * @return {*} a ping id to be able to remove the ping with
 */
export function perform(position, userId = game.user.id, moveCanvas = false) {
	throwOnUserMissing(userId);
	throwErrorNoNumber(position.x, `position.x`);
	throwErrorNoNumber(position.y, `position.y`);
	layer.displayUserPing(position, userId, moveCanvas);
	sendMessage(MESSAGES.USER_PING, {
		id: userId,
		position,
		moveCanvas
	});
	return userId;
}

/**
 * Shows a ping on the canvas as if the given user had sent a ping. Does not send the ping to any other player.
 *
 * @param {{x: Number, y: Number}} position the position of the ping on the canvas
 * @param {String} [userId=game.user.id] userId of the user the ping should originate from
 * @param {Boolean} [moveCanvas=false] if the ping should also move the canvas so the ping is centered.
 * @return {*} a ping id to be able to remove the ping with
 */
export function show(position, userId = game.user.id, moveCanvas = false) {
	throwOnUserMissing(userId);
	throwErrorNoNumber(position.x, `position.x`);
	throwErrorNoNumber(position.y, `position.y`);
	layer.displayUserPing(position, userId, moveCanvas);
	return userId;
}

/**
 * Sends a ping to other players as if it was triggered by the given user.
 *
 * @param {{x: Number, y: Number}} position the position of the ping on the canvas
 * @param {String} [userId=game.user.id] userId of the user the ping should originate from
 * @param {Boolean} [moveCanvas=false] if the ping should also move the canvas so the ping is centered.
 */
export function send(position, userId = game.user.id, moveCanvas = false) {
	throwOnUserMissing(userId);
	throwErrorNoNumber(position.x, `position.x`);
	throwErrorNoNumber(position.y, `position.y`);
	sendMessage(MESSAGES.USER_PING, {
		id: userId,
		position,
		moveCanvas
	});
	return userId;
}

/**
 * Performs a ping with custom text on the canvas for all players.
 *
 * @param {{x: Number, y: Number}} position the position of the ping on the canvas
 * @param {String} text a custom text that should be shown below the ping. May be left falsy to not show any
 *     text.
 * @param {Number} [color=0xAAAAAA] a 6-digit hexadecimal RGB value from 0x000000 to 0xFFFFFF for the color of
 *     the ping
 * @param {Boolean} [moveCanvas=false] if the ping should also move the canvas so the ping is centered.
 */
export function performText(position, text, color = DEFAULT_PING_COLOR, moveCanvas = false) {
	throwErrorNoNumber(position.x, `position.x`);
	throwErrorNoNumber(position.y, `position.y`);
	throwErrorNoColor(color);
	const id = getId();
	layer.displayTextPing(position, id, text, color, moveCanvas);
	sendMessage(MESSAGES.TEXT_PING, {
		position,
		id,
		text,
		color,
		moveCanvas
	});
	return id;
}

/**
 * Shows a ping with custom text on the canvas.
 *
 * @param {{x: Number, y: Number}} position the position of the ping on the canvas
 * @param {String} text a custom text that should be shown below the ping. May be left falsy to not show any
 *     text.
 * @param {Number} [color=0xAAAAAA] a 6-digit hexadecimal RGB value from 0x000000 to 0xFFFFFF for the color of
 *     the ping
 * @param {Boolean} [moveCanvas=false] if the ping should also move the canvas so the ping is centered.
 */
export function showText(position, text, color = DEFAULT_PING_COLOR, moveCanvas = false) {
	throwErrorNoNumber(position.x, `position.x`);
	throwErrorNoNumber(position.y, `position.y`);
	throwErrorNoColor(color);
	const id = getId();
	layer.displayTextPing(position, id, text, color, moveCanvas);
	return id;
}

/**
 * Shows a ping with custom text on the canvas.
 *
 * @param {{x: Number, y: Number}} position the position of the ping on the canvas
 * @param {String} text a custom text that should be shown below the ping. May be left falsy to not show any
 *     text.
 * @param {Number} [color=0xAAAAAA] a 6-digit hexadecimal RGB value from 0x000000 to 0xFFFFFF for the color of
 *     the ping
 * @param {Boolean} [moveCanvas=false] if the ping should also move the canvas so the ping is centered.
 */
export function sendText(position, text, color = DEFAULT_PING_COLOR, moveCanvas = false) {
	throwErrorNoNumber(position.x, `position.x`);
	throwErrorNoNumber(position.y, `position.y`);
	throwErrorNoColor(color);
	const id = getId();
	sendMessage(MESSAGES.TEXT_PING, {
		position,
		id,
		text,
		color,
		moveCanvas
	});
	return id;
}

/**
 * Removes a ping that has been created with the other methods of this class.
 * @param {*} id a ping ID obtained by calling one of the other methods of this class
 * @param {Boolean} [removeForOthers=true] if the ping should be removed for all users. If false, will only be
 *     removed locally.
 */
export function remove(id, removeForOthers = true) {
	layer.removePing(id);
	if (removeForOthers) {
		sendMessage(MESSAGES.REMOVE_PING, {id});
	}
}
