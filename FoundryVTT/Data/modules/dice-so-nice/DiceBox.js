import { DICE_MODELS } from './DiceModels.js';
import { RGBELoader } from './libs/three-modules/RGBELoader.js';
import { DiceSFXManager } from './DiceSFXManager.js';
//import {GLTFExporter} from './libs/three-modules/GLTFExporter.js';
import { RendererStats } from './libs/three-modules/threex.rendererstats.js';
import * as THREE from './libs/three.module.js';

export class DiceBox {

	constructor(element_container, dice_factory, config) {
		//private variables
		this.known_types = ['d4', 'd6', 'd8', 'd10', 'd12', 'd14', 'd16', 'd20', 'd24', 'd30', 'd100'];
		this.container = element_container;
		this.dimensions = config.dimensions;
		this.dicefactory = dice_factory;
		this.config = config;
		this.speed = 1;
		this.isVisible = false;
		this.last_time = 0;
		this.running = false;
		this.allowInteractivity = false;
		this.raycaster = new THREE.Raycaster();

		this.nbIterationsBetweenRolls = 15;

		this.display = {
			currentWidth: null,
			currentHeight: null,
			containerWidth: null,
			containerHeight: null,
			aspect: null,
			scale: null
		};

		this.mouse = {
			pos: new THREE.Vector2(),
			startDrag: undefined,
			startDragTime: undefined,
			constraintDown:false,
			constraint:null
		};

		this.cameraHeight = {
			max: null,
			close: null,
			medium: null,
			far: null
		};


		this.clock = new THREE.Clock();
		this.world_sim = new CANNON.World();
		this.dice_body_material = new CANNON.Material();
		this.desk_body_material = new CANNON.Material();
		this.barrier_body_material = new CANNON.Material();
		this.sounds_table = {};
		this.sounds_dice = {};
		this.sounds_coins = [];
		this.lastSoundType = '';
		this.lastSoundStep = 0;
		this.lastSound = 0;
		this.iteration;
		this.renderer;
		this.barrier;
		this.camera;
		this.light;
		this.light_amb;
		this.desk;
		this.pane;

		//public variables
		this.public_interface = {};
		this.diceList = []; //'private' variable
		this.deadDiceList = [];
		this.framerate = (1 / 60);
		this.sounds = true;
		this.volume = 1;
		this.soundDelay = 1; // time between sound effects in worldstep
		this.soundsSurface = "felt";
		this.animstate = '';
		this.throwingForce = "medium";

		this.selector = {
			animate: true,
			rotate: true,
			intersected: null,
			dice: []
		};
		this.showExtraDice = false;
		this.muteSoundSecretRolls = false;

		this.colors = {
			ambient: 0xffffff,
			spotlight: 0x333333,
			ground: 0x242644
		};

		this.shadows = true;

		this.rethrowFunctions = {};
		this.afterThrowFunctions = {};
	}

	preloadSounds() {
		//Surfaces
		fetch(`modules/dice-so-nice/sounds/surfaces.json`).then(res => {
			res.json().then(json =>{
				AudioHelper.preloadSound(`modules/dice-so-nice/sounds/${json.resources[0]}`).then(src => this.sounds_table.source = src);
				Object.entries(json.spritemap).forEach(sound => {
					let type = sound[0].match(/surface\_([a-z\_]*)/)[1];
					if(!this.sounds_table[type])
						this.sounds_table[type] = [];
					this.sounds_table[type].push(sound[1]);
				});
			});
		});

		//Hits
		fetch(`modules/dice-so-nice/sounds/dicehit.json`).then(res => {
			res.json().then(json =>{
				this.sounds_dice.source = AudioHelper.preloadSound(`modules/dice-so-nice/sounds/${json.resources[0]}`).then(src => this.sounds_dice.source = src);
				Object.entries(json.spritemap).forEach(sound => {
					let type = sound[0].match(/dicehit\_([a-z\_]*)/)[1];
					if(!this.sounds_dice[type])
						this.sounds_dice[type] = [];
					this.sounds_dice[type].push(sound[1]);
				});
			});
		});
	}

	playAudioSprite(source, sprite, selfVolume){
		let gainNode = source.context.createGain();
		gainNode.gain.value = selfVolume * this.volume * game.settings.get("core", "globalInterfaceVolume");
		const startTime = sprite.start;
		const duration = sprite.end - sprite.start;
		const sampleSource = source.context.createBufferSource();
		sampleSource.buffer = source.container.buffer;
		sampleSource.connect(gainNode).connect(source.context.destination);
		sampleSource.start(source.context.currentTime, startTime, duration);
	}

