"use strict";
const DETokenizeThis = (() => {
const sortTokenizableSubstrings=(a,b)=>{if(a.length>b.length){return-1}
if(a.length<b.length){return 1}
return 0};const endsWith=(str,suffix)=>{return str.indexOf(suffix,str.length-suffix.length)!==-1};class Tokenizer{constructor(factory,str,forEachToken){this.factory=factory;this.str=str;this.forEachToken=forEachToken;this.previousChr='';this.toMatch='';this.currentToken='';this.modeStack=['modeNone'];this.currentIndex=0}
getCurrentMode(){return this.modeStack[this.modeStack.length-1]}
setCurrentMode(mode){return this.modeStack.push(mode)}
completeCurrentMode(){const currentMode=this.getCurrentMode();if(currentMode==='modeDefault'){this.pushDefaultModeTokenizables()}
if((currentMode==='modeMatch'&&this.currentToken==='')||this.currentToken!==''){this.push(this.currentToken)}
this.currentToken='';return this.modeStack.pop()}
push(token){let surroundedBy='';if(this.factory.convertLiterals&&this.getCurrentMode()!=='modeMatch'){switch(token.toLowerCase()){case 'null':token=null;break;case 'true':token=!0;break;case 'false':token=!1;break;default:if(isFinite(token)){token=Number(token)}
break}}else{surroundedBy=this.toMatch}
if(this.forEachToken){this.forEachToken(token,surroundedBy,this.currentIndex)}}
tokenize(){let index=0;while(index<this.str.length){this.currentIndex=index;this.consume(this.str.charAt(index++))}
while(this.getCurrentMode()!=='modeNone'){this.completeCurrentMode()}}
consume(chr){this[this.getCurrentMode()](chr);this.previousChr=chr}['modeNone'](chr){if(!this.factory.matchMap[chr]){this.setCurrentMode('modeDefault');return this.consume(chr)}
this.setCurrentMode('modeMatch');this.toMatch=chr}['modeDefault'](chr){if(this.factory.delimiterMap[chr]){return this.completeCurrentMode()}
if(this.factory.matchMap[chr]){let tokenizeIndex=0;while(tokenizeIndex<this.factory.tokenizeList.length){if(endsWith(this.currentToken,this.factory.tokenizeList[tokenizeIndex++])){this.completeCurrentMode();return this.consume(chr)}}}
this.currentToken+=chr;return this.currentToken}
pushDefaultModeTokenizables(){let tokenizeIndex=0;let lowestIndexOfTokenize=Infinity;let toTokenize=null;while(this.currentToken&&tokenizeIndex<this.factory.tokenizeList.length){const tokenize=this.factory.tokenizeList[tokenizeIndex++];const indexOfTokenize=this.currentToken.indexOf(tokenize);if(indexOfTokenize!==-1&&indexOfTokenize<lowestIndexOfTokenize){lowestIndexOfTokenize=indexOfTokenize;toTokenize=tokenize}}
if(!toTokenize){return}
if(lowestIndexOfTokenize>0){this.push(this.currentToken.substring(0,lowestIndexOfTokenize))}
if(lowestIndexOfTokenize!==-1){this.push(toTokenize);this.currentToken=this.currentToken.substring(lowestIndexOfTokenize+toTokenize.length);return this.pushDefaultModeTokenizables()}}['modeMatch'](chr){if(chr===this.toMatch){if(this.previousChr!==this.factory.escapeCharacter){return this.completeCurrentMode()}
this.currentToken=this.currentToken.substring(0,this.currentToken.length-1)}
this.currentToken+=chr;return this.currentToken}}
class TokenizeThis{constructor(config){if(!config){config={}}
config=Object.assign({},this.constructor.defaultConfig,config);this.convertLiterals=config.convertLiterals;this.escapeCharacter=config.escapeCharacter;this.tokenizeList=[];this.tokenizeMap={};this.matchList=[];this.matchMap={};this.delimiterList=[];this.delimiterMap={};config.shouldTokenize.sort(sortTokenizableSubstrings).forEach((token)=>{if(!this.tokenizeMap[token]){this.tokenizeList.push(token);this.tokenizeMap[token]=token}});config.shouldMatch.forEach((match)=>{if(!this.matchMap[match]){this.matchList.push(match);this.matchMap[match]=match}});config.shouldDelimitBy.forEach((delimiter)=>{if(!this.delimiterMap[delimiter]){this.delimiterList.push(delimiter);this.delimiterMap[delimiter]=delimiter}})}
tokenize(str,forEachToken){const tokenizerInstance=new Tokenizer(this,str,forEachToken);return tokenizerInstance.tokenize()}
static get defaultConfig(){return{shouldTokenize:['(',')',',','*','/','%','+','-','=','!=','!','<','>','<=','>=','^'],shouldMatch:['"',"'",'`'],shouldDelimitBy:[' ',"\n","\r","\t"],convertLiterals:!0,escapeCharacter:"\\"}}}

return Tokenizer;
})();

