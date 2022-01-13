import {LGT} from "./Util.js";

class UtilNotifications {
	/**
	 * @param id
	 * @param type One of: "info", "warn", "error".
	 * @param message
	 */
	static notifyOnce ({id, type = "info", message}) {
		if (!UtilNotifications._VALID_TYPES.has(type)) type = "info";
		id = id || message;

		if (!UtilNotifications._SEEN_NOTIFICATIONS[id]) ui.notifications[type](message);
		UtilNotifications._SEEN_NOTIFICATIONS[id] = true;

		switch (type) {
			case "info": console.log(...LGT, message); break;
			case "warn": console.warn(...LGT, message); break;
			case "error": console.error(...LGT, message); break;
		}
	}
}
UtilNotifications._VALID_TYPES = new Set(["info", "warn", "error"]);
UtilNotifications._SEEN_NOTIFICATIONS = {};

export {UtilNotifications};
