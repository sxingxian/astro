import { app } from "./app.ts";
import { email } from "./email.ts";
import { landing } from "./landing.ts";
import type { CopyEntry, EntrySpec, Surface } from "./types.ts";
import { placeholdersIn } from "./validate.ts";

export type LandingKey = keyof typeof landing;
export type AppKey = keyof typeof app;
export type EmailKey = keyof typeof email;
export type CopyKey = LandingKey | AppKey | EmailKey;

function build<K extends string>(surface: Surface, specs: Record<K, EntrySpec>): Record<K, CopyEntry> {
  return Object.fromEntries(
    (Object.entries(specs) as [K, EntrySpec][]).map(([key, s]) => [key, { ...s, key, surface, placeholders: placeholdersIn(s.default) }])
  ) as unknown as Record<K, CopyEntry>;
}

/** Every piece of editable wording. Defaults live here; overrides and published versions live in the database. */
export const catalogue: Record<CopyKey, CopyEntry> = {
  ...build("landing", landing),
  ...build("app", app),
  ...build("email", email)
};

export const isCopyKey = (k: string): k is CopyKey => Object.hasOwn(catalogue, k);
export const entriesFor = (surface: Surface): CopyEntry[] => Object.values(catalogue).filter((e) => e.surface === surface);

export type { CopyEntry, Surface } from "./types.ts";
export { fill, placeholdersIn, resolve, validateOverride } from "./validate.ts";
