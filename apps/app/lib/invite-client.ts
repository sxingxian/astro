"use client";

const KEY = "astro-invite";
const TTL = 72 * 3600_000;

/** Keeps an invite token across sign-in, sign-up and email confirmation in this browser, for up to 72 hours. */
export function savePendingInvite(token: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    /* storage can be unavailable (private mode); the link still works when opened again */
  }
}

export function pendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw) as { token?: unknown; at?: unknown };
    if (typeof token !== "string" || typeof at !== "number" || Date.now() - at > TTL) return null;
    return token;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Where to go after signing in: back to a pending invite, or Today. */
export const afterSignIn = () => (pendingInvite() ? "/invite" : "/today");
