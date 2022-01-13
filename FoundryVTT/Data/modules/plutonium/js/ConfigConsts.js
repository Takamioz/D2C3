import {Util} from "./Util.js";
import {UtilActors} from "./UtilActors.js";
import {UtilCompat} from "./UtilCompat.js";
import {SharedConsts} from "../shared/SharedConsts.js";

class ConfigConsts {
	static _template_getEntityPermissions (help) {
		const out = MiscUtil.copy(ConfigConsts._TEMPLATE_ENTITY_PERMISSIONS);
		out.values = Util.Fvtt.getPermissionsEnum();
		out.help = help;
		return out;
	}

	static _template_getTokenSettings () {
		return {
			tokenNameDisplay: {
				name: "Token Name Display Mode",
				help: `The default Display Name mode for imported tokens.`,
				default: 20,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: 0,
						name: "None",
					},
					{
						value: 10,
						name: "Control",
					},
					{
						value: 20,
						name: "Owner Hover",
					},
					{
						value: 30,
						name: "Hover",
					},
					{
						value: 40,
						name: "Owner",
					},
					{
						value: 50,
						name: "Always",
					},
				],
			},
			tokenDisposition: {
				name: "Token Disposition",
				help: `The default Token Disposition mode for imported tokens.`,
				default: -1,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: -1,
						name: "Hostile",
					},
					{
						value: 0,
						name: "Neutral",
					},
					{
						value: 1,
						name: "Friendly",
					},
				],
			},
			tokenLockRotation: {
				name: "Token Lock Rotation",
				help: `The default Lock Rotation mode for imported tokens.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenIsAddVision: {
				name: "Enable Token Vision",
				help: `Enable vision for tokens.`,
				default: ConfigConsts.C_BOOL_ENABLED,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_BOOL_DISABLED,
						name: "Disabled",
					},
					{
						value: ConfigConsts.C_BOOL_ENABLED,
						name: "Enabled",
					},
				],
			},
			tokenDimSight: {
				name: "Token Dim Vision Distance",
				help: `How token Dim Vision (Distance) should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenBrightSight: {
				name: "Token Bright Vision Distance",
				help: `How token Bright Vision (Distance) should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenSightAngle: {
				name: "Token Sight Angle",
				help: `How token Sight Angle (Degrees) should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenDimLight: {
				name: "Token Dim Light Radius",
				help: `How token Dim Light Radius (Distance) should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenBrightLight: {
				name: "Token Bright Light Radius",
				help: `How token Bright Light Radius (Distance) should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenLightAngle: {
				name: "Token Light Emission Angle",
				help: `How token Light Emission (Angle) should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenLightColor: {
				name: "Token Light Color",
				help: `How token Light Color should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenLightAlpha: {
				name: "Token Light Intensity",
				help: `How token Color Intensity should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenLightAnimationType: {
				name: "Token Light Animation Type",
				help: `How token Light Animation Type should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenLightAnimationSpeed: {
				name: "Token Light Animation Speed",
				help: `How token Light Animation Speed should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenLightAnimationIntensity: {
				name: "Token Light Animation Intensity",
				help: `How token Light Animation Intensity should be set.`,
				default: ConfigConsts.C_USE_PLUT_VALUE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
				],
			},
			tokenBarDisplay: {
				name: "Token Bar Display Mode",
				help: `The default Display Bars mode for imported tokens.`,
				default: 40,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use game setting",
					},
					{
						value: 0,
						name: "None",
					},
					{
						value: 10,
						name: "Control",
					},
					{
						value: 20,
						name: "Owner Hover",
					},
					{
						value: 30,
						name: "Hover",
					},
					{
						value: 40,
						name: "Owner",
					},
					{
						value: 50,
						name: "Always",
					},
				],
			},
			tokenBar1Attribute: {
				name: "Token Bar 1 Attribute",
				help: `The default token bar 1 attribute for imported tokens.`,
				default: "attributes.hp",
				type: "enum",
				values: () => [
					{value: ConfigConsts.C_USE_GAME_DEFAULT, name: "Use game setting"},
					...UtilActors.getModelBarAttributes(game.system.model.Actor.npc),
				],
				isNullable: true,
			},
			tokenBar2Attribute: {
				name: "Token Bar 2 Attribute",
				help: `The default token bar 2 attribute for imported tokens.`,
				default: null,
				type: "enum",
				values: () => [
					{value: ConfigConsts.C_USE_GAME_DEFAULT, name: "Use game setting"},
					...UtilActors.getModelBarAttributes(game.system.model.Actor.npc),
				],
				isNullable: true,
			},
			tokenScale: {
				name: "Token Scale",
				help: `The default token scale for imported tokens.`,
				default: null,
				type: "number",
				placeholder: "(Use default)",
				min: 0.2,
				max: 3,
				isNullable: true,
			},
			isTokenMetric: {
				name: "Convert Token Vision Ranges to Metric",
				help: "Whether or not token vision range units should be converted to an approximate metric equivalent (5 feet \u2248 1.5 metres).",
				default: false,
				type: "boolean",
			},
		};
	}

	static _template_getAdventureBookSettings () {
		return {
			isOrderingPrefixJournalNames: {
				name: "Add Sort Order Prefix to Journal Entry Names",
				help: `If imported journal entries should be prefixed with a sorting-friendly identifier, to avoid directory sorting from re-ordering them.`,
				type: "boolean",
				default: true,
			},
			journalEntrySplitMode: {
				name: "Text Splitting Mode",
				help: `Which strategy to use when splitting text into journal entries.`,
				type: "enum",
				default: ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_CHAPTER,
				values: [
					{
						value: ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_CHAPTER,
						name: `By chapter`,
					},
					{
						value: ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_CONTENTS,
						name: `By contents`,
					},
					{
						value: ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_HEADINGS,
						name: `By heading`,
					},
				],
			},
			isUseJournalEmbeds: {
				name: "Link Journals as Embeds",
				help: `If enabled, and the "Enable Journal Embeds" Journal Entries Config option is also enabled, links between sections will be rendered as embedded journal entries, rather than simple links.`,
				type: "boolean",
				default: true,
			},
		};
	}

	static _template_getSceneImportSettings () {
		return {
			scenePadding: {
				name: "Scene Padding",
				help: `The amount of scene padding to apply when creating a scene.`,
				default: 0,
				type: "number",
				min: 0,
				max: 0.5,
			},
			sceneBackgroundColor: {
				name: "Scene Background Color",
				help: `The background color to apply when creating a scene.`,
				default: "#222222",
				type: "color",
			},
			isSceneTokenVision: {
				name: "Scene Token Vision",
				help: `Whether or not token vision should be enabled for a created scene.`,
				default: true,
				type: "boolean",
			},
			isSceneFogExploration: {
				name: "Scene Fog Exploration",
				help: `Whether or not fog exploration should be enabled for a created scene.`,
				default: true,
				type: "boolean",
			},
			isSceneAddToNavigation: {
				name: "Add Scenes to Navigation",
				help: `Whether or not a created scene should be added to the navigation bar.`,
				default: false,
				type: "boolean",
			},
			isSceneGenerateThumbnail: {
				name: "Generate Scene Thumbnails",
				help: `Whether or not a thumbnail should be generated for a created scene. Note that this greatly slows down the scene creation process.`,
				default: true,
				type: "boolean",
			},
			isSceneGridMetric: {
				name: "Convert Scene Grid Distances to Metric",
				help: `Whether or not scene grid distances should be converted to an approximate metric equivalent (${ConfigConsts._DISP_METRIC_FEET}; ${ConfigConsts._DISP_METRIC_MILES}).`,
				default: false,
				type: "boolean",
			},
		};
	}

	static _template_getMinimumRole ({name, help}) {
		const out = MiscUtil.copy(ConfigConsts._TEMPALTE_MINIMUM_ROLE);
		out.values = Util.Fvtt.getMinimumRolesEnum();
		out.name = name;
		out.help = help;
		return out;
	}
}

ConfigConsts._TEMPLATE_ENTITY_PERMISSIONS = {
	name: "Default Permissions",
	default: 0,
	type: "enum",
};

ConfigConsts._TEMPALTE_MINIMUM_ROLE = {
	default: 0,
	type: "enum",
	isReloadRequired: true,
};

// region Metric
ConfigConsts._DISP_METRIC_POUNDS = `1 pound \u2248 0.5 kilograms`;
ConfigConsts._DISP_METRIC_FEET = `5 feet \u2248 1.5 metres`;
ConfigConsts._DISP_METRIC_MILES = `1 mile \u2248 1.6 kilometres`;
// endregion

// region Compendiums
ConfigConsts.SRD_COMPENDIUMS_CREATURES = ["dnd5e.monsters"];
ConfigConsts.SRD_COMPENDIUMS_CREATURE_FEATURES = ["dnd5e.monsterfeatures"];
ConfigConsts.SRD_COMPENDIUMS_CLASSES = ["dnd5e.classes"];
ConfigConsts.SRD_COMPENDIUMS_CLASS_FEATURES = ["dnd5e.classfeatures"];
ConfigConsts.SRD_COMPENDIUMS_ITEMS = ["dnd5e.items", "dnd5e.tradegoods"];
ConfigConsts.SRD_COMPENDIUMS_SPELLS = ["dnd5e.spells"];
ConfigConsts.SRD_COMPENDIUMS_OPTIONAL_FEATURES = ["dnd5e.classfeatures"];
ConfigConsts.SRD_COMPENDIUMS_RACES_AND_FEATURES = ["dnd5e.races"];
// endregion

// region Constants
ConfigConsts.C_ART_IMAGE_MODE_TOKEN = 0;
ConfigConsts.C_ART_IMAGE_MODE_TILE = 1;
ConfigConsts.C_ART_IMAGE_MODE_NOTE = 2;
ConfigConsts.C_ART_IMAGE_MODE_SCENE = 3;

ConfigConsts.C_ART_IMAGE_SAVE_MODE__DEFAULT = 0;
ConfigConsts.C_ART_IMAGE_SAVE_MODE__ALWAYS = 1;
ConfigConsts.C_ART_IMAGE_SAVE_MODE__NEVER = 2;

ConfigConsts.C_IMPORT_DEDUPE_MODE_NONE = 0;
ConfigConsts.C_IMPORT_DEDUPE_MODE_SKIP = 1;
ConfigConsts.C_IMPORT_DEDUPE_MODE_OVERWRITE = 2;

ConfigConsts.C_IMPORT_DRAG_DROP_MODE_NEVER = 0;
ConfigConsts.C_IMPORT_DRAG_DROP_MODE_PROMPT = 1;
ConfigConsts.C_IMPORT_DRAG_DROP_MODE_ALWAYS = 2;

ConfigConsts.C_CREATURE_NAMETAGS_CR = 0;
ConfigConsts.C_CREATURE_NAMETAGS_TYPE = 1;
ConfigConsts.C_CREATURE_NAMETAGS_TYPE_WITH_TAGS = 2;

ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM = "sheetItem";
ConfigConsts.C_SPELL_POINTS_RESOURCE__ATTRIBUTE_CUSTOM = "attributeCustom";

ConfigConsts.C_ITEM_ATTUNEMENT_NONE = 0;
ConfigConsts.C_ITEM_ATTUNEMENT_REQUIRED = 1;
ConfigConsts.C_ITEM_ATTUNEMENT_ATTUNED = 2;

ConfigConsts.C_ITEM_ATTUNEMENT_NEVER = 0;
ConfigConsts.C_ITEM_ATTUNEMENT_SMART = 1;
ConfigConsts.C_ITEM_ATTUNEMENT_ALWAYS = 2;

ConfigConsts.C_USE_GAME_DEFAULT = "VE_USE_GAME_DEFAULT";
ConfigConsts.C_USE_PLUT_VALUE = "VE_USE_MODULE_VALUE";
ConfigConsts.C_BOOL_DISABLED = 0;
ConfigConsts.C_BOOL_ENABLED = 1;

ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_CHAPTER = 0;
ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_CONTENTS = 1;
ConfigConsts.C_IMPORT_ADVBOOK_JOURNAL_SPLIT_STRATEGY_HEADINGS = 2;

ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_NONE = 0;
ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_STANDARD = 1;
ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_GM = 2;
ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_BLIND = 3;
ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_SELF = 4;
ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_HIDDEN = 5;
ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_MIN = 6;
ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_MAX = 7;
// endregion

ConfigConsts.DEFAULT_CONFIG_ = {
	ui: {
		name: "UI",
		settings: {
			isStreamerMode: {
				name: "Streamer Mode",
				help: `Remove identifiable 5etools/Plutonium references from the UI, and replaces them with "SRD Enhanced."`,
				default: false,
				type: "boolean",
				isReloadRequired: true,
				isPlayerEditable: true,
			},
			isShowPopout: {
				name: "Enable Sheet Popout Buttons",
				help: `Add a "Popout" button to sheet headers, which opens the sheet as a popup browser window.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactWindowBar: {
				name: "Compact Header Buttons",
				help: `Combine the Plutonium-specific header buttons into a single dropdown, and re-style other header buttons to match.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactDirectoryButtons: {
				name: "Compact Directory Buttons",
				help: `Reduce the height of "Create X"/"Create Folder" buttons in the directory, to offset the additional space requirements of Plutonium's UI.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactChat: {
				name: "Compact Chat",
				help: "Make various tweaks to the appearance of chat, in order to fit more on-screen. Hold down SHIFT while hovering over a message to expand it, revealing its header and delete button.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactScenes: {
				name: "Compact Scenes Directory",
				help: "Reduce the height of scene thumbnails in the Scenes Directory, to fit more on-screen.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactActors: {
				name: "Compact Actors Directory",
				help: "Reduce the height of Actors Directory directory items, to fit more on-screen.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactItems: {
				name: "Compact Items Directory",
				help: "Reduce the height of Items Directory directory items, to fit more on-screen.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactJournal: {
				name: "Compact Journal Entries",
				help: "Reduce the height of Journal Entries directory items, to fit more on-screen.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactTables: {
				name: "Compact Rollable Tables",
				help: "Reduce the height of Rollable Tables directory items, to fit more on-screen.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactCards: {
				name: "Compact Card Stacks",
				help: "Reduce the height of Card Stacks directory items, to fit more on-screen.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isCompactMacros: {
				name: "Compact Macros",
				help: "Reduce the height of Macro directory items, to fit more on-screen.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isHidePlutoniumDirectoryButtons: {
				name: "Hide Directory Buttons",
				help: `Hide the Plutonium directory buttons.`,
				default: false,
				type: "boolean",
			},
			isNameTabFromScene: {
				name: "Prepend Active Scene Name to Browser Tab Name",
				help: "Sets the browser tab name to be that of the currently-active scene.",
				default: true,
				type: "boolean",
			},
			tabNameSuffix: {
				name: "Tab Name Suffix",
				help: `Requires the "Name Browser Tab After Active Scene" option to be enabled. A custom name suffix to append to the scene name displayed in the tab (separated by a Foundry-style bullet character).`,
				default: null,
				isNullable: true,
				type: "string",
			},
			isDisplayBackendStatus: {
				name: "Display Detected Backend",
				help: `Adds a cool green hacker tint to the Foundry "anvil" logo in the top-left corner of the screen if Plutonium's backend is detected.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isExpandActiveEffectConfig: {
				name: "Enhance Active Effect Config UI",
				help: `Adds a list of potential active effect attribute keys to the Configure Active Effect window's "Effects" tab, and a field for configuring priority.`,
				default: true,
				type: "boolean",
				compatibilityModeValues: {
					[UtilCompat.MODULE_DAE]: false,
				},
			},
			isAddDeleteToSceneNavOptions: {
				name: `Add "Delete" to Navbar Scene Context Menu`,
				help: `Adds a "Delete" option to the context menu found when right-clicking a scene in the navigation bar. Note that this does not include the currently-active scene.`,
				default: true,
				type: "boolean",
			},
		},
		settingsAdvanced: {
			isHideGmOnlyConfig: {
				name: "Hide GM-Only Config",
				help: `If enabled, a player viewing the config will see only the limited subset of settings they are allowed to modify. If disabled, a player viewing the config will see all settings, regardless of whether or not they can modify those settings.`,
				default: true,
				type: "boolean",
			},
			isDisableLargeImportWarning: {
				name: "Disable Large Import Warning",
				help: `Disable the warning confirmation dialogue shown when importing a large number of entities.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
		settingsHacks: {
			isFastAnimations: {
				name: "Fast Animations",
				help: "Increase the speed of various UI animations.",
				// N.B.: avoid making this default, as it causes sheet "close()" calls to mysteriously fail to set the
				//   sheet "_state" flag to CLOSED (instead leaving them on CLOSING) for some users. Was unable to
				//   reproduce, but having users run:
				//   `CONFIG.Actor.collection.instance.forEach(it => Object.values(it.apps).forEach(it => it._state = it._state === -2 ? -1 : it._state))`
				//   successfully "unstuck" their sheets.
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			isFixEscapeKey: {
				name: "Fix ESC Key",
				help: `Bind the "Escape" key to (in this order): de-select active input fields; de-select selected canvas elements; close context menus; close individual windows in most-recently-active-first order; toggle the main menu.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isAddOpenMainMenuButtonToSettings: {
				name: `Add "Open Game Menu" Button if &quot;Fix ESC Key&quot; Is Enabled`,
				help: `Add an alternate "Open Game Menu" button to the Settings tab if the "Fix ESC Key" Config option is enabled. This allows you to quickly open the main menu without first having to close all open windows.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isFixDrawingFreehandMinDistance: {
				name: "Fix Freehand Drawing Minimum Distance",
				help: `Reduce the minimum mouse movement distance required to start a freehand drawing.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isEnableIncreasedFolderDepth: {
				name: "Render >3 Levels of Folder Nesting",
				help: `If enabled, Foundry's default folder nesting limit (of 3) will be bypassed, for the purpose of rendering directories. Note that this does not necessarily allow you to create additionally-nested folders without using the game API.`,
				default: true,
				type: "boolean",
			},
			isEnableFolderNameWrap: {
				name: "Wrap Long Folder Names",
				help: `Wrap long folder names over multiple lines, instead of clipping the name.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			isEnableSubPopouts: {
				name: "Allow Popout Chaining",
				help: `Automatically pop out apps opened from within popped-out apps. If disabled, apps opened from within popped-out apps will appear in the main window, instead.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isLazyActorAndItemRendering: {
				name: "Minimize Actor/Item Re-Renders",
				help: `If enabled, actor/item sheet re-rendering will be skipped where possible. This may reduce UI flickering, and may reduce unexpected input deselection when tabbing or clicking through fields. It may also horribly break your game, and is not expected to work with anything except default dnd5e sheets. Use with caution.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
				isReloadRequired: true,
			},
			isAlwaysResizableApps: {
				name: "Default Resizeable Applications",
				help: `If enabled, applications will be resizeable by default. Note that specific applications may still override this.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
	},
	tokens: {
		name: "Tokens",
		settings: {
			isDisplayDamageDealt: {
				name: "Display Missing Health",
				help: `This allows players to see "damage dealt" to a token, without revealing the token's total health. If enabled, each token's missing health is displayed as a number in the bottom-right corner of the token.`,
				default: false,
				type: "boolean",
			},
			damageDealtBloodiedThreshold: {
				name: `Display Missing Health &quot;Wounded&quot; Threshold`,
				help: `The health-loss threshold at which the Missing Health text turns red.`,
				default: 0.5,
				type: "percentage",
				min: 0.0,
				max: 1.0,
			},
			nameplateFontSizeMultiplier: {
				name: "Font Size Multiplier",
				help: `A multiplier which is applied to token nameplate/tooltip font size, e.g. a value of "0.5" will decrease token nameplate/tooltip font size by half.`,
				default: null,
				type: "number",
				placeholder: "(Use default)",
				min: 0.1,
				max: 10,
				isNullable: true,
			},
			isAllowNameplateFontWrap: {
				name: "Allow Text Wrap",
				help: `If enabled, token nameplate/tooltip text will wrap.`,
				default: ConfigConsts.C_USE_GAME_DEFAULT,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_USE_GAME_DEFAULT,
						name: "Use Foundry default",
					},
					{
						value: false,
						name: "Disabled",
					},
					{
						value: true,
						name: "Enabled",
					},
				],
			},
			nameplateFontWrapWidthMultiplier: {
				name: "Text Wrap Max Width Multiplier",
				help: `A multiplier which is applied to token nameplate/tooltip text wrapping maximum size, e.g. a value of "0.5" will force token nameplates/tooltips to wrap at half their usual length. The base value to which this multiplier is applied is: "2.5 × token width".`,
				default: null,
				type: "number",
				placeholder: "(Use default)",
				min: 0.1,
				max: 10,
				isNullable: true,
			},
			npcHpRollMode: {
				name: "NPC HP Roll Mode",
				help: `Determines whether or not token HP, for NPC tokens which are not linked to their actor's data, should be rolled upon token creation. If a mode other than "None" is selected, and the token has a valid HP dice formula, the token will roll for HP. For example, a Goblin (7 HP; formula is 2d6) could be created with anywhere between 2 and 12 HP (inclusive).`,
				default: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_NONE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_NONE,
						name: `None`,
						help: `Do not roll NPC token health.`,
					},
					{
						value: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_STANDARD,
						name: `Standard Roll`,
					},
					{
						value: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_GM,
						name: `GM Roll`,
					},
					{
						value: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_BLIND,
						name: `Blind Roll`,
					},
					{
						value: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_SELF,
						name: `Self Roll`,
					},
					{
						value: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_HIDDEN,
						name: `Hidden Roll`,
						help: `Roll NPC token health, but do not post the result to chat.`,
					},
					{
						value: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_MIN,
						name: `Minimum Value`,
						help: `Use the minimum possible roll value.`,
					},
					{
						value: ConfigConsts.C_TOKEN_NPC_HP_ROLL_MODE_MAX,
						name: `Maximum Value`,
						help: `Use the maximum possible roll value.`,
					},
				],
			},
			isFastAnimations: {
				name: "Disable Animations",
				help: "Disable token animations.",
				default: false,
				type: "boolean",
			},
		},
		settingsHacks: {
			isDisableFastAnimationsForWaypointMovement: {
				name: "Avoid Disabling Animations for Ruler Movement",
				help: `Suppresses the "Disable Animations" option for a token being moved via ruler waypoints (i.e. when CTRL-dragging from a token and pressing SPACE). Note that dismissing the ruler during the move will end this suppression.`,
				default: true,
				type: "boolean",
			},
		},
	},
	import: {
		name: "Import",
		settings: {
			isAddSourceToName: {
				name: "Add Source to Names",
				help: `If the source of each imported entry (e.g. "MM" for Monster Manual) should be appended to the name of the entry.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			isAddPageNumberToSource: {
				name: "Add Page Numbers to Sources",
				help: `If the page number (where available) of each imported entry should be appended to the "source" field of the entry.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			isRenderLinksAsTags: {
				name: `Render Links as &quot;@tag&quot;s`,
				help: `If links found in description text should be rendered as Plutonium-specific @tag syntax, e.g. a link to "goblin" would be rendered as "@creature[goblin|mm]". (By default, a link to the 5etools page will be rendered instead.)`,
				default: true,
				type: "boolean",
			},
			isRendererLinksDisabled: {
				name: "Disable 5etools Links",
				help: `Prevents links to other 5etools content from being added to the text of imported 5etools content.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			isRendererDiceDisabled: {
				name: "Render Dice as Plain Text",
				help: `Forces dice expressions, usually rendered as "[[/r XdY + Z ...]", to be rendered as plain text when importing 5etools content.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			deduplicationMode: {
				name: "Duplicate Handling Mode",
				help: `Determines what action is taken when importing duplicate content to a directory or compendium. An entity is considered a duplicate if and only if its name and source match an existing entity. Note that this does not function when importing to actor sheets.`,
				default: ConfigConsts.C_IMPORT_DEDUPE_MODE_NONE,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_IMPORT_DEDUPE_MODE_NONE,
						name: `None`,
						help: `No deduplication is done.`,
					},
					{
						value: ConfigConsts.C_IMPORT_DEDUPE_MODE_SKIP,
						name: `Skip duplicates`,
						help: `If a duplicate is found for a would-be imported entity, that entity is not imported.`,
					},
					{
						value: ConfigConsts.C_IMPORT_DEDUPE_MODE_OVERWRITE,
						name: `Update existing`,
						help: `If a duplicate is found for a would-be import entity, the existing entity is updated.`,
					},
				],
			},
			minimumRole: ConfigConsts._template_getMinimumRole({
				name: "Minimum Permission Level for Import",
				help: `"Import" buttons will be hidden for any user with a role less than the chosen role.`,
			}),
			dragDropMode: {
				name: "Use Importer when Drag-Dropping Items to Actors",
				help: `Some Foundry items (backgrounds, races, spells, items, etc.), when imported via Plutonium and later drag-dropped to an actor sheet, have special handling allowing for greater functionality (such as populating skills and features). This allows you to control whether or not that special handling is used, rather than the baseline Foundry drag-drop. Note that if you modify an item, the changes will not be reflected in the version imported to the sheet by Plutonium.`,
				default: ConfigConsts.C_IMPORT_DRAG_DROP_MODE_PROMPT,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_IMPORT_DRAG_DROP_MODE_NEVER,
						name: `Never`,
					},
					{
						value: ConfigConsts.C_IMPORT_DRAG_DROP_MODE_PROMPT,
						name: `Prompt`,
					},
					{
						value: ConfigConsts.C_IMPORT_DRAG_DROP_MODE_ALWAYS,
						name: `Always`,
					},
				],
				isPlayerEditable: true,
			},
			isUseOtherFormulaFieldForSaveHalvesDamage: {
				name: `Treat &quot;Save Halves&quot; Additional Attack Damage as &quot;Other Formula&quot;`,
				help: `This moves extra attack damage rolls (for example, the poison damage done by a Giant Spider's bite) to the "Other Formula" dice field, which can improve compatibility with some modules.`,
				default: false,
				type: "boolean",
			},
			isGlobalMetric: {
				name: "Prefer Metric (Where Available)",
				help: `If enabled, metric units will be preferred, where the importer supports them. Enabling this option effectively overrides all other metric options, causing the importer to treat each as though it was enabled.`,
				default: false,
				type: "boolean",
			},
			isShowVariantsInLists: {
				name: "Show Variants/Versions",
				help: `If variants/versions of base entries should be shown in list views (with grayed-out names).`,
				default: true,
				type: "boolean",
			},
			isSaveImagesToServer: {
				name: "Save Imported Images to Server",
				help: `If images referenced in imported content should be saved to your server files, rather than referenced from an external server.`,
				default: false,
				type: "boolean",
			},
			isSaveTokensToServer: {
				name: "Save Imported Tokens to Server",
				help: `If tokens for imported actors should be saved to your server files, rather than referenced from an external server.`,
				default: true,
				type: "boolean",
			},
			localImageDirectoryPath: {
				name: "Image/Token Directory",
				help: `The sub-directory of the "User Data" directory where imported images/tokens will be saved to when using the "Save Imported Images to Server" option or the "Save Imported Tokens to Server" option. If the "Use Local Images" option is enabled, images will be loaded from this directory by default.`,
				default: `assets/${SharedConsts.MODULE_NAME_FAKE}`,
				type: "string",
			},
			isPreferFoundryImages: {
				name: "Prefer Foundry/System Images",
				help: `If enabled, portraits for actors and images for items will be sourced from built-in compendiums first, then Plutonium second. If disabled, portraits/images will be sourced from Plutonium first, then built-in compendiums second.`,
				default: false,
				type: "boolean",
			},
			isPreferFoundryTokens: {
				name: "Prefer Foundry/System Tokens",
				help: `If enabled, tokens will be sourced from built-in compendiums first, then Plutonium second. If disabled, tokens will be sourced from Plutonium first, then built-in compendiums second.`,
				default: false,
				type: "boolean",
			},
			isLoadLocalHomebrewIndex: {
				name: "Load Local Homebrew",
				help: `If enabled, the directory specified by the "Local Homebrew Directory" option will be read, and its contents added to the list of available sources.`,
				default: false,
				type: "boolean",
			},
			localHomebrewDirectoryPath: {
				name: "Local Homebrew Directory",
				help: `The sub-directory of the "User Data" directory from which homebrew should be automatically loaded if the "Load Local Homebrew" option is enabled.`,
				default: `assets/homebrew`,
				type: "string",
			},
			isUseLocalHomebrewIndexJson: {
				name: `Use <code>index.json</code> for Local Homebrew`,
				help: `If, rather than read the local homebrew directory directly, an "index.json" file should be read when loading local homebrew. This file should be of the form: {"toImport": [ ... list of filenames ... ]}. Note that this is required if players do not have "Use File Browser" permissions.`,
				default: false,
				type: "boolean",
			},
			localHomebrew: {
				name: "Additional Homebrew Files",
				help: `Homebrew files which should be automatically loaded and added to the list of available sources.`,
				default: [],
				type: "arrayStringShort",
				isCaseSensitive: true,
			},
		},
		settingsAdvanced: {
			baseSiteUrl: {
				name: "Base Site URL",
				help: `The root server URL from which to load data and source images, and to link in rendered text. Note that, where possible, the module will use its own built-in data files, rather than call out to a remote server.`,
				type: "url",
				default: null,
				isNullable: true,
				isReloadRequired: true,
			},
			isNoLocalData: {
				name: "Avoid Loading Local Data",
				help: `If enabled, any data which would normally be loaded from the module's local copies is instead loaded from the sites URL (which may be customised by editing the "Base Site Url" config option).`,
				default: false,
				type: "boolean",
			},
			isNoHomebrewIndexes: {
				name: "Avoid Loading Homebrew Indexes on Startup",
				help: `If enabled, homebrew repository indexes won't be loaded during initial module load. This will effectively prevent any homebrew sources from appearing in source listings. Note that these indexes are loaded in the background/asynchronously during normal operation, so should not negatively impact game load times, unless you have a particularly terrible internet connection.`,
				default: false,
				type: "boolean",
			},
			isUseLocalImages: {
				name: "Use Local Images",
				help: `If enabled, images will be sourced from the "Image/Token Directory" directory, defined above.`,
				default: false,
				type: "boolean",
			},
			isStrictMatching: {
				name: "Use Strict Entity Matching",
				help: `If enabled, any Plutonium feature which searches for existing data (for example, the class importer attempting to find existing class levels in a given class) will match by name and source. If disabled, only name is used.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			baseBrewUrl: {
				name: "Base Homebrew Repository URL",
				help: `The root GitHub repository URL from which to load data and source images, and to link in rendered text, when importing homebrew content.`,
				type: "url",
				default: null,
				isNullable: true,
				isReloadRequired: true,
			},
			tempFolderName: {
				name: "Temp Folder Name",
				help: `The name of a temporary folder created/deleted by some operations. Note that the importer will delete this folder regardless of its contents, as anything contained within it is assumed to be a temporary entity created by the importer.`,
				type: "string",
				default: "Temp",
			},
		},
	},
	importCreature: {
		name: "Import (Creatures)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported creature.`),
			isImportBio: {
				name: "Import Fluff to Biography",
				help: `If enabled, any fluff text which is available for a creature will be imported into that creature's biography.`,
				default: true,
				type: "boolean",
			},
			isImportBioImages: {
				name: "Include Fluff Image in Biography",
				help: `If enabled, any fluff image which is available for a creature will be imported into that creature's biography.`,
				default: false,
				type: "boolean",
			},
			isImportBioVariants: {
				name: "Include Variants in Biography",
				help: `If enabled, any inset variant boxes associated with a creature will be imported into that creature's biography.`,
				default: true,
				type: "boolean",
			},
			isImportVariantsAsFeatures: {
				name: "Import Variants as Features",
				help: `If enabled, any inset variant boxes associated with a creature will be imported into that creature's features.`,
				default: false,
				type: "boolean",
			},
			isSecretWrapAttacks: {
				name: `&quot;Secret&quot; Attack Descriptions`,
				help: `If enabled, creature attack descriptions will be wrapped in "Secret" blocks, which are not shown when rolling.`,
				default: false,
				type: "boolean",
			},
			...ConfigConsts._template_getTokenSettings(),
			itemWeightAndValueSizeScaling: {
				name: "Item Weight & Value Scaling",
				help: `The method by which to scale the weights and values of non-standard-sizes items carried by creatures.`,
				default: 1,
				type: "enum",
				values: [
					{
						value: 1,
						name: "No scaling",
					},
					{
						value: 2,
						name: `"Barding" scaling (multiplicative)`,
						help: `Based on the rules for calculating the weight and cost of barding, as presented in the Player's Handbook (p. 155).`,
					},
					{
						value: 3,
						name: `"Gurt's Greataxe" scaling (exponential)`,
						help: `Based on the giant-size greateaxe of the same name found in Storm King's Thunder (p. 234).`,
					},
				],
			},
			isMetric: {
				name: "Convert Speeds to Metric",
				help: `Whether or not creature speed units should be converted to an approximate metric equivalent (${ConfigConsts._DISP_METRIC_FEET}).`,
				default: false,
				type: "boolean",
			},
			spellcastingPrimaryTraitMode: {
				name: "Spellcasting Primary Trait Selection Method",
				help: `The method by which a primary spellcasting trait (i.e., the spellcasting trait used to set spellcasting ability, spell DC, and spell attack bonus) is selected if a creature has multiple spellcasting traits with associated ability scores.`,
				default: 1,
				type: "enum",
				values: [
					{
						value: 1,
						name: "Highest spell count",
						help: `Use whichever spellcasting trait has the most spells listed.`,
					},
					{
						value: 2,
						name: `Highest ability score`,
						help: `Use whichever spellcasting trait has the highest associated ability score. Note that this may prefer innate spellcasting traits over spellcasting class levels.`,
					},
				],
			},
			nameTags: {
				name: "Add Tag Suffixes to Names",
				help: `Add tags to an imported creature's name, to allow easier searching (especially within compendiums).`,
				default: {
					[ConfigConsts.C_CREATURE_NAMETAGS_CR]: false,
					[ConfigConsts.C_CREATURE_NAMETAGS_TYPE]: false,
					[ConfigConsts.C_CREATURE_NAMETAGS_TYPE_WITH_TAGS]: false,
				},
				type: "multipleChoice",
				choices: [
					"Add [CR] tag",
					"Add [type] tag",
					"Add [type (with tags)] tag",
				],
			},
		},
		settingsAdvanced: {
			additionalDataCompendium: {
				name: "Additional Data Compendiums",
				help: `A comma-separated list of compendiums that the creature importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_CREATURES.join(", "),
				type: "string",
				isNullable: true,
			},
			additionalDataCompendiumFeatures: {
				name: "Additional Data Compendiums (Features)",
				help: `A comma-separated list of compendiums that the creature importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_CREATURE_FEATURES.join(", "),
				type: "string",
				isNullable: true,
			},
			isUseTokenImageAsPortrait: {
				name: "Use Token Image as Portrait",
				help: `If enabled, a creature's token image will be preferred over its portrait image when populating its sheet portrait during import.`,
				default: false,
				type: "boolean",
			},
			isUseStaticAc: {
				name: "Use Static AC Values",
				help: `If enabled, creature AC will be imported as a static number (rather than relying on the sheet's formula calculation), and creature armor will be imported as unequipped.`,
				default: false,
				type: "boolean",
			},
			isUseCustomNaturalAc: {
				name: "Use Custom Natural Armor Formula",
				help: `If enabled, creatures with natural armor will have their armor formula broken down as "@attributes.ac.base + @abilities.dex.mod + <naturalBonus>", allowing any later Dexterity score changes to be reflected in the creatures AC.`,
				default: false,
				type: "boolean",
			},
		},
	},
	importVehicle: {
		name: "Import (Vehicles)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported vehicle.`),
			...ConfigConsts._template_getTokenSettings(),
			isMetric: {
				name: "Convert Speeds to Metric",
				help: `Whether or not vehicle speed units should be converted to an approximate metric equivalent (${ConfigConsts._DISP_METRIC_FEET}; ${ConfigConsts._DISP_METRIC_MILES}).`,
				default: false,
				type: "boolean",
			},
			isImportBio: {
				name: "Import Fluff to Description",
				help: `If enabled, any fluff text which is available for a vehicle will be imported into that vehicle's description.`,
				default: true,
				type: "boolean",
			},
			isImportBioImages: {
				name: "Include Fluff Image in Description",
				help: `If enabled, any fluff image which is available for a vehicle will be imported into that creature's description.`,
				default: false,
				type: "boolean",
			},
		},
		settingsAdvanced: {
			additionalDataCompendium: {
				name: "Additional Data Compendiums",
				help: `A comma-separated list of compendiums that the vehicle importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: "",
				type: "string",
				isNullable: true,
			},
			isUseTokenImageAsPortrait: {
				name: "Use Token Image as Portrait",
				help: `If enabled, a vehicle's token image will be preferred over its portrait image when populating its sheet portrait during import.`,
				default: false,
				type: "boolean",
			},
		},
	},
	importVehicleUpgrade: {
		name: "Import (Vehicle Upgrades)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported vehicle upgrades.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a vehicle upgrade's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importObject: {
		name: "Import (Objects)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported object.`),
			...ConfigConsts._template_getTokenSettings(),
			isMetric: {
				name: "Convert Speeds to Metric",
				help: `Whether or not object speed units should be converted to an approximate metric equivalent (${ConfigConsts._DISP_METRIC_FEET}).`,
				default: false,
				type: "boolean",
			},
		},
	},
	importFeat: {
		name: "Import (Feats)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported feat.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a feat's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importBackground: {
		name: "Import (Backgrounds)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported background.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a background's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importClass: {
		name: "Import (Classes)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported class or subclass.`),
			isAddUnarmedStrike: {
				name: "Add Unarmed Strike",
				help: `If enabled, importing a class to an actor will create an "Unarmed Strike" weapon, unless one already exists.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			isImportClassTable: {
				name: "Import Class Table to Description",
				help: `If enabled, a class's table will be imported as part of the class item's description.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isAddLevelUpButton: {
				name: `Add &quot;Level Up&quot; Button to Character Sheets`,
				help: `If enabled, a "Level Up" button will be displayed in the top-right corner of a character's sheet (assuming the default dnd5e sheet is used).`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isSetXp: {
				name: "Set Minimum Actor XP on Class Import",
				help: `If enabled, during class import, actor XP will be set to the minimum XP value required for the actor's new level, if the actor's current XP is insufficient for them to reach their new level.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
		settingsAdvanced: {
			additionalDataCompendium: {
				name: "Additional Data Compendiums (Classes)",
				help: `A comma-separated list of compendiums that the class importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_CLASSES.join(", "),
				type: "string",
				isNullable: true,
			},
			additionalDataCompendiumFeatures: {
				name: "Additional Data Compendiums (Features)",
				help: `A comma-separated list of compendiums that the class importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_CLASS_FEATURES.join(", "),
				type: "string",
				isNullable: true,
			},
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a class's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importClassSubclassFeature: {
		name: "Import (Class & Sub Features)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported class/subclass feature.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a class/subclass feature's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importItem: {
		name: "Import (Items)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported item.`),
			isAddActiveEffects: {
				name: "Populate Active Effects",
				help: `If items should have active effects created during import.`,
				default: true,
				type: "boolean",
				// No player editable, since calculations are different with/without this option
			},
			isMetric: {
				name: "Convert Item Weights and Ranges to Metric",
				help: `Whether or not item weight and range units should be converted to an approximate metric equivalent (${ConfigConsts._DISP_METRIC_POUNDS}; ${ConfigConsts._DISP_METRIC_FEET}).`,
				default: false,
				type: "boolean",
			},
			inventoryStackingMode: {
				name: "Inventory Stacking Mode",
				help: `If imported items should "stack" with existing items when imported to an actor's inventory. If stacking is allowed, the importer will check for an existing item when importing an item to an actor's sheet. If the item already exists, the importer will increase the quantity of that item in the actor's inventory, rather than create a new copy of the item in the actor's inventory.`,
				default: ConfigConsts.C_ITEM_ATTUNEMENT_SMART,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_ITEM_ATTUNEMENT_NEVER,
						name: `Never Stack`,
					},
					{
						value: ConfigConsts.C_ITEM_ATTUNEMENT_SMART,
						name: `Sometimes Stack (e.g. consumables, throwables)`,
					},
					{
						value: ConfigConsts.C_ITEM_ATTUNEMENT_ALWAYS,
						name: `Always Stack`,
					},
				],
			},
			isSplitPacksActor: {
				name: "Import Packs to Actors as Constituent Items",
				help: `If "pack" items (explorer's pack, dungeoneer's pack) should be broken down and imported as their constituent items when importing to an actor's items.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			isSplitAtomicPacksActor: {
				name: "Import Item Stacks to Actors as Constituent Items",
				help: `If an item which is formed of multiple constituent items of the same type, such as "Bag of Ball Bearings (1,000)", should be split up into its constituent items (a "Ball Bearing" item with its sheet quantity set to 1,000, in this example).`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			throwables: {
				name: "Throwing Items",
				help: `A list of items which are imported with their usage set to deplete their own quantity when used.`,
				default: ["Handaxe", "Javelin", "Light Hammer", "Dart", "Net"],
				type: "arrayStringShort",
				isPlayerEditable: true,
			},
			attunementType: {
				name: "Attunement Type for Attunable Items",
				help: `The attunement type to use when importing an item which can be attuned.`,
				default: ConfigConsts.C_ITEM_ATTUNEMENT_REQUIRED,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_ITEM_ATTUNEMENT_NONE,
						name: `None`,
					},
					{
						value: ConfigConsts.C_ITEM_ATTUNEMENT_REQUIRED,
						name: `Attunement required`,
					},
					{
						value: ConfigConsts.C_ITEM_ATTUNEMENT_ATTUNED,
						name: `Attuned`,
					},
				],
			},
			isImportDescriptionHeader: {
				name: "Include Damage, Properties, Rarity, and Attunement in Description",
				help: `If enabled, an imported item's description will include text generated from its rarity, attunement requirements, damage, and other properties.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
		settingsAdvanced: {
			additionalDataCompendium: {
				name: "Additional Data Compendiums",
				help: `A comma-separated list of compendiums that the item importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_ITEMS.join(", "),
				type: "string",
				isNullable: true,
			},
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, an item's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importPsionic: {
		name: "Import (Psionics)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported psionic.`),
			psiPointsResource: {
				name: "Psi Points Resource",
				help: `The resource consumed by psionics.`,
				default: "resources.primary.value",
				type: "enum",
				values: [
					{
						value: "resources.primary",
					},
					{
						value: "resources.secondary",
					},
					{
						value: "resources.tertiary",
					},
					{
						value: ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM,
						name: `"Psi Points" sheet item`,
					},
					{
						value: ConfigConsts.C_SPELL_POINTS_RESOURCE__ATTRIBUTE_CUSTOM,
						name: `Custom (see below)`,
					},
				],
				isPlayerEditable: true,
			},
			psiPointsResourceCustom: {
				name: "Psi Points Custom Resource",
				help: `The name of the custom resource to use if "Custom" is selected for "Psi Points Resource", above. This supports modules that expand the number of available sheet resources, such as "5e-Sheet Resources Plus" (which adds e.g. "resources.fourth", "resources.fifth", ...).`,
				type: "string",
				default: null,
				isNullable: true,
				isPlayerEditable: true,
			},
			isImportAsSpell: {
				name: "Import as Spells",
				help: `If enabled, psionics will be imported as spells, rather than features.`,
				default: false,
				type: "boolean",
			},
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a psionic's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importRace: {
		name: "Import (Races)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported race.`),
			isMetric: {
				name: "Convert Speeds to Metric",
				help: `Whether or not race speed units should be converted to an approximate metric equivalent (${ConfigConsts._DISP_METRIC_FEET}).`,
				default: false,
				type: "boolean",
			},
		},
		settingsAdvanced: {
			additionalDataCompendium: {
				name: "Additional Data Compendiums (Races)",
				help: `A comma-separated list of compendiums that the race importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_RACES_AND_FEATURES.join(", "),
				type: "string",
				isNullable: true,
			},
			additionalDataCompendiumFeatures: {
				name: "Additional Data Compendiums (Features)",
				help: `A comma-separated list of compendiums that the race importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_RACES_AND_FEATURES.join(", "),
				type: "string",
				isNullable: true,
			},
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a race's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importTable: {
		name: "Import (Table)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported table.`),
		},
	},
	importSpell: {
		name: "Import (Spells)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported spell.`),
			prepareActorSpells: {
				name: "Prepare Actor Spells",
				help: "Whether or not spells that are imported to actor sheets should be prepared by default.",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			prepareSpellItems: {
				name: "Prepare Spell Items",
				help: "Whether or not spells that are imported to the items directory should be prepared by default.",
				default: false,
				type: "boolean",
			},
			actorSpellPreparationMode: {
				name: "Actor Spell Preparation Mode",
				help: `The default spell preparation mode for spells imported to actor sheets.`,
				default: "prepared",
				type: "enum",
				values: [
					{
						value: "",
						name: "(None)",
					},
					{
						value: "always",
						name: "Always Prepared",
					},
					{
						value: "prepared",
						name: "Prepared",
					},
					{
						value: "innate",
						name: "Innate Spellcasting",
					},
					{
						value: "pact",
						name: "Pact Magic",
					},
				],
				isPlayerEditable: true,
			},
			isAutoDetectActorSpellPreparationMode: {
				name: "Auto-Detect Actor Spell Preparation Mode",
				help: `If enabled, the default spell preparation mode for spells imported to actor sheets (as defined by "Actor Spell Preparation Mode") may be automatically overridden, e.g. "pact magic" is automatically used when importing to a warlock.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
			spellItemPreparationMode: {
				name: "Spell Item Preparation Mode",
				help: `The default spell preparation mode for spells imported to the items directory.`,
				default: "prepared",
				type: "enum",
				values: [
					{
						value: "",
						name: "(None)",
					},
					{
						value: "always",
						name: "Always Prepared",
					},
					{
						value: "prepared",
						name: "Prepared",
					},
					{
						value: "innate",
						name: "Innate Spellcasting",
					},
					{
						value: "pact",
						name: "Pact Magic",
					},
				],
			},
			isSpellPoints: {
				name: "Use Spell Points",
				help: `If enabled, imported spells which would use spell slots will instead be marked as "at will" and set to consume an actor's primary/secondary/tertiary resource. (The "Spell Points" variant rule can be found in the DMG, page 288.)`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
			spellPointsResource: {
				name: "Spell Points Resource",
				help: `The resource consumed by spells imported with "Use Spell Points" enabled.`,
				default: "resources.primary.value",
				type: "enum",
				values: [
					{
						value: "resources.primary",
					},
					{
						value: "resources.secondary",
					},
					{
						value: "resources.tertiary",
					},
					{
						value: ConfigConsts.C_SPELL_POINTS_RESOURCE__SHEET_ITEM,
						name: `"Spell Points" sheet item`,
					},
					{
						value: ConfigConsts.C_SPELL_POINTS_RESOURCE__ATTRIBUTE_CUSTOM,
						name: `Custom (see below)`,
					},
				],
				isPlayerEditable: true,
			},
			spellPointsResourceCustom: {
				name: "Spell Points Custom Resource",
				help: `The name of the custom resource to use if "Custom" is selected for "Spell Points Resource", above. This supports modules that expand the number of available sheet resources, such as "5e-Sheet Resources Plus" (which adds e.g. "resources.fourth", "resources.fifth", ...).`,
				type: "string",
				default: null,
				isNullable: true,
				isPlayerEditable: true,
			},
			isIncludeClassesInDescription: {
				name: "Include Caster Classes in Spell Description",
				help: `If enabled, an imported spell's description will include the list of classes which have the spell on their spell list.`,
				default: false,
				type: "boolean",
			},
			isMetric: {
				name: "Convert Spell Ranges and Areas to Metric",
				help: `Whether or not spell range/area units should be converted to an approximate metric equivalent (${ConfigConsts._DISP_METRIC_FEET}; ${ConfigConsts._DISP_METRIC_MILES}).`,
				default: false,
				type: "boolean",
			},
			isFilterOnOpen: {
				name: "Apply Class Filter when Opening on Actor",
				help: "If enabled, and the importer is opened from an actor, the spell list will be filtered according to that actor's current class(es).",
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
		settingsAdvanced: {
			additionalDataCompendium: {
				name: "Additional Data Compendiums",
				help: `A comma-separated list of compendiums that the spell importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_SPELLS.join(", "),
				type: "string",
				isNullable: true,
			},
			setEffectDisabled: {
				name: `Override Effect &quot;Disabled&quot; Value`,
				help: `If set, overrides the "Disabled" value present on any effects tied to imported spells.`,
				type: "enum",
				default: ConfigConsts.C_USE_PLUT_VALUE,
				values: [
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
					{
						value: ConfigConsts.C_BOOL_DISABLED,
						name: `Set to "False"`,
					},
					{
						value: ConfigConsts.C_BOOL_ENABLED,
						name: `Set to "True"`,
					},
				],
			},
			setEffectTransfer: {
				name: `Override Effect &quot;Transfer&quot; Value`,
				help: `If set, overrides the "Transfer to Actor" value present on any effects tied to imported spells.`,
				type: "enum",
				default: ConfigConsts.C_USE_PLUT_VALUE,
				values: [
					{
						value: ConfigConsts.C_USE_PLUT_VALUE,
						name: "Allow importer to set",
					},
					{
						value: ConfigConsts.C_BOOL_DISABLED,
						name: `Set to "False"`,
					},
					{
						value: ConfigConsts.C_BOOL_ENABLED,
						name: `Set to "True"`,
					},
				],
			},
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a spell's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
			isSpellPointsNpc: {
				name: "Use Spell Points (NPCs)",
				help: `If enabled, a spell imported to an NPC import will be marked as "at will" and set to consume a sheet resource. (The "Spell Points" variant rule can be found in the DMG, page 288.)`,
				default: false,
				type: "boolean",
			},
		},
	},
	importRule: {
		name: "Import (Rules)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported rule.`),
		},
	},
	importLanguage: {
		name: "Import (Languages)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported language.`),
		},
	},
	importOptionalFeature: {
		name: "Import (Options & Features)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported option/feature.`),
		},
		settingsAdvanced: {
			additionalDataCompendium: {
				name: "Additional Data Compendiums",
				help: `A comma-separated list of compendiums that the optional feature importer will attempt to pull additional data (including art) from rather than use the default Plutonium icons.`,
				default: ConfigConsts.SRD_COMPENDIUMS_OPTIONAL_FEATURES.join(", "),
				type: "string",
				isNullable: true,
			},
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, an optional feature's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importConditionDisease: {
		name: "Import (Conditions & Diseases)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported condition/diseases.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a condition/disease's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importCultBoon: {
		name: "Import (Cults & Supernatural Boons)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported cult/boon.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a cult/boon's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importAction: {
		name: "Import (Actions)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported action.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a action's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importReward: {
		name: "Import (Gifts & Rewards)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported supernatural gift/reward.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a supernatural gift/reward's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importCharCreationOption: {
		name: "Import (Char. Creation Options)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported character creation option.`),
		},
		settingsAdvanced: {
			isImportDescription: {
				name: "Import Text as Description",
				help: `If enabled, a character creation option's text will be imported as item description.`,
				default: true,
				type: "boolean",
			},
		},
	},
	importDeity: {
		name: "Import (Deities)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported deity.`),
		},
	},
	importRecipe: {
		name: "Import (Recipes)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported recipe.`),
		},
	},
	importTrap: {
		name: "Import (Traps)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported trap.`),
			...ConfigConsts._template_getTokenSettings(),
		},
	},
	importHazard: {
		name: "Import (Hazards)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported hazard.`),
		},
	},
	importAdventure: {
		name: "Import (Adventures)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported adventure.`),
			...ConfigConsts._template_getAdventureBookSettings(),
			isUseModdedInstaller: {
				name: "Use Modded Package Installer",
				help: `If the modded Plutonium backend is installed, adventure packages (modules/worlds) will be installed, automatically, using the mod, rather than providing you with a list of links to copy-paste into Foundry's "Setup".`,
				type: "boolean",
				default: false,
			},
			isUseLegacyImporter: {
				name: "Enable Legacy Package Importer",
				help: `If Plutonium should allow adventure packages (modules/worlds) to be imported directly, rather than providing references for the user to investigate themselves.`,
				type: "boolean",
				default: false,
				unlockCode: "unlock",
			},
			indexUrl: {
				name: "Package Index URL",
				help: `The URL of the index file from which world/module package metadata is loaded.`,
				type: "url",
				// Alternate link: `https://raw.githubusercontent.com/DMsGuild201/Foundry_Resources/master/worlds/index.json`
				default: "https://foundry.5e.tools/plutonium/index.json",
				isReloadRequired: true,
			},
		},
	},
	importBook: {
		name: "Import (Books)",
		settings: {
			permissions: ConfigConsts._template_getEntityPermissions(`The default (i.e. used for all players unless a player-specific permission level is set) permissions for an imported book.`),
			...ConfigConsts._template_getAdventureBookSettings(),
		},
	},
	importMap: {
		name: "Import (Maps)",
		settings: {
			...ConfigConsts._template_getSceneImportSettings(),
		},
	},
	actor: {
		name: "Actors",
		settings: {
			isRefreshOtherOwnedSheets: {
				name: `Refresh Sheets using &quot;@${SharedConsts.MODULE_NAME_FAKE}.userchar&quot; when Updating Player Character`,
				help: `Player only. If enabled, when you update your character, the sheets of other actors you control which use "@${SharedConsts.MODULE_NAME_FAKE}.userchar. ..." attributes will be automatically refreshed to reflect any changes made to your character. If disabled, you may notice a "lag" between updating your character and seeing the changes reflected in other sheets (a refresh can be forced manually by editing any field on the other sheet, or refreshing your browser tab).`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
		settingsHacks: {
			isAutoMultiattack: {
				name: "Auto-Roll Multiattacks",
				help: `Attempt to detect and automatically roll components of a creature's "Multiattack" sheet item on activation.`,
				default: false,
				type: "boolean",
				compatibilityModeValues: {
					[UtilCompat.MODULE_MIDI_QOL]: false,
				},
			},
			isUseExtendedActiveEffectsParser: {
				name: "Support Variables in Active Effect Values",
				help: `Allows the use of roll syntax, and notably variables (such as "@abilities.dex.mod"), in active effect values.`,
				default: true,
				type: "boolean",
				compatibilityModeValues: {
					[UtilCompat.MODULE_DAE]: false,
				},
			},
		},
	},
	rivet: {
		name: "Rivet",
		settings: {
			targetActorId: {
				name: "Target Actor",
				help: `The ID of an actor to which Rivet content should be imported.`,
				default: "",
				type: "string",
				isPlayerEditable: true,
			},
			isDisplayStatus: {
				name: "Display Extension Detected",
				help: `Adds a "paper plane" icon to the Foundry "anvil" logo in the top-left corner of the screen if Rivet is detected.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
	},
	artBrowser: {
		name: "Art Browser",
		settings: {
			importImagesAs: {
				name: "Drag-Drop Images As",
				help: `The type of canvas object that should be created when drag-dropping images from the art browser to the canvas.`,
				default: ConfigConsts.C_ART_IMAGE_MODE_TOKEN,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_ART_IMAGE_MODE_TOKEN,
						name: "Tokens",
					},
					{
						value: ConfigConsts.C_ART_IMAGE_MODE_TILE,
						name: "Tiles",
					},
					{
						value: ConfigConsts.C_ART_IMAGE_MODE_NOTE,
						name: "Journal notes",
					},
					{
						value: ConfigConsts.C_ART_IMAGE_MODE_SCENE,
						name: "Scenes",
					},
				],
			},
			scale: {
				name: "Tile/Scene Scaling",
				help: `A factor by which to scale placed tiles, and by which to scale scene backgrounds.`,
				default: 1.0,
				type: "number",
				min: 0.01,
				max: 100,
			},
			...ConfigConsts._template_getSceneImportSettings(),
			tokenSize: {
				name: "Token Size",
				help: `The default size of placed tokens.`,
				default: 1,
				type: "enum",
				values: [
					{
						value: 1,
						name: "Medium or smaller",
					},
					{
						value: 2,
						name: "Large",
					},
					{
						value: 3,
						name: "Huge",
					},
					{
						value: 4,
						name: "Gargantuan or larger",
					},
				],
			},
			isSwitchToCreatedScene: {
				name: "Activate Scenes on Creation",
				help: `If enabled, a scene will be activated upon creation (by drag-dropping an image to the canvas).`,
				default: true,
				type: "boolean",
			},
			isDisplaySheetCreatedScene: {
				name: "Display Scene Sheets on Creation",
				help: `If enabled, the "sheet" (i.e., configuration UI) for a scene will be shown upon creation (by drag-dropping an image to the canvas).`,
				default: true,
				type: "boolean",
			},
			artDirectoryPath: {
				name: "User Art Directory",
				help: `The sub-directory of the "User Data" directory where downloaded images and image packs will be saved.`,
				default: "assets/art",
				type: "string",
				isNullable: true,
			},
			buttonDisplay: {
				name: "Add Button To",
				help: `The place(s) where the Art Browser button should be visible.`,
				default: {
					[ConfigConsts.C_ART_IMAGE_MODE_TOKEN]: true,
					[ConfigConsts.C_ART_IMAGE_MODE_TILE]: true,
					[ConfigConsts.C_ART_IMAGE_MODE_NOTE]: true,
					[ConfigConsts.C_ART_IMAGE_MODE_SCENE]: true,
				},
				type: "multipleChoice",
				choices: [
					"Token scene controls",
					"Tile scene controls",
					"Note scene controls",
					"Scene controls",
				],
			},
			imageSaveMode: {
				name: "Image Saving Mode",
				help: `How images should be saved to the server. If "Default" is selected, an imported image will only be saved if it cannot be referenced via URL. If "Always" is selected, an imported image will be saved to the server, regardless of whether or not it can be referenced via URL. If "Never" is selected, an imported image will only be referenced by URL; if it cannot be referenced via URL, the import will fail. Note that saving images requires the Plutonium backend mod to be installed.`,
				default: ConfigConsts.C_ART_IMAGE_SAVE_MODE__DEFAULT,
				type: "enum",
				values: [
					{
						value: ConfigConsts.C_ART_IMAGE_SAVE_MODE__DEFAULT,
						name: `Default`,
					},
					{
						value: ConfigConsts.C_ART_IMAGE_SAVE_MODE__ALWAYS,
						name: `Always`,
					},
					{
						value: ConfigConsts.C_ART_IMAGE_SAVE_MODE__NEVER,
						name: `Never`,
					},
				],
			},
		},
	},
	journalEntries: {
		name: "Journal Entries",
		settings: {
			isEnableUrlEmbeds: {
				name: "Enable URL Entries",
				help: `Add a "Set URL" context menu option to journal entry directory items, allowing the contents of the journal item to be replaced with embedded web content (Google Doc, reference page, YouTube video, etc.).`,
				default: false,
				type: "boolean",
				compatibilityModeValues: {
					[UtilCompat.MODULE_KANKA_FOUNDRY]: false,
				},
			},
			isEnableJournalEmbeds: {
				name: "Enable Journal Embeds",
				help: `Add custom syntax to journal entries, which allows other journal entries to be embedded. This syntax is similar to that used to link a journal entry; simply prepend "Embed" to a content link. For example, "@JournalEntry[Entry Name]" would become "@EmbedJournalEntry[Entry Name]".`,
				default: false,
				type: "boolean",
			},
			isAutoExpandJournalEmbeds: {
				name: "Auto-Expand Journal Embeds",
				help: `If the "Enable Journal Embeds" option is enabled, this determines whether or not the embedded content is expanded by default.`,
				default: true,
				type: "boolean",
			},
		},
	},
	tools: {
		name: "Tools",
		settings: {
			isDeduplicateIgnoreType: {
				name: "Ignore Types When Deduplicating",
				help: `If enabled, the Collection Deduplicator will ignore entity types, treating e.g. a PC sheet and an NPC sheet with the same name as a set of duplicates.`,
				default: false,
				type: "boolean",
			},
			minimumRolePolymorph: ConfigConsts._template_getMinimumRole({
				name: "Minimum Permission Level for Polymorph Tool",
				help: `Actor "Polymorph" buttons will be hidden for any user with a role less than the chosen role.`,
			}),
			minimumRoleActorTools: ConfigConsts._template_getMinimumRole({
				name: "Minimum Permission Level for Other Actor Tools",
				help: `Actor "Feature/Spell Cleaner," "Prepared Spell Mass-Toggler," etc. buttons will be hidden for any user with a role less than the chosen role.`,
			}),
			minimumRoleTableTools: ConfigConsts._template_getMinimumRole({
				name: "Minimum Permission Level for Other Table Tools",
				help: `Table "Row Cleaner" button will be hidden for any user with a role less than the chosen role.`,
			}),
		},
	},
	text: {
		name: "Text and Tags",
		settings: {
			isEnableContentLinks: {
				name: "Enable Content @tag Links",
				help: `Add custom syntax to journal entries, which enables an approximation of 5etools @tag syntax. This syntax is of the form "@<tagName>[<name|source|...>]". For example, "@creature[goblin]{goblins!}" could be used to insert the link "goblins!" which, when clicked, would load a (temporary) Goblin actor via the importer. For a complete list of available tags, see the 5etools Renderer Demo page (https://5e.tools/renderdemo.html).`,
				default: true,
				type: "boolean",
			},
			isEnableHoverForLinkTags: {
				name: `Enable Hover Popups for &quot;@tag&quot; Links`,
				help: `If links rendered from @tag syntax should display popups when hovered.`,
				default: false,
				type: "boolean",
				isReloadRequired: true,
			},
			isAutoRollActorEmbeddedDocumentTags: {
				name: "Roll Items Linked by @ActorEmbeddedItem on Click",
				help: `If enabled, clicking a rendered @ActorEmbeddedItem tag will roll the linked embedded item. If disabled, clicking the tag will open the item's sheet instead.`,
				default: true,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
	},
	misc: {
		name: "Miscellaneous",
		settingsAdvanced: {
			isSkipBackendCheck: {
				name: "Skip Backend Check",
				help: `Avoid sending a network request during module initialisation to check if the modded Plutonium backend is installed.`,
				default: false,
				type: "boolean",
				isPlayerEditable: true,
			},
		},
	},
	equipmentShop: {
		name: "Equipment Shop",
		settings: {
			priceMultiplier: {
				name: "Price Multiplier",
				help: `A factor by which the prices in the equipment shop are multiplied.`,
				default: 1.0,
				type: "percentage",
				min: 0.0001,
			},
			minimumRole: ConfigConsts._template_getMinimumRole({
				name: "Minimum Permission Level",
				help: `"Equipment Shop" button will be hidden for any user with a role less than the chosen role.`,
			}),
		},
	},
};

export {ConfigConsts};
