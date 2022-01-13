Hooks.once("init", async function() {
    game.socket.on("module.nap-time", restResolve);
})
Hooks.on("getSceneControlButtons", addRestButton); //add the button for this to the menu

Hooks.on("renderShortRestDialog", (dialog, html) => {
    html.find(".window-title").text(`${dialog.data.title}: ${dialog.actor.name}`);
})

Hooks.on("renderLongRestDialog", (dialog, html) => {
    html.find(".window-title").text(`${dialog.data.title}: ${dialog.actor.name}`);
})

async function restResolve(data, actor){
    actor = game.actors.get(data.actorID) ?? game.user.character //if no actor specified in data, try the user's character
    if (!actor || actor.data.type !== "character") return; //if still no actor, or if actor is not a character, bail out
    let restType = data.operation;
    if(restType === "shortRest") {
        let {autoHD, autoHDThreshold, dialog} = data;
        await actor.shortRest({dialog, autoHD, autoHDThreshold});
    }
    if(restType === "longRest") {
        let {newDay, dialog} = data;
        await actor.longRest({dialog, newDay});
    }
}

function addRestButton(buttons) {
    let tokenButton = buttons.find(b => b.name === "token")
    if (tokenButton) {
        tokenButton.tools.push({
            name: "nap-time",
            title: game.i18n.localize('NAPTIME.Button'),
            icon: "fas fa-bed",
            visible: game.user.isGM,
            onClick: () => restDialog(),
            button: true
        });
    }
}

function restDialog() {
    let longRestText = game.i18n.localize("DND5E.RestL");
    let shortRestText = game.i18n.localize("DND5E.RestS");
    let content = "";
    let longDialogSkip = (
        game.settings.get("nap-time", "characterLong") === "gmnodialog" ||
        game.settings.get("nap-time", "otherLong") === "gmnodialog"
    )
    let shortDialogSkip = (
        game.settings.get("nap-time", "characterShort") === "gmnodialog" ||
        game.settings.get("nap-time", "otherShort") === "gmnodialog"
    )

    if (longDialogSkip) {
        content += `
<h2> ${longRestText} </h2>
<label for="newDay">New Day?</label>
<input type="checkbox" id="newDay" name="newDay" checked>
`
    }
    if(shortDialogSkip){
        content += `
<h2> ${shortRestText} </h2>
<label for="autoHD">${game.i18n.localize("NAPTIME.AutoHD")}</label>
<input type="checkbox" id="autoHD" name="autoHD" checked>
<br/>
<label for="autoHDThreshold">${game.i18n.localize("NAPTIME.AutoHDThreshold")}</label>
<input type="number" id="autoHDThreshold" name="autoHDThreshold">
`
    }
    let d = new Dialog({
        title: game.i18n.localize("NAPTIME.Dialog.Title"),
        content,
        buttons:{
            short:{
                icon: "<i class='fas fa-hourglass-half'></i>",
                label: game.i18n.localize("DND5E.RestS"),
                callback: shortRestCallback
            },
            long:{
                icon: "<i class='fas fa-bed'></i>",
                label: game.i18n.localize("DND5E.RestL"),
                callback: longRestCallback
            }
        }
    })
    d.render(true)
}

async function shortRestCallback(html){
    let characterResolve = game.settings.get("nap-time", "characterShort");
    let otherResolve = game.settings.get("nap-time", "otherShort");
    let shortDialogSkip = (
        characterResolve === "gmnodialog" ||
        otherResolve === "gmnodialog"
    )
    let data={operation:"shortRest"};
    if(shortDialogSkip){
        data.autoHD = html.find("input#autoHD")[0].checked;
        data.autoHDThreshold = html.find("input#autoHDThreshold")[0].value;
    }

    let characterIDs=[]
    for (let user of game.users){
        if(user.character && (!game.settings.get("nap-time", "offlineMode") || user.active)) {
            characterIDs.push(user.character.id)
        }
    }

    let otherIDs = []
    for (let actor of game.actors){
        if (actor.data.type === "character" && !characterIDs.includes(actor.id)){
            otherIDs.push(actor.id)
        }
    }
    // noinspection FallThroughInSwitchStatementJS
    switch (characterResolve){
        case "none":
            break;
        case "player":
            game.socket.emit("module.nap-time", data);
            break;
        case "gmnodialog":
            data.dialog = false;
        case "gmdialog":
            for (let id of characterIDs){
                data.actorID = id;
                await restResolve(data)
            }
            break;
    }
    // noinspection FallThroughInSwitchStatementJS
    switch (otherResolve){
        case "none":
            break;
        case "gmnodialog":
            data.dialog = false;
        case "gmdialog":
            for (let id of otherIDs){
                data.actorID = id;
                await restResolve(data)
            }
            break;
    }
}

async function longRestCallback(html){
    let characterResolve = game.settings.get("nap-time", "characterLong");
    let otherResolve = game.settings.get("nap-time", "otherLong");
    let longDialogSkip = (
        characterResolve === "gmnodialog" ||
        otherResolve === "gmnodialog"
    )
    let data={operation:"longRest"};
    if(longDialogSkip){
        data.newDay = html.find("input#newDay")[0].checked;
    }

    let characterIDs=[]
    for (let user of game.users){
        if(user.character && (!game.settings.get("nap-time", "offlineMode") || user.active)) {
            characterIDs.push(user.character.id)
        }
    }

    let otherIDs = []
    for (let actor of game.actors){
        if (actor.data.type === "character" && !characterIDs.includes(actor.id)){
            otherIDs.push(actor.id)
        }
    }
    // noinspection FallThroughInSwitchStatementJS
    switch (characterResolve){
        case "none":
            break;
        case "player":
            game.socket.emit("module.nap-time", data);
            break;
        case "gmnodialog":
            data.dialog = false;
        case "gmdialog":
            for (let id of characterIDs){
                data.actorID = id;
                await restResolve(data)
            }
            break;
    }
    // noinspection FallThroughInSwitchStatementJS
    switch (otherResolve){
        case "none":
            break;
        case "gmnodialog":
            data.dialog = false;
        case "gmdialog":
            for (let id of otherIDs){
                data.actorID = id;
                await restResolve(data)
            }
            break;
    }
}