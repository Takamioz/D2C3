class UtilCanvas {
	/**
	 * @param evt
	 * @param layerName One of: "BackgroundLayer", "DrawingsLayer", "GridLayer", "WallsLayer", "TemplateLayer",
	 * "NotesLayer", "TokenLayer", "ForegroundLayer", "SoundsLayer", "LightingLayer", "SightLayer", "EffectsLayer",
	 * "ControlsLayer"
	 * @return {{x: *, y: *}}
	 */
	static getPosCanvasSpace (evt, layerName) {
		const layer = canvas.layers.find(it => it.name === layerName);

		// (Taken from `_onDropActorData`)
		// Acquire cursor position transformed to Canvas coordinates
		const [x, y] = [evt.clientX, evt.clientY];
		const t = layer.worldTransform;
		const tx = (x - t.tx) / canvas.stage.scale.x;
		const ty = (y - t.ty) / canvas.stage.scale.y;
		const p = canvas.grid.getTopLeft(tx, ty);

		return {x: p[0], y: p[1]};
	}

	/** See: https://stackoverflow.com/a/16282685 */
	static getCentroid (arr) {
		const x = arr.map(xy => xy[0]);
		const y = arr.map(xy => xy[1]);
		const cx = (Math.min(...x) + Math.max(...x)) / 2;
		const cy = (Math.min(...y) + Math.max(...y)) / 2;
		return [cx, cy];
	}
}

export {UtilCanvas};
