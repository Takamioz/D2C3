// date-time modifer applied to DateTime
import { intervalATtoSC } from "./DateTime.js";
import { DTCalc } from "./DTCalc.js";
/**
 * A modifer for add opeations to DateTimes.
 * can be any combination of years, months, days, hours, minutes,  seconds
 */
export class DTMod {
    constructor({ years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 0 }) {
        this._interval = intervalATtoSC({ years, months, days, hours, minutes, seconds });
        console.warn(`about-time | DTMod deprecated use 
      {year: y, month: m, day: d, hours: h, minutes: m, seconds: s`);
        return this;
    }
    get interval() { return this._interval; }
    ;
    set interval(interval) {
        this._interval = intervalATtoSC(interval);
    }
    /**
     * Short hand creation method DTMod.create({....})
     * @param data {years=0, months=0, days=0,hours=0, minutes=0, seconds=0}
     */
    static create({ years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 0 }) {
        return new DTMod({ years, months, days, minutes, hours, seconds });
    }
    /**
   * Add together two DTMods. no managment of values other than making them integers
   * @param increment the DTMod to add to the current.
   * returns a new mod
   */
    add(increment) {
        console.warn("about-time | add() deprecated - do the calc directly");
        let year = Math.floor(this.interval.year + (increment.interval.year || 0));
        let month = Math.floor(this.interval.month + (increment.interval.month || 0));
        let day = Math.floor(this.interval.day + (increment.interval.day || 0));
        let hour = Math.floor(this.interval.hour + (increment.interval.hour || 0));
        let minute = Math.floor(this.interval.minute + (increment.interval.minute || 0));
        let second = Math.floor(this.interval.second + (increment.interval.second || 0));
        const result = new DTMod({});
        result.interval = { year, month, day, hour, minute, second };
        return result;
    }
    /**
     * WARNING does not work for leap years
     * A convenience method to allow conversion of time specs to seconds.
     */
    toSeconds() {
        console.warn(`about-time | toSconds  deprecated use
    SimpleCalendar.api.timestampPlusInterval(game.time.worldTime, interval) - game.time.worldTime`);
        //@ts-ignore
        return window.SimpleCalendar.api.timestampPlusinterval(window.SimpleCalendar.api.timestamp(), this.interval) - window.SimpleCalendar.api.timestamp();
    }
    /* The following methods are all for using DTMods to represent times and do time arithmetic */
    static timeString(timeInSeconds) {
        console.warn("about-time | timeString deprecated - print it yourself");
        let dmhs = this.fromSeconds(timeInSeconds);
        let pad = DTCalc.padNumber;
        return `${pad(dmhs.interval.hour)}:${pad(dmhs.interval.minute)}:${pad(dmhs.interval.second)}`;
    }
    static fromSeconds(seconds) {
        // wont work for pathfinder
        console.warn(`about-time | fromSeeconds deprecated use 
    const interval = window.SimpleCalendar.api.timestampToDate(seconds);
    `);
        //@ts-ignore
        const dateTime = window.SimpleCalendar.api.timestampToDate(seconds);
        return new DTMod({ years: 0, months: 0, days: 0, hours: dateTime.hours, minutes: dateTime.minutes, seconds: dateTime.seconds });
    }
}