	initialize() {
		return new Promise(async resolve => {
			game.audio.pending.push(this.preloadSounds.bind(this));

			await this.dicefactory.preloadPresets();

			this.sounds = this.config.sounds == '1';
			this.volume = this.config.soundsVolume;
			this.soundsSurface = this.config.soundsSurface;
			this.shadows = this.config.shadowQuality != "none";
			this.showExtraDice = this.config.showExtraDice;
			this.muteSoundSecretRolls = this.config.muteSoundSecretRolls;

			this.allowInteractivity = this.config.boxType == "board" && game.settings.get("dice-so-nice", "allowInteractivity");

			this.dicefactory.setBumpMapping(this.config.bumpMapping);
			let globalAnimationSpeed = game.settings.get("dice-so-nice", "globalAnimationSpeed");
			if (globalAnimationSpeed === "0")
				this.speed = this.config.speed;
			else
				this.speed = parseInt(globalAnimationSpeed, 10);
			this.throwingForce = this.config.throwingForce;
			this.scene = new THREE.Scene();
			if (game.dice3dRenderers[this.config.boxType] != null) {
				this.renderer = game.dice3dRenderers[this.config.boxType];
				this.scene.environment = this.renderer.scopedTextureCache.textureCube;
				this.scene.traverse(object => {
					if (object.type === 'Mesh') object.material.needsUpdate = true;
				});
			}
			else {
				this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
				if (this.config.useHighDPI)
					this.renderer.setPixelRatio(window.devicePixelRatio);
				if (this.dicefactory.bumpMapping) {
					this.renderer.physicallyCorrectLights = true;
					this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
					this.renderer.toneMappingExposure = 1;
					this.renderer.outputEncoding = THREE.sRGBEncoding;
				}
				await this.loadContextScopedTextures(this.config.boxType);
				this.dicefactory.initializeMaterials();
				game.dice3dRenderers[this.config.boxType] = this.renderer;
			}

			if(false && this.config.boxType == "board"){
				this.rendererStats	= new RendererStats()

				this.rendererStats.domElement.style.position	= 'absolute';
				this.rendererStats.domElement.style.left	= '44px';
				this.rendererStats.domElement.style.bottom	= '178px';
				this.rendererStats.domElement.style.transform	= 'scale(2)';
				document.body.appendChild( this.rendererStats.domElement );
			}

			this.container.appendChild(this.renderer.domElement);
			this.renderer.shadowMap.enabled = this.shadows;
			this.renderer.shadowMap.type = this.config.shadowQuality == "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
			this.renderer.setClearColor(0x000000, 0);

			this.setDimensions(this.config.dimensions);

			this.world_sim.gravity.set(0, 0, -9.8 * 800);
			this.world_sim.broadphase = new CANNON.NaiveBroadphase();
			this.world_sim.solver.iterations = 14;
			this.world_sim.allowSleep = true;

			let contactMaterial = new CANNON.ContactMaterial(this.desk_body_material, this.dice_body_material, { friction: 0.01, restitution: 0.5 });
			this.world_sim.addContactMaterial(contactMaterial);
			contactMaterial = new CANNON.ContactMaterial(this.barrier_body_material, this.dice_body_material, { friction: 0, restitution: 0.95 });
			this.world_sim.addContactMaterial(contactMaterial);
			contactMaterial = new CANNON.ContactMaterial(this.dice_body_material, this.dice_body_material, { friction: 0.01, restitution: 0.7 });
			this.world_sim.addContactMaterial(contactMaterial);
			let desk = new CANNON.Body({ allowSleep: false, mass: 0, shape: new CANNON.Plane(), material: this.desk_body_material });
			this.world_sim.addBody(desk);

			let barrier = new CANNON.Body({ allowSleep: false, mass: 0, shape: new CANNON.Plane(), material: this.barrier_body_material });
			barrier.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
			barrier.position.set(0, this.display.containerHeight * 0.93, 0);
			this.world_sim.addBody(barrier);

			barrier = new CANNON.Body({ allowSleep: false, mass: 0, shape: new CANNON.Plane(), material: this.barrier_body_material });
			barrier.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
			barrier.position.set(0, -this.display.containerHeight * 0.93, 0);
			this.world_sim.addBody(barrier);

			barrier = new CANNON.Body({ allowSleep: false, mass: 0, shape: new CANNON.Plane(), material: this.barrier_body_material });
			barrier.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
			barrier.position.set(this.display.containerWidth * 0.93, 0, 0);
			this.world_sim.addBody(barrier);

			barrier = new CANNON.Body({ allowSleep: false, mass: 0, shape: new CANNON.Plane(), material: this.barrier_body_material });
			barrier.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
			barrier.position.set(-this.display.containerWidth * 0.93, 0, 0);
			this.world_sim.addBody(barrier);

			let shape = new CANNON.Sphere(0.1);
            this.jointBody = new CANNON.Body({ mass: 0 });
            this.jointBody.addShape(shape);
            this.jointBody.collisionFilterGroup = 0;
            this.jointBody.collisionFilterMask = 0;
            this.world_sim.addBody(this.jointBody)

			this.renderer.render(this.scene, this.camera);
			resolve();
		});
	}

	loadContextScopedTextures(type) {
		return new Promise(resolve => {
			this.renderer.scopedTextureCache = { type: type };
			if (this.dicefactory.bumpMapping) {
				let textureLoader = new THREE.TextureLoader();
				this.renderer.scopedTextureCache.roughnessMap_fingerprint = textureLoader.load('modules/dice-so-nice/textures/roughnessMap_finger.webp');
				this.renderer.scopedTextureCache.roughnessMap_wood = textureLoader.load('modules/dice-so-nice/textures/roughnessMap_wood.webp');
				this.renderer.scopedTextureCache.roughnessMap_metal = textureLoader.load('modules/dice-so-nice/textures/roughnessMap_metal.webp');

				this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
				this.pmremGenerator.compileEquirectangularShader();

				new RGBELoader()
					.setDataType(THREE.HalfFloatType)
					.setPath('modules/dice-so-nice/textures/equirectangular/')
					.load('foyer.hdr', function (texture) {
						this.renderer.scopedTextureCache.textureCube = this.pmremGenerator.fromEquirectangular(texture).texture;
						this.scene.environment = this.renderer.scopedTextureCache.textureCube;
						texture.dispose();
						this.pmremGenerator.dispose();
						resolve();

					}.bind(this));
			} else {
				let loader = new THREE.CubeTextureLoader();
				loader.setPath('modules/dice-so-nice/textures/cubemap/');

				this.renderer.scopedTextureCache.textureCube = loader.load([
					'px.webp', 'nx.webp',
					'py.webp', 'ny.webp',
					'pz.webp', 'nz.webp'
				]);
				resolve();
			}
		});
	}

