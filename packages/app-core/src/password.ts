import type { AppKey } from "@astro/copy";

/** A quick, local strength hint (as a wording key). The server still enforces length and checks breach lists. */
export function passwordHint(pw: string): { key: AppKey; values?: Record<string, string>; ok: boolean } {
  if (pw.length === 0) return { key: "app.password.hint_empty", ok: false };
  if (pw.length === 11) return { key: "app.password.hint_more_one", ok: false };
  if (pw.length < 12) return { key: "app.password.hint_more", values: { count: String(12 - pw.length) }, ok: false };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 16 || kinds >= 3) return { key: "app.password.hint_strong", ok: true };
  return { key: "app.password.hint_good", ok: true };
}
