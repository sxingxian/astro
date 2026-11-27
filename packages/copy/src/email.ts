import type { EntrySpec } from "./types.ts";

/** Email wording. Filled in task B3. */
export const email = {} as const satisfies Record<`email.${string}`, EntrySpec>;