	setDimensions(dimensions) {
		this.display.currentWidth = this.container.clientWidth / 2;
		this.display.currentHeight = this.container.clientHeight / 2;

		if (dimensions) {
			this.display.containerWidth = dimensions.w;
			this.display.containerHeight = dimensions.h;

			if(!this.display.currentWidth || !this.display.currentHeight){
				this.display.currentWidth = dimensions.w / 2;
				this.display.currentHeight = dimensions.h / 2;
			}
		} else {
			this.display.containerWidth = this.display.currentWidth;
			this.display.containerHeight = this.display.currentHeight;
		}
		this.display.aspect = Math.min(this.display.currentWidth / this.display.containerWidth, this.display.currentHeight / this.display.containerHeight);

		if (this.config.autoscale)
			this.display.scale = Math.sqrt(this.display.containerWidth * this.display.containerWidth + this.display.containerHeight * this.display.containerHeight) / 13;
		else
			this.display.scale = this.config.scale;
		if (this.config.boxType == "board")
			this.dicefactory.setScale(this.display.scale);
		this.renderer.setSize(this.display.currentWidth * 2, this.display.currentHeight * 2);

		this.cameraHeight.max = this.display.currentHeight / this.display.aspect / Math.tan(10 * Math.PI / 180);

		this.cameraHeight.medium = this.cameraHeight.max / 1.5;
		this.cameraHeight.far = this.cameraHeight.max;
		this.cameraHeight.close = this.cameraHeight.max / 2;

		if (this.camera) this.scene.remove(this.camera);
		this.camera = new THREE.PerspectiveCamera(20, this.display.currentWidth / this.display.currentHeight, 1, this.cameraHeight.max * 1.3);

		switch (this.animstate) {
			case 'selector':
				this.camera.position.z = this.selector.dice.length > 9 ? this.cameraHeight.far : (this.selector.dice.length < 6 ? this.cameraHeight.close : this.cameraHeight.medium);
				break;
			default:
				this.camera.position.z = this.cameraHeight.far;
		}
		this.camera.near = 10;
		this.camera.lookAt(new THREE.Vector3(0, 0, 0));

		const maxwidth = Math.max(this.display.containerWidth, this.display.containerHeight);

		if (this.light) this.scene.remove(this.light);
		if (this.light_amb) this.scene.remove(this.light_amb);

		let intensity, intensity_amb;
		if (this.dicefactory.bumpMapping) { //advanced lighting
			intensity = 0.4;
			intensity_amb = 0.35;
		} else {
			intensity = 1;
			intensity_amb = 1.7;
		}

		this.light_amb = new THREE.HemisphereLight(this.colors.ambient, this.colors.ground, intensity_amb);
		this.scene.add(this.light_amb);

		this.light = new THREE.DirectionalLight(this.colors.spotlight, intensity);
		if(this.config.boxType == "board")
			this.light.position.set(-this.display.containerWidth / 10, this.display.containerHeight / 10, maxwidth / 2);
		else
			this.light.position.set(0, this.display.containerHeight / 10, maxwidth / 2);
		this.light.target.position.set(0, 0, 0);
		this.light.distance = 0;
		this.light.castShadow = this.shadows;
		this.light.shadow.camera.near = maxwidth / 10;
		this.light.shadow.camera.far = maxwidth * 5;
		this.light.shadow.camera.fov = 50;
		this.light.shadow.bias = -0.0001;;
		this.light.shadow.mapSize.width = 1024;
		this.light.shadow.mapSize.height = 1024;
		const d = 1000;
		this.light.shadow.camera.left = - d;
		this.light.shadow.camera.right = d;
		this.light.shadow.camera.top = d;
		this.light.shadow.camera.bottom = - d;
		this.scene.add(this.light);


		if (this.desk)
			this.scene.remove(this.desk);

		let shadowplane = new THREE.ShadowMaterial();
		shadowplane.opacity = 0.5;
		this.desk = new THREE.Mesh(new THREE.PlaneGeometry(this.display.containerWidth * 6, this.display.containerHeight * 6, 1, 1), shadowplane);
		this.desk.receiveShadow = this.shadows;
		this.desk.position.set(0, 0, -1);
		this.scene.add(this.desk);

		this.renderer.render(this.scene, this.camera);
	}

	async update(config) {
		this.showExtraDice = config.showExtraDice;
		this.muteSoundSecretRolls = config.muteSoundSecretRolls;
		if(this.config.boxType == "board"){
			if (config.autoscale) {
				this.display.scale = Math.sqrt(this.display.containerWidth * this.display.containerWidth + this.display.containerHeight * this.display.containerHeight) / 13;
			} else {
				this.display.scale = config.scale
			}
			this.dicefactory.setScale(this.display.scale);
		}
		this.dicefactory.setBumpMapping(config.bumpMapping);

		let globalAnimationSpeed = game.settings.get("dice-so-nice", "globalAnimationSpeed");
		if (globalAnimationSpeed === "0")
			this.speed = parseInt(config.speed, 10);
		else
			this.speed = parseInt(globalAnimationSpeed, 10);
		this.shadows = config.shadowQuality != "none";
		this.light.castShadow = this.shadows;
		this.desk.receiveShadow = this.shadows;
		this.renderer.shadowMap.enabled = this.shadows;
		this.renderer.shadowMap.type = config.shadowQuality == "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
		this.sounds = config.sounds;
		this.volume = config.soundsVolume;
		this.soundsSurface = config.soundsSurface;

		await this.dicefactory.preloadPresets(true, null, config.appearance);

		this.throwingForce = config.throwingForce;
		this.scene.traverse(object => {
			if (object.type === 'Mesh') object.material.needsUpdate = true;
		});
	}


	vectorRand({ x, y }) {
		let angle = Math.random() * Math.PI / 5 - Math.PI / 5 / 2;
		let vec = {
			x: x * Math.cos(angle) - y * Math.sin(angle),
			y: x * Math.sin(angle) + y * Math.cos(angle)
		};
		if (vec.x == 0) vec.x = 0.01;
		if (vec.y == 0) vec.y = 0.01;
		return vec;
	}

	//returns an array of vectordata objects
	getVectors(notationVectors, vector, boost, dist) {

		for (let i = 0; i < notationVectors.dice.length; i++) {

			const diceobj = this.dicefactory.get(notationVectors.dice[i].type);

			let vec = this.vectorRand(vector);

			vec.x /= dist;
			vec.y /= dist;

			let pos = {
				x: this.display.containerWidth * (vec.x > 0 ? -1 : 1) * 0.9 + Math.floor(Math.random() * 201) - 100,
				y: this.display.containerHeight * (vec.y > 0 ? -1 : 1) * 0.9 + Math.floor(Math.random() * 201) - 100,
				z: Math.random() * 200 + 200
			};

			let projector = Math.abs(vec.x / vec.y);
			if (projector > 1.0) pos.y /= projector; else pos.x *= projector;


			let velvec = this.vectorRand(vector);

			velvec.x /= dist;
			velvec.y /= dist;
			let velocity, angle, axis;

			if (diceobj.shape != "d2") {

				velocity = {
					x: velvec.x * boost,
					y: velvec.y * boost,
					z: -10
				};

				angle = {
					x: -(Math.random() * vec.y * 5 + diceobj.inertia * vec.y),
					y: Math.random() * vec.x * 5 + diceobj.inertia * vec.x,
					z: 0
				};

				axis = {
					x: Math.random(),
					y: Math.random(),
					z: Math.random(),
					a: Math.random()
				};

				axis = {
					x: 0,
					y: 0,
					z: 0,
					a: 0
				};
			} else {
				//coin flip
				velocity = {
					x: velvec.x * boost / 10,
					y: velvec.y * boost / 10,
					z: 3000
				};

				angle = {
					x: 12 * diceobj.inertia,//-(Math.random() * velvec.y * 50 + diceobj.inertia * velvec.y ) ,
					y: 1 * diceobj.inertia,//Math.random() * velvec.x * 50 + diceobj.inertia * velvec.x ,
					z: 0
				};

				axis = {
					x: 1,//Math.random(), 
					y: 1,//Math.random(), 
					z: Math.random(),
					a: Math.random()
				};
			}

			notationVectors.dice[i].vectors = {
				type: diceobj.type,
				pos,
				velocity,
				angle,
				axis
			};
		}
		return notationVectors;
	}

