Hooks.on("init", registerSettings)

function registerSettings(){
    game.settings.register("nap-time", "characterShort",{
        name: "NAPTIME.Settings.CharacterShort.Name",
        hint: "NAPTIME.Settings.CharacterShort.Hint",
        scope: "global",
        type: String,
        config: true,
        choices:{
            "gmnodialog": game.i18n.localize("NAPTIME.Settings.GMNoDialog"),
            "gmdialog": game.i18n.localize("NAPTIME.Settings.GMDialog"),
            "player": game.i18n.localize("NAPTIME.Settings.Player"),
            "none": game.i18n.localize("NAPTIME.Settings.None")
        },
        default: "player"
    });
    game.settings.register("nap-time", "otherShort",{
        name: "NAPTIME.Settings.OtherShort.Name",
        hint: "NAPTIME.Settings.OtherShort.Hint",
        scope: "global",
        type: String,
        config: true,
        choices:{
            "gmnodialog": game.i18n.localize("NAPTIME.Settings.GMNoDialog"),
            "gmdialog": game.i18n.localize("NAPTIME.Settings.GMDialog"),
            "none": game.i18n.localize("NAPTIME.Settings.None")
        },
        default: "none"
    });
    game.settings.register("nap-time", "characterLong",{
        name: "NAPTIME.Settings.CharacterLong.Name",
        hint: "NAPTIME.Settings.CharacterLong.Hint",
        scope: "global",
        type: String,
        config: true,
        choices:{
            "gmnodialog": game.i18n.localize("NAPTIME.Settings.GMNoDialog"),
            "gmdialog": game.i18n.localize("NAPTIME.Settings.GMDialog"),
            "player": game.i18n.localize("NAPTIME.Settings.Player"),
            "none": game.i18n.localize("NAPTIME.Settings.None")
        },
        default: "player"
    });
    game.settings.register("nap-time", "otherLong",{
        name: "NAPTIME.Settings.OtherLong.Name",
        hint: "NAPTIME.Settings.OtherLong.Hint",
        scope: "global",
        type: String,
        config: true,
        choices:{
            "gmnodialog": game.i18n.localize("NAPTIME.Settings.GMNoDialog"),
            "gmdialog": game.i18n.localize("NAPTIME.Settings.GMDialog"),
            "none": game.i18n.localize("NAPTIME.Settings.None")
        },
        default: "none"
    });
    game.settings.register("nap-time", "offlineMode",{
        name: "NAPTIME.Settings.Offline.Name",
        hint: "NAPTIME.Settings.Offline.Hint",
        scope: "global",
        type: Boolean,
        config: true,
        default: false
    })

}