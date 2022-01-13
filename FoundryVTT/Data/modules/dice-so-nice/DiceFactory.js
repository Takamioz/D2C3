import {DicePreset} from './DicePreset.js';
import {BASE_PRESETS_LIST, EXTRA_PRESETS_LIST} from './DiceDefaultPresets.js';
import {DiceColors, DICE_SCALE, COLORSETS} from './DiceColors.js';
import {DICE_MODELS} from './DiceModels.js';
import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/three-modules/GLTFLoader.js';
export class DiceFactory {

	constructor() {
		this.geometries = {};

		this.baseScale = 50;

		this.preferredSystem = "standard";
		this.preferredColorset = "custom";

		this.cache_hits = 0;
		this.cache_misses = 0;

		this.bumpMapping = true;

		this.loaderGLTF = new GLTFLoader();

		this.baseTextureCache = {};
		this.fontFamilies = [
			"Arial",
			"Verdana",
			"Trebuchet MS",
			"Times New Roman",
			"Didot",
			"American Typewriter",
			"Andale Mono",
			"Courier",
			"Bradley Hand",
			"Luminari"
		];

		// fixes texture rotations on specific dice models
		this.rotate = {
			d8: {even: 7.5, odd: 127.5},
			d12: {all: -5},
			d20: {all: 8.5},
		};

		this.systems = {
			'standard': {id: 'standard', name: game.i18n.localize("DICESONICE.System.Standard"), dice:[], mode:"default"},
			'spectrum': {id: 'spectrum', name: game.i18n.localize("DICESONICE.System.SpectrumDice"), dice:[], mode:"default"},
			'foundry_vtt': {id: 'foundry_vtt', name: game.i18n.localize("DICESONICE.System.FoundryVTT"), dice:[], mode:"default"},
			'dot': {id: 'dot', name: game.i18n.localize("DICESONICE.System.Dot"), dice:[], mode:"default"},
			'dot_b': {id: 'dot_b', name: game.i18n.localize("DICESONICE.System.DotBlack"), dice:[], mode:"default"}
		};
		
		BASE_PRESETS_LIST.forEach((preset) => {
			this.register(preset);
		});
		
		EXTRA_PRESETS_LIST.forEach((data) => {
			this.addDicePreset(data);
		});

		for(let i in CONFIG.Dice.terms){
			let term = CONFIG.Dice.terms[i];
			//If this is not a core dice type
			if(![Coin, FateDie, Die].includes(term)){
				let objTerm = new term({});
				if([2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 30].includes(objTerm.faces)){
					this.internalAddDicePreset(objTerm);
				}
			}
		}
	}

	initializeMaterials(){
		if(this.bumpMapping){
			this.material_options = {
				'plastic': {
					'type':"standard",
					'options':{
						metalness: 0,
						roughness: 0.6,
						envMapIntensity:1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_fingerprint",
						envMap : true
					}
				},
				'metal': {
					'type':'standard',
					'options': {
						roughness: 0.95,
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_metal",
						envMap : true
					}
				},
				'wood': {
					'type':'standard',
					'options': {
						roughness:1,
						metalness:0
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_wood",
						envMap : true
					}
				},
				'glass': {
					'type':'standard',
					'options': {
						roughness: 0.3,
						metalness: 0
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_fingerprint",
						envMap : true
					}
				},
				'chrome': {
					'type':'standard',
					'options': {
						metalness: 1,
						roughness: 0.1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_fingerprint",
						envMap : true
					}
				}
			}
		} else {
			this.material_options = {
				'plastic': {
					'type':"phong",
					'options':{
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 3,
						flatShading: true
					}
				},
				'metal': {
					'type':'standard',
					'options': {
						color: 0xdddddd,
						emissive:0x111111,
						roughness: 0.6,
						metalness: 1,
						envMapIntensity:2
					},
					'scopedOptions':{
						envMap:true
					}
				},
				'wood': {
					'type':'phong',
					'options': {
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 1,
						flatShading: true
					}
				},
				'glass': {
					'type':'phong',
					'options': {
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 0.3,
						reflectivity:0.1,
						combine:THREE.MixOperation
					},
					'scopedOptions':{
						envMap:true
					}
				},
				'chrome': {
					'type':'phong',
					'options': {
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 1,
						reflectivity:0.7,
						combine:THREE.AddOperation
					},
					'scopedOptions':{
						envMap:true
					}
				}
			}
		}
	}

	setScale(scale){
		this.baseScale = scale;
	}

	setBumpMapping(bumpMapping){
		this.bumpMapping = bumpMapping;
	}

	register(diceobj) {
		//If it is added to standard, it can be from automated system detecting DiceTerm, or the basic dice list. In those case, the internalAdd preorperty is set to true
		//Everything should exist in the standard system
		//We check to see if there's already this Dice DONOMINATOR in the standard system
		let index = this.systems.standard.dice.findIndex(el => el.type == diceobj.type);

		//If it exists in the standard system, and it was added there by the automated system, we want to override and load it
		if(index>=0 && (this.systems.standard.dice[index].internalAdd || diceobj.internalAdd)){
			this.systems.standard.dice[index] = diceobj;
			if(diceobj.modelFile){
				diceobj.loadModel(this.loaderGLTF);
			} else {
				diceobj.loadTextures();
			}
		}
		if(diceobj.system == "standard"){
			//If we're adding to the standard system directly, we only do it if it didn't exist previously
			if(index < 0){
				this.systems[diceobj.system].dice.push(diceobj);
			}	
		} else {
			//If for some reasons, we try to register a dice type that doesnt exist on the standard system, we add it there first.
			//This should not happen because of internalAddDicePreset but I'm only 95% sure.
			if(index<0){
				this.systems.standard.dice.push(diceobj);
				if(diceobj.modelFile){
					diceobj.loadModel(this.loaderGLTF);
				} else {
					diceobj.loadTextures();
				}
			}
			//Then we add it to its own system. No need to load it, that will be taken care of automatically
			this.systems[diceobj.system].dice.push(diceobj);
		}
	}

