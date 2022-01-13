import { ElapsedTime } from "./ElapsedTime.js";
export const registerSettings = function () {
    // Register any custom module settings here
    let modulename = "about-time";
    game.settings.register("about-time", "store", {
        name: "Elapsed Time event queue",
        hint: "Don't touch this",
        default: {},
        type: Object,
        scope: 'world',
        config: false
    });
    game.settings.register("about-time", "debug", {
        name: "Debug output",
        hint: "Debug output",
        default: false,
        type: Boolean,
        scope: 'client',
        config: true,
        onChange: ElapsedTime._fetchParams
    });
    game.settings.register("about-time", "store", {
        name: "Elapsed Time event queue",
        hint: "Don't touch this",
        default: {},
        type: Object,
        scope: 'world',
        config: false
    });
    //calendar weather compat
    game.settings.register("about-time", "election-timeout", {
        name: "For calendar-weather",
        hint: "Don't touch this",
        default: 5,
        type: Number,
        scope: 'world',
        config: false
    });
    game.settings.register("about-time", "timeZeroOffset", {
        name: "For calendar-weather",
        hint: "Don't touch this",
        default: "",
        type: String,
        scope: 'world',
        config: false
    });
    game.settings.register("about-time", "calendar", {
        name: "For calendar-weather",
        hint: "Don't touch this",
        default: 0,
        type: Number,
        scope: 'world',
        config: false
    });
    game.settings.register("about-time", "savedCalendar", {
        name: "For calendar-weather",
        hint: "Don't touch this",
        default: {},
        type: Object,
        scope: 'world',
        config: false
    });
};
