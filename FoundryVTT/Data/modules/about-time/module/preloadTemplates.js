export const preloadTemplates = async function () {
    const templatePaths = [
        // Add paths to "modules/about-time/templates"
        'modules/about-time/templates/simpleCalendarDisplay.html',
        'modules/about-time/templates/simpleClockDisplay.html',
        'modules/about-time/templates/countDown.html',
        'modules/about-time/templates/calendarEditor.html'
    ];
    return loadTemplates(templatePaths);
};
