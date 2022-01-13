import { DiceSFX } from '../DiceSFX.js';
import * as THREE from '../libs/three.module.js';

export class PlayAnimationBright extends DiceSFX {
    static id = "PlayAnimationBright";
    static specialEffectName = "DICESONICE.PlayAnimationBright";
    static brightColor = null;
    static duration = 0.6;
    static sound = "modules/dice-so-nice/sfx/sounds/bright.mp3";
    /**@override init */
    static async init() {
        PlayAnimationBright.brightColor = new THREE.Color(0.4,0.4,0.4);
        this.glowingMesh=null;
        game.audio.pending.push(function(){
            AudioHelper.preloadSound(PlayAnimationBright.sound);
        }.bind(this));
    }

    /**@override play */
    async play() {
        
        if(!this.dicemesh.material && this.dicemesh.userData.glow){
            //We check if there's a glow target specified
            this.dicemesh.traverse(object => {
                if (object.userData && object.userData.name && object.userData.name === this.dicemesh.userData.glow) this.glowingMesh=object;
            });
        } else if(this.dicemesh.material){
            this.glowingMesh=this.dicemesh;
        } else {
            return false;
        }
        if(!this.glowingMesh.material.emissiveMap && !this.glowingMesh.material.bumpMap)
            return false;
        this.clock = new THREE.Clock();
        this.baseColor = this.glowingMesh.material.emissive.clone();
        this.baseMaterial = this.glowingMesh.material;
        this.glowingMesh.material = this.baseMaterial.clone();
        if(!this.glowingMesh.material.emissiveMap && this.glowingMesh.material.bumpMap){
            //Change the emissive map shader to highlight black instead of white
            this.glowingMesh.material.onBeforeCompile = (shader) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <emissivemap_fragment>',
                    [
                        '#ifdef USE_EMISSIVEMAP',
                        'vec4 emissiveColorOg = texture2D( emissiveMap, vUv );',
                        'vec4 emissiveColor = vec4(1.0 - emissiveColorOg.r,1.0 -emissiveColorOg.g,1.0 -emissiveColorOg.b,1);',
                        'emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;',
                        'totalEmissiveRadiance *= emissiveColor.rgb;',
                        '#endif'
                    ].join('\n')
                );
            };
            if(this.glowingMesh.material.bumpMap)
                this.glowingMesh.material.emissiveMap = this.glowingMesh.material.bumpMap;
            this.glowingMesh.material.emissiveIntensity = 1.5;
        }
        AudioHelper.play({
            src: PlayAnimationBright.sound,
            volume: this.volume
		}, false);
        this.renderReady = true;
    }

    render() {
        if(!this.renderReady)
            return;
        let x = 1-((PlayAnimationBright.duration - this.clock.getElapsedTime())/PlayAnimationBright.duration);
        if(x>1){
            this.destroy();
        } else {
            let val = (Math.sin(2 * Math.PI * (x - 1/4)) + 1) / 2;
            this.glowingMesh.material.emissive.copy(this.baseColor);
            this.glowingMesh.material.emissive.lerp(PlayAnimationBright.brightColor, val);
        }
    }

    destroy(){
        let sfxMaterial = this.glowingMesh.material;
        this.glowingMesh.material = this.baseMaterial;
        sfxMaterial.dispose();
        this.destroyed = true;
    }
}