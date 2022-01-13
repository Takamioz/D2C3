import { DiceSFX } from '../DiceSFX.js';

export class PlaySoundEpicWin extends DiceSFX {
    static id = "PlaySoundEpicWin";
    static specialEffectName = "DICESONICE.PlaySoundEpicWin";
    static path = 'modules/dice-so-nice/sfx/sounds/epic_win.mp3';
    /**@override init */
    static async init(){
        game.audio.pending.push(function(){
            AudioHelper.preloadSound(PlaySoundEpicWin.path);
        }.bind(this));
        return true;
    }

    /**@override play */
    async play(){
        AudioHelper.play({
            src: PlaySoundEpicWin.path,
            volume: this.volume
		}, false);
    }
}