	async preloadPresets(waitForLoad = true, userID = null, config = {}){
		let activePresets = [];
		const preloadPresetsByUser = (user) => {
			let appearance = user.getFlag("dice-so-nice", "appearance") ? duplicate(user.getFlag("dice-so-nice", "appearance")) : null;
			if(!appearance){
				appearance = {global:{}};
				if(this.preferredSystem != "standard")
					appearance.global.system = this.preferredSystem;
				if(this.preferredColorset != "custom")
					appearance.global.colorset = this.preferredColorset;
			}
			//load basic model
			this.systems["standard"].dice.forEach((obj) =>{
				activePresets.push(obj);
			});
			mergeObject(appearance, config);
			if(!isObjectEmpty(appearance)){
				for (let scope in appearance) {
					if (appearance.hasOwnProperty(scope)) {
						if(scope != "global")
							activePresets.push(this.getPresetBySystem(scope, appearance[scope].system));
						else if(this.systems.hasOwnProperty(appearance[scope].system)){
							this.systems[appearance[scope].system].dice.forEach((obj) =>{
								activePresets.push(obj);
							});
						}
					}
				}
			}
		};
		if(userID)
			preloadPresetsByUser(game.users.get(userID));
		else
        	game.users.forEach((user) =>{
				preloadPresetsByUser(user);
			});
        //remove duplicate
        activePresets = activePresets.filter((v, i, a) => a.indexOf(v) === i);
		let promiseArray = [];
		activePresets.forEach((preset)=>{
			if(preset){
				if(preset.modelFile){
					//Custom 3D model
					promiseArray.push(preset.loadModel(this.loaderGLTF));
				} else {
					//Classic 3D model
					promiseArray.push(preset.loadTextures());
				}
			}
		});

		if(waitForLoad)
			await Promise.all(promiseArray);
	}

	//{id: 'standard', name: game.i18n.localize("DICESONICE.System.Standard")}
	addSystem(system, mode="default"){
		system.dice = [];
		system.mode = mode;
		if(mode != "default" && this.preferredSystem == "standard")
			this.preferredSystem = system.id;
		this.systems[system.id] = system;
	}
	//{type:"",labels:[],system:""}
	//Should have been called "addDicePresetFromModel" but ¯\_(ツ)_/¯
	addDicePreset(dice, shape = null){
		let model = this.systems["standard"].dice.find(el => el.type == dice.type);
		if(!model || !model.internalAdd){
			if(!shape)
				shape = dice.type;
			model = this.systems["standard"].dice.find(el => el.type == shape);
		}
		let preset = new DicePreset(dice.type, model.shape);
		let denominator = dice.type.substr(1);

		preset.term = isNaN(denominator) ? CONFIG.Dice.terms[denominator].name : "Die";
		
		preset.setLabels(dice.labels);
		preset.setModel(dice.modelFile);
		if(dice.values){
			if(dice.values.min == undefined)
				dice.values.min = 1;
			if(dice.values.max == undefined)
				dice.values.max = model.values.length;
			if(dice.values.step == undefined)
				dice.values.step = 1;
			preset.setValues(dice.values.min,dice.values.max,dice.values.step);
		} else {
			preset.values = model.values;
			preset.valueMap = model.valueMap;
		}
		preset.mass = model.mass;
		preset.scale = model.scale;
		preset.inertia = model.inertia;
		preset.system = dice.system;
		preset.font = dice.font;
		preset.fontScale = dice.fontScale || null;
		preset.colorset = dice.colorset || null;
		//If it overrides an existing model that isn't a numbered die, set a font scale to prevent undesired fontScale from previous model
		if(!preset.fontScale && !["d2","d4","d6","d8","d10","d12","d14","d16","d20","d24","d30","d100"].includes(dice.type) && this.systems["standard"].dice.find(el => el.type == dice.type))
			preset.fontScale = DICE_SCALE[shape];
		
		if(dice.bumpMaps && dice.bumpMaps.length)
			preset.setBumpMaps(dice.bumpMaps);
		this.register(preset);

		if(dice.font && !this.fontFamilies.includes(dice.font)){
			this.fontFamilies.push(dice.font);
		}
	}

	//Is called when trying to create a DicePreset by guessing its faces from the CONFIG entries
	internalAddDicePreset(diceobj){
		let shape = "d";
		let fakeShape = [3,5,7];
		if(fakeShape.includes(diceobj.faces))
			shape += (diceobj.faces*2);
		else
			shape += diceobj.faces;
		let type = "d" + diceobj.constructor.DENOMINATION;
		let model = this.systems["standard"].dice.find(el => el.type == shape);
		let preset = new DicePreset(type, model.shape);
		preset.term = diceobj.constructor.name;
		let labels = [];
		for(let i = 1;i<= diceobj.faces;i++){
			labels.push(diceobj.getResultLabel({result:i}));
		}
		preset.setLabels(labels);
		preset.setValues(1,diceobj.faces);
		preset.mass = model.mass;
		preset.inertia = model.inertia;
		preset.scale = model.scale;
		preset.internalAdd = true;
		this.register(preset);
	}

	disposeCachedMaterials(type = null){
		for (const material in this.baseTextureCache) {
			if(type == null || material.substr(0,type.length) == type){
				this.baseTextureCache[material].map.dispose();
				if(this.baseTextureCache[material].bumpMap)
				this.baseTextureCache[material].bumpMap.dispose();
				this.baseTextureCache[material].dispose();
				delete this.baseTextureCache[material];
			}
		}
	}

	/**
	 * Copied from FVTT core and modified for DsN
	 * @return {Promise<void>}
	 * @private
	 */
	async _loadFonts() {
		for (let font of this.fontFamilies) {
			document.fonts.load(`1rem ${font}`);
		}
		const timeout = new Promise(resolve => setTimeout(resolve, 3000));
		return Promise.race([document.fonts.ready, timeout]);
	}

	get(type) {
		return this.getPresetBySystem(type);
	}

	getPresetBySystem(type, system = "standard"){
		let model = this.systems["standard"].dice.find(obj => obj.type == type);
		if(!model)
			return null;
		let diceobj = null;
		if(system != "standard"){
			if(this.systems.hasOwnProperty(system)){
				diceobj = this.systems[system].dice.find(obj => obj.type == type && obj.shape == model.shape);
				if(!diceobj){
					//If it doesn't exist, we look for a similar shape and values
					diceobj = this.systems[system].dice.find(obj => obj.shape == model.shape && obj.values.length == model.values.length && !model.colorset);
				}
			}
		}

		if(!diceobj){
			diceobj = this.systems.standard.dice.find(obj => obj.type == type);
		}
		return diceobj;
	}

