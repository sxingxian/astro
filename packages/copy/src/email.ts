import type { EntrySpec } from "./types.ts";

const S = 40; // buttons
const M = 120; // one sentence
const L = 300; // a short paragraph

/** Email wording. Defaults are the launch wording, word for word. Emails are plain text and escaped HTML. */
export const email = {
  "email.footer": { group: "All emails", label: "Footer", where: "Bottom of every email", default: "You're receiving this because of activity on your Astro account. If it wasn't you, you can ignore this email.", max: L },

  "email.verify.subject": { group: "Confirm email", label: "Subject", where: "Inbox", default: "Confirm your email for Astro", max: M },
  "email.verify.title": { group: "Confirm email", label: "Heading", where: "Top of the email", default: "Confirm your email", max: M },
  "email.verify.line1": { group: "Confirm email", label: "First paragraph", where: "Email body", default: "Welcome to Astro. Confirm your email address to finish creating your account.", max: L },
  "email.verify.line2": { group: "Confirm email", label: "Second paragraph", where: "Email body", default: "This link expires in one hour.", max: L },
  "email.verify.button": { group: "Confirm email", label: "Button", where: "Email body", default: "Confirm email", max: S },

  "email.reset.subject": { group: "Reset password", label: "Subject", where: "Inbox", default: "Reset your Astro password", max: M },
  "email.reset.title": { group: "Reset password", label: "Heading", where: "Top of the email", default: "Reset your password", max: M },
  "email.reset.line1": { group: "Reset password", label: "First paragraph", where: "Email body", default: "Someone asked to reset the password for your Astro account. If it was you, use the link below.", max: L },
  "email.reset.line2": { group: "Reset password", label: "Second paragraph", where: "Email body", default: "This link expires in one hour. Resetting your password signs you out everywhere else.", max: L },
  "email.reset.button": { group: "Reset password", label: "Button", where: "Email body", default: "Choose a new password", max: S },

  "email.registered.subject": { group: "Already registered", label: "Subject", where: "Inbox", default: "You already have an Astro account", max: M },
  "email.registered.title": { group: "Already registered", label: "Heading", where: "Top of the email", default: "You already have an account", max: M },
  "email.registered.line1": { group: "Already registered", label: "First paragraph", where: "Email body", default: "Someone tried to create an Astro account with this email, but you already have one.", max: L },
  "email.registered.line2": { group: "Already registered", label: "Second paragraph", where: "Email body", default: "If it was you, sign in instead, or reset your password if you've forgotten it.", max: L },
  "email.registered.button": { group: "Already registered", label: "Button", where: "Email body", default: "Sign in", max: S },

  "email.invite.subject": { group: "Team invitation", label: "Subject", where: "Inbox", default: "You're invited to join Astro", max: M },
  "email.invite.title": { group: "Team invitation", label: "Heading", where: "Top of the email", default: "You're invited to join Astro as {role}", max: M },
  "email.invite.line1": { group: "Team invitation", label: "First paragraph", where: "Email body", default: "Open the link to accept. You'll sign in to Astro with this email address (or create an account), and turn on 2-step sign-in with an authenticator app. Your access starts after that.", max: L },
  "email.invite.line2": { group: "Team invitation", label: "Second paragraph", where: "Email body", default: "This invitation expires on {date}. If you weren't expecting it, you can ignore this email.", max: L },
  "email.invite.button": { group: "Team invitation", label: "Button", where: "Email body", default: "Accept invitation", max: S },
  "email.invite.role_admin": { group: "Team invitation", label: "Role words: admin", where: "Inside the heading", default: "an admin", max: S },
  "email.invite.role_moderator": { group: "Team invitation", label: "Role words: moderator", where: "Inside the heading", default: "a moderator", max: S },
  "email.invite.role_reader": { group: "Team invitation", label: "Role words: reader", where: "Inside the heading", default: "a reader", max: S },

  "email.offer.subject": { group: "Role offer", label: "Subject", where: "Inbox", default: "You've been offered a role on Astro", max: M },
  "email.offer.title": { group: "Role offer", label: "Heading", where: "Top of the email", default: "You've been offered {roles}", max: M },
  "email.offer.line1": { group: "Role offer", label: "First paragraph", where: "Email body", default: "Open Astro and sign in to this account to see the offer. You'll need 2-step sign-in with an authenticator app, and readers also agree to the reader guidelines. Nothing changes until you accept.", max: L },
  "email.offer.line2": { group: "Role offer", label: "Second paragraph", where: "Email body", default: "This offer expires on {date}. If you weren't expecting it, you can ignore this email.", max: L },
  "email.offer.button": { group: "Role offer", label: "Button", where: "Email body", default: "See the offer", max: S },
  "email.offer.role_reader": { group: "Role offer", label: "Role words: reader", where: "Inside the heading", default: "the reader role", max: S },
  "email.offer.role_moderator": { group: "Role offer", label: "Role words: moderator", where: "Inside the heading", default: "the moderator role", max: S },
  "email.offer.role_admin": { group: "Role offer", label: "Role words: admin", where: "Inside the heading", default: "the admin role", max: S },
  "email.offer.and": { group: "Role offer", label: "Joining word", where: "Between two roles in the heading", default: "and", max: S },

  "email.ai_key.subject": { group: "AI key changed", label: "Subject", where: "Owner's inbox", default: "Astro: an AI service key was changed", max: M },
  "email.ai_key.title": { group: "AI key changed", label: "Heading", where: "Top of the email", default: "An AI service key was changed", max: M },
  "email.ai_key.line1": { group: "AI key changed", label: "First paragraph", where: "Email body", default: "The key for {service} was replaced by {by} on {date}. It now ends in {last4}.", max: L },
  "email.ai_key.line2": { group: "AI key changed", label: "Second paragraph", where: "Email body", default: "If this wasn't you or someone you trust, sign in to the admin portal, replace the key, and check the audit log.", max: L }
} as const satisfies Record<`email.${string}`, EntrySpec>;
