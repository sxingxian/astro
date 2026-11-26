"use client";

import { localTimeZone, postJson } from "../client";

export interface DeckState {
  stage: "single" | "majors" | "minors";
  size: number;
  fingerprint: string;
  picks: number[];
}

export interface StartState {
  sessionId: string;
  status: "picking" | "complete";
  decks: DeckState[];
}

export type StartOutcome =
  | { kind: "ready"; state: StartState }
  | { kind: "done"; sessionId: string }
  | { kind: "needs-check" }
  | { kind: "sign-up" }
  | { kind: "error"; message: string };

export async function startReading(spread: "one" | "three", turnstileToken?: string): Promise<StartOutcome> {
  const res = await postJson<StartState & { sessionId?: string }>("/api/draw/start", { spread, timeZone: localTimeZone(), turnstileToken });
  if (res.ok) return res.data.status === "complete" ? { kind: "done", sessionId: res.data.sessionId } : { kind: "ready", state: res.data };
  if (res.status === 409 && res.data.error === "daily_limit" && res.data.sessionId) return { kind: "done", sessionId: res.data.sessionId };
  if (res.status === 403 && res.data.error === "verification_failed") return { kind: "needs-check" };
  if (res.status === 403 && res.data.error === "guest_spread") return { kind: "sign-up" };
  if (res.status === 429) return { kind: "error", message: "You've reached today's limit for guest readings from this network. Create a free account to keep drawing." };
  return { kind: "error", message: "The deck couldn't be shuffled just now. Please try again." };
}

export async function pickCards(sessionId: string, stage: DeckState["stage"], positions: number[]): Promise<boolean> {
  return (await postJson("/api/draw/pick", { sessionId, stage, positions })).ok;
}
