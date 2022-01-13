import {Config} from "./Config.js";

/**
 * Base class for context menus.
 */
class Menu {
	/**
	 * @param opts
	 * @param opts.eventNamespace
	 * @param opts.toolsList
	 * @param [opts.direction]
	 * @param [opts.fnHandleToolClick]
	 */
	constructor (opts) {
		this._eventNamespace = opts.eventNamespace;
		this._toolsList = opts.toolsList;
		this._direction = opts.direction;

		this._$wrpMenu = null;
	}

	_closeMenu (evt) {
		if (evt) evt.preventDefault();
		this._$wrpMenu.remove();
		$(document.body).off(`click.${this._eventNamespace}`);
		Menu._OPEN_MENUS.delete(this);
	}

	_getFilteredToolList (toolArgs) {
		let availableToolList = this._toolsList.filter(it => !it || !it.fnCheckRequirements || it.fnCheckRequirements(...toolArgs));

		// Trim trailing/leading nully values; ensure no double-null values
		while (availableToolList.length && !availableToolList[0]) availableToolList.shift();
		while (availableToolList.length && !availableToolList.last()) availableToolList.pop();

		let prevVal = null;
		availableToolList = availableToolList.filter(it => {
			if (it == null && prevVal == null) return false;
			prevVal = it;
			return true;
		});

		return availableToolList;
	}

	async _pOpenMenu (evt, ...toolArgs) {
		// Clean up any previous menus
		Menu.closeAllMenus();

		Menu._OPEN_MENUS.add(this);

		const $eles = [];
		this._getFilteredToolList(toolArgs).forEach((toolMeta, i) => {
			if (i !== 0) $eles.push($(`<div class="veapp-ctx-menu__spacer ${toolMeta?.additionalClassesPreSpacer || ""}"></div>`));

			if (!toolMeta) return;

			const displayName = toolMeta.streamerName && Config.get("ui", "isStreamerMode") ? toolMeta.streamerName : toolMeta.name;

			const $btnOpen = $(`<a class="veapp-ctx-menu__item m-1 ve-flex-v-center px-1 ${toolMeta.additionalClassesButton || ""}" ${toolMeta.title ? `title="${toolMeta.title.escapeQuotes()}"` : ""}>${toolMeta.getIcon ? toolMeta.getIcon() : `<i class="fas fa-fw ${toolMeta.iconClass}"></i>`}<span class="ml-1">${displayName}</span></a>`)
				.mouseup(evt => {
					this._closeMenu(evt);
					this._pHandleOpenButtonClick(evt, toolMeta, ...toolArgs);
				});

			$eles.push($btnOpen);
		});

		$(document.body).on(`mouseup.${this._eventNamespace}`, () => {
			this._closeMenu();
		});

		this._$wrpMenu = $$`<div class="veapp-ctx-menu__wrp ve-flex-col">${$eles}</div>`
			.appendTo(document.body);

		const w = this._$wrpMenu.width();
		if (this._direction === "up") {
			const h = this._$wrpMenu.height();
			this._$wrpMenu.css({top: EventUtil.getClientY(evt) - h + 4, left: EventUtil.getClientX(evt) - w + 4});
		} else {
			let left = EventUtil.getClientX(evt) - 16;
			if (EventUtil.getClientX(evt) + w > window.innerWidth) left -= w - 32;
			this._$wrpMenu.css({top: EventUtil.getClientY(evt) - 10, left});
		}
	}

	async _pHandleOpenButtonClick (evt, toolMeta, ...toolArgs) {
		if (toolMeta.Class) {
			if (toolMeta.Class.pHandleButtonClick) return toolMeta.Class.pHandleButtonClick(evt, ...toolArgs);

			const tool = new toolMeta.Class(...toolArgs);
			if (tool.pInit) await tool.pInit();
			tool.render(true);
			return;
		}

		if (toolMeta.pFnOnClick) {
			await toolMeta.pFnOnClick(evt, ...toolArgs);
			return;
		}

		throw new Error(`No handler class or onclick function defined for tool "${toolMeta.name}"! This is a bug!`);
	}

	/** Close all menus, returning `true` if any were closed, `false` otherwise. */
	static closeAllMenus () {
		return !![...Menu._OPEN_MENUS].map(it => it._closeMenu()).length;
	}
}
Menu._OPEN_MENUS = new Set();

export {Menu};
