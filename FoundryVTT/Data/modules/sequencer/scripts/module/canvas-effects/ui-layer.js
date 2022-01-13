export default class SequencerUILayer{

    constructor() {

        this.canvas = document.createElement("canvas");
        this.canvas.id = "sequencerUILayer"

        this.canvas.style.cssText = `
            position:absolute;
            touch-action: none;
            pointer-events: none;
            width:100%;
            height:100%;
            z-index:0.1;
            padding: 0;
            margin: 0;
        `;

        document.body.appendChild(this.canvas);

        this.app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            view: this.canvas,
            antialias: true,
            backgroundAlpha: 0.0,
            sharedTicker: true
        });

        this.app.resizeTo = window;

        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.container.parentName = "sequencer";

        this.app.stage.addChild(this.container);

        this.app.ticker.add(this.tick.bind(this));

    }

    get children(){
        return this.container.children;
    }

    tick(){
        this.updateAnchoredElements();
    }

    removeContainerByEffect(inEffect){
        const child = this.children.find(child => child === inEffect);
        if(!child) return;
        this.container.removeChild(child);
    }

    updateAnchoredElements(){

        for(let child of this.children){

            let screenSpaceAnchor = child.data.screenSpaceAnchor;
            let screenSpacePosition = child.data.screenSpacePosition;

            if(!screenSpaceAnchor) {
                if (!child.data.anchor) {
                    if (!screenSpaceAnchor) {
                        screenSpaceAnchor = { x: 0.5, y: 0.5 };
                    }
                    if (child.data.screenSpace) {
                        child.data.anchor = { ...screenSpaceAnchor };
                    } else {
                        child.data.anchor = { x: 0.5, y: 0.5 };
                    }
                } else if (!screenSpaceAnchor) {
                    screenSpaceAnchor = { ...child.data.anchor };
                }
            }

            child.position.set(
                screenSpacePosition.x + this.app.renderer.width * screenSpaceAnchor.x,
                screenSpacePosition.y + this.app.renderer.height * screenSpaceAnchor.y
            );

            if(child.data.screenSpaceScale) {

                const scaleData = child.data.screenSpaceScale;

                let scaleX = scaleData.x;
                let scaleY = scaleData.y;

                if(scaleData.fitX){
                    scaleX = scaleX * (this.app.renderer.width / child.sprite.width);
                }

                if(scaleData.fitY){
                    scaleY = scaleY * (this.app.renderer.height / child.sprite.height);
                }

                scaleX = scaleData.ratioX ? scaleY : scaleX;
                scaleY = scaleData.ratioY ? scaleX : scaleY;

                child.scale.set(
                    scaleX,
                    scaleY
                )

            }

        }

    }

}