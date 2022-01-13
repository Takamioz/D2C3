Hooks.on("ready", () => {
    return;
    // intend to setup global variables here
    console.log("Vars running and seting globals");
    //@ts-ignore
    DMf = game.Gametime.DMf;
    //@ts-ignore
    DTM = game.Gametime.DTM;
    //@ts-ignore
    DTNow = game.Gametime.DTNow;
    //@ts-ignore
    DTC = game.Gametime.DTC;
    //@ts-ignore
    DTf = game.Gametime.DTf;
});
