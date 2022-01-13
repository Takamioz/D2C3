import { Dice3D } from './Dice3D.js';
import { DiceConfig } from './DiceConfig.js';
import { RollableAreaConfig } from './RollableAreaConfig.js';
import { Utils } from './Utils.js';

/**
 * Registers the exposed settings for the various 3D dice options.
 */
Hooks.once('init', () => {
    const debouncedReload = foundry.utils.debounce(() => {
        window.location.reload();
    }, 100);
    game.settings.registerMenu("dice-so-nice", "dice-so-nice", {
        name: "DICESONICE.config",
        label: "DICESONICE.configTitle",
        hint: "DICESONICE.configHint",
        icon: "fas fa-dice-d20",
        type: DiceConfig,
        restricted: false
    });

    game.settings.registerMenu("dice-so-nice", "rollable-area", {
        name: "DICESONICE.RollableAreaConfig",
        label: "DICESONICE.RollableAreaConfigTitle",
        hint: "DICESONICE.RollableAreaConfigHint",
        icon: "fas fa-crop-alt",
        type: RollableAreaConfig,
        restricted: false
    });

    //Not used anymore but kept for compatibility with migration
    game.settings.register("dice-so-nice", "settings", {
        name: "3D Dice Settings",
        scope: "client",
        default: {},
        type: Object,
        config: false
    });

    game.settings.register("dice-so-nice", "maxDiceNumber", {
        name: "DICESONICE.maxDiceNumber",
        hint: "DICESONICE.maxDiceNumberHint",
        scope: "world",
        type: Number,
        default: 20,
        range: {
            min: 20,
            max: 100,
            step: 5
        },
        config: true
    });

    game.settings.register("dice-so-nice", "globalAnimationSpeed", {
        name: "DICESONICE.globalAnimationSpeed",
        hint: "DICESONICE.globalAnimationSpeedHint",
        scope: "world",
        type: String,
        choices: Utils.localize({
            "0": "DICESONICE.PlayerSpeed",
            "1": "DICESONICE.NormalSpeed",
            "2": "DICESONICE.2xSpeed",
            "3": "DICESONICE.3xSpeed"
        }),
        default: "0",
        config: true,
        onChange: debouncedReload
    });

    game.settings.register("dice-so-nice", "enabledSimultaneousRolls", {
        name: "DICESONICE.enabledSimultaneousRolls",
        hint: "DICESONICE.enabledSimultaneousRollsHint",
        scope: "world",
        type: Boolean,
        default: true,
        config: true,
        onChange: debouncedReload
    });

    game.settings.register("dice-so-nice", "enabledSimultaneousRollForMessage", {
        name: "DICESONICE.enabledSimultaneousRollForMessage",
        hint: "DICESONICE.enabledSimultaneousRollForMessageHint",
        scope: "world",
        type: Boolean,
        default: true,
        config: true
    });

    game.settings.register("dice-so-nice", "diceCanBeFlipped", {
        name: "DICESONICE.diceCanBeFlipped",
        hint: "DICESONICE.diceCanBeFlippedHint",
        scope: "world",
        type: Boolean,
        default: true,
        config: true
    });

    game.settings.register("dice-so-nice", "formatVersion", {
        scope: "world",
        type: String,
        default: "",
        config: false
    });

    game.settings.register("dice-so-nice", "disabledDuringCombat", {
        name: "DICESONICE.disabledDuringCombat",
        hint: "DICESONICE.disabledDuringCombatHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register("dice-so-nice", "disabledForInitiative", {
        name: "DICESONICE.disabledForInitiative",
        hint: "DICESONICE.disabledForInitiativeHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register("dice-so-nice", "immediatelyDisplayChatMessages", {
        name: "DICESONICE.immediatelyDisplayChatMessages",
        hint: "DICESONICE.immediatelyDisplayChatMessagesHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register("dice-so-nice", "animateRollTable", {
        name: "DICESONICE.animateRollTable",
        hint: "DICESONICE.animateRollTableHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register("dice-so-nice", "animateInlineRoll", {
        name: "DICESONICE.animateInlineRoll",
        hint: "DICESONICE.animateInlineRollHint",
        scope: "world",
        type: Boolean,
        default: true,
        config: true
    });

    game.settings.register("dice-so-nice", "hideNpcRolls", {
        name: "DICESONICE.hideNpcRolls",
        hint: "DICESONICE.hideNpcRollsHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register("dice-so-nice", "allowInteractivity", {
        name: "DICESONICE.allowInteractivity",
        hint: "DICESONICE.allowInteractivityHint",
        scope: "world",
        type: Boolean,
        default: true,
        config: true,
        onChange: debouncedReload
    });

    game.settings.register("dice-so-nice", "showGhostDice", {
        name: "DICESONICE.showGhostDice",
        hint: "DICESONICE.showGhostDiceHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

});

/**
 * Foundry is ready, let's create a new Dice3D!
 */
Hooks.once('ready', () => {
    Utils.migrateOldSettings().then((updated) => {
        if (updated) {
            if (!game.settings.get("core", "noCanvas"))
                game.dice3d = new Dice3D();
            else
                logger.warn("Dice So Nice! is disabled because the user has activated the 'No-Canvas' mode");
        }
    });
});

/**
 * Intercepts all roll-type messages hiding the content until the animation is finished
 */
Hooks.on('createChatMessage', (chatMessage) => {
    //precheck for better perf
    let hasInlineRoll = game.settings.get("dice-so-nice", "animateInlineRoll") && chatMessage.data.content.indexOf('inline-roll') !== -1;
    if ((!chatMessage.isRoll && !hasInlineRoll) || (!chatMessage.isContentVisible && !game.settings.get("dice-so-nice", "showGhostDice")) ||
        (game.view != "stream" && (!game.dice3d || game.dice3d.messageHookDisabled)) ||
        (chatMessage.getFlag("core", "RollTable") && !game.settings.get("dice-so-nice", "animateRollTable"))) {
        return;
    }
    let roll = chatMessage.isRoll ? chatMessage.roll : null;
    let maxRollOrder = roll ? 0:-1;
    if (hasInlineRoll) {
        let JqInlineRolls = $($.parseHTML(`<div>${chatMessage.data.content}</div>`)).find(".inline-roll.inline-result:not(.inline-dsn-hidden)");
        if (JqInlineRolls.length == 0 && !chatMessage.isRoll) //it was a false positive
            return;
        let inlineRollList = [];
        JqInlineRolls.each((index, el) => {
            let roll = Roll.fromJSON(unescape(el.dataset.roll));
            maxRollOrder++;
            roll.dice.forEach(diceterm => {
                if(!diceterm.options.hasOwnProperty("rollOrder"))
                    diceterm.options.rollOrder = maxRollOrder;
            });
            inlineRollList.push(roll);
        });
        if (inlineRollList.length) {
            if (chatMessage.isRoll)
                inlineRollList.unshift(chatMessage.roll);
            
            let pool = PoolTerm.fromRolls(inlineRollList);
            roll = Roll.fromTerms([pool]);
        }
        else if (!chatMessage.isRoll)
            return;
    }

    //Because Better Roll 5e sends an empty roll object sometime
    if(!roll.dice.length)
        return;

    const isInitiativeRoll = chatMessage.getFlag("core","initiativeRoll");
    if(isInitiativeRoll && game.settings.get("dice-so-nice", "disabledForInitiative"))
        return;

    //Remove the chatmessage sound if it is the core dice sound.
    if (Dice3D.CONFIG().enabled && chatMessage.data.sound == "sounds/dice.wav") {
        mergeObject(chatMessage.data, { "-=sound": null });
    }
    chatMessage._dice3danimating = true;

    const showMessage = () => {
            delete chatMessage._dice3danimating;
            
            window.ui.chat.element.find(`.message[data-message-id="${chatMessage.id}"]`).show();
            if(window.ui.sidebar.popouts.chat)
                window.ui.sidebar.popouts.chat.element.find(`.message[data-message-id="${chatMessage.id}"]`).show();

            Hooks.callAll("diceSoNiceRollComplete", chatMessage.id);

            window.ui.chat.scrollBottom({popout:true});
    }

    if (game.view == "stream" && !game.modules.get("0streamutils")?.active) {
        setTimeout(showMessage, 2500, chatMessage);
    } else {
        //1- We create a list of all 3D rolls, ordered ASC
        //2- We create a Roll object with the correct formula and results
        //3- We queue the showForRoll calls and then show the message
        let orderedDiceList = [[]];
        roll.dice.forEach(diceTerm => {
            let index = 0;
            if(!game.settings.get("dice-so-nice","enabledSimultaneousRollForMessage") && diceTerm.options.hasOwnProperty("rollOrder")){
                index = diceTerm.options.rollOrder;
                if(orderedDiceList[index] == null){
                    orderedDiceList[index] = [];
                }
            }
            orderedDiceList[index].push(diceTerm);
        });
        orderedDiceList = orderedDiceList.filter(el => el != null);
        
        let rollList = [];
        const plus = new OperatorTerm({operator: "+"}).evaluate();
        orderedDiceList.forEach(dice => {
            //add a "plus" between each term
            if(Array.isArray(dice) && dice.length){
                let termList = [...dice].map((e, i) => i < dice.length - 1 ? [e, plus] : [e]).reduce((a, b) => a.concat(b));
                rollList.push(Roll.fromTerms(termList));
            }
        });
        
        //call each promise one after the other, then call the showMessage function
        const recursShowForRoll = (rollList, index) => {
            game.dice3d.showForRoll(rollList[index], chatMessage.user, false, null, false, chatMessage.id, chatMessage.data.speaker).then(()=>{
                index++;
                if(rollList[index] != null)
                    recursShowForRoll(rollList, index);
                else
                    showMessage();
            });
        };

        recursShowForRoll(rollList, 0);
    }
});

/**
 * Hide messages which are animating rolls.
 */
Hooks.on("renderChatMessage", (message, html, data) => {
    if (game.dice3d && game.dice3d.messageHookDisabled) {
        return;
    }
    if (message._dice3danimating && !game.settings.get("dice-so-nice", "immediatelyDisplayChatMessages")) {
        html.hide();
    }
});

document.addEventListener("visibilitychange", function () {
    //if there was roll while the tab was hidden
    if (!document.hidden && game.dice3d && game.dice3d.hiddenAnimationQueue && game.dice3d.hiddenAnimationQueue.length) {
        let now = (new Date()).getTime();
        for (let i = 0; i < game.dice3d.hiddenAnimationQueue.length; i++) {
            let anim = game.dice3d.hiddenAnimationQueue[i];
            if (now - anim.timestamp > 10000) {
                anim.resolve(false);
            } else {
                game.dice3d._showAnimation(anim.data, anim.config).then(displayed => {
                    anim.resolve(displayed);
                });
            }
        }
        game.dice3d.hiddenAnimationQueue = [];
    }
});