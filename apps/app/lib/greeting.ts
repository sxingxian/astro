export type DayPart = "morning" | "afternoon" | "evening";
const partOf = (hour: number): DayPart => (hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening");

/** The part of the day and "Friday · 27 November", in `timeZone` (or the runtime's own zone when null). */
export function localGreeting(timeZone: string | null, now: Date = new Date()): { part: DayPart; day: string } {
  const opts = timeZone ? { timeZone } : {};
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", ...opts }).format(now));
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", ...opts }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { part: partOf(hour), day: `${get("weekday")} · ${get("day")} ${get("month")}` };
}
