export const preloadTemplates = async function () {
    const templatePaths = [
        // Add paths to "modules/dae/templates"
        `./modules/dae/templates/ActiveEffects.html`,
        `./modules/dae/templates/DAEActiveSheetConfig.html`
    ];
    return loadTemplates(templatePaths);
};
