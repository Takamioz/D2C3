export class DiceSFX {
    get nameLocalized(){
        return game.i18n.localize(this._name);
    }
    
    constructor(box, dicemesh){
        this.dicemesh = dicemesh;
        this.box = box;
        this.destroyed = false;
        this.enableGC = false;
        this.renderReady = false;
        this.volume = dicemesh.body_sim.secretRoll && box.muteSoundSecretRolls ? 0 : this.box.volume;
    }

    static async init(){
        return true;
    }

    async play(){
        return Promise.resolve();
    }

    static async loadAsset(loader,url) {
        return new Promise((resolve, reject) => {
          loader.load(url, data=> resolve(data), null, reject);
        });
    }

    static getDialogContent(sfxLine,id){
        let dialogContent = {};
        let disabled = game.user.isGM ? '':'disabled="disabled"';
        dialogContent.content = `<div class="form-group">
                                    <label>{{localize "DICESONICE.sfxOptionsIsGlobal"}}</label>
                                    <input type="checkbox" name="sfxLine[{{id}}][options][isGlobal]" data-dtype="Boolean" ${disabled} {{checked isGlobal}} />
                                </div>`;

        dialogContent.data = {
            isGlobal : sfxLine.options ? sfxLine.options.isGlobal:false,
            id:id
        };

        return dialogContent;
    }
}