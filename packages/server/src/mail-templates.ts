import { catalogue, fill, type EmailKey } from "@astro/copy";
import type { Mail } from "./mail";

/** Email wording lookup. The app passes its published wording; without one, the catalogue defaults are used. */
export type EmailT = (key: EmailKey, values?: Readonly<Record<string, string>>) => string;
export const defaultEmailT: EmailT = (key, values) => fill(catalogue[key].default, values ?? {});

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Plain, brand-styled HTML with no images or tracking. */
function layout(t: EmailT, title: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font:16px/1.6 Inter,Arial,sans-serif;color:#EDE6D6">${escape(p)}</p>`).join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escape(action.url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#D8B46A;color:#0B0B14;font:600 16px Inter,Arial,sans-serif;text-decoration:none">${escape(action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0B0B14;padding:32px 16px"><div style="max-width:480px;margin:0 auto"><p style="margin:0 0 24px;font:600 22px Georgia,serif;color:#D8B46A">Astro</p><h1 style="margin:0 0 16px;font:500 28px Georgia,serif;color:#EDE6D6">${escape(title)}</h1>${body}${button}<p style="margin:32px 0 0;font:13px/1.5 Inter,Arial,sans-serif;color:#8C88A6">${escape(t("email.footer"))}</p></div></body></html>`;
}

function message(t: EmailT, to: string, kind: "verify" | "reset" | "registered", url: string): Mail {
  const title = t(`email.${kind}.title`);
  const lines = [t(`email.${kind}.line1`), t(`email.${kind}.line2`)];
  return { to, subject: t(`email.${kind}.subject`), text: `${title}\n\n${lines.join("\n")}\n\n${url}\n`, html: layout(t, title, lines, { label: t(`email.${kind}.button`), url }) };
}

export const verifyEmail = (to: string, url: string, t: EmailT = defaultEmailT): Mail => message(t, to, "verify", url);
export const resetPassword = (to: string, url: string, t: EmailT = defaultEmailT): Mail => message(t, to, "reset", url);
export const alreadyRegistered = (to: string, signInUrl: string, t: EmailT = defaultEmailT): Mail => message(t, to, "registered", signInUrl);

const ROLE_WORDS: Record<string, EmailKey> = {
  admin: "email.invite.role_admin",
  moderator: "email.invite.role_moderator",
  reader: "email.invite.role_reader"
};

const formatDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** An invitation to join Astro's team. The link opens the app, where the person signs in and sets up 2-step sign-in. */
export function inviteEmail(to: string, role: string, url: string, expiresAt: Date, t: EmailT = defaultEmailT): Mail {
  const words = ROLE_WORDS[role];
  const title = t("email.invite.title", { role: words ? t(words) : role });
  const lines = [t("email.invite.line1"), t("email.invite.line2", { date: formatDay(expiresAt) })];
  return { to, subject: t("email.invite.subject"), text: `${title}\n\n${lines.join("\n")}\n\n${url}\n`, html: layout(t, title, lines, { label: t("email.invite.button"), url }) };
}

/** Offers an existing account a role: the reader role, a portal role, or both. The link opens the app's /offer page. */
export function roleOfferEmail(to: string, roles: { reader: boolean; portalRole: "admin" | "moderator" | null }, url: string, expiresAt: Date, t: EmailT = defaultEmailT): Mail {
  const words = [roles.portalRole ? t(`email.offer.role_${roles.portalRole}`) : null, roles.reader ? t("email.offer.role_reader") : null].filter((w): w is string => Boolean(w));
  const title = t("email.offer.title", { roles: words.join(` ${t("email.offer.and")} `) });
  const lines = [t("email.offer.line1"), t("email.offer.line2", { date: formatDay(expiresAt) })];
  return { to, subject: t("email.offer.subject"), text: `${title}\n\n${lines.join("\n")}\n\n${url}\n`, html: layout(t, title, lines, { label: t("email.offer.button"), url }) };
}

/** Tells the owner an AI service key changed. Never includes the key. */
export function aiKeyChangedEmail(to: string, details: { service: string; last4: string; by: string; at: Date }, t: EmailT = defaultEmailT): Mail {
  const title = t("email.ai_key.title");
  const lines = [t("email.ai_key.line1", { service: details.service, by: details.by, date: formatDay(details.at), last4: details.last4 }), t("email.ai_key.line2")];
  return { to, subject: t("email.ai_key.subject"), text: `${title}\n\n${lines.join("\n")}\n`, html: layout(t, title, lines) };
}
