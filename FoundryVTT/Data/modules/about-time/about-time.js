/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: [your name]
 * Content License: [copyright and-or license] If using an existing system
 * 					you may want to put a (link to a) license or copyright
 * 					notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 * 					 determines how others may use and modify your module
 */
// Import TypeScript modules
import { registerSettings } from "./module/settings.js";
import { ElapsedTime } from "./module/ElapsedTime.js";
import { PseudoClock } from "./module/PseudoClock.js";
import { DateTime } from "./module/calendar/DateTime.js";
import { DTMod } from "./module/calendar/DTMod.js";
import { DTCalc } from "./module/calendar/DTCalc.js";
export var simpleCalendar;
export function DTNow() {
    //@ts-ignore
    return DateTime.createFromSeconds(game.time.worldTime);
}
/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
    console.log('about-time | Initializing about-time');
    // Assign custom classes and constants here
    // Register custom module settings
    registerSettings();
    // Preload Handlebars templates
    // await preloadTemplates();
    // Register custom sheets (if any)
});
let operations;
export var calendars = {};
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function () {
    // Do anything after initialization but before
    // ready
    operations = {
        isMaster: () => PseudoClock.isMaster,
        isRunning: PseudoClock.isRunning,
        doAt: ElapsedTime.doAt,
        doIn: ElapsedTime.doIn,
        doEvery: ElapsedTime.doEvery,
        doAtEvery: ElapsedTime.doAtEvery,
        reminderAt: ElapsedTime.reminderAt,
        reminderIn: ElapsedTime.reminderIn,
        reminderEvery: ElapsedTime.reminderEvery,
        reminderAtEvery: ElapsedTime.reminderAtEvery,
        notifyAt: ElapsedTime.notifyAt,
        notifyIn: ElapsedTime.notifyIn,
        notifyEvery: ElapsedTime.notifyEvery,
        notifyAtEvery: ElapsedTime.notifyAtEvery,
        clearTimeout: ElapsedTime.gclearTimeout,
        getTimeString: ElapsedTime.currentTimeString,
        getTime: ElapsedTime.currentTimeString,
        queue: ElapsedTime.showQueue,
        chatQueue: ElapsedTime.chatQueue,
        ElapsedTime: ElapsedTime,
        DTM: DTMod,
        DTC: DTCalc,
        DT: DateTime,
        DMf: DTMod.create,
        DTf: DateTime.create,
        DTNow: DateTime.now,
        calendars: calendars,
        _notifyEvent: PseudoClock.notifyEvent,
        startRunning: () => {
            if (ElapsedTime.debug)
                console.warn("about-time | startRunning deprecated use SimpleCalendar.api.startClock()");
            //@ts-ignore
            window.SimpleCalendar.api.startClock();
        },
        stopRunning: () => {
            if (ElapsedTime.debug)
                console.warn("about-time | stopRunning not supported use SimpleCalendar.api.stopClock()");
            //@ts-ignore
            window.SimpleCalendar.api.stopClock();
        },
        mutiny: PseudoClock.mutiny,
        advanceClock: ElapsedTime.advanceClock,
        advanceTime: ElapsedTime.advanceTime,
        setClock: PseudoClock.setClock,
        setTime: ElapsedTime.setTime,
        setAbsolute: ElapsedTime.setAbsolute,
        setDateTime: ElapsedTime.setDateTime,
        flushQueue: ElapsedTime._flushQueue,
        reset: ElapsedTime._initialize,
        resetCombats: () => console.error("about-time | not supported"),
        status: ElapsedTime.status,
        pc: PseudoClock,
        //@ts-ignore
        showClock: () => window.SimpleCalendar.api.showCalendar(null, true),
        //@ts-ignore
        showCalendar: () => window.SimpleCalendar.api.showCalendar(),
        CountDown: () => console.error("about-time | not currently supported"),
        RealTimeCountDown: () => console.error("about-time | not currently supported"),
        _save: (ElapsedTime._save),
        _load: ElapsedTime._load,
    };
    //@ts-ignore
    game.Gametime = operations;
    //@ts-ignore
    window.Gametime = operations;
    // runDateTimeTests();
    // calendar weather support
});
/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', function () {
    DTCalc.initCalendarWeather();
    //@ts-ignore
    if (game.modules.get("foundryvtt-simple-calendar").active) {
        //@ts-ignore
    }
    else
        console.warn("simple calendar not loaded");
    // emergency clearing of the queue ElapsedTime._flushQueue();
    PseudoClock.init();
    ElapsedTime.init();
    // Do this until simple calendar is ready early
});
