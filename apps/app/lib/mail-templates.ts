import { alreadyRegistered as registered, defaultEmailT, resetPassword as reset, verifyEmail as verify, type EmailT } from "@astro/server";
import { loadCopy } from "./copy";
import { getDb } from "./db";

/** The published email wording. If it can't be read, the email still goes out with the default wording. */
async function emailT(): Promise<EmailT> {
  try {
    return await loadCopy(getDb());
  } catch (e) {
    console.error("email wording unavailable, using defaults", e);
    return defaultEmailT;
  }
}

export const verifyEmail = async (to: string, url: string) => verify(to, url, await emailT());
export const resetPassword = async (to: string, url: string) => reset(to, url, await emailT());
export const alreadyRegistered = async (to: string, signInUrl: string) => registered(to, signInUrl, await emailT());
