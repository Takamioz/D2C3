// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//                            Imports
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
import { moduleName, moduleTag } from "./scripts/constants.js";
import { registerSettings } from "./scripts/settings.js";
import {AmmoTracker} from "./scripts/tracker.js"

export let socket;
let trackers = [];

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//                              Main
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Hooks.on('init', async () => {
    await registerSettings();
    console.log(`${moduleTag} | Initialized`);
});


Hooks.on('socketlib.ready', () => {
    socket = socketlib.registerModule(moduleName);
    socket.register("recoverClient", recoverClient);
});


Hooks.on('ready', async () => {    
    // Enable watcher.
    watcher();
    if (!game.user.isGM) return;
    
    // Fetch running combats and create trackers
    const combats = game.combats._source

    for (let combat of combats) {
        console.log(combat);
        let tracker = new AmmoTracker(combat._id, true);
        if (tracker.combat.data.round !== 0) tracker.started = true; 
        trackers.push(tracker);
    }
    
    
    console.log(`${moduleTag} | Ready`);
});


Hooks.on('createCombat', async (...args) => {
    if (!game.user.isGM) return;
    const tracker = new AmmoTracker(args[0].data._id);
    trackers.push(tracker);
});


Hooks.on('updateCombat', async (...args) => {
    if (!game.user.isGM) return;
    if (args[0].data.round === 0) { return true; }
    
    for (let tracker of trackers) {
        if (tracker.combatId == args[0].data._id){
            if (!tracker.started) {
                tracker.started = true;
                await tracker.startTracker();
            }
            break;
        }
    }
}); 


Hooks.on('deleteCombat', async (...args) => {
    if (!game.user.isGM) return;
    for (let tracker of trackers) {
        if (tracker.combatId == args[0].data._id) {
            if (tracker.started) {
                tracker.ended = true;
                await tracker.endTracker();
            }
        }
    }
});


// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//                            Watcher
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
function watcher() {
    $(document).on('click', '.at-recover-btn', async (button) => {
        
        const dataset = button.currentTarget.dataset;
        if (!game.user.isGM) {
            socket.executeAsGM(recoverClient, dataset);
            return;
        }

        await recoverClient(dataset);
    });
}


// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//                       Recover - Client
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
export const recoverClient = async function(dataset) {
    let currentTracker = trackers.find(tracker => tracker.combatId == dataset.combatId );
        console.debug(currentTracker);
        
        if (currentTracker != undefined){
            await currentTracker.recover(dataset.actorId);
        }
} 


// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//                            Tracker
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
