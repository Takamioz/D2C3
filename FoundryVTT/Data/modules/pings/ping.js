/**
 * Up to 0.4.3 tokenTextStyle, after that canvasTextStyle
 * @returns {*}
 */
function getCanvasTextStyle(foundryConfig) {
	return foundryConfig.tokenTextStyle || foundryConfig.canvasTextStyle;
}


function createPingDisplay(ping, color) {
	return ping.options.image ? createImagePingDisplay(ping, color) : createDefaultPingDisplay(ping, color);
}

function createText(ping, text, color) {
	const style = getCanvasTextStyle(ping.foundryConfig).clone();
	style.fill = color;

	const name = new PIXI.Text(text, style);
	name.anchor.x = 0.5;
	const maxSizeChange = 1 + (ping.options.sizeChange ? ping.options.sizeChangeAmount : 0);
	name.y = ping.pingSize / 2 * maxSizeChange;

	const height = ping.pingSize >= 200 ? 36 : ping.pingSize > 50 ? 24 : 18;
	const bounds = name.getBounds();
	const ratio = (bounds.width / bounds.height);
	name.height = height;
	name.width = height * ratio;

	return name;
}

function createImagePingDisplay(ping, color) {
	const pingDisplay = PIXI.Sprite.from(ping.options.image);
	pingDisplay.tint = color;
	pingDisplay.alpha = 0.8;
	pingDisplay.anchor.set(0.5, 0.5);
	return pingDisplay;
}

function createDefaultPingDisplay(ping, color) {
	const pingDisplay = new PIXI.Container();
	pingDisplay.addChild(...createShadows(ping));
	pingDisplay.addChild(...createPingLines(ping, color));
	return pingDisplay;
}

function createPingLines(ping, color) {
	let offset = ping.pingSize * 0.25;
	const lines = [];
	for (let i = 0; i < 4; i++) {
		let line = new PIXI.Graphics();
		line.lineStyle(2, color, 1)
			.moveTo(offset, 0)
			.lineTo(offset * 0.1, offset * 0.1)
			.lineTo(0, offset);

		line.rotation = i * Math.PI / 2;

		lines.push(line);
	}

	offset = offset * 0.25;

	lines[0].x = lines[0].y = offset;
	lines[1].x = -offset;
	lines[1].y = offset;
	lines[2].x = lines[2].y = -offset;
	lines[3].x = offset;
	lines[3].y = -offset;
	return lines;
}

function createShadows(ping) {
	const shadows = createPingLines(ping,0x000000);
	shadows.forEach(addBlurFilter.bind(null, ping));
	return shadows;
}

function addBlurFilter(ping, graphic) {
	const blurFilter = new PIXI.filters.BlurFilter(2);
	blurFilter.padding = ping.pingSize;
	graphic.filters = [blurFilter];
}

function animate(ping) {
	const FADE_IN_DURATION = 500;
	const FADE_OUT_DURATION = 500;

	const animationStarted = this.t === undefined || this.prevTime === undefined;
	if (animationStarted) {
		this.t = 0;
		this.prevTime = Date.now();
		ping.pingDisplay.rotation = rotationDuringTime(ping, -FADE_IN_DURATION);
		ping.pingDisplay.width = ping.pingDisplay.height = ping.pingSize;
		ping.addChild(ping.pingDisplay);
	}

	const dt = Date.now() - this.prevTime;
	this.prevTime = Date.now();

	const fadeInEndTime = FADE_IN_DURATION;
	const mainAnimationEndTime = fadeInEndTime + ping.options.duration * 1000;
	const fadeOutEndTime = mainAnimationEndTime + FADE_OUT_DURATION;

	this.t += dt;

	if (ping.options.rotate) {
		ping.pingDisplay.rotation += rotationDuringTime(ping, dt);
	}

	if (this.t < fadeInEndTime) {
		ping.scale.x = ping.scale.y = this.t / FADE_IN_DURATION;
	} else if (this.t < mainAnimationEndTime) {
		ping.scale.x = ping.scale.y = 1;
		if (ping.options.sizeChange) {
			const sizeChangeFraction = Math.sin(2 * Math.PI * this.t / (ping.options.sizeChangeSpeed * 1000));
			const sizeMultiplier = 1 + sizeChangeFraction * ping.options.sizeChangeAmount;
			ping.pingDisplay.width = ping.pingDisplay.height = ping.pingSize * sizeMultiplier;
		}
	} else if (this.t < fadeOutEndTime) {
		ping.scale.x = ping.scale.y = (fadeOutEndTime - this.t) / FADE_OUT_DURATION;
	} else {
		ping.destroy();
	}
}

function rotationDuringTime(ping, dt) {
	return 2 * Math.PI * dt / (ping.options.rotateSpeed * 1000);
}

/**
 * @typedef {Object} PingPosition
 * @property {number} x x position of the ping
 * @property {number} y y position of the ping
 */

/**
 * @typedef {string} ColorString
 *
 * A string of a hexadecimal number in the form of 0xRRGGBB
 */

/**
 * @typedef {Object} PingOptions
 * @property {number} scale how big in grid cells the ping should be
 * @property {number} duration how long in seconds the ping should be displayed
 * @property {boolean} sizeChange if the ping should change its size while being displayed
 * @property {number} sizeChangeAmount how much in % the size should be increased/decreased
 * @property {number} sizeChangeSpeed how many times per second the size should cycle between -sizeChangeAmount and +sizeChangeAmount
 * @property {boolean} rotate if the ping should rotate while being displayed
 * @property {number} rotateSpeed how long a full rotation should take, in seconds
 * @property {string} image an URL for an image, if set, will use the image instead of the default ping
 */

/**
 * Adapted from https://gitlab.com/moerills-fvtt-modules/pointer
 */
export default class Ping extends PIXI.Container {

	/**
	 *
	 * @param foundryCanvas
	 * @param foundryConfig
	 * @param {PingPosition} pos
	 * @param {*} id
	 * @param {string} text
	 * @param {ColorString} color
	 * @param {PingOptions} options
	 */
	constructor(foundryCanvas, foundryConfig, pos, id, text, color, options) {
		super();

		this.foundryCanvas = foundryCanvas;
		this.foundryConfig = foundryConfig;

		this.zIndex = Object.values(foundryCanvas.layers).reduce((highestZIndex, currentLayer) => {
			const curZIndex = currentLayer.zIndex;
			return highestZIndex > curZIndex ? highestZIndex : curZIndex;
		}, 0) + 1;

		this.x = pos.x;
		this.y = pos.y;

		this.id = id;

		this.options = options;

		const gridSize = foundryCanvas.scene.data.grid;
		this.pingSize = gridSize * this.options.scale;

		this.pingDisplay = this.addChild(createPingDisplay(this, color));
		if (text) {
			this.addChild(createText(this, text, color));
		}

		this._animateFunc = animate.bind({}, this);
		foundryCanvas.app.ticker.add(this._animateFunc, this);
	}

	destroy(options) {
		this.foundryCanvas.app.ticker.remove(this._animateFunc, this);

		super.destroy({
			...options,
			children: true
		});
	}
}
