"use client";

import type { ApiResult } from "@/lib/client";

/** What to tell someone when a text route refuses. */
export function textError(res: ApiResult): string {
  switch (res.data.error) {
    case "too_soon":
      return "You can publish again in 2 minutes.";
    case "too_long":
      return "That's longer than this text allows.";
    case "placeholders":
      return "Keep every {placeholder} from the default, and add no new ones.";
    case "control_chars":
      return "Use plain text only (no tabs or hidden characters).";
    case "empty":
      return "Write something, or use the default.";
    case "invalid_override":
      return "A draft no longer fits its rules. Open it and fix it, or use the default.";
    case "forbidden":
      return "Your role can't do that.";
    case "network":
      return "Couldn't reach the portal. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;
// Line breaks are fine; other control characters aren't (the same rule the server applies).
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/;

/** The checks the editor shows as you type. The server checks again on save and publish. */
export function checkText(value: string, max: number, placeholders: readonly string[]) {
  const used = [...new Set([...value.matchAll(PLACEHOLDER)].map((m) => m[1]!))];
  const missing = placeholders.filter((p) => !used.includes(p));
  const extra = used.filter((p) => !placeholders.includes(p));
  const length = value.length;
  const plain = !CONTROL.test(value);
  const empty = value.trim() === "";
  return { length, tooLong: length > max, plain, missing, extra, empty, ok: !empty && length <= max && plain && missing.length === 0 && extra.length === 0 };
}

export const changes = (n: number) => `${n} change${n === 1 ? "" : "s"}`;
