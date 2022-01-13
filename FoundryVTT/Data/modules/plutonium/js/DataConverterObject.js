import {DataConverterActor} from "./DataConverterActor.js";
import {SharedConsts} from "../shared/SharedConsts.js";

class DataConverterObject {
	static async pGetParsedAction (obj, action, monOpts) {
		const {
			damageTuples,
			formula,
			offensiveAbility,
			isAttack,
			rangeShort,
			rangeLong,
			actionType,
			isProficient,
			attackBonus,
		} = DataConverterActor.getParsedActionEntryData(obj, action, monOpts, {mode: "object"});

		const img = await this._pGetParsedAction_getImg(obj, action, monOpts, {isAttack});

		return {
			damageTuples,
			formula,
			offensiveAbility,
			isAttack,
			rangeShort,
			rangeLong,
			actionType,
			isProficient,
			attackBonus,
			_foundryData: action._foundryData,
			foundryData: action.foundryData,
			_foundryFlags: action._foundryFlags,
			foundryFlags: action.foundryFlags,
			img,
		};
	}

	/**
	 * @param obj
	 * @param action
	 * @param monOpts
	 * @param [opts]
	 * @param [opts.isAttack]
	 */
	static async _pGetParsedAction_getImg (obj, action, monOpts, opts) {
		opts = opts || {};

		if (opts.isAttack) return `modules/${SharedConsts.MODULE_NAME}/media/icon/crossed-swords.svg`;
		return `modules/${SharedConsts.MODULE_NAME}/media/icon/mailed-fist.svg`;
	}
}

export {DataConverterObject};