	// swaps dice faces to match desired result
	swapDiceFace(dicemesh) {
		const diceobj = this.dicefactory.get(dicemesh.notation.type);

		let value = parseInt(dicemesh.getLastValue().value);
		let result = parseInt(dicemesh.forcedResult);

		if (diceobj.shape == 'd10' && result == 0) result = 10;

		if (diceobj.valueMap) { //die with special values
			result = diceobj.valueMap[result];
		}

		// Make the last rolled dice and the DiceBox instance available for debugging
		//CONFIG.DiceSoNice = {
		//	dicemesh,
		//	dicebox: this
		//};

		if (value == result) return;

		let rotIndex = value > result ? result + "," + value : value + "," + result;
		//console.log(`Needed ${result}, Rolled ${value}, Remap: ${rotIndex}`)
		let rotationDegrees = DICE_MODELS[dicemesh.shape].rotationCombinations[rotIndex];
		let eulerAngle = new THREE.Euler(THREE.MathUtils.degToRad(rotationDegrees[0]), THREE.MathUtils.degToRad(rotationDegrees[1]), THREE.MathUtils.degToRad(rotationDegrees[2]));
		let quaternion = new THREE.Quaternion().setFromEuler(eulerAngle);
		if (value > result)
			quaternion.invert();

		dicemesh.applyQuaternion(quaternion);

		dicemesh.resultReason = 'forced';
	}

  /*
  // Apply an euler angle from rotationCombinations for debugging
	swapTest(dicemesh, mapping, invert = false, revert = true) {

		let rotationDegrees = DICE_MODELS[dicemesh.shape].rotationCombinations[mapping];
		let eulerAngle = new THREE.Euler(THREE.MathUtils.degToRad(rotationDegrees[0]), THREE.MathUtils.degToRad(rotationDegrees[1]), THREE.MathUtils.degToRad(rotationDegrees[2]));
		let quaternion = new THREE.Quaternion().setFromEuler(eulerAngle);
		if (invert)
			quaternion.invert();

		dicemesh.applyQuaternion(quaternion);

		if (revert) {
			setTimeout(() => { this.swapTest(dicemesh, mapping, !invert, false) }, 2000 )
		}

		dicemesh.resultReason = 'forced';
	}

  // Apply an euler angle directly for debugging
	swapTest(dicemesh, mapping, invert = false, revert = true) {
	swapTestEuler(dicemesh, euler, invert = false, revert = true) {
		let eulerAngle = new THREE.Euler(THREE.MathUtils.degToRad(euler[0]), THREE.MathUtils.degToRad(euler[1]), THREE.MathUtils.degToRad(euler[2]));
		let quaternion = new THREE.Quaternion().setFromEuler(eulerAngle);
		if (invert)
			quaternion.invert();

		dicemesh.applyQuaternion(quaternion);

		if (revert) {
			setTimeout(() => { this.swapTestEuler(dicemesh, euler, !invert, false) }, 2000 )
		}

		dicemesh.resultReason = 'forced';
	}

  // Extract the euler angle from a mesh in degrees for debugging
	extractEuler(dicemesh) {
		let euler = dicemesh.rotation
		console.log("World Euler:", THREE.MathUtils.radToDeg(euler.x), THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.z), euler.order)
	}
  */

	//spawns one dicemesh object from a single vectordata object
	spawnDice(dicedata, appearance) {
		let vectordata = dicedata.vectors;
		const diceobj = this.dicefactory.get(vectordata.type);
		if (!diceobj) return;

		let dicemesh = this.dicefactory.create(this.renderer.scopedTextureCache, diceobj.type, appearance);
		if (!dicemesh) return;

		let mass = diceobj.mass;
		switch (appearance.material) {
			case "metal":
				mass *= 7;
				break;
			case "wood":
				mass *= 0.65;
				break;
			case "glass":
				mass *= 2;
				break;
		}
		
		dicemesh.notation = vectordata;
		dicemesh.result = [];
		dicemesh.forcedResult = dicedata.result;
		dicemesh.startAtIteration = dicedata.startAtIteration;
		dicemesh.stopped = 0;
		dicemesh.castShadow = this.shadows;
		dicemesh.receiveShadow = this.shadows;
		dicemesh.specialEffects = dicedata.specialEffects;

		dicemesh.body_sim = new CANNON.Body({ allowSleep: true, sleepSpeedLimit: 75, sleepTimeLimit: 0.9, mass: mass, shape: dicemesh.geometry.cannon_shape, material: this.dice_body_material });
		dicemesh.body_sim.type = CANNON.Body.DYNAMIC;
		dicemesh.body_sim.position.set(vectordata.pos.x, vectordata.pos.y, vectordata.pos.z);
		dicemesh.body_sim.quaternion.setFromAxisAngle(new CANNON.Vec3(vectordata.axis.x, vectordata.axis.y, vectordata.axis.z), vectordata.axis.a * Math.PI * 2);
		dicemesh.body_sim.angularVelocity.set(vectordata.angle.x, vectordata.angle.y, vectordata.angle.z);
		dicemesh.body_sim.velocity.set(vectordata.velocity.x, vectordata.velocity.y, vectordata.velocity.z);
		dicemesh.body_sim.linearDamping = 0.1;
		dicemesh.body_sim.angularDamping = 0.1;
		dicemesh.body_sim.addEventListener('collide', this.eventCollide.bind(this));
		dicemesh.body_sim.stepQuaternions = new Array(1000);
		dicemesh.body_sim.stepPositions = new Array(1000);

		//We add some informations about the dice to the CANNON body to be used in the collide event
		dicemesh.body_sim.diceType = diceobj.type;
		dicemesh.body_sim.diceMaterial = appearance.material;
		dicemesh.body_sim.secretRoll = dicedata.options?.secret;

		//dicemesh.meshCannon = this.body2mesh(dicemesh.body_sim,true);

		/*var gltfExporter = new GLTFExporter();
		gltfExporter.parse(dicemesh.meshCannon, function ( result ) {
			if ( result instanceof ArrayBuffer ) {
				saveArrayBuffer( result, 'scene.glb' );
			} else {
				var output = JSON.stringify( result, null, 2 );
				console.log( output );
				saveString( output, 'scene.gltf' );
			}
		}, {});

		var link = document.createElement( 'a' );
		link.style.display = 'none';
		document.body.appendChild( link ); // Firefox workaround, see #6594

		function save( blob, filename ) {
			link.href = URL.createObjectURL( blob );
			link.download = filename;
			link.click();
			// URL.revokeObjectURL( url ); breaks Firefox...
		}

		function saveString( text, filename ) {
			save( new Blob( [ text ], { type: 'text/plain' } ), filename );
		}

		function saveArrayBuffer( buffer, filename ) {
			save( new Blob( [ buffer ], { type: 'application/octet-stream' } ), filename );
		}*/

		let objectContainer = new THREE.Group();
		objectContainer.add(dicemesh);

		this.diceList.push(dicemesh);
		if (dicemesh.startAtIteration == 0) {
			this.scene.add(objectContainer);
			//this.scene.add(dicemesh.meshCannon);
			this.world_sim.addBody(dicemesh.body_sim);
		}
	}

