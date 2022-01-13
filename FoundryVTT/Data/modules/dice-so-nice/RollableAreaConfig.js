import {Dice3D} from "./Dice3D.js";

export class RollableAreaConfig extends FormApplication {

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: game.i18n.localize("DICESONICE.RollableAreaConfigTitle"),
            template: "modules/dice-so-nice/templates/rollable-area-config.html",
            width: 280,
            top: 70,
            left: window.innerWidth - 290
        });
    }

    render(force, context={}) {
        this.area = $(`
            <div class='dice-so-nice rollable-area'>
                <div class='resizers'>
                    <div class='resizer nw'></div>
                    <div class='resizer ne'></div>
                    <div class='resizer sw'></div>
                    <div class='resizer se'></div>
                    <div class="info">${game.i18n.localize("DICESONICE.RollableAreaText")}</div> 
                </div>
            </div>
        `);

        let rollingArea = Dice3D.CONFIG().rollingArea;
        if(!rollingArea) {
            const $diceBox = $("#dice-box-canvas");
            rollingArea = {
                top: $diceBox.position().top,
                left: $diceBox.position().left,
                width: $diceBox.width(),
                height: $diceBox.height()
            }
        }
        console.log(rollingArea);
        this.area.appendTo($('body'));
        this.area.css(rollingArea);

        return super.render(force, context);
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('button[name="restore"]').click(this._onRestore.bind(this));

        let el = $(this.area).get(0);
        let resizing = false;
        this.area.mousedown(function(e) {
            let prevX = e.clientX;
            let prevY = e.clientY;

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);

            function onMouseMove(e) {
                if (!resizing) {
                    let newX = prevX - e.clientX;
                    let newY = prevY - e.clientY;

                    const rect = el.getBoundingClientRect();
                    el.style.left = rect.left - newX + 'px';
                    el.style.top = rect.top - newY + 'px';

                    prevX = e.clientX;
                    prevY = e.clientY;
                }
            }

            function onMouseUp() {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            }
        });

        const resizers = $(".rollable-area > .resizers > .resizer");
        for(let resizer of resizers) {
            $(resizer).mousedown(function (e) {
                resizing = true;
                let prevX = e.clientX;
                let prevY = e.clientY;

                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);

                function onMouseMove(e) {
                    const rect = el.getBoundingClientRect();

                    if(resizer.classList.contains("se")) {
                        el.style.width = rect.width - (prevX - e.clientX) + "px";
                        el.style.height = rect.height - (prevY - e.clientY) + "px";
                    }
                    else if(resizer.classList.contains("sw")) {
                        el.style.width = rect.width + (prevX - e.clientX) + "px";
                        el.style.height = rect.height - (prevY - e.clientY) + "px";
                        el.style.left = rect.left - (prevX - e.clientX) + "px";
                    }
                    else if(resizer.classList.contains("ne")) {
                        el.style.width = rect.width - (prevX - e.clientX) + "px";
                        el.style.height = rect.height + (prevY - e.clientY) + "px";
                        el.style.top = rect.top - (prevY - e.clientY) + "px";
                    }
                    else {
                        el.style.width = rect.width + (prevX - e.clientX) + "px";
                        el.style.height = rect.height + (prevY - e.clientY) + "px";
                        el.style.left = rect.left - (prevX - e.clientX) + "px";
                        el.style.top = rect.top - (prevY - e.clientY) + "px";
                    }

                    prevX = e.clientX;
                    prevY = e.clientY;
                }

                function onMouseUp() {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                    resizing = false;
                }
            });
        }
    }

    async _onRestore() {
        await this.saveSettingsAndRebuild(false);
        await this.close();
    }

    async _updateObject() {
        await this.saveSettingsAndRebuild({
            top: this.area.position().top,
            left: this.area.position().left,
            width: this.area.width(),
            height: this.area.height()
        });
    }

    async saveSettingsAndRebuild(rollingArea) {
        let settings = mergeObject(Dice3D.CONFIG(), {
            rollingArea: rollingArea
        });
        await game.user.setFlag('dice-so-nice', 'settings', settings);
        game.dice3d.resizeAndRebuild();
    }

    async close(options={}) {
        this.area.remove();
        return super.close(options);
    }
}