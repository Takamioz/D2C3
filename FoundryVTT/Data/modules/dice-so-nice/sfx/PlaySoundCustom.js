import { DiceSFX } from '../DiceSFX.js';

/**
 * Options needed: path
 */
export class PlaySoundCustom extends DiceSFX {
    static id = "PlaySoundCustom";
    static specialEffectName = "DICESONICE.PlaySoundCustom";

    /**@override play */
    async play(options){
        if(options && options.path){
            AudioHelper.play({
                src: options.path,
                volume: this.volume
            }, false);
        }
    }

    static getDialogContent(sfxLine,id){
        let dialogContent = super.getDialogContent(sfxLine,id);

        dialogContent.content = dialogContent.content.concat(`<div class="form-group">
                                        <label>{{localize "DICESONICE.sfxOptionsCustomSound"}}</label>
                                        <div class="form-fields">
                                            <button type="button" class="file-picker" data-type="audio" data-target="sfxLine[{{id}}][options][path]" title="Browse Files" tabindex="-1">
                                                <i class="fas fa-file-import fa-fw"></i>
                                            </button>
                                            <input class="image" type="text" name="sfxLine[{{id}}][options][path]" placeholder="path/audio.mp3" value="{{path}}">
                                        </div>
                                    </div>`);

        dialogContent.data.path = sfxLine.options ? sfxLine.options.path:"";
        return dialogContent;
    }
}