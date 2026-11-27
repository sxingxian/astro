import type { EntrySpec } from "./types.ts";

/** The app's wording. Filled in task B3. */
export const app = {} as const satisfies Record<`app.${string}`, EntrySpec>;
