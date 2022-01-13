class JqueryExtension {
	static init () {
		$.fn.extend({
			/**
			 * Takes a jQuery object and replaces elements with `data-r-<id>` with the element at key id
			 * $(`<div><div>my <span>initial</span> html <div data-r="foo"></div> <div data-r="bar"></div></div>`)
			 */
			swap: function ($eleMap) {
				Object.entries($eleMap).forEach(([k, $v]) => {
					this.find(`[data-r="${k}"]`).replaceWith($v);
				});

				return this;
			},
		});
	}
}

export {JqueryExtension};
