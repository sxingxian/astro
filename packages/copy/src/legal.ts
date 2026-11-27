import { DOC_LIMITS, docOf } from "./doc.ts";
import type { EntrySpec } from "./types.ts";

const where = "Its own page in the app";

/** The long legal pages. Each is a document (see doc.ts) and is published on its own. Defaults are placeholders. */
export const legal = {
  "legal.terms": {
    group: "Legal",
    label: "Terms of use",
    where,
    format: "doc",
    max: DOC_LIMITS.bytes,
    default: docOf([{ h: "Terms of use" }, { p: "Replace this with your terms of use before Astro opens to the public. A legal review is recommended." }])
  },
  "legal.privacy": {
    group: "Legal",
    label: "Privacy notice",
    where,
    format: "doc",
    max: DOC_LIMITS.bytes,
    default: docOf([{ h: "Privacy notice" }, { p: "Replace this with your privacy notice before Astro opens to the public. A legal review is recommended." }])
  },
  "legal.guidelines": {
    group: "Legal",
    label: "Reader guidelines",
    where: "Shown to readers when they accept the role, and again when it changes",
    format: "doc",
    max: DOC_LIMITS.bytes,
    default: docOf([
      { h: "Reader guidelines" },
      { p: "Never share or ask for contact details." },
      { p: "Don't give medical, legal or money advice." },
      { p: "Reply within 48 hours of taking a request." }
    ])
  }
} as const satisfies Record<`legal.${string}`, EntrySpec>;
