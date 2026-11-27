import { aiKeyChangedEmail } from "@astro/server";
import { z } from "zod";
import { getMailer, type Staff } from "./auth";
import { ownerEmail } from "./ai";
import { getDb } from "./db";
import { getEnv } from "./env";
import { emailT } from "./text";

/** Shared input rules for the AI routes. Model names go into provider URLs, so they're kept to a safe alphabet. */
export const serviceFields = z.object({
  provider: z.enum(["anthropic", "openai", "gemini", "openai_compatible"]),
  name: z.string().trim().min(1).max(60),
  company: z.string().trim().min(1).max(60),
  model: z.string().trim().regex(/^[A-Za-z0-9._:/-]{1,100}$/),
  baseUrl: z.string().max(300).nullish(),
  enabled: z.boolean().default(true)
});
export const apiKey = z.string().trim().min(8).max(500).regex(/^[\x21-\x7e]+$/);

/** Emails the owner whenever a key changes, so a change they didn't make is noticed. */
export async function alertOwner(actor: Staff, service: string, last4: string): Promise<void> {
  if (getEnv().OWNER_ALERTS !== "on") return;
  const to = await ownerEmail(getDb());
  if (to) await getMailer().send(aiKeyChangedEmail(to, { service, last4, by: actor.email, at: new Date() }, await emailT(getDb())));
}
