import ViewManager from '../control/ViewManager.js';

/**
 * Defines the main FQL constants for module name and the DB flag.
 *
 * @type {{folderState: string, flagDB: string, moduleName: string, moduleLabel: string, primaryState: string}}
 */
const constants = {
   moduleName: 'forien-quest-log',
   moduleLabel: `Forien's Quest Log`,
   flagDB: 'json'
};

/**
 * Defines the {@link JQuery} events that are used in FQL.
 *
 * @type {{click: string, dblclick: string, dragstart: string, drop: string, focus: string, focusout: string, mousedown: string}}
 */
const jquery = {
   click: 'click',
   dblclick: 'dblclick',
   dragenter: 'dragenter',
   dragstart: 'dragstart',
   drop: 'drop',
   focus: 'focus',
   focusout: 'focusout',
   keydown: 'keydown',
   mousedown: 'mousedown'
};

/**
 * Defines the left-hand UI control note buttons.
 *
 * @type {object[]}
 */
const noteControls = [
   {
      name: constants.moduleName,
      title: 'ForienQuestLog.QuestLogButton',
      icon: 'fas fa-scroll',
      visible: true,
      onClick: () => ViewManager.questLog.render(true, { focus: true }),
      button: true
   },
   {
      name: 'forien-quest-log-floating-window',
      title: 'ForienQuestLog.QuestTracker.Title',
      icon: 'fas fa-tasks',
      visible: true,
      onClick: async () => { await game.settings.set(constants.moduleName, settings.questTrackerEnable, true); },
      button: true
   }
];

/**
 * Stores strings for quest types (statuses)
 *
 * @returns {{active: string, available: string, completed: string, failed: string, inactive: string}}
 */
const questStatus = {
   active: 'active',
   available: 'available',
   completed: 'completed',
   failed: 'failed',
   inactive: 'inactive'
};

/**
 * Stores localization strings for quest types (statuses)
 *
 * @type {{active: string, available: string, completed: string, failed: string, inactive: string}}
 */
const questStatusI18n = {
   active: 'ForienQuestLog.QuestTypes.Active',
   available: 'ForienQuestLog.QuestTypes.Available',
   completed: 'ForienQuestLog.QuestTypes.Completed',
   failed: 'ForienQuestLog.QuestTypes.Failed',
   inactive: 'ForienQuestLog.QuestTypes.InActive'
};

/**
 * Stores the QuestLog tab indexes. This is used by QuestLog.setPosition to select the current table based on status
 * name.
 *
 * @type {{inactive: number, available: number, active: number, completed: number, failed: number}}
 */
const questTabIndex = {
   active: 1,
   available: 0,
   completed: 2,
   failed: 3,
   inactive: 4
};

/**
 * Stores the keys used with session storage.
 *
 * @type {FQLSessionConstants}
 */
const sessionConstants = {
   currentPrimaryQuest: 'forien.questlog.currentPrimaryQuest',
   trackerFolderState: 'forien.questtracker.folderState-',
   trackerShowPrimary: 'forien.questtracker.showPrimary'
};

/**
 * @type {FQLSettings} Defines all the module settings for world and client.
 */
const settings = {
   allowPlayersAccept: 'allowPlayersAccept',
   allowPlayersCreate: 'allowPlayersCreate',
   allowPlayersDrag: 'allowPlayersDrag',
   countHidden: 'countHidden',
   defaultAbstractRewardImage: 'defaultAbstractRewardImage',
   defaultPermission: 'defaultPermission',
   dynamicBookmarkBackground: 'dynamicBookmarkBackground',
   hideFQLFromPlayers: 'hideFQLFromPlayers',
   navStyle: 'navStyle',
   notifyRewardDrop: 'notifyRewardDrop',
   primaryQuest: 'primaryQuest',
   questTrackerEnable: 'questTrackerEnable',
   questTrackerPinned: 'questTrackerPinned',
   questTrackerPosition: 'questTrackerPosition',
   questTrackerResizable: 'questTrackerResizable',
   showFolder: 'showFolder',
   showTasks: 'showTasks',
   trustedPlayerEdit: 'trustedPlayerEdit'
};

export { constants, jquery, noteControls, questStatus, questStatusI18n, questTabIndex, sessionConstants, settings };

/**
 * @typedef {object} FQLSessionConstants
 *
 * @property {string}   currentPrimaryQuest - Stores current primary quest set from {@link FQLSettings.primaryQuest}.
 *
 * @property {string}   trackerFolderState - Stores a boolean with tacked on quest ID for whether objectives are shown.
 *
 * @property {string}   trackerShowPrimary - Stores a boolean if the tracker is showing the primary quest or all quests.
 */

/**
 * @typedef {object} FQLSettings
 *
 * @property {string}   allowPlayersAccept - Allow players to accept quests.
 *
 * @property {string}   allowPlayersCreate - Allow players to create quests.
 *
 * @property {string}   allowPlayersDrag - Allow players to drag reward items to actor sheet.
 *
 * @property {string}   countHidden - Count hidden objectives / subquests.
 *
 * @property {string}   defaultAbstractRewardImage - Sets the default abstract reward image path.
 *
 * @property {string}   defaultPermission - Sets the default permission level for new quests.
 *
 * @property {string}   dynamicBookmarkBackground - Uses jQuery to dynamically set the tab background image.
 *
 * @property {string}   hideFQLFromPlayers - Completely hides FQL from players.
 *
 * @property {string}   navStyle - Navigation style / classic / or bookmark tabs.
 *
 * @property {string}   notifyRewardDrop - Post a notification UI message when rewards are dropped in actor sheets.
 *
 * @property {string}   primaryQuest - Stores the quest ID of a quest that is the current primary quest.
 *
 * @property {string}   questTrackerEnable - Enables the quest tracker.
 *
 * @property {string}   questTrackerPinned - Is the QuestTracker pinned to the side bar.
 *
 * @property {string}   questTrackerPosition - Hidden setting to store current quest tracker position.
 *
 * @property {string}   questTrackerResizable - Stores the current window handling mode ('auto' or 'resize').
 *
 * @property {string}   showFolder - Shows the `_fql_quests` directory in the journal entries sidebar.
 *
 * @property {string}   showTasks - Determines if objective counts are rendered.
 *
 * @property {string}   trustedPlayerEdit - Allows trusted players to have full quest editing capabilities.
 */
