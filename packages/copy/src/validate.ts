import type { CopyEntry } from "./types.ts";

/** The {name} placeholders a text uses, sorted and without repeats. */
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map((m) => m[1]!))].sort();
}

// Line breaks (\n, \r) are checked separately; every other control character is refused.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Whether an override can replace an entry's default. Markup is allowed as plain text: every surface renders
 * wording escaped, never as HTML.
 */
export function validateOverride(entry: CopyEntry, value: string): { ok: true } | { ok: false; reason: "too_long" | "placeholders" | "control_chars" | "line_breaks" | "empty" } {
  if (value.trim() === "") return { ok: false, reason: "empty" };
  if (CONTROL.test(value)) return { ok: false, reason: "control_chars" };
  // Only where the default has one: never in email subjects, buttons or labels.
  if (/[\r\n]/.test(value) && !entry.default.includes("\n")) return { ok: false, reason: "line_breaks" };
  if (value.length > entry.max) return { ok: false, reason: "too_long" };
  const want = [...entry.placeholders].sort();
  const got = placeholdersIn(value);
  if (got.length !== want.length || got.some((p, i) => p !== want[i])) return { ok: false, reason: "placeholders" };
  return { ok: true };
}

export function resolve(entry: CopyEntry, overrides: Readonly<Record<string, string>>): string {
  return overrides[entry.key] ?? entry.default;
}

/** Replaces {name} with values.name. Placeholders without a value stay as they are. */
export function fill(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{([a-z][a-z0-9_]*)\}/g, (m, name: string) => values[name] ?? m);
}
