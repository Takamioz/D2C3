import {Config} from "./Config.js";
import {SharedConsts} from "../shared/SharedConsts.js";

class Patcher_ChatMessage {
	static handleConfigUpdate ({isInit = false} = {}) {
		try {
			return this._handleConfigUpdate_();
		} catch (e) {
			if (!isInit) throw e;
			Config.handleFailedInitConfigApplication("ui", "isCompactChat", e);
		}
	}

	static _handleConfigUpdate_ () {
		// On option change, update the existing message renders in chat
		if (Patcher_ChatMessage._LAST_CONFIG_STATE == null || Patcher_ChatMessage._LAST_CONFIG_STATE !== Config.get("ui", "isCompactChat")) {
			Patcher_ChatMessage._LAST_CONFIG_STATE = Config.get("ui", "isCompactChat");
			if (Patcher_ChatMessage._LAST_CONFIG_STATE) this._doAddToExistingMessages();
			else this._doRemoveFromExistingMessages();
		}
	}

	static _doAddToExistingMessages () {
		const $messages = ui.chat.element.find(`.message`);
		$messages.each((i, e) => {
			const $ele = $(e);
			const chatMessage = CONFIG.ChatMessage.collection.instance.get(e.dataset.messageId);
			this._handleRenderChatMessage(chatMessage, $ele, true);
		});
	}

	static _doRemoveFromExistingMessages () {
		const $messages = ui.chat.element.find(`.message`);
		$messages.each((i, e) => {
			e.classList.remove(`chatmsg__trim-top`);
			e.classList.remove(`chatmsg__trim-bottom`);
			$(e)
				.off(`mousemove.${Patcher_ChatMessage._EVENT_NAMESPACE}`)
				.off(`mouseover.${Patcher_ChatMessage._EVENT_NAMESPACE}`)
				.off(`mouseleave.${Patcher_ChatMessage._EVENT_NAMESPACE}`);
		});
	}

	static init () {
		Hooks.on("renderChatMessage", (chatMessage, $ele) => {
			if (!Config.get("ui", "isCompactChat")) return;

			this._handleRenderChatMessage(chatMessage, $ele);
		});

		Hooks.on("deleteChatMessage", (...args) => {
			if (!Config.get("ui", "isCompactChat")) return;

			this._handleDeleteChatMessage(...args);
		});
	}

	static _handleRenderChatMessage (chatMessage, $ele, isIgnoreExisting) {
		// region Handle message updates
		if (!isIgnoreExisting) {
			const $eleExisting = this._$getExistingRender(chatMessage);
			if ($eleExisting && $eleExisting.length) {
				return this._doHandleExistingMessage(chatMessage, $ele, $eleExisting);
			}
		}
		// endregion

		if (!this._isMetaMatch(chatMessage)) {
			Patcher_ChatMessage._LAST_MESSAGE_META = this._getMessageMeta(chatMessage, $ele);
			return;
		}

		// region Adjust previous message
		Patcher_ChatMessage._LAST_MESSAGE_META.$ele.addClass(`chatmsg__trim-bottom`);
		// endregion

		// region Adjust this message
		const nxtMeta = this._getMessageMeta(chatMessage, $ele);

		nxtMeta.$ele.addClass(`chatmsg__trim-top`);
		this._doBindTrimmedTopEventHandlers(nxtMeta.$ele);
		// endregion

		Patcher_ChatMessage._LAST_MESSAGE_META = nxtMeta;
	}

	static _getMessageMeta (chatMessage, $ele) {
		const $header = $ele.find(`header.message-header`);

		return {
			$ele,
			$header,
			chatMessage,
		};
	}

	static _$getExistingRender (chatMessage) {
		// Based on `ui.chat.updateMessage`
		// Note that this is a performance nightmare, but until Foundry updates chat to e.g. track existing renders,
		//   this is all we can do without performing invasive surgery.
		return ui.chat.element.find(`.message[data-message-id="${chatMessage.id}"]`);
	}

