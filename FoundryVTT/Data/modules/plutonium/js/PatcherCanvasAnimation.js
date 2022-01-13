import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";

class Patcher_CanvasAnimation {
	static init () {
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"Token.prototype.setPosition",
			function (fn, x, y, opts, ...otherArgs) {
				if (
					Config.get("tokens", "isFastAnimations")
					&& (
						!Config.get("tokens", "isDisableFastAnimationsForWaypointMovement")
						|| !Patcher_CanvasAnimation._isTokenMovingAlongRuler(this)
					)
				) {
					opts = opts || {};
					opts.animate = false;
				}
				return fn(x, y, opts, ...otherArgs);
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"Ruler.prototype._getMovementToken",
			function (fn) {
				const out = fn();
				this._plut_tokenLastMoving = out;
				return out;
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);
	}

	static _isTokenMovingAlongRuler (token) {
		return canvas.controls.rulers.children.some(it => it._state === Ruler.STATES.MOVING && it._plut_tokenLastMoving === token);
	}
}

export {Patcher_CanvasAnimation};
