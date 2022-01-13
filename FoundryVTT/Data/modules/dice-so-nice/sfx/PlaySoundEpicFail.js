import { DiceSFX } from '../DiceSFX.js';

export class PlaySoundEpicFail extends DiceSFX {
    static id = "PlaySoundEpicFail";
    static specialEffectName = "DICESONICE.PlaySoundEpicFail";
    static path = 'modules/dice-so-nice/sfx/sounds/epic_fail.mp3';
    /**@override init */
    static async init(){
        game.audio.pending.push(function(){
            AudioHelper.preloadSound(PlaySoundEpicFail.path);
        }.bind(this));
        return true;
    }

    /**@override play */
    async play(){
        AudioHelper.play({
            src: PlaySoundEpicFail.path,
            volume: this.volume
		}, false);
    }
}