/** The date picker's arithmetic (day, month and year dropdowns), kept apart from the screen so it can be tested. */
export interface Parts {
  day: number;
  month: number;
  year: number;
}

export const daysIn = (month: number, year: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function dateParts(value: string): Parts {
  const [y, m, d] = value.split("-").map(Number);
  return { day: d || 1, month: m || 1, year: y || new Date().getUTCFullYear() };
}

/** "YYYY-MM-DD", with the day moved back into the month if it no longer fits (31 Feb → 28 Feb). */
export function joinDate({ day, month, year }: Parts): string {
  const d = Math.min(day, daysIn(month, year));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** This year and the ten before it, newest first, plus a saved year older than that. */
export function yearsFor(thisYear: number, saved: number): number[] {
  const years = Array.from({ length: 11 }, (_, i) => thisYear - i);
  return saved < years.at(-1)! ? [...years, saved] : years;
}
