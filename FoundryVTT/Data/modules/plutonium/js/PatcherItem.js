import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {LGT} from "./Util.js";
import {Patcher_RollData} from "./PatcherRollData.js";

class Patcher_Item {
	static init () {
		this._init_tryPatchGetRollData();
	}

	static _init_tryPatchGetRollData () {
		try {
			libWrapper.register(
				SharedConsts.MODULE_NAME,
				"CONFIG.Item.documentClass.prototype.getRollData",
				function (fn, ...args) {
					const out = fn(...args);
					return Patcher_Item._getRollData(this, out);
				},
				UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
			);
		} catch (e) {
			console.error(...LGT, `Failed to bind getRollData handler!`, e);
		}
	}

	static _getRollData (item, rollData) {
		if (!rollData) return rollData;
		Object.assign(rollData, Patcher_RollData.getAdditionalRollDataBase(item));
		return rollData;
	}
}

export {Patcher_Item};