	// returns a dicemesh (THREE.Mesh) object
	create(scopedTextureCache, type, appearance) {
		let diceobj = this.getPresetBySystem(type, appearance.system);
		if(diceobj.model && appearance.isGhost){
			diceobj = this.getPresetBySystem(type, "standard");
		}
		let scopedScale = scopedTextureCache.type == "board" ? this.baseScale : 60;
		if (!diceobj) return null;
		let dicemesh;

		let geom = this.geometries[type+scopedScale];
		if(!geom) {
			geom = this.createGeometry(diceobj.shape, diceobj.scale, scopedScale);
			this.geometries[type+scopedScale] = geom;
		}
		if (!geom) return null;


		if(diceobj.model){
			dicemesh = diceobj.model.scene.children[0].clone();
			let scale = scopedScale/100;
			dicemesh.scale.set(scale,scale,scale);
			if(!dicemesh.geometry)
				dicemesh.geometry = {};
			dicemesh.geometry.cannon_shape = geom.cannon_shape;
			if(diceobj.model.animations.length>0){
				dicemesh.mixer = new THREE.AnimationMixer(dicemesh);
				dicemesh.mixer.clipAction(diceobj.model.animations[0]).play();
			}
		}else{
			let materialData = this.generateMaterialData(diceobj, appearance);

			let baseTextureCacheString = scopedTextureCache.type+type+materialData.cacheString;
			let materials;
			if(this.baseTextureCache[baseTextureCacheString])
				materials = this.baseTextureCache[baseTextureCacheString];
			else
				materials = this.createMaterials(scopedTextureCache, baseTextureCacheString, diceobj, materialData);
			
			dicemesh = new THREE.Mesh(geom, materials);

			if (diceobj.color) {
				dicemesh.material[0].color = new THREE.Color(diceobj.color);
				dicemesh.material[0].emissive = new THREE.Color(diceobj.color);
				dicemesh.material[0].emissiveIntensity = 1;
				dicemesh.material[0].needsUpdate = true;
			}
		}
		
		dicemesh.result = [];
		dicemesh.shape = diceobj.shape;
		dicemesh.rerolls = 0;
		dicemesh.resultReason = 'natural';

		let factory = this;
		dicemesh.getFaceValue = function() {
			let reason = this.resultReason;
			let vector = new THREE.Vector3(0, 0, this.shape == 'd4' ? -1 : 1);
			let faceCannon = new THREE.Vector3();
			let closest_face, closest_angle = Math.PI * 2;
			for (let i = 0, l = this.body_sim.shapes[0].faceNormals.length; i < l; ++i) {
				if(DICE_MODELS[this.shape].faceValues[i] == 0)
					continue;
				faceCannon.copy(this.body_sim.shapes[0].faceNormals[i]);
				
				let angle = faceCannon.applyQuaternion(this.body_sim.quaternion).angleTo(vector);
				if (angle < closest_angle) {
					closest_angle = angle;
					closest_face = i;
				}
			}
			const diceobj = factory.get(this.notation.type);
			let dieValue = DICE_MODELS[this.shape].faceValues[closest_face];

			if (this.shape == 'd4') {
				return {value: dieValue, label: diceobj.labels[dieValue-1], reason: reason};
			}
			let labelIndex = dieValue;
			if (['d10','d2'].includes(this.shape)) labelIndex += 1;
			let label = diceobj.labels[labelIndex+1];

			//console.log('Face Value', closest_face, dieValue, label)

			return {value: dieValue, label: label, reason: reason};
		};

		dicemesh.storeRolledValue = function() {
			this.result.push(this.getFaceValue());
		};

		dicemesh.getLastValue = function() {
			if (!this.result || this.result.length < 1) return {value: undefined, label: '', reason: ''};

			return this.result[this.result.length-1];
		};

		dicemesh.setLastValue = function(result) {
			if (!this.result || this.result.length < 1) return;
			if (!result || result.length < 1) return;

			return this.result[this.result.length-1] = result;
		};

		return dicemesh;
	}