	eventCollide({ body, target }) {
		// collision events happen simultaneously for both colliding bodies
		// all this sanity checking helps limits sounds being played
		if (!this.sounds || !body || !this.sounds_dice.source) return;

		let now = body.world.stepnumber;
		let currentSoundType = (body.mass > 0) ? 'dice' : 'table';

		// the idea here is that a dice clack should never be skipped in favor of a table sound
		// if ((don't play sounds if we played one this world step, or there hasn't been enough delay) AND 'this sound IS NOT a dice clack') then 'skip it'
		if ((this.lastSoundStep == body.world.stepnumber || this.lastSound > body.world.stepnumber) && currentSoundType != 'dice') return;

		// also skip if it's too early and both last sound and this sound are the same
		if ((this.lastSoundStep == body.world.stepnumber || this.lastSound > body.world.stepnumber) && currentSoundType == 'dice' && this.lastSoundType == 'dice') return;

		if (body.mass > 0) { // dice to dice collision
			let speed = body.velocity.length();
			// also don't bother playing at low speeds
			if (speed < 250) return;
			let strength = Math.max(Math.min(speed / (550), 1), 0.2);
			if(this.muteSoundSecretRolls && (body.secretRoll || target.secretRoll))
				strength = 0;
			let sound;

			if (body.diceType != "dc") {
				let sounds_dice = this.sounds_dice['plastic'];
				if (this.sounds_dice[body.diceMaterial])
					sounds_dice = this.sounds_dice[body.diceMaterial];
				sound = sounds_dice[Math.floor(Math.random() * sounds_dice.length)];
			}
			else
				sound = this.sounds_dice['coin'][Math.floor(Math.random() * this.sounds_dice['coin'].length)];
			if(this.animstate == "simulate"){
				this.detectedCollides[this.iteration] = [this.sounds_dice.source, sound, strength];
			} else {
				this.playAudioSprite(this.sounds_dice.source, sound, strength);
			}
			this.lastSoundType = 'dice';


		} else { // dice to table collision
			let speed = target.velocity.length();
			// also don't bother playing at low speeds
			if (speed < 100) return;

			let surface = this.soundsSurface;
			let strength = Math.max(Math.min(speed / (500), 1), 0.2);
			if(this.muteSoundSecretRolls && (body.secretRoll || target.secretRoll))
				strength = 0;
			let soundlist = this.sounds_table[surface];
			let sound = soundlist[Math.floor(Math.random() * soundlist.length)];
			if(this.animstate == "simulate"){
				this.detectedCollides[this.iteration] = [this.sounds_table.source, sound, strength];
			} else {
				this.playAudioSprite(this.sounds_table.source, sound, strength);
			}

			this.lastSoundType = 'table';
		}
		this.lastSoundStep = body.world.stepnumber;
		this.lastSound = body.world.stepnumber + this.soundDelay;
	}

	throwFinished(worldType = "render") {

		let stopped = true;
		if (this.iteration > 1000) return true;
		if (this.iteration <= this.minIterations) return false;
		if (worldType == "render") {
			stopped = this.iteration >= this.iterationsNeeded;
			if (stopped) {
				for (let i = 0, len = this.diceList.length; i < len; ++i) {
					this.diceList[i].body_sim.stepPositions = new Array(1000);
					this.diceList[i].body_sim.stepQuaternions = new Array(1000);
					this.diceList[i].body_sim.detectedCollides = [];
					if (!this.diceList[i].body_sim.mass)
						this.diceList[i].body_sim.dead = true;
				}
			}
		}
		else {
			for (let i = 0, len = this.diceList.length; i < len; ++i) {
				if (this.diceList[i].body_sim.sleepState < 2)
					return false;
				else if (this.diceList[i].result.length == 0)
					this.diceList[i].storeRolledValue();
			}
			//Throw is actually finished
			if (stopped) {
				this.iterationsNeeded = this.iteration;
				let canBeFlipped = game.settings.get("dice-so-nice", "diceCanBeFlipped");
				if (!canBeFlipped) {
					//make the current dice on the board STATIC object so they can't be knocked
					for (let i = 0, len = this.diceList.length; i < len; ++i) {
						this.diceList[i].body_sim.mass = 0;
						this.diceList[i].body_sim.updateMassProperties();
					}
				}
			}
		}
		return stopped;
	}

	simulateThrow() {
		this.detectedCollides = new Array(1000);
		this.iterationsNeeded = 0;
		this.animstate = 'simulate';
		this.rolling = true;
		while (!this.throwFinished("sim")) {
			//Before each step, we copy the quaternions of every die in an array
			++this.iteration;

			if (!(this.iteration % this.nbIterationsBetweenRolls)) {
				for (let i = 0; i < this.diceList.length; i++) {
					if (this.diceList[i].startAtIteration == this.iteration)
						this.world_sim.addBody(this.diceList[i].body_sim);
				}
			}
			this.world_sim.step(this.framerate);

			for (let i = 0; i < this.world_sim.bodies.length; i++) {
				if (this.world_sim.bodies[i].stepPositions) {
					this.world_sim.bodies[i].stepQuaternions[this.iteration] = {
						"w": this.world_sim.bodies[i].quaternion.w,
						"x": this.world_sim.bodies[i].quaternion.x,
						"y": this.world_sim.bodies[i].quaternion.y,
						"z": this.world_sim.bodies[i].quaternion.z
					};
					this.world_sim.bodies[i].stepPositions[this.iteration] = {
						"x": this.world_sim.bodies[i].position.x,
						"y": this.world_sim.bodies[i].position.y,
						"z": this.world_sim.bodies[i].position.z
					};
				}
			}
		}
	}

