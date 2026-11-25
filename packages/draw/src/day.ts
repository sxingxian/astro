const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, f);
  }
  return f;
}

/** True for a timezone name Intl understands, such as "Asia/Singapore". */
export function isTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** The calendar day (YYYY-MM-DD) that `at` falls on in `timeZone`. */
export function localDay(at: Date, timeZone: string): string {
  return formatter(timeZone).format(at);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The first instant after `at` whose local day differs from `at`'s. Correct across DST changes. */
export function nextLocalMidnight(at: Date, timeZone: string): Date {
  const today = localDay(at, timeZone);
  let t = at.getTime();
  for (let i = 0; i < 48 && localDay(new Date(t + HOUR), timeZone) === today; i++) t += HOUR;
  while (localDay(new Date(t), timeZone) === today) t += MINUTE;
  return new Date(Math.floor(t / MINUTE) * MINUTE);
}