	createMaterials(scopedTextureCache, baseTextureCacheString, diceobj, materialData) {
		//TODO : createMaterials
		if(this.baseTextureCache[baseTextureCacheString])
			return this.baseTextureCache[baseTextureCacheString];

		let labels = diceobj.labels;
		if (diceobj.shape == 'd4') {
			labels = diceobj.labels[0];
		}
		//If the texture is an array of texture (for random face texture), we look at the first element to determine the faces material and the edge texture
		let dice_texture = Array.isArray(materialData.texture) ? materialData.texture[0] : materialData.texture;

		var mat;
		let materialSelected = this.material_options[materialData.material] ? this.material_options[materialData.material] : this.material_options["plastic"];
		if(!this.bumpMapping){
			delete materialSelected.roughnessMap;
		}
		switch(materialSelected.type){
			case "phong":
				mat = new THREE.MeshPhongMaterial(materialSelected.options);
				break;
			case "standard":
				mat = new THREE.MeshStandardMaterial(materialSelected.options);
				break;
			default: //plastic
				mat = new THREE.MeshPhongMaterial(this.material_options.plastic.options);
		}
		if(materialSelected.scopedOptions){
			if(materialSelected.scopedOptions.envMap)
				mat.envMap = scopedTextureCache.textureCube;
			if(materialSelected.scopedOptions.roughnessMap)
				mat.roughnessMap = scopedTextureCache[materialSelected.scopedOptions.roughnessMap];
		}
		let font = {
			"type":diceobj.font,
			"scale": diceobj.fontScale ? diceobj.fontScale:null
		};
		
		if(!font.type){
			font.type = materialData.font;
		}
		if(!font.scale){
			if(materialData.fontScale[diceobj.type])
				font.scale = materialData.fontScale[diceobj.type];
			else{
				font.scale = DICE_SCALE[diceobj.shape];
			}	
		}

		let canvas = document.createElement("canvas");
		let context = canvas.getContext("2d", {alpha: true});
		context.globalAlpha = 0;

		let canvasBump = document.createElement("canvas");
		let contextBump = canvasBump.getContext("2d", {alpha: true});
		contextBump.globalAlpha = 0;

		let labelsTotal = labels.length;
		let isHeritedFromShape = ["d3","d5","d7"].includes(diceobj.type) || (diceobj.type == "df"&&diceobj.shape == "d6");
		if(isHeritedFromShape){
			labelsTotal = labelsTotal*2 -2;
			if(diceobj.shape == "d2" || diceobj.shape == "d10")
				labelsTotal += 1;
		}

		let texturesPerLine = Math.ceil(Math.sqrt(labelsTotal));
		let sizeTexture = 256;
		let ts = this.calc_texture_size(Math.sqrt(labelsTotal)*sizeTexture, true);
		
		canvas.width = canvas.height = canvasBump.width = canvasBump.height = ts;
		let x = 0;
		let y = 0;
		let texturesOnThisLine = 0;
		for (var i = 0; i < labels.length; ++i) {
			if(texturesOnThisLine == texturesPerLine){
				y += sizeTexture;
				x = 0;
				texturesOnThisLine = 0;
			}
			if(i==0)//edge
			{
				//if the texture is fully opaque, we do not use it for edge
				let texture = {name:"none"};
				if(dice_texture.composite != "source-over")
					texture = dice_texture;
				this.createTextMaterial(context, contextBump, x, y, sizeTexture, diceobj, labels, font, i, texture, materialData);
			}
			else
			{
				this.createTextMaterial(context, contextBump, x, y, sizeTexture, diceobj, labels, font, i, materialData.texture, materialData);
			}
			texturesOnThisLine++;
			x += sizeTexture;
		}

		//Special dice from shape divided by 2
		//D3
		if(isHeritedFromShape){
			let startI = 2;
			//for some reason, there's an extra empty cell for all shape except d2 and d10. Should fix that at some point.
			if(diceobj.shape == "d2" || diceobj.shape == "d10")
				startI = 1;
			for(i=startI;i<labels.length;i++){
				if(texturesOnThisLine == texturesPerLine){
					y += sizeTexture;
					x = 0;
					texturesOnThisLine = 0;
				}
				this.createTextMaterial(context, contextBump, x, y, sizeTexture, diceobj, labels, font, i, materialData.texture, materialData);
				texturesOnThisLine++;
				x += sizeTexture;
			}
		}


		//var img    = canvas.toDataURL("image/png");
		//document.write('<img src="'+img+'"/>');
		//generate basetexture for caching
		if(!this.baseTextureCache[baseTextureCacheString]){
			let texture = new THREE.CanvasTexture(canvas);
			texture.flipY = false;
			mat.map = texture;
			mat.map.anisotropy = 4;
			if(this.bumpMapping){
				let bumpMap = new THREE.CanvasTexture(canvasBump);
				bumpMap.flipY = false;
				mat.bumpMap = bumpMap;
				mat.bumpMap.anisotropy = 4;
			}
		}

		//mat.displacementMap = mat.bumpMap;

		switch(materialData.material){
			case "chrome":
				if(this.bumpMapping)
					mat.metalnessMap = mat.bumpMap;
				break;
		}
		
		mat.opacity = 1;
		mat.transparent = true;
		mat.depthTest = true;
		mat.needUpdate = true;
		this.baseTextureCache[baseTextureCacheString] = mat;
		return mat;
	}
	createTextMaterial(context, contextBump, x, y, ts, diceobj, labels, font, index, texture, materialData) {
		if (labels[index] === undefined) return null;

		let forecolor = materialData.foreground;
		let outlinecolor = materialData.outline;
		let backcolor = index > 0 ? materialData.background : materialData.edge != "" ? materialData.edge:materialData.background;

		if(Array.isArray(texture))
			texture = texture[Math.floor(Math.random() * texture.length)];
		
		let text;
		if(materialData.isGhost && labels[index] != "")
			text = "?";
		else
			text = labels[index];

		let normal = diceobj.normals[index];
		let isTexture = false;
		let margin = 1.0;

		// create color
		context.fillStyle = backcolor;
		context.fillRect(x, y, ts, ts);

		contextBump.fillStyle = "#FFFFFF";
		contextBump.fillRect(x, y, ts, ts);

		//context.rect(x, y, ts, ts);
		//context.stroke();

		//create underlying texture
		if (texture.name != '' && texture.name != 'none') {
			context.save();
			context.beginPath();
			context.rect(x,y,ts,ts);
			context.clip();
			context.globalCompositeOperation = texture.composite || 'source-over';
			context.drawImage(texture.texture, x, y, ts, ts);
			context.restore();
			
			if (texture.bump != '') {
				contextBump.drawImage(texture.bump, x, y, ts, ts);
			}
		}

		// create text
		context.globalCompositeOperation = 'source-over';
		context.textAlign = "center";
		context.textBaseline = "middle";

		contextBump.textAlign = "center";
		contextBump.textBaseline = "middle";
		contextBump.shadowColor = "#000000";
		contextBump.shadowOffsetX = 1;
		contextBump.shadowOffsetY = 1;
		contextBump.shadowBlur = 3;
		
		if (diceobj.shape != 'd4') {
			
			//custom texture face
			if(text instanceof HTMLImageElement){
				isTexture = true;
				context.drawImage(text, 0,0,text.width,text.height,x,y,ts,ts);
				if(normal)
					contextBump.drawImage(normal, 0,0,text.width,text.height,x,y,ts,ts);
			}
			else{
				let fontsize = ts / (1 + 2 * margin);
				let textstarty = (ts / 2);
				let textstartx = (ts / 2);

				if(font.scale)
					fontsize *= font.scale;

				//Needed for every fonts
				switch(diceobj.shape){
					case 'd10':
						textstarty = textstartx*1.3;
						break
					case 'd14':
						textstarty = textstartx*1.4;
						break
					case 'd16':
						textstarty = textstartx*1.4;
						break
					case 'd8':
						textstarty = textstarty*1.1;
						break;
					case 'd12':
						textstarty = textstarty*1.08;
						break;
					case 'd20':
						textstarty = textstartx*1.2;
						break;
					case 'd6':
						textstarty = textstarty*1.1;
						break;
				}

				context.font =  fontsize+ 'pt '+font.type;
				contextBump.font =  fontsize+ 'pt '+font.type;
				var lineHeight = fontsize;
				
				let textlines = text.split("\n");

				if (textlines.length > 1) {
					fontsize = fontsize / textlines.length;
					context.font =  fontsize+ 'pt '+font.type;
					contextBump.font =  fontsize+ 'pt '+font.type;

					//to find the correct text height for every possible fonts, we have no choice but to use the great (and complex) pixi method
					//First we create a PIXI.TextStyle object, to pass later to the measure method
					let pixiStyle = new PIXI.TextStyle({
						fontFamily: font.type,
						fontSize: fontsize,
						stroke: "#0000FF",
						strokeThickness: (outlinecolor != 'none' && outlinecolor != backcolor) ? 1:0
					});
					//Then we call the PIXI measureText method
					let textMetrics = PIXI.TextMetrics.measureText(textlines.join(""),pixiStyle);

					lineHeight = textMetrics.lineHeight;
					if(textlines[0]!=""){
						textstarty -= (lineHeight * textlines.length) / 2;
						//On a D12, we add a little padding because it looks better to human eyes even tho it's not really the center anymore
						if(diceobj.shape == "d12")
							textstarty = textstarty *1.08;
					}
					else
						textlines.shift();
				}

				for(let i = 0, l = textlines.length; i < l; i++){
					let textline = textlines[i].trim();

					// attempt to outline the text with a meaningful color
					if (outlinecolor != 'none' && outlinecolor != backcolor) {
						context.strokeStyle = outlinecolor;
						context.lineWidth = 5;
						context.strokeText(textlines[i], textstartx+x, textstarty+y);

						contextBump.strokeStyle = "#555555";
						contextBump.lineWidth = 5;
						contextBump.strokeText(textlines[i], textstartx+x, textstarty+y);
						if (textline == '6' || textline == '9') {
							context.strokeText('  .', textstartx+x, textstarty+y);
							contextBump.strokeText('  .', textstartx+x, textstarty+y);
						}
					}

					context.fillStyle = forecolor;
					context.fillText(textlines[i], textstartx+x, textstarty+y);

					contextBump.fillStyle = "#555555";
					contextBump.fillText(textlines[i], textstartx+x, textstarty+y);
					if (textline == '6' || textline == '9') {
						context.fillText('  .', textstartx+x, textstarty+y);
						contextBump.fillText('  .', textstartx+x, textstarty+y);
					}
					textstarty += (lineHeight * 1.5);
				}
			}

		} else {

			var hw = (ts / 2);
			var hh = (ts / 2);
			let fontsize = (ts / 128 * 24);
			if(font.scale)
				fontsize *= font.scale;
			context.font =  fontsize+'pt '+font.type;
			contextBump.font =  fontsize+'pt '+font.type;

			//draw the numbers
			let wShift = 1;
			let hShift = 1;
			for (let i=0;i<text.length;i++) {
				switch(i){
					case 0:
						hShift = 1.13;
						break;
					case 1:
						hShift=0.87;
						wShift=1.13;
						break;
					case 2:
						wShift = 0.87;
				}
				let destX = hw*wShift+x;
				let destY = (hh - ts * 0.3)*hShift+y;
				//custom texture face
				if(text[i] instanceof HTMLImageElement){
					isTexture = true;
					let textureSize = 60 / (text[i].width / ts);
					context.drawImage(text[i],0,0,text[i].width,text[i].height,destX-(textureSize/2),destY-(textureSize/2),textureSize,textureSize);
				}
				else{
					// attempt to outline the text with a meaningful color
					if (outlinecolor != 'none' && outlinecolor != backcolor) {
						context.strokeStyle = outlinecolor;
						
						context.lineWidth = 5;
						context.strokeText(text[i], destX, destY);

						contextBump.strokeStyle = "#555555";
						contextBump.lineWidth = 5;
						contextBump.strokeText(text[i], destX, destY);
					}

					//draw label in top middle section
					context.fillStyle = forecolor;
					context.fillText(text[i], destX, destY);
					contextBump.fillStyle = "#555555";
					contextBump.fillText(text[i], destX, destY);
					//var img    = canvas.toDataURL("image/png");
					//document.write('<img src="'+img+'"/>');
				}

				//rotate 1/3 for next label
				context.translate(hw+x, hh+y);
				context.rotate(Math.PI * 2 / 3);
				context.translate(-hw-x, -hh-y);

				contextBump.translate(hw+x, hh+y);
				contextBump.rotate(Math.PI * 2 / 3);
				contextBump.translate(-hw-x, -hh-y);
			}
		}
	}