	static _doHandleExistingMessage (chatMessage, $ele, $eleExisting) {
		if ($eleExisting.hasClass("chatmsg__trim-bottom")) $ele.addClass("chatmsg__trim-bottom");

		if ($eleExisting.hasClass("chatmsg__trim-top")) {
			$ele.addClass("chatmsg__trim-top");
			this._doBindTrimmedTopEventHandlers($ele);
		}
	}

	static _isMetaMatch (chatMessage) {
		if (!Patcher_ChatMessage._LAST_MESSAGE_META) return false;

		const {chatMessage: lastChatMessage} = Patcher_ChatMessage._LAST_MESSAGE_META;
		if (!lastChatMessage?.data || !chatMessage?.data) return false;

		// If the last message by this speaker was too long ago
		if (lastChatMessage.data.timestamp < chatMessage.data.timestamp - Patcher_ChatMessage._SPEAKER_TIMEOUT_MSEC) return false;

		if (lastChatMessage.user?.id !== chatMessage.user?.id) return false;
		if (lastChatMessage.user?.color !== chatMessage.user?.color) return false;
		if (lastChatMessage.author?.id !== chatMessage.author?.id) return false;
		if (lastChatMessage.alias !== chatMessage.alias) return false;
		if (!CollectionUtil.deepEquals(lastChatMessage.data?.whisper, chatMessage.data?.whisper)) return false;
		if (lastChatMessage.data?.blind !== chatMessage.data?.blind) return false;

		return true;
	}

	static _handleDeleteChatMessage (chatMessage) {
		const $ele = ui.chat.element.find(`.message[data-message-id="${chatMessage.id}"]`);

		const $prevEle = $ele.prev();
		const $nxtEle = $ele.next();

		// If we were a group header, and the next element is a group member, make the next element a group header
		if ($nxtEle.length) {
			if (!$ele.hasClass(`chatmsg__trim-top`) && $ele.hasClass(`chatmsg__trim-bottom`)) {
				$nxtEle.removeClass(`chatmsg__trim-top`);
			}
		}

		// If we were a group footer, and the previous element is a group member, make the previous element the group footer
		if ($prevEle.length) {
			if ($ele.hasClass(`chatmsg__trim-top`) && !$ele.hasClass(`chatmsg__trim-bottom`)) {
				$prevEle.removeClass(`chatmsg__trim-bottom`);
			}
		}

		// Cleanup the tracked message, if we are deleting it
		if (Patcher_ChatMessage._LAST_MESSAGE_META) {
			const {chatMessage: lastChatMessage} = Patcher_ChatMessage._LAST_MESSAGE_META;
			if (lastChatMessage === chatMessage) Patcher_ChatMessage._LAST_MESSAGE_META = null;
		}
	}

	static _doBindTrimmedTopEventHandlers ($ele) {
		$ele
			.on(`mousemove.${Patcher_ChatMessage._EVENT_NAMESPACE}`, evt => {
				if (!evt.shiftKey) return;
				$ele.addClass(`chatmsg__trim-top--inspecting`);
			})
			.on(`mouseover.${Patcher_ChatMessage._EVENT_NAMESPACE}`, evt => {
				if (!evt.shiftKey) return;
				$ele.addClass(`chatmsg__trim-top--inspecting`);
			})
			.on(`mouseleave.${Patcher_ChatMessage._EVENT_NAMESPACE}`, () => {
				$ele.removeClass(`chatmsg__trim-top--inspecting`);
			});
	}
}
Patcher_ChatMessage._LAST_CONFIG_STATE = null;
Patcher_ChatMessage._SPEAKER_TIMEOUT_MSEC = 30_000;
Patcher_ChatMessage._LAST_MESSAGE_META = null;
Patcher_ChatMessage._EVENT_NAMESPACE = `${SharedConsts.MODULE_NAME}-chat`;

export {Patcher_ChatMessage};
