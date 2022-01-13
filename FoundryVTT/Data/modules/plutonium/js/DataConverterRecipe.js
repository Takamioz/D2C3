import {UtilApplications} from "./UtilApplications.js";
import {Config} from "./Config.js";
import {Vetools} from "./Vetools.js";
import {UtilDataConverter} from "./UtilDataConverter.js";

class DataConverterRecipe {
	/**
	 * @param recipe
	 * @param [opts] Options object.
	 * @param [opts.isAddPermission]
	 * @param [opts.defaultPermission]
	 */
	static async pGetRecipeJournal (recipe, opts) {
		opts = opts || {};

		const content = await UtilDataConverter.pGetWithDescriptionPlugins(() => Renderer.recipe.getBodyHtml(recipe));

		const fluff = await Renderer.utils.pGetFluff({
			entity: recipe,
			fluffUrl: `data/fluff-recipes.json`,
			fluffProp: "recipeFluff",
		});

		const img = await Vetools.pOptionallySaveImageToServerAndGetUrl(
			await this._pGetRecipeJournal_getRecipeImagePath(recipe, fluff),
		);

		const out = {
			name: UtilApplications.getCleanEntityName(UtilDataConverter.getNameWithSourcePart(recipe)),
			permission: {default: 0},
			entryTime: Date.now(),
			content,
			img,
		};

		if (opts.defaultPermission != null) out.permission = {default: opts.defaultPermission};
		else if (opts.isAddPermission) out.permission = {default: Config.get("importRecipe", "permissions")};

		return out;
	}

	static async _pGetRecipeJournal_getRecipeImagePath (recipe, fluff) {
		if (recipe.foundryImg) return recipe.foundryImg;
		return fluff?.images?.length
			? Vetools.pOptionallySaveImageToServerAndGetUrl(Renderer.utils.getMediaUrl(fluff.images[0], "href", "img"))
			: null;
	}
}

export {DataConverterRecipe};