	getAppearanceForDice(appearances, dicetype, dicenotation = null){
		/*
			We use either (by order of priority): 
			1) A notation appearance
			2) A flavor/notation colorset
			3) The colorset of the diceobj
			4) The colorset configured by the player for this dice type
			5) A preferred system set by a module/system (done in main.js)
			6) The global colorset of the player
		*/
		
		let settings;
		if(appearances[dicetype])
			settings = appearances[dicetype];
		else
			settings = appearances.global;

		//To keep compatibility with both older integrations and user settings, we use the DiceColor naming convention from there
		let appearance = {
			colorset: settings.colorset ? settings.colorset : appearances.global.colorset ? appearances.global.colorset : "custom",
			foreground: settings.labelColor ? settings.labelColor:appearances.global.labelColor ? appearances.global.labelColor : "#FFFFFF",
			background: settings.diceColor ? settings.diceColor:appearances.global.diceColor ? appearances.global.diceColor : "#000000",
			//outline: settings.outlineColor ? settings.outlineColor: appearances.global.outlineColor ? appearances.global.outlineColor : "",
			//edge: settings.edgeColor ? settings.edgeColor:appearances.global.edgeColor ? appearances.global.edgeColor:"",
			texture: settings.texture ? settings.texture:appearances.global.texture ? appearances.global.texture : "none",
			material: settings.material ? settings.material:appearances.global.material ? appearances.global.material : "auto",
			font: settings.font ? settings.font:appearances.global.font ? appearances.global.font : "Arial",
			system: settings.system ? settings.system:appearances.global.system ? appearances.global.system : "standard"
		};

		if(appearance.colorset == "custom"){
			appearance.outline = settings.outlineColor ? settings.outlineColor:"";
			appearance.edge = settings.edgeColor ? settings.edgeColor:"";
		} else {
			appearance.outline = settings.outlineColor ? settings.outlineColor: appearances.global.outlineColor ? appearances.global.outlineColor : "";
			appearance.edge = settings.edgeColor ? settings.edgeColor:appearances.global.edgeColor ? appearances.global.edgeColor:"";
		}

		if(appearance.colorset && appearance.colorset != "custom"){
			let colorsetData = DiceColors.getColorSet(appearance.colorset);
			appearance.foreground = colorsetData.foreground;
			appearance.background = colorsetData.background;
			appearance.outline = colorsetData.outline;
			appearance.edge = colorsetData.edge ? colorsetData.edge : "";
		}
		let diceobj = this.getPresetBySystem(dicetype,appearance.system);
		if(diceobj.colorset){
			let colorsetData = {...DiceColors.getColorSet(diceobj.colorset)};
			Object.entries(colorsetData).forEach((opt) => {
				if(opt[1] == "custom")
					delete colorsetData[opt[0]];
			});
			mergeObject(appearance, colorsetData);
			appearance.colorset = diceobj.colorset;
		}
		
		if(dicenotation){
			let colorset = null;
			if (dicenotation.options.colorset)
				colorset = dicenotation.options.colorset;
			else if (dicenotation.options.flavor && COLORSETS[dicenotation.options.flavor]) {
				colorset = dicenotation.options.flavor;
			}
			if(colorset){
				let colorsetData = DiceColors.getColorSet(colorset);
				colorsetData.edge = colorsetData.edge ? colorsetData.edge : "";
				appearance = colorsetData;
			}
			if(dicenotation.options.appearance){
				mergeObject(appearance, dicenotation.options.appearance);
			}
			if(dicenotation.options.ghost){
				appearance.isGhost = true;
			}
		}
		return appearance;
	}

