import {SharedConsts} from "../shared/SharedConsts.js";

class UtilSocket {
	static init () {
		game.socket.on(
			UtilSocket._EVENT_NAME,
			packedData => {
				if (!packedData.type) return;

				const data = this._getUnpackedData(packedData);
				const fnsToRun = UtilSocket._EVENT_LISTENERS[packedData.type] || [];
				fnsToRun.forEach(fn => fn(data));
			},
		);

		// Based on `setup.js`'s `activateSocketListeners`
		game.socket.on("progress", data => {
			this._doHandleProgressMessage(data);
		});
	}

	/** Handle progress messages when e.g. installing worlds/modules. */
	static _doHandleProgressMessage (data) {
		if (data?.action === "installPackage") SceneNavigation._onLoadProgress(data.step, data.pct);
	}

	static pSendData (namespace, data) {
		const packedData = this._getPackedData(namespace, data);

		return new Promise((resolve) => {
			game.socket.emit(
				UtilSocket._EVENT_NAME,
				packedData, // data
				{}, // options (https://gitlab.com/foundrynet/foundryvtt/-/issues/4749)
				unknown => { // callback
					return resolve(unknown);
				},
			);
		});
	}

	static _getPackedData (namespace, data) {
		return {
			type: namespace,
			data,
		};
	}

	static _getUnpackedData (packedData) {
		if (!packedData.type) return packedData;
		return packedData.data;
	}

	static addSocketEventListener (namespace, fnListener) {
		const tgt = MiscUtil.getOrSet(UtilSocket._EVENT_LISTENERS, namespace, []);
		tgt.push(fnListener);
	}
}
UtilSocket._EVENT_NAME = `module.${SharedConsts.MODULE_NAME}`;
UtilSocket._EVENT_LISTENERS = {};

export {UtilSocket};
