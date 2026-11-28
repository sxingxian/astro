/**
 * The one way a date is shown, in the app and in emails (owner, 28 Nov): "01 Jan 2016". Built here rather than by the
 * browser, so no language setting changes it.
 */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS: Record<string, string> = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const zoned = (d: Date, timeZone: string) => {
  const read = (tz: string) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(d).map((p) => [p.type, p.value]));
  try {
    return read(timeZone);
  } catch {
    return read("UTC"); // an unknown time zone
  }
};

/** A calendar day ("2016-01-01") as it is, or a moment (Date or ISO time) on its day in `timeZone`. "" if broken. */
export function formatDate(value: string | Date, timeZone = "UTC"): string {
  const day = typeof value === "string" ? DAY.exec(value) : null;
  if (day) return `${day[3]} ${MONTHS[Number(day[2]) - 1] ?? ""} ${day[1]}`;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const p = zoned(d, timeZone);
  return `${String(p.day).padStart(2, "0")} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

/** "Saturday": the day of the week of a moment, in `timeZone`. */
export function weekdayOf(d: Date, timeZone = "UTC"): string {
  return WEEKDAYS[String(zoned(d, timeZone).weekday)] ?? "";
}
