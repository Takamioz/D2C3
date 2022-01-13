class Consts {}
Consts.RUN_TIME = `${Date.now()}`;
Consts.FLAG_IFRAME_URL = "iframe_url";

Consts.TERMS_COUNT = [
	{tokens: ["once"], count: 1},
	{tokens: ["twice"], count: 2},
	{tokens: ["thrice"], count: 3},
	{tokens: ["three", " ", "times"], count: 3},
	{tokens: ["four", " ", "times"], count: 4},
];

Consts.Z_INDEX_MAX_FOUNDRY = 9999;

Consts.ACTOR_TEMP_NAME = "Importing...";

Consts.CHAR_MAX_LEVEL = 20;

export {Consts};
