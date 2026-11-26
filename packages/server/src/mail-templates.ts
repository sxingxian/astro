import type { Mail } from "./mail";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Plain, brand-styled HTML with no images or tracking. */
function layout(title: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font:16px/1.6 Inter,Arial,sans-serif;color:#EDE6D6">${escape(p)}</p>`).join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escape(action.url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#D8B46A;color:#0B0B14;font:600 16px Inter,Arial,sans-serif;text-decoration:none">${escape(action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0B0B14;padding:32px 16px"><div style="max-width:480px;margin:0 auto"><p style="margin:0 0 24px;font:600 22px Georgia,serif;color:#D8B46A">Astro</p><h1 style="margin:0 0 16px;font:500 28px Georgia,serif;color:#EDE6D6">${escape(title)}</h1>${body}${button}<p style="margin:32px 0 0;font:13px/1.5 Inter,Arial,sans-serif;color:#8C88A6">You're receiving this because of activity on your Astro account. If it wasn't you, you can ignore this email.</p></div></body></html>`;
}

export function verifyEmail(to: string, url: string): Mail {
  const title = "Confirm your email";
  const lines = ["Welcome to Astro. Confirm your email address to finish creating your account.", "This link expires in one hour."];
  return { to, subject: "Confirm your email for Astro", text: `${title}\n\n${lines.join("\n")}\n\n${url}\n`, html: layout(title, lines, { label: "Confirm email", url }) };
}

export function resetPassword(to: string, url: string): Mail {
  const title = "Reset your password";
  const lines = ["Someone asked to reset the password for your Astro account. If it was you, use the link below.", "This link expires in one hour. Resetting your password signs you out everywhere else."];
  return { to, subject: "Reset your Astro password", text: `${title}\n\n${lines.join("\n")}\n\n${url}\n`, html: layout(title, lines, { label: "Choose a new password", url }) };
}

export function alreadyRegistered(to: string, signInUrl: string): Mail {
  const title = "You already have an account";
  const lines = ["Someone tried to create an Astro account with this email, but you already have one.", "If it was you, sign in instead, or reset your password if you've forgotten it."];
  return { to, subject: "You already have an Astro account", text: `${title}\n\n${lines.join("\n")}\n\n${signInUrl}\n`, html: layout(title, lines, { label: "Sign in", url: signInUrl }) };
}

const ROLE_WORDS: Record<string, string> = {
  admin: "an admin",
  moderator: "a moderator",
  reader: "a reader"
};

const formatDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** An invitation to join Astro's team. The link opens the app, where the person signs in and sets up 2-step sign-in. */
export function inviteEmail(to: string, role: string, url: string, expiresAt: Date): Mail {
  const title = `You're invited to join Astro as ${ROLE_WORDS[role] ?? role}`;
  const lines = [
    "Open the link to accept. You'll sign in to Astro with this email address (or create an account), and turn on 2-step sign-in with an authenticator app. Your access starts after that.",
    `This invitation expires on ${formatDay(expiresAt)}. If you weren't expecting it, you can ignore this email.`
  ];
  return { to, subject: "You're invited to join Astro", text: `${title}\n\n${lines.join("\n")}\n\n${url}\n`, html: layout(title, lines, { label: "Accept invitation", url }) };
}

/** Tells the owner an AI service key changed. Never includes the key. */
export function aiKeyChangedEmail(to: string, details: { service: string; last4: string; by: string; at: Date }): Mail {
  const title = "An AI service key was changed";
  const lines = [
    `The key for ${details.service} was replaced by ${details.by} on ${formatDay(details.at)}. It now ends in ${details.last4}.`,
    "If this wasn't you or someone you trust, sign in to the admin portal, replace the key, and check the audit log."
  ];
  return { to, subject: "Astro: an AI service key was changed", text: `${title}\n\n${lines.join("\n")}\n`, html: layout(title, lines) };
}