	animateThrow() {
		this.animstate = 'throw';
		let time = (new Date()).getTime();
		this.last_time = this.last_time || time - (this.framerate * 1000);
		let time_diff = (time - this.last_time) / 1000;

		let neededSteps = Math.floor(time_diff / this.framerate);

		//Update animated dice mixer
		if (this.animatedDiceDetected) {
			let delta = this.clock.getDelta();
			for (let i in this.scene.children) {
				let container = this.scene.children[i];
				let dicemesh = container.children && container.children.length && container.children[0].body_sim != undefined ? container.children[0] : null;
				if (dicemesh && dicemesh.mixer) {
					dicemesh.mixer.update(delta);
				}
			}
		}

		if (neededSteps && this.rolling) {
			for (let i = 0; i < neededSteps * this.speed; i++) {
				++this.iteration;
				if (!(this.iteration % this.nbIterationsBetweenRolls)) {
					for (let i = 0; i < this.diceList.length; i++) {
						if (this.diceList[i].startAtIteration == this.iteration) {
							this.scene.add(this.diceList[i].parent);
						}
					}
				}
			}
			if (this.iteration > this.iterationsNeeded)
				this.iteration = this.iterationsNeeded;

			// update physics interactions visually

			for (let i in this.scene.children) {
				let container = this.scene.children[i];
				let dicemesh = container.children && container.children.length && container.children[0].body_sim != undefined && !container.children[0].body_sim.dead ? container.children[0] : null;
				if (dicemesh && dicemesh.body_sim.stepPositions[this.iteration]) {
					container.position.copy(dicemesh.body_sim.stepPositions[this.iteration]);
					container.quaternion.copy(dicemesh.body_sim.stepQuaternions[this.iteration]);

					if (dicemesh.meshCannon) {
						dicemesh.meshCannon.position.copy(dicemesh.body_sim.stepPositions[this.iteration]);
						dicemesh.meshCannon.quaternion.copy(dicemesh.body_sim.stepQuaternions[this.iteration]);
					}
				}
			}

			if (this.detectedCollides[this.iteration]) {
				this.playAudioSprite(...this.detectedCollides[this.iteration]);
			}
		} else if(!this.rolling) {
			let worldAsleep = true;
			for(let i=0;i<this.world_sim.bodies.length;i++){
				if(this.world_sim.bodies[i].allowSleep && this.world_sim.bodies[i].sleepState < 2){
					worldAsleep = false;
					break;
				}
			}
			if(!worldAsleep){
				this.world_sim.step(this.framerate, time_diff);
				for (let i in this.scene.children) {
					let container = this.scene.children[i];
					let dicemesh = container.children && container.children.length && container.children[0].body_sim != undefined && !container.children[0].body_sim.dead ? container.children[0] : null;
					if (dicemesh) {
						container.position.copy(dicemesh.body_sim.position);
						container.quaternion.copy(dicemesh.body_sim.quaternion);

						if (dicemesh.meshCannon) {
							dicemesh.meshCannon.position.copy(dicemesh.body_sim.position);
							dicemesh.meshCannon.quaternion.copy(dicemesh.body_sim.quaternion);
						}
					}
				}
			}
		}

		if (this.isVisible && (this.allowInteractivity || this.animatedDiceDetected || neededSteps || DiceSFXManager.renderQueue.length)){
			DiceSFXManager.renderSFX();
			this.renderer.render(this.scene, this.camera);
		}
		if(this.rendererStats)
			this.rendererStats.update(this.renderer);
		this.last_time = this.last_time + neededSteps * this.framerate * 1000;

		// roll finished
		if (this.throwFinished("render")) {
			//if animated dice still on the table, keep animating
			this.rolling = false;
			if(this.running){
				this.handleSpecialEffectsInit().then(()=>{
					this.callback(this.throws);
					this.callback = null;
					this.throws = null;
					if (!this.animatedDiceDetected && !(this.allowInteractivity && (this.deadDiceList.length + this.diceList.length)>0) && !DiceSFXManager.renderQueue.length)
						this.removeTicker(this.animateThrow);
				});
			}
			this.running = false;
		}
	}

	start_throw(throws, callback) {
		if (this.rolling) return;
		let countNewDice = 0;
		throws.forEach(notation => {
			let vector = { x: (Math.random() * 2 - 0.5) * this.display.currentWidth, y: -(Math.random() * 2 - 0.5) * this.display.currentHeight };
			let dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
			let throwingForceModifier = 0.8;
			switch (this.throwingForce) {
				case "weak":
					throwingForceModifier = 0.5;
					break;
				case "strong":
					throwingForceModifier = 1.8;
					break;
			}
			let boost = ((Math.random() + 3) * throwingForceModifier) * dist;

			notation = this.getVectors(notation, vector, boost, dist);
			countNewDice += notation.dice.length;
		});

		let maxDiceNumber = game.settings.get("dice-so-nice", "maxDiceNumber");
		if (this.deadDiceList.length + this.diceList.length + countNewDice > maxDiceNumber) {
			this.clearAll();
		}
		this.isVisible = true;
		this.rollDice(throws, callback);
	}

	clearDice() {
		this.running = false;
		this.deadDiceList = this.deadDiceList.concat(this.diceList);
		this.diceList = [];
	}

	clearAll() {
		this.clearDice();
		let dice;
		while (dice = this.deadDiceList.pop()) {
			this.scene.remove(dice.parent.type == "Scene" ? dice : dice.parent);
			if (dice.body_sim) this.world_sim.remove(dice.body_sim);
		}

		if (this.pane) this.scene.remove(this.pane);
		
		if(this.config.boxType == "board"){
			DiceSFXManager.clearQueue();
			this.removeTicker(this.animateThrow);
		} else {
			this.removeTicker(this.animateSelector);
		}
		this.renderer.render(this.scene, this.camera);
		this.isVisible = false;
	}

	clearScene() {
		while (this.scene.children.length > 0) {
			this.scene.remove(this.scene.children[0]);
		}
		this.desk.material.dispose();
		this.desk.geometry.dispose();
		if (this.shadows) {
			this.light.shadow.map.dispose();
		}
		if(this.config.boxType == "board")
			this.removeTicker(this.animateThrow);
		else 
			this.removeTicker(this.animateSelector);
	}

	//Allow to remove an handler from a PIXI ticker even when the context changed.
	removeTicker(fn){
		let ticker = canvas.app.ticker;
		let listener = ticker._head.next;

        while (listener)
        {
            // We found a match, lets remove it
            // no break to delete all possible matches
            // incase a listener was added 2+ times
            if (listener.fn === fn)
            {
                listener = listener.destroy();
            }
            else
            {
                listener = listener.next;
            }
        }

        if (!ticker._head.next)
        {
            ticker._cancelIfNeeded();
        }
        return ticker;
	}

	rollDice(throws, callback) {

		this.camera.position.z = this.cameraHeight.far;
		this.clearDice();
		this.minIterations = (throws.length - 1) * this.nbIterationsBetweenRolls;

		for (let j = 0; j < throws.length; j++) {
			let notationVectors = throws[j];
			
			for (let i = 0, len = notationVectors.dice.length; i < len; ++i) {
				notationVectors.dice[i].startAtIteration = j * this.nbIterationsBetweenRolls;
				let appearance = this.dicefactory.getAppearanceForDice(notationVectors.dsnConfig.appearance,notationVectors.dice[i].type, notationVectors.dice[i]);
				this.spawnDice(notationVectors.dice[i], appearance);
			}
		}
		this.iteration = 0;

		this.simulateThrow();
		this.iteration = 0;


		//check forced results, fix dice faces if necessary
		//Detect if there's an animated dice
		this.animatedDiceDetected = false;
		for (let i = 0, len = this.diceList.length; i < len; ++i) {
			let dicemesh = this.diceList[i];
			if (!dicemesh) continue;
			this.swapDiceFace(dicemesh);
			if (dicemesh.mixer)
				this.animatedDiceDetected = true;
		}

		//reset the result
		for (let i = 0, len = this.diceList.length; i < len; ++i) {
			if (!this.diceList[i]) continue;

			if (this.diceList[i].resultReason != 'forced') {
				this.diceList[i].result = [];
			}
		}

		// animate the previously simulated roll
		this.rolling = true;
		this.running = (new Date()).getTime();
		this.last_time = 0;
		this.callback = callback;
		this.throws = throws;
		this.removeTicker(this.animateThrow);
		canvas.app.ticker.add(this.animateThrow, this);
	}