	generateMaterialData(diceobj, appearance) {
		let materialData = {};
		let colorindex;

		if(appearance.texture && !appearance.texture.id)
			appearance.texture = DiceColors.getTexture(appearance.texture);

		let colorsetData = DiceColors.getColorSet(appearance.colorset);

		// ignore custom colorset with unset properties
		if(colorsetData.foreground == "custom")
			colorsetData.foreground = appearance.foreground;
		if(colorsetData.background == "custom")
			colorsetData.background = appearance.background;
		if(colorsetData.texture == "custom")
			colorsetData.texture = appearance.texture;
		if(colorsetData.material == "custom")
			colorsetData.material = appearance.material;
		if(colorsetData.font == "custom")
			colorsetData.font = appearance.font;


		// set base color first
		if (Array.isArray(appearance.background)) {

			colorindex = Math.floor(Math.random() * appearance.background.length);

			// if color list and label list are same length, treat them as a parallel list
			if (Array.isArray(appearance.foreground) && appearance.foreground.length == appearance.background.length) {
				materialData.foreground = appearance.foreground[colorindex];

				// if label list and outline list are same length, treat them as a parallel list
				if (Array.isArray(appearance.outline) && appearance.outline.length == appearance.foreground.length) {
					materialData.outline = appearance.outline[colorindex];
				}
			}
			// if texture list is same length do the same
			if (Array.isArray(appearance.texture) && appearance.texture.length == appearance.background.length) {
				materialData.texture = appearance.texture[colorindex];
			}

			//if edge list and color list are same length, treat them as a parallel list
			if (Array.isArray(appearance.edge) && appearance.edge.length == appearance.background.length) {
				materialData.edge = appearance.edge[colorindex];
			}

			materialData.background = appearance.background[colorindex];
		} else {
			materialData.background = appearance.background;
		}

		if(!materialData.edge){
			if (Array.isArray(appearance.edge)) {
				colorindex = Math.floor(Math.random() * appearance.edge.length);
				materialData.edge = appearance.edge[colorindex];
			}
			else
				materialData.edge = appearance.edge;
		}

		// if selected label color is still not set, pick one
		if(!materialData.foreground){
			if(Array.isArray(appearance.foreground)){
				colorindex = appearance.foreground[Math.floor(Math.random() * appearance.foreground.length)];

				// if label list and outline list are same length, treat them as a parallel list
				if (Array.isArray(appearance.outline) && appearance.outline.length == appearance.foreground.length) {
					materialData.outline = appearance.outline[colorindex];
				}

				materialData.foreground = appearance.foreground[colorindex];
			}
			else
				materialData.foreground = appearance.foreground;
		}

		// if selected label outline is still not set, pick one
		if (!materialData.outline){
			if(Array.isArray(appearance.outline)) {
				colorindex = appearance.outline[Math.floor(Math.random() * appearance.outline.length)];

				materialData.outline = appearance.outline[colorindex];
			} else {
				materialData.outline = appearance.outline;
			}
		}

		// same for textures list
		if(!materialData.texture){
			if (Array.isArray(appearance.texture)) {
				materialData.texture = appearance.texture[Math.floor(Math.random() * appearance.texture.length)];
			} else if(appearance.texture.name == "none"){
				//set to none/theme
				if (Array.isArray(colorsetData.texture)){
					materialData.texture = colorsetData.texture[Math.floor(Math.random() * colorsetData.texture.length)];
				} else {
					materialData.texture = colorsetData.texture;
				}
			} else {
				materialData.texture = appearance.texture;
			}
		}

		//Same for material
		let baseTexture = Array.isArray(materialData.texture) ? materialData.texture[0]:materialData.texture;

		if(appearance.material == "auto" || appearance.material == ""){
			if(colorsetData.material)
				materialData.material = colorsetData.material;
			else
				materialData.material = baseTexture.material;
		} else {
			materialData.material = appearance.material;
		}

		//for font, we priorize the dicepreset font, then custom, then coloret
		if(appearance.font == "auto"){
			if(diceobj.font){
				materialData.font = diceobj.font;
			} else {
				materialData.font = colorsetData.font;
			}
		} else {
			materialData.font = appearance.font;
		}

		if(appearance.fontScale)
			materialData.fontScale = appearance.fontScale;
		else if(diceobj.fontScale){
			materialData.fontScale = diceobj.fontScale;
		} else {
			materialData.fontScale = colorsetData.fontScale;
		}

		materialData.isGhost = appearance.isGhost?appearance.isGhost:false;

		materialData.cacheString = appearance.system+materialData.background+materialData.foreground+materialData.outline+materialData.texture.name+materialData.edge+materialData.material+materialData.font+materialData.isGhost;
		return materialData;
	}

