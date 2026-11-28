import { applyOverrides, getMeaning, type Meaning } from "@astro/meanings";
import { useMemo } from "react";
import { useSession } from "./session";

/**
 * Card meanings with the owner's published wording on top. Kept out of the session so the 78 meanings load only
 * with the screens that show them (reading, check-in), not on every first visit.
 */
export function useMeaning(): (cardId: string) => Meaning {
  const { wording } = useSession();
  return useMemo(() => (cardId: string) => applyOverrides(getMeaning(cardId), wording.meanings), [wording.meanings]);
}
