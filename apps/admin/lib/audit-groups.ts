/** The Action filter on the Audit screen: each group is every logged action with these prefixes. */
export const AUDIT_GROUPS = {
  text: { label: "Text published", prefixes: ["text."] },
  settings: { label: "Site settings", prefixes: ["settings."] },
  ai: { label: "AI settings", prefixes: ["ai."] },
  team: { label: "Roles and invites", prefixes: ["team.", "reader."] },
  users: { label: "Users", prefixes: ["user."] },
  sign_in: { label: "Sign-ins", prefixes: ["auth."] }
} as const;
export type AuditGroup = keyof typeof AUDIT_GROUPS;
