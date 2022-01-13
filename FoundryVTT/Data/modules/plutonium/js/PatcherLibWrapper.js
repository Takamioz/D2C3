class UtilLibWrapper {}

UtilLibWrapper.LIBWRAPPER_MODE_WRAPPER = "WRAPPER";
UtilLibWrapper.LIBWRAPPER_MODE_MIXED = "MIXED";
UtilLibWrapper.LIBWRAPPER_MODE_OVERRIDE = "OVERRIDE";

// region libWrapper shim

// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro
// Source: https://github.com/ruipin/fvtt-lib-wrapper/
// Modified: to remove user prompt on missing library

let libWrapper;

Hooks.once("init", () => {
	// Check if the real module is already loaded - if so, use it
	if (globalThis.libWrapper && !(globalThis.libWrapper.is_fallback ?? true)) {
		libWrapper = globalThis.libWrapper;
		return;
	}

	// Fallback implementation
	libWrapper = class {
		static get is_fallback () { return true; }

		static register (module, target, fn, type = "MIXED") {
			const is_setter = target.endsWith("#set");
			target = !is_setter ? target : target.slice(0, -4);
			const split = target.split(".");
			const fn_name = split.pop();
			const root_nm = split.splice(0, 1)[0];
			// eslint-disable-next-line no-eval
			const _eval = eval; // The browser doesn't expose all global variables (e.g. 'Game') inside globalThis, but it does to an eval. We copy it to a variable to have it run in global scope.
			const obj = split.reduce((x, y) => x[y], globalThis[root_nm] ?? _eval(root_nm));

			let iObj = obj;
			let descriptor = null;
			while (iObj) {
				descriptor = Object.getOwnPropertyDescriptor(iObj, fn_name);
				if (descriptor) break;
				iObj = Object.getPrototypeOf(iObj);
			}
			if (!descriptor) throw new Error(`libWrapper Shim: '${target}' does not exist or could not be found.`);

			let original = null;
			const wrapper = (type === "OVERRIDE") ? function () {
				return fn.call(this, ...arguments);
			} : function () {
				return fn.call(this, original.bind(this), ...arguments);
			};

			if (!is_setter) {
				if (descriptor.value) {
					original = descriptor.value;
					descriptor.value = wrapper;
				} else {
					original = descriptor.get;
					descriptor.get = wrapper;
				}
			} else {
				if (!descriptor.set) throw new Error(`libWrapper Shim: "${target}" does not have a setter`);
				original = descriptor.set;
				descriptor.set = wrapper;
			}

			descriptor.configurable = true;
			Object.defineProperty(obj, fn_name, descriptor);
		}
	};
});

export {
	libWrapper,
	UtilLibWrapper,
};
// endregion
