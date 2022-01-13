
export class DicePreset {

	constructor(type, shape = '') {

		shape = shape || type;

		this.type = type;
		this.term = 'Die';
		this.shape = shape || type;
		this.scale = 1;
		this.labels = [];
		this.valueMap = null;
		this.values = [];
		this.normals = [];
		this.mass = 300;
		this.inertia = 13;
		this.geometry = null;
		this.model = null;
		this.system = 'standard';
		this.modelLoaded = false;
		this.modelLoading = false;
		this.modelFile = null;
		this.internalAdd = false;

		//todo : check if this is useful
		this.appearance = {
			labelColor: "#FFFFFF",
			diceColor: "#000000",
			outlineColor: "#000000",
			edgeColor: "#000000",
			texture: "none",
			material: "auto",
			font: "auto",
			colorset: "custom"
		};
	}

	setValues(min = 1, max = 20, step = 1) {
		this.values = this.range(min, max, step);
		if(min < 1)
			this.setValueMap(min, max, step);
	}

	setValueMap(min, max, step) {
		let map = {};
		let count=1;
		for(let i = min; i<= max; i+=step){
			map[i] = count;
			count++;
		}
		this.valueMap = map;
	}

	registerFaces(faces, type = "labels") {
		let tab = [];
		
		tab.push('');
		if (!["d2", "d10"].includes(this.shape)) tab.push('');

		if (this.shape == 'd4') {

			let a = faces[0];
			let b = faces[1];
			let c = faces[2];
			let d = faces[3];

			tab = [
				[[], [0, 0, 0], [b, d, c], [a, c, d], [b, a, d], [a, b, c]],
				[[], [0, 0, 0], [b, c, d], [c, a, d], [b, d, a], [c, b, a]],
				[[], [0, 0, 0], [d, c, b], [c, d, a], [d, b, a], [c, a, b]],
				[[], [0, 0, 0], [d, b, c], [a, d, c], [d, a, b], [a, c, b]]
			];
		} else {
			Array.prototype.push.apply(tab, faces)
		}
		if (type == "labels")
			this.labels = tab;
		else
			this.normals = tab;
	}

	setLabels(labels) {
		this.labels = labels;
		this.modelLoaded=false;
		this.modelLoading=false;
	}

	setBumpMaps(normals) {
		this.normals = normals;
		this.modelLoaded=false;
		this.modelLoading=false;
	}

	loadTextures() {
		if(!this.modelLoaded && this.modelLoading === false){
			this.modelLoading = new Promise((resolve,reject)=> {
				let textures;
				let type;
				let textureTypeLoaded = 0;
				for(let i = 0; i < 2;i++){
					if(i == 0){
						textures = this.labels;
						type = "labels";
					} else {
						textures = this.normals;
						type = "bump";
					}
					let loadedImages = 0;
					let numImages = textures.length;
					let regexTexture = /\.(PNG|JPG|GIF|WEBP)$/i;
					let imgElements = Array(textures.length);
					let hasTextures = false;
					for (let i = 0; i < numImages; i++) {
						if (textures[i] == null || textures[i] == '' || !textures[i].match(regexTexture)) {
							imgElements[i] = textures[i];
							++loadedImages
							continue;
						}
						hasTextures = true;
						imgElements[i] = new Image();
						imgElements.textureType = type;
						imgElements[i].onload = function(){
							if (++loadedImages >= numImages) {
								this.registerFaces(imgElements, imgElements.textureType);
								if(textureTypeLoaded < 1)
									textureTypeLoaded++;
								else{
									resolve();
									this.modelLoaded = true;
								}
							}
						}.bind(this);
						imgElements[i].src = textures[i];
					}
					if (!hasTextures){
						this.registerFaces(imgElements, type);
						if(textureTypeLoaded < 1)
							textureTypeLoaded++;
						else{
							resolve();
							this.modelLoaded = true;
						}
					}
				}
			});
		}
		return this.modelLoading;
	}

	range(start, stop, step = 1) {
		var a = [start], b = start;
		while (b < stop) {
			a.push(b += step || 1);
		}
		return a;
	}

	setModel(file) {
		this.modelFile = file;
		this.modelLoaded = false;
	}

	loadModel(loader = null) {
		// Load a glTF resource
		if(!this.modelLoaded && this.modelLoading === false){
			this.modelLoading = new Promise((resolve,reject)=> {
				loader.load(this.modelFile, gltf => {
					gltf.scene.traverse(function (node) {
						if (node.isMesh) {
							node.castShadow = true; 
						}
					});
					this.model = gltf;
					this.modelLoaded = true;
					resolve(gltf);
				});
			});
		}
		return this.modelLoading;
	}
}