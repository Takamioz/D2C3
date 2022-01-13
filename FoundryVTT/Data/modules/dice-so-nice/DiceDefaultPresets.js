
import {DicePreset} from './DicePreset.js';

export const BASE_PRESETS_LIST = [];
export const EXTRA_PRESETS_LIST = [];


//////////////////////////////////////////////////
//              BASE SYSTEM                     //
//////////////////////////////////////////////////
let diceobj;

diceobj = new DicePreset('d2');
diceobj.setLabels(['1','2']);
diceobj.setValues(1,2);
diceobj.inertia = 8;
diceobj.mass = 400;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('dc','d2');
diceobj.term = 'Coin';
diceobj.setLabels([
    'modules/dice-so-nice/textures/coin/tail.webp',
    'modules/dice-so-nice/textures/coin/heads.webp'
]);
diceobj.setBumpMaps([
    'modules/dice-so-nice/textures/coin/tail_bump.webp',
    'modules/dice-so-nice/textures/coin/heads_bump.webp'
]);
diceobj.setValues(0,1);
diceobj.inertia = 8;
diceobj.scale = 0.9;
diceobj.colorset = "coin_default"
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d4');
diceobj.setLabels(['1','2','3','4']);
diceobj.setValues(1,4);
diceobj.inertia = 5;
diceobj.scale = 1.2;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d6');
diceobj.setLabels(['1', '2', '3', '4', '5', '6']);
diceobj.setValues(1,6);
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d3', 'd6');
diceobj.setLabels(['1', '2', '3']);
diceobj.setValues(1,3);
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('df', 'd6');
diceobj.term = 'FateDie';
diceobj.setLabels(['−', ' ', '+']);
diceobj.setValues(-1,1);
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d8');
diceobj.setLabels(['1','2','3','4','5','6','7','8']);
diceobj.setValues(1,8);
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d10');
diceobj.setLabels(['1','2','3','4','5','6','7','8','9','0']);
diceobj.setValues(1,10);
diceobj.mass = 450;
diceobj.inertia = 9;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d5','d10');
diceobj.setLabels(['1','2','3','4','5']);
diceobj.setValues(1,5);
diceobj.mass = 450;
diceobj.inertia = 9;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d100', 'd10');
diceobj.setLabels(['10', '20', '30', '40', '50', '60', '70', '80', '90', '00']);
diceobj.setValues(10, 100, 10);
diceobj.mass = 450;
diceobj.inertia = 9;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d12');
diceobj.setLabels(['1','2','3','4','5','6','7','8','9','10','11','12']);
diceobj.setValues(1,12);
diceobj.mass = 450;
diceobj.inertia = 8;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d14');
diceobj.setLabels(['1','2','3','4','5','6','7','8','9','10','11','12', '13', '14']);
diceobj.setValues(1,14);
diceobj.mass = 450;
diceobj.inertia = 8;
diceobj.scale = 1;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d7','d14');
diceobj.setLabels(['1','2','3','4','5','6','7']);
diceobj.setValues(1,7);
diceobj.mass = 450;
diceobj.inertia = 8;
diceobj.scale = 1;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d16');
diceobj.setLabels(['1','2','3','4','5','6','7','8','9','10','11','12', '13', '14', '15', '16']);
diceobj.setValues(1,16);
diceobj.mass = 450;
diceobj.inertia = 8;
diceobj.scale = 1;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d20');
diceobj.setLabels(['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20']);
diceobj.setValues(1,20);
diceobj.mass = 500;
diceobj.scale = 1;
diceobj.inertia = 6;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d24');
diceobj.setLabels(['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20', '21', '22', '23', '24']);
diceobj.setValues(1,24);
diceobj.mass = 500;
diceobj.scale = 1;
diceobj.inertia = 10;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d30');
diceobj.setLabels(['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30']);
diceobj.setValues(1,30);
diceobj.mass = 500;
diceobj.scale = 1;
diceobj.inertia = 10;
BASE_PRESETS_LIST.push(diceobj);

//////////////////////////////////////////////////
//              EXTRA SYSTEM                    //
//////////////////////////////////////////////////

/**
 * Dot System
 */
EXTRA_PRESETS_LIST.push({
    type:"d6",
    labels:[
        'modules/dice-so-nice/textures/dot/d6-1.webp',
        'modules/dice-so-nice/textures/dot/d6-2.webp',
        'modules/dice-so-nice/textures/dot/d6-3.webp',
        'modules/dice-so-nice/textures/dot/d6-4.webp',
        'modules/dice-so-nice/textures/dot/d6-5.webp',
        'modules/dice-so-nice/textures/dot/d6-6.webp'
    ],
    bumpMaps:[
        'modules/dice-so-nice/textures/dot/d6-1-b.webp',
        'modules/dice-so-nice/textures/dot/d6-2-b.webp',
        'modules/dice-so-nice/textures/dot/d6-3-b.webp',
        'modules/dice-so-nice/textures/dot/d6-4-b.webp',
        'modules/dice-so-nice/textures/dot/d6-5-b.webp',
        'modules/dice-so-nice/textures/dot/d6-6-b.webp'
    ],
    system:"dot"
});

