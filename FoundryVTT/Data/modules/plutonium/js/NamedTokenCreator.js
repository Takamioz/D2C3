import {SharedConsts} from "../shared/SharedConsts.js";
import {Vetools} from "./Vetools.js";
import {UtilImage} from "./UtilImage.js";

class NamedTokenCreator {
	static async pCreateToken ({name, xScene, yScene}) {
		if (!canvas.scene) throw new Error(`There is currently no active scene!`);

		const img = await this._pGetBlankTokenImage();
		const tokenBlob = await this._pGetTokenBlob({name, img});
		const url = await Vetools.pSaveImageToServerAndGetUrl({blob: tokenBlob, path: `named-token/${name}.png`});
		await this._pCreateToken({name, url, xScene, yScene});
	}

	static async _pGetBlankTokenImage () {
		return UtilImage.pLoadTempImage(`modules/${SharedConsts.MODULE_NAME}/media/img/blank.png`, {isCacheable: true});
	}

	static _pGetTokenBlob ({name, img}) {
		return UtilImage.pDrawTextGetBlob({
			text: name,
			img,
			bbX0: NamedTokenCreator._BB_X0,
			bbX1: NamedTokenCreator._BB_X1,
			bbY0: NamedTokenCreator._BB_Y0,
			bbY1: NamedTokenCreator._BB_Y1,
			color: "#d0c04c",
			font: `"Modesto Condensed", "Palatino Linotype", serif`,
		});
	}

	static _pCreateToken ({name, url, xScene, yScene}) {
		return TokenDocument.create(
			{
				name,
				x: xScene,
				y: yScene,
				img: encodeURL(url),
				width: 1,
				height: 1,
				scale: 1,
			},
			{
				parent: canvas.scene,
			},
		);
	}
}
NamedTokenCreator._BB_X0 = 31;
NamedTokenCreator._BB_X1 = 246;
NamedTokenCreator._BB_Y0 = 93;
NamedTokenCreator._BB_Y1 = 182;

NamedTokenCreator._CACHE_IMAGE = null;

export {NamedTokenCreator};
