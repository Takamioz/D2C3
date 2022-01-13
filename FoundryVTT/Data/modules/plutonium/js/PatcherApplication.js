import {libWrapper, UtilLibWrapper} from "./PatcherLibWrapper.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {UtilApplications} from "./UtilApplications.js";

/**
 * FIXME(Future) this is not usable; tabs do not function as expected.
 */
class Patcher_Application {
	static init () {
		Patcher_Application._Render.init();

		libWrapper.register(
			SharedConsts.MODULE_NAME,
			"Application.defaultOptions",
			function (fn, ...args) {
				if (!Config.get("ui", "isAlwaysResizableApps")) return fn(...args);
				const out = fn(...args);
				out.resizable = true;
				return out;
			},
			UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
		);
	}
}

Patcher_Application._Render = class {
	static init () {
		[
			"ActorSheet.prototype._render",
			"ItemSheet.prototype._render",
		]
			.forEach(it => {
				libWrapper.register(
					SharedConsts.MODULE_NAME,
					it,
					function (fn, ...args) {
						if (!Patcher_Application._Render._isUseCustomRender(this)) return fn(...args);
						return Patcher_Application._Render._pRenderApplication.bind(this)(...args);
					},
					UtilLibWrapper.LIBWRAPPER_MODE_MIXED,
				);

				libWrapper.register(
					SharedConsts.MODULE_NAME,
					`${it}Inner`,
					async function (fn, ...args) {
						if (!Patcher_Application._Render._isUseCustomRender(this)) return fn(...args);

						// Cache and restore the current form after rendering a new inner, as rendering the inner
						//   overwrites the old form, which we don't want.
						const curForm = this.form;
						const out = await fn(...args);
						this.form = curForm;
						return out;
					},
					UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER,
				);
			});
	}

	static _isUseCustomRender (app) {
		if (!app.popOut) return false;
		if (!Config.get("ui", "isLazyActorAndItemRendering")) return false;
		return !!app.element?.length;
	}

	/** Based on Foundry's `Application._render` */
	static async _pRenderApplication (force = false, options = {}) {
		// Do not render under certain conditions
		const states = Application.RENDER_STATES;
		this._priorState = this._state;
		if ([states.CLOSING, states.RENDERING].includes(this._state)) return;

		// Applications which are not currently rendered must be forced
		if (!force && (this._state <= states.NONE)) return;

		// Begin rendering the application
		if ([states.NONE, states.CLOSED, states.ERROR].includes(this._state)) {
			console.log(`${vtt} | Rendering ${this.constructor.name}`);
		}
		this._state = states.RENDERING;

		// Merge provided options with those supported by the Application class
		foundry.utils.mergeObject(this.options, options, { insertKeys: false });

		// Get the existing HTML element and application data used for rendering
		// const element = this.element;
		const data = await this.getData(this.options);

		// Render the inner content
		const inner = await this._renderInner(data);

		// region Mod
		const $inner = inner instanceof jQuery ? inner : $(inner);

		const $innerExisting = Patcher_Application._Render._doMergeElements.bind(this)({$inner});

		// Deactivate all listeners, so we can re-bind them as though for a fresh render
		$innerExisting.find("*").off();

		// Activate event listeners on the inner HTML
		this._activateCoreListeners($innerExisting);
		this.activateListeners($innerExisting);
		// endregion

		this._state = states.RENDERED;
	}

	/**
	 * See also: https://gomakethings.com/dom-diffing-with-vanilla-js/
	 */
	static _doMergeElements ({$inner}) {
		const $element = UtilApplications.$getAppElement(this);

		if (!this.popOut) {
			throw new Error(`Application was not a popout?!`);
			/*
			const cur = $element[0];
			const nxt = $inner[0];
			Patcher_Application._Render._recurse({cur, nxt});
			 */
		}

		// Foundry's "popout" windows (i.e., normal actors/items/etc. with free-floating windows) have custom handling
		//   in `Application._replaceHTML`
		$element.find(".window-title").text(this.title);

		const cur = $element.find(".window-content")[0];
		const nxt = cur.cloneNode(/* deep= */false);

		// There's usually a leading whitespace text node--add it now to avoid splicing it in later
		if (cur.childNodes[0]?.nodeType === 3) {
			nxt.innerHTML = cur.childNodes[0].textContent;
		}
		nxt.appendChild($inner[0]);

		// Note: change handling is mostly set in `FormApplication.activateListeners` and is bound to the root
		//   `<form class="editable flexcol" ...> ... </form>` element
		Patcher_Application._Render._recurse({cur, nxt});

		return $(cur);
	}

	static _getNodeType (node) {
		switch (node.nodeType) {
			case 3: return "fromType_text";
			case 8: return "fromType_comment";
			default: return node.tagName.toLowerCase();
		}
	}

	static _getNodeContents (node) {
		if (node.childNodes && node.childNodes.length > 0) return null;
		return node.textContent;
	}

	static _recurse ({cur, nxt}) {
		Patcher_Application._Render._recurse_updateAttributes({cur, nxt});
		Patcher_Application._Render._recurse_removeExtraChildren({cur, nxt});

		const nodesCur = [...cur.childNodes];

		[...nxt.childNodes].forEach((nodeNxt, ix) => {
			const nodeCur = nodesCur[ix];

			// If element doesn't exist, create it
			if (!nodeCur) {
				cur.appendChild(nodeNxt.cloneNode(/* deep= */true));
				return;
			}

			const typeCur = Patcher_Application._Render._getNodeType(nodeCur);

			// If element is not the same type, replace it with new element
			if (Patcher_Application._Render._getNodeType(nodeNxt) !== typeCur) {
				nodeCur.parentNode.replaceChild(nodeNxt.cloneNode(/* deep= */true), nodeCur);
				return;
			}

			// Handle text nodes
			if (["fromType_text", "fromType_comment"].includes(typeCur)) {
				if (nodeCur.textContent !== nodeNxt.textContent) nodeCur.textContent = nodeNxt.textContent;
				return;
			}

			Patcher_Application._Render._recurse_updateAttributes({cur: nodeCur, nxt: nodeNxt});
			Patcher_Application._Render._recurse({cur: nodeCur, nxt: nodeNxt});

			// Use a document fragment to minimize reflows.
			// const fragment = document.createDocumentFragment();
			// Patcher_Application._Render._recurse({cur: nodeNxt, nxt: fragment});
			// nodeCur.appendChild(fragment);
		});
	}

	static _recurse_removeExtraChildren ({cur, nxt}) {
		const nodesCur = [...cur.childNodes];
		const nodesNxt = [...nxt.childNodes];

		if ((nodesCur.length - nodesNxt.length) <= 0) return;

		const typesCur = nodesCur.map(it => Patcher_Application._Render._getNodeType(it));
		const typesNxt = nodesNxt.map(it => Patcher_Application._Render._getNodeType(it));

		const ixsCurToUse = [];

		let offsetCur = 0;
		for (let ixNxt = 0; ixNxt < typesNxt.length; ++ixNxt) {
			const ixCur = ixNxt + offsetCur;

			const typeCur = typesCur[ixCur];
			const typeNxt = typesNxt[ixNxt];

			// If the nodes match, use the old node
			if (typeCur === typeNxt) {
				ixsCurToUse.push(ixCur);
				continue;
			}

			// If the nodes do not match, try to scan ahead for the next matching node
			for (let ixTmp = ixCur; ixTmp < typesCur.length; ++ixTmp) {
				const typeCurTmp = typesCur[ixTmp];

				if (typeCurTmp === typeNxt) {
					ixsCurToUse.push(ixTmp);
					offsetCur += ixTmp - ixCur;
					break;
				}
			}
		}

		// If the existing content is unusable, wipe it
		if (!ixsCurToUse.length) {
			cur.innerHTML = "";
			return;
		}

		// Otherwise, step backwards through the current nodes, deleting one at a time
		const ixsCurToUseSet = new Set(ixsCurToUse);
		for (let ixCur = nodesCur.length - 1; ixCur >= 0; --ixCur) {
			if (!ixsCurToUseSet.has(ixCur)) cur.removeChild(cur.childNodes[ixCur]);
		}
	}

	static _recurse_updateAttributes ({cur, nxt}) {
		const attsCur = [...cur.attributes].map(({name, textContent}) => ({name, textContent}));
		const attsNxt = [...nxt.attributes].map(({name, textContent}) => ({name, textContent}));
		if (CollectionUtil.deepEquals(attsCur, attsNxt)) return;

		const setDelete = new Set([...cur.attributes].map(it => it.name));
		[...nxt.attributes]
			.forEach(({name, textContent}) => {
				setDelete.delete(name);
				if (cur.getAttribute(name) !== nxt.getAttribute(name)) cur.setAttribute(name, textContent);
			});
		setDelete.forEach(name => nxt.removeAttribute(name));
	}
};

export {Patcher_Application};
