import { SWADE } from "./config.js";
import { getCanvas } from "./util.js";
export function listenJournalDrop() {
    // Grabbing the image url from the journal entry
    function _onDragStart(event) {
        event.stopPropagation();
        const url = event.srcElement.style.backgroundImage
            .slice(4, -1)
            .replace(/"/g, '');
        const dragData = { type: 'image', src: url };
        event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    }
    // Create the tile with the gathered informations
    async function _onDropImage(event, data) {
        if (data.type == 'image') {
            // Determine the tile size
            const tex = await loadTexture(data.src);
            const t = getCanvas().app.stage.worldTransform;
            const tileData = {
                img: data.src,
                width: (SWADE.imagedrop.height * tex.width) / tex.height,
                height: SWADE.imagedrop.height,
                x: (event.clientX - t.tx) / getCanvas().stage.scale.x,
                y: (event.clientY - t.ty) / getCanvas().stage.scale.y,
                z: 400,
            };
            const viewedScene = game.user?.viewedScene;
            if (!viewedScene)
                return;
            const scene = game.scenes.get(viewedScene, { strict: true });
            await scene.createEmbeddedDocuments('Tile', [tileData]);
        }
    }
    // Add the listener to the board html element
    Hooks.once('canvasReady', () => {
        document.getElementById('board')?.addEventListener('drop', (event) => {
            // Try to extract the data (type + src)
            let data;
            try {
                data = JSON.parse(event.dataTransfer.getData('text/plain'));
            }
            catch (err) {
                return;
            }
            // Create the tile
            _onDropImage(event, data);
        });
    });
    // Add the listener for draggable event from the journal image
    Hooks.on('renderJournalSheet', (sheet, html) => {
        html.find('.lightbox-image').each((i, div) => {
            div.setAttribute('draggable', 'true');
            div.addEventListener('dragstart', _onDragStart, false);
        });
    });
}
