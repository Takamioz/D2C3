import { DTMod } from "./DTMod.js";
import { DateTime } from "./DateTime.js";
export let runDateTimeTests = () => {
    console.log("now", DateTime.now());
    console.log("now", DateTime.now().toDays());
    console.log("+1 day", DateTime.now().add(DTMod.create({ days: 1 })));
    console.log("+1 day", DateTime.now().add(DTMod.create({ days: 1 })).toDays());
    let d1 = DateTime.now().add(DTMod.create({ days: 365 }));
    console.log("d1", d1.longDate());
    let d0 = DateTime.now();
    console.log("d0", d0.longDate());
    console.log("+365 days ", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(DTMod.create({ years: 1 }));
    console.log("d1", d1.longDate());
    console.log("+1 year ", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(DTMod.create({ years: 3 }));
    console.log("d1", d1.longDate());
    console.log("+3 year", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    console.log("+3 months", DateTime.now().add(new DTMod({ months: 3 })).longDate());
    console.log("+3 years of days", DateTime.now().add(DTMod.create({ days: 365 * 3 })).longDate()); // this should be three years in the future
    console.log("+10 years", DateTime.now().add(DTMod.create({ years: 10 })).longDate());
    d1 = DateTime.now().add(DTMod.create({ months: 16 }));
    console.log("+100 days +16 ", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    console.log("+100 days +16 months +200 days + 300 days +128 days", DateTime.now()
        .add(new DTMod({ days: 100 }))
        .add(new DTMod({ months: 16 }))
        .add(new DTMod({ days: 200 }))
        .add(new DTMod({ days: 300 }))
        .add(new DTMod({ days: 128 })).longDate());
    d1 = DateTime.create({ years: 2100 }).add(DTMod.create({ days: 90 }));
    console.log("year 2100 90 days in", d1);
    console.log("long format", d1.longDate());
    console.log("short formate", d1.shortDate());
    // console.log("date in seconds", t2);
    // console.log("seconds-> datespec", DTMod.secondsToDTMod(t2).longDate())
    let start = DateTime.create({ years: 1 });
    let secsToAdd = new DTMod({ seconds: (100 * 365 + 24) * 24 * 60 * 60 }); // 100 years worth of seconds
    console.log("100 years seconds ", start, secsToAdd, start.add(secsToAdd).longDate());
    console.log("leap year Feb 29", DateTime.create({ years: 2020, months: 1, days: 27 }).add(DTMod.create({ days: 1 })));
    console.log("leap year March 1st", DateTime.create({ years: 2020, months: 1, days: 27 }).add(DTMod.create({ days: 2 })));
    d1 = DateTime.now().add(DTMod.create({ years: -1 }));
    console.log("-1 year", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(DTMod.create({ months: -1 }));
    console.log("-1 months", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(DTMod.create({ days: -10 }));
    console.log("-10 days", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(DTMod.create({ hours: -36 }));
    console.log("-36 hours", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    //@ts-ignore
    // DTCalc.createFromData(Greyhawk);
    d0 = DateTime.now();
    console.log("now", DateTime.now().longDate());
    d1 = DateTime.now().add(new DTMod({ days: 1 }));
    console.log("+1 day", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(new DTMod({ days: 364 }));
    console.log("+364 day", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(new DTMod({ days: 182 }));
    console.log("+182 days", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(DTMod.create({ months: 3 }));
    console.log("3 month timespec", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(new DTMod({ days: 364 * 3 }));
    console.log("3 years of days timespec", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(new DTMod({ years: 10 }));
    console.log("+10 years", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
    d1 = DateTime.now().add(new DTMod({ months: 16 }));
    console.log("+16 months", d0, d1, DateTime.daysBetween(d0, d1), d1.longDate());
};