EXTRA_PRESETS_LIST.push({
    type:"d6",
    labels:[
        'modules/dice-so-nice/textures/dot/d6-1-black.webp',
        'modules/dice-so-nice/textures/dot/d6-2-black.webp',
        'modules/dice-so-nice/textures/dot/d6-3-black.webp',
        'modules/dice-so-nice/textures/dot/d6-4-black.webp',
        'modules/dice-so-nice/textures/dot/d6-5-black.webp',
        'modules/dice-so-nice/textures/dot/d6-6-black.webp',
    ],
    bumpMaps:[
        'modules/dice-so-nice/textures/dot/d6-1-b.webp',
        'modules/dice-so-nice/textures/dot/d6-2-b.webp',
        'modules/dice-so-nice/textures/dot/d6-3-b.webp',
        'modules/dice-so-nice/textures/dot/d6-4-b.webp',
        'modules/dice-so-nice/textures/dot/d6-5-b.webp',
        'modules/dice-so-nice/textures/dot/d6-6-b.webp',
    ],
    system:"dot_b"
});

/**
 * foundry_vtt System
 */
 EXTRA_PRESETS_LIST.push({
    type:"d2",
    labels:['1','F'],
    font: "FoundryVTT",
    system:"foundry_vtt",
    fontScale:1.2
});
EXTRA_PRESETS_LIST.push({
    type:"d4",
    labels:['1','2','3','E'],
    font: "FoundryVTT",
    system:"foundry_vtt",
    fontScale:0.8
});
EXTRA_PRESETS_LIST.push({
    type:"d6",
    labels:['1','2','3','4','5','E'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"df",
    labels:['−', ' ', '+'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d3",
    labels:['1', '2', 'E'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d8",
    labels:['1','2','3','4','5','6','7','F'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d10",
    labels:['1','2','3','4','5','6','7','8','9','E'],
    font: "FoundryVTT",
    system:"foundry_vtt",
    fontScale:0.9
});
EXTRA_PRESETS_LIST.push({
    type:"d5",
    labels:['1','2','3','4','E'],
    font: "FoundryVTT",
    system:"foundry_vtt",
    fontScale:0.9
});
EXTRA_PRESETS_LIST.push({
    type:"d100",
    labels:['10','20','30','40','50','60','70','80','90','E'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d12",
    labels:['1','2','3','4','5','6','7','8','9','10','11','E'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d14",
    labels:['1','2','3','4','5','6','7','8','9','10','11','12','13','E'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d7",
    labels:['1','2','3','4','5','6','E'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d16",
    labels:['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','E'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d20",
    labels:['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','F'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d24",
    labels:['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','F'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type:"d30",
    labels:['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','E'],
    font: "FoundryVTT",
    system:"foundry_vtt"
});


/**
 * Spectrum System
 */

EXTRA_PRESETS_LIST.push({
    type:"df",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/df-m.webp',
        'modules/dice-so-nice/textures/spectrumdice/df-0.webp',
        'modules/dice-so-nice/textures/spectrumdice/df-p.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"d2",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/d2-1.webp',
        'modules/dice-so-nice/textures/spectrumdice/d2-2.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"dc",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/dc-h.webp',
        'modules/dice-so-nice/textures/spectrumdice/dc-t.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"d4",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/d4-1.webp',
        'modules/dice-so-nice/textures/spectrumdice/d4-2.webp',
        'modules/dice-so-nice/textures/spectrumdice/d4-3.webp',
        'modules/dice-so-nice/textures/spectrumdice/d4-4.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"d6",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/d6-1.webp',
        'modules/dice-so-nice/textures/spectrumdice/d6-2.webp',
        'modules/dice-so-nice/textures/spectrumdice/d6-3.webp',
        'modules/dice-so-nice/textures/spectrumdice/d6-4.webp',
        'modules/dice-so-nice/textures/spectrumdice/d6-5.webp',
        'modules/dice-so-nice/textures/spectrumdice/d6-6.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"d8",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/d8-1.webp',
        'modules/dice-so-nice/textures/spectrumdice/d8-2.webp',
        'modules/dice-so-nice/textures/spectrumdice/d8-3.webp',
        'modules/dice-so-nice/textures/spectrumdice/d8-4.webp',
        'modules/dice-so-nice/textures/spectrumdice/d8-5.webp',
        'modules/dice-so-nice/textures/spectrumdice/d8-6.webp',
        'modules/dice-so-nice/textures/spectrumdice/d8-7.webp',
        'modules/dice-so-nice/textures/spectrumdice/d8-8.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"d10",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/d10-1.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-2.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-3.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-4.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-5.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-6.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-7.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-8.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-9.webp',
        'modules/dice-so-nice/textures/spectrumdice/d10-0.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"d12",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/d12-1.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-2.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-3.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-4.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-5.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-6.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-7.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-8.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-9.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-10.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-11.webp',
        'modules/dice-so-nice/textures/spectrumdice/d12-12.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"d100",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/d100-10.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-20.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-30.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-40.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-50.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-60.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-70.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-80.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-90.webp',
        'modules/dice-so-nice/textures/spectrumdice/d100-00.webp'
    ],
    system:"spectrum"
});

EXTRA_PRESETS_LIST.push({
    type:"d20",
    labels:[
        'modules/dice-so-nice/textures/spectrumdice/d20-1.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-2.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-3.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-4.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-5.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-6.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-7.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-8.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-9.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-10.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-11.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-12.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-13.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-14.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-15.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-16.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-17.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-18.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-19.webp',
        'modules/dice-so-nice/textures/spectrumdice/d20-20.webp'
    ],
    system:"spectrum"
});
