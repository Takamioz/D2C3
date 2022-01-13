import { DTMod } from "./DTMod.js";
import { ElapsedTime } from "../ElapsedTime.js";
let warn = (...args) => {
    if (ElapsedTime.debug)
        console.warn("about-time | ", ...args);
};
let log = (...args) => {
    console.log("about-time | ", ...args);
};
var compatShim = true;
export function clockStatus() {
    //@ts-ignore
    return window.SimpleCalendar.api.clockStatus();
}
export function secondsToInterval(seconds) {
    //@ts-ignore
    const interval = window.SimpleCalendar.api.secondsToInterval(secondds);
    // compat shim
    return intervalSCtoAT(interval);
}
export function currentWorldTime() {
    //@ts-ignore
    return game.time.worldTime;
    // look at window.SimpleCalendar.api.timestamp()
}
export function timestamp() {
    //@ts-ignore
    return window.SimpleCalendar.api.timestamp();
}
export function dateToTimestamp(date) {
    date = intervalATtoSC(date);
    //@ts-ignore
    return window.SimpleCalendar.api.dateToTimestamp(date);
}
export function intervalATtoSC(interval) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const newInterval = {};
    // if (compatShim && ((interval.years || interval.months || interval.days || interval.hours || interval.minutes || interval.seconds) !== undefined)) {
    if (_e = (_d = (_c = (_b = (_a = interval.years, (_a !== null && _a !== void 0 ? _a : interval.months)), (_b !== null && _b !== void 0 ? _b : interval.days)), (_c !== null && _c !== void 0 ? _c : interval.hours)), (_d !== null && _d !== void 0 ? _d : interval.minutes)), (_e !== null && _e !== void 0 ? _e : interval.seconds)) {
        warn("About time | DT Mod notation has changed plese use .year/.month/.day/.hour/.minute/.sceond", interval);
        warn("About time | DT Mod deprecated - use SimpleCalendar.api instead");
    }
    newInterval.year = (_f = interval.year, (_f !== null && _f !== void 0 ? _f : interval.years));
    newInterval.month = (_g = interval.month, (_g !== null && _g !== void 0 ? _g : interval.months));
    newInterval.day = (_h = interval.day, (_h !== null && _h !== void 0 ? _h : interval.days));
    newInterval.hour = (_j = interval.hour, (_j !== null && _j !== void 0 ? _j : interval.hours));
    newInterval.minute = (_k = interval.minute, (_k !== null && _k !== void 0 ? _k : interval.minutes));
    newInterval.second = (_l = interval.second, (_l !== null && _l !== void 0 ? _l : interval.seconds));
    // }
    return newInterval;
}
export function intervalSCtoAT(interval) {
    var _a, _b, _c, _d, _e, _f;
    const newInterval = {};
    if (compatShim) {
        newInterval.years = (_a = interval.year, (_a !== null && _a !== void 0 ? _a : interval.years));
        newInterval.months = (_b = interval.month, (_b !== null && _b !== void 0 ? _b : interval.months));
        newInterval.days = (_c = interval.day, (_c !== null && _c !== void 0 ? _c : interval.days));
        newInterval.hours = (_d = interval.hour, (_d !== null && _d !== void 0 ? _d : interval.hours));
        newInterval.minutes = (_e = interval.minute, (_e !== null && _e !== void 0 ? _e : interval.minutes));
        newInterval.seconds = (_f = interval.second, (_f !== null && _f !== void 0 ? _f : interval.seconds));
    }
    return newInterval;
}
export function padNumber(n, digits = 2) {
    return `${n}`.padStart(digits, "0");
}
export class DateTime {
    constructor(timestamp) {
        warn("abput-time | DateTime deprecated - use SimpleClaendar.api instead");
        this._timestamp = timestamp;
        //@ts-ignore
        this._dateForm = window.SimpleCalendar.api.timestampToDate(this._timestamp);
        return this;
    }
    get years() { return this._dateForm.year; }
    get months() { return this._dateForm.month; }
    get days() { return this._dateForm.day; }
    get hours() { return this._dateForm.hour; }
    get minutes() { return this._dateForm.minute; }
    get seconds() { return this._dateForm.second; }
    get timestamp() { return this._timestamp; }
    ;
    set timesteamp(timestamp) { this._timestamp = timestamp; }
    ;
    /**
     * returns a new DateTime. convenience method to support DateTime.create({...})
     * If no year is specified defaults to clock start year.
     * NOTE days and months are 0 index, January 1st (in gregorian calendar) is {months: 0, days: 0}
     * @param p
     */
    static create({ years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 0 }) {
        //@ts-ignore
        return new DateTime(window.SimpleCalendar.api.dateToTimestamp({ year: years, month: months, day: days, hour: hours, minute: minutes, second: seconds }));
    }
    static createFromDateTime(dt) {
        return new DateTime(dt.timestamp);
    }
    /**
     * return a DateTime representint the current game time clock.
     */
    static now() {
        warn("about-time | now() deprecated. Use timestamps game.time.worldTime");
        //@ts-ignore
        return new DateTime(game.time.worldTime);
    }
    /**
     *
     * @param increment DTMod. Add the icrement to a DateTime and return the normailized result.
     */
    add(increment) {
        if (increment instanceof DTMod) {
            const scInterval = intervalATtoSC(increment.interval);
            //@ts-ignore
            const ts = window.SimpleCalendar.api.timestampPlusInterval(this._timestamp, scInterval);
            // console.error("diff is ", (ts - this._timestamp) / 24/ 60 / 60);
            //@ts-ignore
            this._timestamp = window.SimpleCalendar.api.timestampPlusInterval(this._timestamp, scInterval);
        }
        else {
            const scInterval = intervalATtoSC(increment);
            //@ts-ignore
            const ts = window.SimpleCalendar.api.timestampPlusInterval(this._timestamp, scInterval);
            // console.error("diff is ", (ts - this._timestamp) / 24/ 60 / 60);
            //@ts-ignore
            this._timestamp = window.SimpleCalendar.api.timestampPlusInterval(this._timestamp, scInterval);
        }
        //@ts-ignore
        this._dateForm = window.SimpleCalendar.api.timestampToDate(this._timestamp);
        return this;
    }
    setAbsolute(spec = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }) {
        const scInterval = intervalATtoSC(spec);
        //@ts-ignore
        this._timestamp = window.SimpleCalendar.api.dateToTimestamp(scInterval);
        //@ts-ignore
        this._dateForm = window.SimpleCalendar.api.timestampToDate(this._timestamp);
        return this;
    }
    /**
     *
     * @param seconds convert the number of seconds to a DateTime. Requires a start year which defualts to clockStartYear
     * @param startYear
     */
    static createFromSeconds(seconds) {
        return new DateTime(seconds);
    }
    /**
     * retun the number of days represented by a date. Return the residual hours minutes seconds as well.
     */
    toDays() {
        //@ts-ignore
        return { days: Math.floor(this._timestamp / window.SimpleCalendar.api.timestampPlusInterval(0, { day: 1 })) };
    }
    /**
     * return the number of days between d1 and d2
     * @param d1
     * @param d2
     */
    static daysBetween(d1, d2) {
        return d2.toDays().days - d1.toDays().days;
    }
    /**
     * return the dow for a given DateTime (0=Monday or equivalent)
     */
    dow() {
        //@ts-ignore
        return window.SimpleCalendar.api.timestampToDate(game.time.worldTime).dayOfTheWeek;
    }
    /**
     * Adjust the calendar so that the dow() of this will be dow
     * @param dow the new dow for this.
     */
    setCalDow(dow) {
        console.error("setting cal dow not supported");
    }
    /**
     * convert the date to a number of Seconds.
     */
    toSeconds() {
        return this._timestamp;
    }
    /**
     * Some formatting methods
     */
    shortDate() {
        //@ts-ignore
        let dobj = window.SimpleCalendar.api.timestampToDate(this.timestamp);
        return { date: `${dobj.year}/${dobj.month + 1}/${dobj.day + 1}`, time: `${dobj.hour}:${dobj.minute}:${dobj.second}` };
    }
    longDate() {
        //@ts-ignore
        const date = window.SimpleCalendar.api.timestampToDate(this.timestamp);
        return {
            year: date.year,
            years: date.year,
            month: date.month + 1,
            months: date.month + 1,
            day: date.day + 1,
            days: date.day + 1,
            hour: date.hour,
            minute: date.minute,
            second: date.second,
            hours: date.hour,
            minutes: date.minute,
            seconds: date.second,
            monthString: date.monthName,
            dowString: date.weekdays[date.dayOfTheWeek]
        };
    }
    asSpec() {
        return this.longDate();
    }
    longDateExtended() {
        //@ts-ignore
        const dateObj = window.SimpleCalendar.api.timestampToDate(this.timestamp);
        return {
            year: dateObj.year,
            years: dateObj.year,
            month: dateObj.month + 1,
            months: dateObj.month + 1,
            day: dateObj.day + 1,
            days: dateObj.day + 1,
            hour: dateObj.hour,
            hours: dateObj.hour,
            minute: dateObj.minute,
            minutes: dateObj.minute,
            second: dateObj.second,
            seconds: dateObj.second,
            dow: dateObj.dayOfTheWeek,
            dowString: dateObj.weekdays[dateObj.dayOfTheWeek],
            monthString: dateObj.monthName,
            yearName: dateObj.yearName
        };
    }
    longDateSelect({ day = true, month = true, year = true, hours = true, minutes = true, seconds = true, monthDay = true }) {
        const pad = padNumber;
        //@ts-ignore
        const dateObj = window.SimpleCalendar.api.timestampToDate(this.timestamp);
        let years = year ? `  ${dateObj.year}` : "";
        if (dateObj.yearName)
            years = dateObj.yearName;
        let months = month ? ` ${dateObj.monthName}` : "";
        let days = day ? `${dateObj.weekdays[dateObj.dayOfTheWeek]}` : "";
        let monthDays = monthDay ? ` ${pad(dateObj.day + 1, 2)}` : "";
        return {
            "date": `${days}${months}${monthDays}${years}`,
            "time": `${pad(dateObj.hour, 2)}:${pad(dateObj.minute, 2)}:${pad(dateObj.second, 2)}`
        };
    }
}
