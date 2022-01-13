import {SharedConsts} from "../shared/SharedConsts.js";

class UtilHooks {
	static callAll (name, val) { Hooks.callAll(this._getHookName(name), val); }

	static call (name, val) { Hooks.callAll(this._getHookName(name), val); }

	static on (name, fn) { Hooks.on(this._getHookName(name), fn); }

	static off (name, fn) { Hooks.off(this._getHookName(name), fn); }

	static _getHookName (name) { return `${SharedConsts.MODULE_NAME_FAKE}.${name}`; }
}
UtilHooks.HK_CONFIG_UPDATE = "configUpdate";
UtilHooks.HK_IMPORT_COMPLETE = "importComplete";

export {UtilHooks};