	showcase(config) {
		this.clearAll();

		let selectordice = this.dicefactory.systems.standard.dice.map(dice => dice.type);
		const extraDiceTypes = ["d3","d5","d7","d14","d16","d24","d30"];
		if(!this.showExtraDice)
			selectordice = selectordice.filter((die) => !extraDiceTypes.includes(die));
		
		let proportion = this.display.containerWidth / this.display.containerHeight;
		let columns = Math.min(selectordice.length, Math.round(Math.sqrt(proportion * selectordice.length)));
		let rows = Math.floor((selectordice.length + columns - 1) / columns);

		this.camera.position.z = this.cameraHeight.medium;
		this.camera.position.x = this.display.containerWidth/2 - (this.display.containerWidth/columns/2);
		this.camera.position.y = -this.display.containerHeight/2 + (this.display.containerHeight/rows/2);
		this.camera.fov = 2 * Math.atan(this.display.containerHeight / (2*this.camera.position.z)) * (180 / Math.PI);
		this.camera.updateProjectionMatrix();

		if (this.pane) this.scene.remove(this.pane);
		if (this.desk) this.scene.remove(this.desk);
		if (this.shadows) {
			
			let shadowplane = new THREE.ShadowMaterial();
			shadowplane.opacity = 0.5;

			this.pane = new THREE.Mesh(new THREE.PlaneGeometry(this.display.containerWidth*2, this.display.containerHeight*2, 1, 1), shadowplane);
			this.pane.receiveShadow = this.shadows;
			this.pane.position.set(0, 0, -70);
			this.scene.add(this.pane);
		}

		let z = 0;
		let count = 0;
		for(let y = 0;y < rows;y++){
			for(let x = 0; x < columns;x++){
				if(count>=selectordice.length)
					break;
				let appearance = this.dicefactory.getAppearanceForDice(config.appearance,selectordice[count]);
				let dicemesh = this.dicefactory.create(this.renderer.scopedTextureCache, selectordice[count], appearance);
				dicemesh.scale.set(
					Math.min(dicemesh.scale.x * 5 /  columns, dicemesh.scale.x * 2 /  rows), 
					Math.min(dicemesh.scale.y * 5 /  columns, dicemesh.scale.y * 2 /  rows), 
					Math.min(dicemesh.scale.z * 5 /  columns,dicemesh.scale.z * 2 /  rows)
				);

				dicemesh.position.set(x * this.display.containerWidth / columns, -(y * this.display.containerHeight / rows), z);
				
				dicemesh.castShadow = this.shadows;
				
				dicemesh.userData = selectordice[count];

				this.diceList.push(dicemesh);
				this.scene.add(dicemesh);
				count++;
			}
		}

		this.last_time = 0;
		if (this.selector.animate) {
			this.container.style.opacity = 0;
			this.last_time = window.performance.now();
			this.start_time = this.last_time;
			this.framerate = 1000 / 60;
			this.removeTicker(this.animateSelector);
			canvas.app.ticker.add(this.animateSelector, this);
		}
		else this.renderer.render(this.scene, this.camera);
		setTimeout(() => {
			this.scene.traverse(object => {
				if (object.type === 'Mesh') object.material.needsUpdate = true;
			});
		}, 2000);
	}

	animateSelector() {
		this.animstate = 'selector';
		let now = window.performance.now();
		let elapsed = now - this.last_time;
		if(elapsed > this.framerate){
			this.last_time = now - (elapsed % this.framerate);

			if (this.container.style.opacity != '1') this.container.style.opacity = Math.min(1, (parseFloat(this.container.style.opacity) + 0.05));

			if (this.selector.rotate) {
				let angle_change = 0.005 * Math.PI;
				for (let i = 0; i < this.diceList.length; i++) {
					this.diceList[i].rotation.y += angle_change;
					this.diceList[i].rotation.x += angle_change / 4;
					this.diceList[i].rotation.z += angle_change / 10;
				}
			}
			this.renderer.render(this.scene, this.camera);
		}
	}

