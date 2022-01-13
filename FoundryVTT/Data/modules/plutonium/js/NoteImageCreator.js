import {Vetools} from "./Vetools.js";
import {UtilImage} from "./UtilImage.js";
import {SharedConsts} from "../shared/SharedConsts.js";

class NoteImageCreator {
	static async pCreateImageGetUrl ({name}) {
		if (!name) throw new Error(`No puck name provided!`);

		// We assume the user isn't deleting the pucks made in a single session
		if (NoteImageCreator._CACHE_URLS[name]) return NoteImageCreator._CACHE_URLS[name];

		const img = await this._pGetBlankPuckImage();
		const tokenBlob = await this._pGetPuckBlob({name, img});
		const out = await Vetools.pSaveImageToServerAndGetUrl({blob: tokenBlob, path: `puck/${name}.png`});

		NoteImageCreator._CACHE_URLS[name] = out;

		return out;
	}

	static async _pGetBlankPuckImage () {
		return UtilImage.pLoadTempImage(`modules/${SharedConsts.MODULE_NAME}/media/img/puck.png`, {isCacheable: true});
	}

	static _pGetPuckBlob ({name, img}) {
		return UtilImage.pDrawTextGetBlob({
			text: name,
			img,
			bbX0: NoteImageCreator._BB_X0,
			bbX1: NoteImageCreator._BB_X1,
			bbY0: NoteImageCreator._BB_Y0,
			bbY1: NoteImageCreator._BB_Y1,
			color: NoteImageCreator._COLOR_TEXT,
			font: `"Times New Roman", Times, serif`,
			isBold: true,
		});
	}
}
NoteImageCreator._COLOR_TEXT = "#010101";
NoteImageCreator._BB_X0 = 12;
NoteImageCreator._BB_X1 = 128;
NoteImageCreator._BB_Y0 = 39;
NoteImageCreator._BB_Y1 = 105;

NoteImageCreator._CACHE_URLS = {};

export {NoteImageCreator};