	calc_texture_size(approx, ceil = false) {
		let size = 0;
		if(!ceil)
			size = Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)));
		else
			size = Math.pow(2, Math.ceil(Math.log(approx) / Math.log(2)));
		return size;
	}

	createGeometry(type, typeScale, scopedScale) {
		let radius = typeScale * scopedScale;
		let geom = null;
		switch (type) {
			case 'd2':
				geom = this.create_d2_geometry(radius, scopedScale);
				break;
			case 'd4':
				geom = this.create_d4_geometry(radius, scopedScale);
				break;
			case 'd6':
				geom = this.create_d6_geometry(radius, scopedScale);
				break;
			case 'd8':
				geom = this.create_d8_geometry(radius, scopedScale);
				break;
			case 'd10':
				geom = this.create_d10_geometry(radius, scopedScale);
				break;
			case 'd12':
				geom = this.create_d12_geometry(radius, scopedScale);
				break;
			case 'd14':
				geom = this.create_d14_geometry(radius, scopedScale);
				break;
			case 'd16':
				geom = this.create_d16_geometry(radius, scopedScale);
				break;
			case 'd20':
				geom = this.create_d20_geometry(radius, scopedScale);
				break;
			case 'd24':
				geom = this.create_d24_geometry(radius, scopedScale);
				break;
			case 'd30':
				geom = this.create_d30_geometry(radius, scopedScale);
				break;
		}
		return geom;
	}

	load_geometry(type, scopedScale){
		var loader = new THREE.BufferGeometryLoader();
		let bufferGeometry = loader.parse(DICE_MODELS[type]);
		bufferGeometry.scale(scopedScale/100,scopedScale/100,scopedScale/100);
		return bufferGeometry;
	}

	create_d2_geometry(radius, scopedScale){
		let geom = this.load_geometry("d2",scopedScale);
		geom.cannon_shape = new CANNON.Cylinder(1*radius,1*radius,0.1*radius,8);
		return geom;
	}

	create_d4_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d4",scopedScale);
		var vertices = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
		var faces = [[1, 0, 2, 1], [0, 1, 3, 2], [0, 3, 2, 3], [1, 2, 3, 4]];
		geom.cannon_shape = this.create_geom(vertices, faces, radius);
		return geom;
	}

	create_d6_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d6",scopedScale);
		var vertices = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
				[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
		var faces = [[0, 3, 2, 1, 1], [1, 2, 6, 5, 2], [0, 1, 5, 4, 3],
				[3, 7, 6, 2, 4], [0, 4, 7, 3, 5], [4, 5, 6, 7, 6]];
		geom.cannon_shape = this.create_geom(vertices, faces, radius);
		return geom;
	}

	create_d8_geometry(radius, scopedScale) {
		let geometry = this.load_geometry("d8",scopedScale);
		
		var vertices = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
		var faces = [[0, 2, 4, 1], [0, 4, 3, 2], [0, 3, 5, 3], [0, 5, 2, 4], [1, 3, 4, 5],
				[1, 4, 2, 6], [1, 2, 5, 7], [1, 5, 3, 8]];
		geometry.cannon_shape = this.create_geom(vertices, faces, radius);
		return geometry;
	}

	create_d10_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d10",scopedScale);
		//geom.scale(1.38,1.38,1.38);
		
		var a = Math.PI * 2 / 10, h = 0.105, v = -1;
		var vertices = [];
		for (var i = 0, b = 0; i < 10; ++i, b += a) {
			vertices.push([Math.cos(b), Math.sin(b), h * (i % 2 ? 1 : -1)]);
		}
		vertices.push([0, 0, -1]);
		vertices.push([0, 0, 1]);

		var faces = [
            [5, 6, 7, 11, 0],
            [4, 3, 2, 10, 1],
            [1, 2, 3, 11, 2],
            [0, 9, 8, 10, 3],
            [7, 8, 9, 11, 4],
            [8, 7, 6, 10, 5],
            [9, 0, 1, 11, 6],
            [2, 1, 0, 10, 7],
            [3, 4, 5, 11, 8],
            [6, 5, 4, 10, 9]
        ];
		geom.cannon_shape = this.create_geom(vertices, faces, radius);
		//geom = this.scaleGeometryToShape(geom);
		return geom;
	}

	create_d12_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d12",scopedScale);
		var p = (1 + Math.sqrt(5)) / 2, q = 1 / p;
		var vertices = [[0, q, p], [0, q, -p], [0, -q, p], [0, -q, -p], [p, 0, q],
				[p, 0, -q], [-p, 0, q], [-p, 0, -q], [q, p, 0], [q, -p, 0], [-q, p, 0],
				[-q, -p, 0], [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1],
				[-1, 1, -1], [-1, -1, 1], [-1, -1, -1]];
		var faces = [[2, 14, 4, 12, 0, 1], [15, 9, 11, 19, 3, 2], [16, 10, 17, 7, 6, 3], [6, 7, 19, 11, 18, 4],
				[6, 18, 2, 0, 16, 5], [18, 11, 9, 14, 2, 6], [1, 17, 10, 8, 13, 7], [1, 13, 5, 15, 3, 8],
				[13, 8, 12, 4, 5, 9], [5, 4, 14, 9, 15, 10], [0, 12, 8, 10, 16, 11], [3, 19, 7, 17, 1, 12]];

		geom.cannon_shape = this.create_geom(vertices, faces, radius);
		return geom;
	}

	create_d14_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d14",scopedScale);

		var vertices = [[-0.005093127489089966, 1.177548885345459, 0.002782404189929366], [-0.9908595681190491, 0.061759304255247116, 0.22585006058216095], [-0.9924551844596863, -0.06095181778073311, -0.23028047382831573], [-0.7984917163848877, 0.061637163162231445, -0.6402497291564941], [-0.4453684985637665, -0.06121010705828667, -0.9239609241485596], [-0.00504341721534729, 0.06129471957683563, -1.0241185426712036], [0.437289297580719, -0.06156954541802406, -0.9219886660575867], [0.7920035719871521, 0.06098949536681175, -0.6366959810256958], [0.9908595681190491, -0.06175928935408592, -0.22585000097751617], [0.9924551844596863, 0.0609518401324749, 0.23028059303760529], [0.7984917163848877, -0.061637137085199356, 0.6402497291564941], [0.4453684985637665, 0.061210136860609055, 0.9239609241485596], [0.00504341721534729, -0.06129469349980354, 1.0241185426712036], [-0.4372892379760742, 0.061569564044475555, 0.9219887852668762], [-0.7920035719871521, -0.060989461839199066, 0.6366960406303406], [0.005093127489089966, -1.177548885345459, -0.002782404189929366]];
		var faces = [[0, 3, 2, 1], [1, 14, 13, 0], [12, 11, 0, 13], [10, 9, 0, 11], [8, 7, 0, 9], [6, 5, 0, 7], [4, 3, 0, 5], [10, 11, 12, 15], [14, 15, 12, 13], [2, 15, 14, 1], [2, 3, 4, 15], [4, 5, 6, 15], [6, 7, 8, 15], [8, 9, 10, 15]];
		geom.cannon_shape = this.create_geom_dcc(vertices, faces, radius * 0.85);
		return geom;
	}

	create_d16_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d16",scopedScale);

		var vertices = [[-1.0301814079284668, 0.002833150327205658, 1.0244150161743164], [-0.0018179342150688171, -0.006610371172428131, -1.4427297115325928], [1.4587815999984741, 0.0028328225016593933, -0.006545569747686386], [1.031739592552185, 0.0028328821063041687, -1.0375059843063354], [-1.4572231769561768, 0.0028332099318504333, -0.006545361131429672], [-1.0301814079284668, 0.002833150327205658, -1.0375059843063354], [1.031739592552185, 0.0028328821063041687, 1.0244150161743164], [-0.0018179342150688171, -0.006610371172428131, 1.4732751846313477], [0.0007793977856636047, 1.4608354568481445, -0.006545450538396835], [-0.0018181726336479187, -1.4646127223968506, 0.015272742137312889]];
		var faces = [[5, 8, 1], [5, 4, 8], [4, 0, 8], [0, 7, 8], [8, 7, 6], [8, 6, 2], [2, 3, 8], [3, 1, 8], [3, 9, 1], [2, 9, 3], [6, 9, 2], [6, 7, 9], [0, 9, 7], [4, 9, 0], [5, 9, 4], [5, 1, 9]];
		geom.cannon_shape = this.create_geom_dcc(vertices, faces, radius * 0.83);
		return geom;
	}

	create_d20_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d20",scopedScale);

		var t = (1 + Math.sqrt(5)) / 2;
		var vertices = [[-1, t, 0], [1, t, 0 ], [-1, -t, 0], [1, -t, 0],
				[0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
				[t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
		var faces = [[0, 11, 5, 1], [0, 5, 1, 2], [0, 1, 7, 3], [0, 7, 10, 4], [0, 10, 11, 5],
				[1, 5, 9, 6], [5, 11, 4, 7], [11, 10, 2, 8], [10, 7, 6, 9], [7, 1, 8, 10],
				[3, 9, 4, 11], [3, 4, 2, 12], [3, 2, 6, 13], [3, 6, 8, 14], [3, 8, 9, 15],
				[4, 9, 5, 16], [2, 4, 11, 17], [6, 2, 10, 18], [8, 6, 7, 19], [9, 8, 1, 20]];
		geom.cannon_shape = this.create_geom(vertices, faces, radius);
		return geom;
	}

	create_d24_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d24",scopedScale);

		var vertices = [[0.7070000171661377, -0.0, -0.7070000171661377], [0.7070000171661377, 0.7070000171661377, -0.0], [0.5468999743461609, 0.5468999743461609, -0.5468999743461609], [-0.0, -0.7070000171661377, -0.7070000171661377], [-0.0, 0.7070000171661377, -0.7070000171661377], [-0.5468999743461609, 0.5468999743461609, -0.5468999743461609], [-0.5468999743461609, -0.5468999743461609, -0.5468999743461609], [0.5468999743461609, 0.5468999743461609, 0.5468999743461609], [-0.0, -0.0, -1.0], [1.0, -0.0, -0.0], [0.5468999743461609, -0.5468999743461609, -0.5468999743461609], [-0.5468999743461609, 0.5468999743461609, 0.5468999743461609], [-0.0, -0.0, 1.0], [-0.0, 0.7070000171661377, 0.7070000171661377], [-0.0, 1.0, -0.0], [-0.7070000171661377, 0.7070000171661377, -0.0], [-0.7070000171661377, -0.0, -0.7070000171661377], [-0.7070000171661377, -0.7070000171661377, -0.0], [-0.0, -0.7070000171661377, 0.7070000171661377], [-0.5468999743461609, -0.5468999743461609, 0.5468999743461609], [-1.0, 0.0, -0.0], [0.5468999743461609, -0.5468999743461609, 0.5468999743461609], [0.7070000171661377, -0.0, 0.7070000171661377], [-0.0, -1.0, -0.0], [0.7070000171661377, -0.7070000171661377, -0.0], [-0.7070000171661377, -0.0, 0.7070000171661377]];
		var faces = [[4, 5, 15, 14], [3, 10, 24, 23], [11, 15, 20, 25], [10, 3, 8, 0], [19, 18, 12, 25], [7, 22, 9, 1], [22, 21, 24, 9], [7, 13, 12, 22], [5, 4, 8, 16], [20, 17, 19, 25], [6, 3, 23, 17], [2, 4, 14, 1], [18, 19, 17, 23], [13, 7, 1, 14], [0, 2, 1, 9], [18, 21, 22, 12], [3, 6, 16, 8], [15, 5, 16, 20], [6, 17, 20, 16], [4, 2, 0, 8], [13, 11, 25, 12], [24, 10, 0, 9], [11, 13, 14, 15], [21, 18, 23, 24]];
		geom.cannon_shape = this.create_geom(vertices, faces, radius);
		return geom;
	}

	create_d30_geometry(radius, scopedScale) {
		let geom = this.load_geometry("d30",scopedScale);

		var vertices = [[-1.6180000305175781, 0.0, 1.0], [-1.6180000305175781, 0.6179999709129333, -0.0], [-0.0, 1.6180000305175781, 0.6179999709129333], [0.6179999709129333, 0.0, 1.6180000305175781], [-1.0, -1.6180000305175781, -0.0], [1.6180000305175781, 0.0, 1.0], [-1.6180000305175781, -0.6179999709129333, -0.0], [-0.6179999709129333, 0.0, 1.6180000305175781], [-0.0, 1.0, -1.6180000305175781], [-1.0, 1.0, -1.0], [1.6180000305175781, 0.6179999709129333, -0.0], [1.0, -1.6180000305175781, -0.0], [-1.0, -1.0, -1.0], [1.6180000305175781, -0.6179999709129333, -0.0], [-1.0, 1.6180000305175781, -0.0], [1.0, 1.0, -1.0], [1.0, 1.6180000305175781, -0.0], [-0.0, 1.0, 1.6180000305175781], [1.0, -1.0, -1.0], [-0.6179999709129333, 0.0, -1.6180000305175781], [-0.0, -1.0, -1.6180000305175781], [-1.0, 1.0, 1.0], [0.6179999709129333, 0.0, -1.6180000305175781], [-0.0, -1.0, 1.6180000305175781], [-1.0, -1.0, 1.0], [-0.0, 1.6180000305175781, 0.6179999709129333], [-1.6180000305175781, 0.0, -1.0], [1.0, 1.0, 1.0], [-0.0, -1.6180000305175781, -0.6179999709129333], [1.6180000305175781, 0.0, -1.0], [1.0, -1.0, 1.0], [-0.0, 1.6180000305175781, -0.6179999709129333], [-0.0, -1.6180000305175781, 0.6179999709129333]];
		var faces = [[25, 16, 31, 14], [7, 0, 24, 23], [19, 20, 12, 26], [13, 5, 30, 11], [1, 0, 21, 14], [10, 29, 15, 16], [6, 0, 1, 26], [22, 29, 18, 20], [9, 14, 31, 8], [28, 4, 12, 20], [30, 5, 3, 23], [12, 4, 6, 26], [31, 16, 15, 8], [21, 17, 25, 14], [22, 20, 19, 8], [3, 17, 7, 23], [18, 11, 28, 20], [32, 23, 24, 4], [27, 5, 10, 16], [9, 8, 19, 26], [25, 17, 27, 16], [30, 23, 32, 11], [7, 17, 21, 0], [10, 5, 13, 29], [24, 0, 6, 4], [13, 11, 18, 29], [9, 26, 1, 14], [3, 5, 27, 17], [15, 29, 22, 8], [28, 11, 32, 4]];
		geom.cannon_shape = this.create_geom_dcc(vertices, faces, radius);
		return geom;
	}

	create_shape(vertices, faces, radius) {
		var cv = new Array(vertices.length), cf = new Array(faces.length);
		for (var i = 0; i < vertices.length; ++i) {
			var v = vertices[i];
			cv[i] = new CANNON.Vec3(v.x * radius, v.y * radius, v.z * radius);
		}
		for (var i = 0; i < faces.length; ++i) {
			cf[i] = faces[i].slice(0, faces[i].length - 1);
		}
		return new CANNON.ConvexPolyhedron(cv, cf);
	}

	create_geom(vertices, faces, radius) {
		var vectors = new Array(vertices.length);
		for (var i = 0; i < vertices.length; ++i) {
			vectors[i] = (new THREE.Vector3).fromArray(vertices[i]).normalize();
		}
		let cannon_shape = this.create_shape(vectors, faces, radius);
		return cannon_shape;
	}

	create_shape_dcc(vertices, faces, radius) {
		var cv = new Array(vertices.length), cf = new Array(faces.length);
		for (var i = 0; i < vertices.length; ++i) {
			var v = vertices[i];
			cv[i] = new CANNON.Vec3(v.x * radius, v.y * radius, v.z * radius);
		}
		for (var i = 0; i < faces.length; ++i) {
			cf[i] = faces[i];//.slice(0, faces[i].length - 1);
		}
		return new CANNON.ConvexPolyhedron(cv, cf);
	}

	create_geom_dcc(vertices, faces, radius) {
		var vectors = new Array(vertices.length);
		for (var i = 0; i < vertices.length; ++i) {
			vectors[i] = (new THREE.Vector3).fromArray(vertices[i]).normalize();
		}
		let cannon_shape = this.create_shape_dcc(vectors, faces, radius);
		return cannon_shape;
	}
}
