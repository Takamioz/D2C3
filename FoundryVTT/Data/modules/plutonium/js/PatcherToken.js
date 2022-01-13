import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {LGT} from "./Util.js";
import {ConfigConsts} from "./ConfigConsts.js";

class Patcher_Token {
	static init () {
		// region "Damage dealt" display
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"Token.prototype.refresh",
			function (fn, ...args) {
				if (Config.get("tokens", "isDisplayDamageDealt")) Patcher_Token._handleConfigUpdate_displayDamageDealt_doUpdateDisplay(this);
				return fn(...args);
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"Token.prototype._onUpdate",
			function (fn, ...args) {
				if (Config.get("tokens", "isDisplayDamageDealt")) Patcher_Token._handleConfigUpdate_displayDamageDealt_doUpdateDisplay(this);
				return fn(...args);
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"TokenDocument.prototype._onUpdateTokenActor",
			function (fn, ...args) {
				if (Config.get("tokens", "isDisplayDamageDealt")) Patcher_Token._handleConfigUpdate_displayDamageDealt_doUpdateDisplay(this.object);
				return fn(...args);
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"TokenDocument.prototype._onUpdateBaseActor",
			function (fn, ...args) {
				if (Config.get("tokens", "isDisplayDamageDealt")) Patcher_Token._handleConfigUpdate_displayDamageDealt_doUpdateDisplay(this.object);
				return fn(...args);
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);
		// endregion

		// region Nameplate text size
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"Token.prototype._getTextStyle",
			function (fn, ...args) {
				const out = fn(...args);

				const fontSizeMult = Config.get("tokens", "nameplateFontSizeMultiplier");
				if (fontSizeMult != null) {
					if (out.fontSize != null) out.fontSize *= fontSizeMult;
				}

				const isAllowWrap = Config.get("tokens", "isAllowNameplateFontWrap");
				if (isAllowWrap !== ConfigConsts.C_USE_GAME_DEFAULT) {
					out.wordWrap = !!isAllowWrap;
				}

				const fontWrapWidthMult = Config.get("tokens", "nameplateFontWrapWidthMultiplier");
				if (fontWrapWidthMult != null) {
					if (out.wordWrapWidth != null) out.wordWrapWidth *= fontWrapWidthMult;
				}

				return out;
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);
		// endregion
	}

	static handleConfigUpdate ({isInit = false, current, previous} = {}) {
		const tokens = MiscUtil.get(canvas, "tokens", "placeables") || [];

		this._handleConfigUpdate_displayDamageDealt({isInit, tokens});

		// Avoid doing a draw unless we've had a relevant config update
		if (!this._handleConfigUpdate_isDoDraw({isInit, current, previous})) return;

		for (const token of tokens) {
			try {
				const visible = token.visible;
				token.draw();
				token.visible = visible;
			} catch (e) {
				// Sanity check/should never occur
				console.warn(...LGT, `Failed to refresh token "${token.id}"!`, e);
			}
		}
	}

	static _handleConfigUpdate_isDoDraw ({isInit, current, previous}) {
		if (isInit) return true;
		if (!current || !previous) return false;

		const diffProps = [
			"isDisplayDamageDealt",
			"damageDealtBloodiedThreshold",

			"nameplateFontSizeMultiplier",
			"isAllowNameplateFontWrap",
			"nameplateFontWrapWidthMultiplier",
		];
		return diffProps.some(prop => MiscUtil.get(current, "tokens", prop) !== MiscUtil.get(previous, "tokens", prop));
	}

	static _handleConfigUpdate_displayDamageDealt ({isInit = false, tokens} = {}) {
		try {
			return this._handleConfigUpdate_displayDamageDealt_({tokens});
		} catch (e) {
			if (!isInit) throw e;
			Config.handleFailedInitConfigApplication("tokens", "isDisplayDamageDealt", e);
		}
	}

	static _handleConfigUpdate_displayDamageDealt_ ({tokens}) {
		this._handleConfigUpdate_displayDamageDealt_doRefreshTokens({
			tokens,
			isRemoveDisplays: !Config.get("tokens", "isDisplayDamageDealt"),
		});
	}

	/**
	 * @param [opts]
	 * @param [opts.tokens]
	 * @param [opts.isRemoveDisplays] If the custom displays should be removed.
	 */
	static _handleConfigUpdate_displayDamageDealt_doRefreshTokens ({tokens, isRemoveDisplays}) {
		for (const token of tokens) {
			try {
				if (isRemoveDisplays && token._plutonium_xDispDamageDealt) {
					token.removeChild(token._plutonium_xDispDamageDealt);
					token._plutonium_xDispDamageDealt = null;
				}
			} catch (e) {
				// Should never occur
			}
		}
	}

	static _handleConfigUpdate_displayDamageDealt_doUpdateDisplay (token) {
		try {
			this._handleConfigUpdate_displayDamageDealt_doAddDisplay(token);

			const maxHp = MiscUtil.get(token.actor, "data", "data", "attributes", "hp", "max") || 0;
			const curHp = MiscUtil.get(token.actor, "data", "data", "attributes", "hp", "value") || 0;

			const damageDealt = Math.min(maxHp, Math.max(0, maxHp - curHp));
			token._plutonium_xDispDamageDealt.text = `-${damageDealt}`;

			token._plutonium_xDispDamageDealt.visible = !!damageDealt;

			if (curHp <= Math.floor(maxHp * Config.get("tokens", "damageDealtBloodiedThreshold"))) token._plutonium_xDispDamageDealt.style.fill = 0xFF0000;
			else token._plutonium_xDispDamageDealt.style.fill = 0xFFFFFF;
		} catch (e) {
			// Sanity check/should never occur
			console.warn(...LGT, `Failed to update "damage dealt" display for token "${token.id}"!`, e);
		}
	}

	static _handleConfigUpdate_displayDamageDealt_doAddDisplay (token) {
		if (
			token._plutonium_xDispDamageDealt
			&& token._plutonium_xDispDamageDealt.parent // Our display can become orphaned--in this case, we need to regenerate it
		) return;

		// If orphaned, cleanup to prevent any leaks
		if (token._plutonium_xDispDamageDealt && !token._plutonium_xDispDamageDealt.parent) {
			token.removeChild(token._plutonium_xDispDamageDealt);
			token._plutonium_xDispDamageDealt = null;
		}

		// region Based on "Token._drawNameplate()"
		// Create the nameplate text
		token._plutonium_xDispDamageDealt = new PIXI.Text("", CONFIG.canvasTextStyle.clone());
		token._plutonium_xDispDamageDealt.style.fontSize = 24;

		// Anchor text to the bottom-right of the nameplate
		token._plutonium_xDispDamageDealt.anchor.set(1, 1);

		// Set position at bottom-right of token (with small offsets)
		token._plutonium_xDispDamageDealt.position.set(token.w - 3, token.h - 1);

		token.addChild(token._plutonium_xDispDamageDealt);
	}
}

export {Patcher_Token};
