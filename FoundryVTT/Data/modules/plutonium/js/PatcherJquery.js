import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";

class Patcher_Jquery {
	static init () {
		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"$.prototype.animate",
			function (fn, ...args) {
				return fn(...Patcher_Jquery._getNextArgs(...args));
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);
	}

	static _getNextArgs (...args) {
		let nxtArgs = [...args];

		if (Config.get("ui", "isFastAnimations")) {
			for (let i = 0; i < nxtArgs.length; ++i) {
				const arg = nxtArgs[i];

				// This mysteriously breaks when going to lower numbers
				//   Therefore, limit it to "numbers above 33," in case lower numbers have special meaning
				//   It may be that there exists a race condition between this and e.g. saving sheet state,
				//   which would explain things like "opening a token sheet, closing it, then updating the health of
				//   the token causes the sheet to re-open" existing.
				if (typeof arg === "object" && arg.duration != null) {
					if (arg.duration > 33) arg.duration = 33;
					break;
				} else if (typeof arg === "number") {
					if (arg > 33) nxtArgs[i] = 33;
					break;
				}
			}
		}

		return nxtArgs;
	}
}

export {Patcher_Jquery};
