import { calendars } from "../../about-time.js";
import { ElapsedTime } from "../ElapsedTime.js";
let warn = (...args) => {
    if (ElapsedTime.debug)
        console.warn("about-time | ", ...args);
};
let log = (...args) => {
    console.log("about-time | ", ...args);
};
export class DTCalc {
    static initCalendarWeather() {
        //@ts-ignore
        this.weekDays = window.SimpleCalendar.api.timestampToDate(0).weekdays;
        this.loadUserCalendar();
    }
    static changeDefaultCalendar() {
        console.error("about-time | Change calendar not supported - use Simple Calendar UI");
    }
    static userCalendarChanged() {
        warn("about-time | User Calendar Change not supported use Simple Calendar UI");
    }
    /**
     *
     * @param year how many leap years from uear 0 to year "year"
     */
    static numLeapYears(year) {
        console.error("about-time | numLeapYears not supported no replacement");
        return -1;
    }
    static setFirstDay(day) {
        console.error("about-time | setFirstDay not supported - use Simple Calendar UI");
    }
    static padNumber(n, digits = 2) {
        return `${n}`.padStart(digits, "0");
    }
    static padYear(n, digits = 2) {
        return `${n}`.padStart(digits, " ");
    }
    /**
     *
     * @param year is year "year" a leap year 1 for yes, 0 for no.
     */
    static isLeapYear(year) {
        console.error("about-time | isLeapYear not supported");
        return undefined;
    }
    /**
     *
     * @param year how days in the year "year" - know about leap years
     */
    static daysInYear(year) {
        warn("about-time | deprecated - no replacement");
    }
    static get spd() {
        //@ts-ignore
        return window.SimpleCalendar.api.timestampPlusInterval(0, { day: 1 });
    }
    /**
    *
    * @param {days, hours, minutes, second} return the equivalent total number of seconds.
    */
    static timeToSeconds({ days = 0, hours = 0, minutes = 0, seconds = 0 }) {
        warn(`about-time | deprecated use 
      const today = game.time.worldTime;
      const interval = {day: days, hour: hours, mintue: minutes};
      const future = simpleCalendar.api.timestampPlusInterval(today, interval)
      timeToSeconds = future - today;
    `);
        //@ts-ignore
        const today = window.SimpleCalendar.api.timestampToDate(window.SimpleCalendar.api.timestamp);
        const interval = { day: days, hour: hours, mintue: minutes, second: seconds };
        //@ts-ignore
        const future = window.SimpleCalendar.api.timestampPlusInterval(window.SimpleCalendar.api.timesteamp, interval);
        return future - today;
    }
    static createFromData(calendarSpec) {
        warn("about-time | createFromdata deprecated - use Simple Calendar UI");
        // warn("Seting calendar Spec to ", duplicate(calendarSpec))
        // this.saveUserCalendar(calendarSpec);
    }
    static loadUserCalendar() {
        var _a;
        warn("about-time | load calendar deprecated");
        let userCalendarSpec = duplicate(game.settings.get("about-time", "savedCalendar"));
        if (!((_a = userCalendarSpec) === null || _a === void 0 ? void 0 : _a.month_len)) {
            console.error("about-time | User Calendar load failed");
            userCalendarSpec = {};
        }
        else
            userCalendarSpec.leap_year_rule = eval(userCalendarSpec.leap_year_rule);
        calendars["UserCreated"] = userCalendarSpec;
        return userCalendarSpec;
    }
    //@ts-ignore
    static async saveUserCalendar(newCalendarSpec) {
        warn("about-time | save calendar deprecated");
        let savedCalendarSpec = duplicate(newCalendarSpec);
        if (!newCalendarSpec.month_len || !newCalendarSpec.weekdays) {
            console.warn("about-time attempting to save invalid calendar spec", newCalendarSpec);
        }
        if (!newCalendarSpec.month_len)
            newCalendarSpec.month_len = [];
        if (!newCalendarSpec.weekdays)
            newCalendarSpec.weekdays = [];
        calendars["UserCreated"] = newCalendarSpec;
        //@ts-ignore
        if (game.user.isGM) {
            if (!savedCalendarSpec.leap_year_rule)
                savedCalendarSpec.leap_year_rule = () => 0;
            savedCalendarSpec.leap_year_rule = savedCalendarSpec.leap_year_rule.toString();
            savedCalendarSpec.first_day = 0;
            await game.settings.set("about-time", "savedCalendar", savedCalendarSpec);
            //@ts-ignore
            await window.SimpleCalendar.api.calendarWeatherImport();
        }
    }
}
DTCalc.sum = (...args) => args.reduce((acc, v) => acc + v);