	//used to debug cannon shape vs three shape
	body2mesh(body) {
		var obj = new THREE.Object3D();
		let currentMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
		for (var l = 0; l < body.shapes.length; l++) {
			var shape = body.shapes[l];

			var mesh;

			switch (shape.type) {

				case CANNON.Shape.types.SPHERE:
					var sphere_geometry = new THREE.SphereGeometry(shape.radius, 8, 8);
					mesh = new THREE.Mesh(sphere_geometry, currentMaterial);
					break;

				case CANNON.Shape.types.PARTICLE:
					mesh = new THREE.Mesh(this.particleGeo, this.particleMaterial);
					var s = this.settings;
					mesh.scale.set(s.particleSize, s.particleSize, s.particleSize);
					break;

				case CANNON.Shape.types.PLANE:
					var geometry = new THREE.PlaneGeometry(10, 10, 4, 4);
					mesh = new THREE.Object3D();
					var submesh = new THREE.Object3D();
					var ground = new THREE.Mesh(geometry, currentMaterial);
					ground.scale.set(100, 100, 100);
					submesh.add(ground);

					ground.castShadow = true;
					ground.receiveShadow = true;

					mesh.add(submesh);
					break;

				case CANNON.Shape.types.BOX:
					var box_geometry = new THREE.BoxGeometry(shape.halfExtents.x * 2,
						shape.halfExtents.y * 2,
						shape.halfExtents.z * 2);
					mesh = new THREE.Mesh(box_geometry, currentMaterial);
					break;

				case CANNON.Shape.types.CONVEXPOLYHEDRON:
					var geo = new THREE.BufferGeometry()
					var points = []
					for (var i = 0; i < shape.faces.length; i++) {
						var face = shape.faces[i];

						for (var j = 0; j < face.length - 1; j++) {
							var a = shape.vertices[face[j]];
							var b = shape.vertices[face[j + 1]];
							points.push(a);
							points.push(b);
						}
					}
					geo.setFromPoints(points);
					geo.computeVertexNormals();
					mesh = new THREE.Mesh(geo, currentMaterial);
					break;

				case CANNON.Shape.types.HEIGHTFIELD:
					var geometry = new THREE.Geometry();

					var v0 = new CANNON.Vec3();
					var v1 = new CANNON.Vec3();
					var v2 = new CANNON.Vec3();
					for (var xi = 0; xi < shape.data.length - 1; xi++) {
						for (var yi = 0; yi < shape.data[xi].length - 1; yi++) {
							for (var k = 0; k < 2; k++) {
								shape.getConvexTrianglePillar(xi, yi, k === 0);
								v0.copy(shape.pillarConvex.vertices[0]);
								v1.copy(shape.pillarConvex.vertices[1]);
								v2.copy(shape.pillarConvex.vertices[2]);
								v0.vadd(shape.pillarOffset, v0);
								v1.vadd(shape.pillarOffset, v1);
								v2.vadd(shape.pillarOffset, v2);
								geometry.vertices.push(
									new THREE.Vector3(v0.x, v0.y, v0.z),
									new THREE.Vector3(v1.x, v1.y, v1.z),
									new THREE.Vector3(v2.x, v2.y, v2.z)
								);
								var i = geometry.vertices.length - 3;
								geometry.faces.push(new THREE.Face3(i, i + 1, i + 2));
							}
						}
					}
					geometry.computeBoundingSphere();
					geometry.computeFaceNormals();
					mesh = new THREE.Mesh(geometry, currentMaterial);
					break;

				case CANNON.Shape.types.TRIMESH:
					var geometry = new THREE.Geometry();

					var v0 = new CANNON.Vec3();
					var v1 = new CANNON.Vec3();
					var v2 = new CANNON.Vec3();
					for (var i = 0; i < shape.indices.length / 3; i++) {
						shape.getTriangleVertices(i, v0, v1, v2);
						geometry.vertices.push(
							new THREE.Vector3(v0.x, v0.y, v0.z),
							new THREE.Vector3(v1.x, v1.y, v1.z),
							new THREE.Vector3(v2.x, v2.y, v2.z)
						);
						var j = geometry.vertices.length - 3;
						geometry.faces.push(new THREE.Face3(j, j + 1, j + 2));
					}
					geometry.computeBoundingSphere();
					geometry.computeFaceNormals();
					mesh = new THREE.Mesh(geometry, currentMaterial);
					break;

				default:
					throw "Visual type not recognized: " + shape.type;
			}

			//mesh.receiveShadow = this.shadows;
			mesh.castShadow = this.shadows;
			if (mesh.children) {
				for (var i = 0; i < mesh.children.length; i++) {
					mesh.children[i].castShadow = true;
					mesh.children[i].receiveShadow = true;
					if (mesh.children[i]) {
						for (var j = 0; j < mesh.children[i].length; j++) {
							mesh.children[i].children[j].castShadow = true;
							mesh.children[i].children[j].receiveShadow = true;
						}
					}
				}
			}

			var o = body.shapeOffsets[l];
			var q = body.shapeOrientations[l];
			mesh.position.set(o.x, o.y, o.z);
			mesh.quaternion.set(q.x, q.y, q.z, q.w);

			obj.add(mesh);
		}

		return obj;
	}

	findRootObject(object){
		if(object.hasOwnProperty("shape"))
			return object;
		else if(object.parent)
			return this.findRootObject(object.parent);
		else
			return null;
	}

	findShowcaseDie(pos){
		this.raycaster.setFromCamera(pos, this.camera);
		const intersects = this.raycaster.intersectObjects(this.diceList, true);
		if(intersects.length){

			return intersects[0];
		}
		else
			return null;
	}

	findHoveredDie(){
		if(this.isVisible && !this.running && !this.mouse.constraintDown){
			this.raycaster.setFromCamera(this.mouse.pos, this.camera);
			const intersects = this.raycaster.intersectObjects(this.diceList, true);
			if(intersects.length){
				this.hoveredDie = intersects[0];
			}
			else
				this.hoveredDie = null;
		}
	}

	onMouseMove(event,ndc){
		this.mouse.pos.x = ndc.x;
		this.mouse.pos.y = ndc.y;

		if(this.mouse.constraint){
			this.raycaster.setFromCamera(this.mouse.pos, this.camera);
			const intersects = this.raycaster.intersectObjects([this.desk]);
			if(intersects.length){
				let pos = intersects[0].point;
				this.jointBody.position.set(pos.x,pos.y,pos.z+150);
            	this.mouse.constraint.update();
			}
		}
	}

	onMouseDown(event,ndc){
		this.mouse.pos.x = ndc.x;
		this.mouse.pos.y = ndc.y;
		this.hoveredDie = null;
		this.findHoveredDie();

		let entity = this.hoveredDie;
		if(!entity)
			return;
		let pos = entity.point;
		if(pos){
			this.mouse.constraintDown = true;
			//disable FVTT mouse events
			if(canvas.mouseInteractionManager)
				canvas.mouseInteractionManager.object.interactive = false;

			// Vector to the clicked point, relative to the body
			let root = this.findRootObject(entity.object);
			let v1 = new CANNON.Vec3(pos.x,pos.y,pos.z).vsub(root.body_sim.position);

			// Apply anti-quaternion to vector to tranform it into the local body coordinate system
			let antiRot = root.body_sim.quaternion.inverse();
			let pivot = antiRot.vmult(v1); // pivot is not in local body coordinates
  
			// Move the cannon click marker particle to the click position
			this.jointBody.position.set(pos.x,pos.y,pos.z+150);
  
			// Create a new constraint
			// The pivot for the jointBody is zero
			this.mouse.constraint = new CANNON.PointToPointConstraint(root.body_sim, pivot, this.jointBody, new CANNON.Vec3(0,0,0));
  
			// Add the constriant to world
			this.world_sim.addConstraint(this.mouse.constraint);
			return true;
		}
		return false;
	}

	onMouseUp(event){
		if(this.mouse.constraintDown){
			this.mouse.constraintDown = false;
			this.world_sim.removeConstraint(this.mouse.constraint);

			//re-enable fvtt canvas events
			if(canvas.mouseInteractionManager)
				canvas.mouseInteractionManager.activate();
			return true;
		}
		return false;
	}

	async handleSpecialEffectsInit(){
		let promisesSFX = [];
		this.diceList.forEach(dice =>{
			if(dice.specialEffects){
				dice.specialEffects.forEach(sfx => {
					promisesSFX.push(DiceSFXManager.playSFX(sfx, this, dice));
				});
			}
		});
		return Promise.all(promisesSFX);
	}
}
