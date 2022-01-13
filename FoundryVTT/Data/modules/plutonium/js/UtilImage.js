class UtilImage {
	static pLoadImage (uri) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onerror = err => reject(err);
			img.onload = () => resolve(img);
			img.src = uri;
		});
	}

	static async pLoadTempImage (uri, {isCacheable = false} = {}) {
		if (UtilImage._CACHE_TEMP_IMAGE[uri]) return UtilImage._CACHE_TEMP_IMAGE[uri];

		const imgReq = await fetch(uri);
		const imgBlob = await imgReq.blob();

		const img = new Image();
		let resolve = null;
		const pImgLoad = new Promise(resolve_ => resolve = resolve_);
		img.onload = () => resolve();
		img.src = URL.createObjectURL(imgBlob);
		await pImgLoad;

		if (isCacheable) UtilImage._CACHE_TEMP_IMAGE[uri] = img;

		return img;
	}

	static async pDrawTextGetBlob (
		{
			text,
			img,
			bbX0,
			bbX1,
			bbY0,
			bbY1,
			color,
			font,
			isBold,
		},
	) {
		const cnv = document.createElement("canvas");
		cnv.width = img.width;
		cnv.height = img.height;
		const ctx = cnv.getContext("2d");
		ctx.drawImage(img, 0, 0);

		ctx.shadowColor = "#000000";
		ctx.shadowBlur = 14;

		ctx.fillStyle = color;
		ctx.font = `${isBold ? "bold" : ""} ${bbY1 - bbY0}px ${font}`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(
			text,
			bbX0 + ((bbX1 - bbX0) / 2),
			bbY0 + ((bbY1 - bbY0) / 2),
			bbX1 - bbX0,
		);

		return new Promise(resolve => {
			cnv.toBlob(blob => resolve(blob), "image/png");
		});
	}
}

UtilImage._CACHE_TEMP_IMAGE = {};

export {UtilImage};
