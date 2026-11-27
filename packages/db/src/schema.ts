import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, char, check, customType, date, index, integer, jsonb, pgTable, primaryKey, real, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ---------- Better Auth (property names match Better Auth's field names) ---------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  timeZone: text("time_zone").notNull().default("UTC"),
  timeZoneChangedAt: ts("time_zone_changed_at"),
  checkInsEnabled: boolean("check_ins_enabled").notNull().default(true),
  /** Set by staff (admin portal). A disabled person can't sign in and has no sessions. */
  disabledAt: ts("disabled_at")
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    /** Which Better Auth instance made the session. The app and the admin portal each accept only their own. */
    surface: text("surface", { enum: ["app", "admin"] }).notNull().default("app")
  },
  (t) => [index("session_user_idx").on(t.userId), check("session_surface_check", sql`${t.surface} in ('app', 'admin')`)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow()
  },
  (t) => [index("account_user_idx").on(t.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow()
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: ts("locked_until")
  },
  (t) => [index("two_factor_user_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)]
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull()
});

/* ---------- Draws ---------- */

export const drawSession = pgTable(
  "draw_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    guestHash: text("guest_hash"),
    spread: text("spread", { enum: ["one", "three"] }).notNull(),
    localDay: date("local_day", { mode: "string" }).notNull(),
    timeZone: text("time_zone").notNull(),
    status: text("status", { enum: ["picking", "complete"] }).notNull().default("picking"),
    private: boolean("private").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    completedAt: ts("completed_at")
  },
  (t) => [
    check("draw_session_spread_check", sql`${t.spread} in ('one', 'three')`),
    check("draw_session_status_check", sql`${t.status} in ('picking', 'complete')`),
    check("draw_session_actor_check", sql`(${t.userId} is null) <> (${t.guestHash} is null)`),
    uniqueIndex("draw_session_user_day_uq").on(t.userId, t.spread, t.localDay).where(sql`${t.userId} is not null`),
    uniqueIndex("draw_session_guest_day_uq").on(t.guestHash, t.localDay).where(sql`${t.guestHash} is not null`),
    index("draw_session_user_completed_idx").on(t.userId, t.completedAt),
    index("draw_session_guest_created_idx").on(t.createdAt).where(sql`${t.guestHash} is not null`)
  ]
);

export const drawDeck = pgTable(
  "draw_deck",
  {
    sessionId: uuid("session_id").notNull().references(() => drawSession.id, { onDelete: "cascade" }),
    stage: text("stage", { enum: ["single", "majors", "minors"] }).notNull(),
    order: text("order").array().notNull(),
    orientations: text("orientations").array().notNull(),
    salt: text("salt").notNull(),
    fingerprint: char("fingerprint", { length: 32 }).notNull(),
    picks: integer("picks").array().notNull().default(sql`'{}'::integer[]`)
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.stage] }), check("draw_deck_stage_check", sql`${t.stage} in ('single', 'majors', 'minors')`)]
);

export const readingNote = pgTable(
  "reading_note",
  {
    sessionId: uuid("session_id").primaryKey().references(() => drawSession.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow()
  },
  (t) => [check("reading_note_body_length", sql`char_length(${t.body}) <= 2000`)]
);

export const checkIn = pgTable(
  "check_in",
  {
    sessionId: uuid("session_id").primaryKey().references(() => drawSession.id, { onDelete: "cascade" }),
    outcome: text("outcome", { enum: ["fit", "partly", "not", "skipped"] }).notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow()
  },
  (t) => [
    check("check_in_outcome_check", sql`${t.outcome} in ('fit', 'partly', 'not', 'skipped')`),
    check("check_in_note_length", sql`${t.note} is null or char_length(${t.note}) <= 500`)
  ]
);

export const guestDayCap = pgTable(
  "guest_day_cap",
  {
    ipHash: text("ip_hash").notNull(),
    localDay: date("local_day", { mode: "string" }).notNull(),
    count: integer("count").notNull().default(0)
  },
  (t) => [primaryKey({ columns: [t.ipHash, t.localDay] })]
);

/* ---------- Settings and development mail ---------- */

export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull()
});

/** Development and test only: the outbox mail driver writes here instead of sending. */
export const mailOutbox = pgTable("mail_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  text: text("text").notNull(),
  createdAt: ts("created_at").notNull().defaultNow()
});

/* ---------- Admin portal ---------- */

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });

export const STAFF_ROLES = ["owner", "admin", "moderator"] as const;
/** What an invite can carry: a portal role or the reader role (readers work in the app). */
export const INVITE_ROLES = ["admin", "moderator", "reader"] as const;

/** One active role per person. Exactly one active owner (unique partial index). */
export const staffRole = pgTable(
  "staff_role",
  {
    userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: STAFF_ROLES }).notNull(),
    grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
    grantedAt: ts("granted_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at")
  },
  (t) => [
    check("staff_role_role_check", sql`${t.role} in ('owner', 'admin', 'moderator')`),
    uniqueIndex("staff_role_one_owner_uq").on(sql`(true)`).where(sql`${t.role} = 'owner' and ${t.revokedAt} is null`)
  ]
);

export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: text("role", { enum: INVITE_ROLES }).notNull(),
    tokenHash: bytea("token_hash").notNull().unique(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    revokedAt: ts("revoked_at")
  },
  (t) => [check("invite_role_check", sql`${t.role} in ('admin', 'moderator', 'reader')`), index("invite_email_idx").on(sql`lower(${t.email})`)]
);

/** The reader role, held alone or beside a portal role. Active while revoked_at is null; never deleted. */
export const readerRole = pgTable("reader_role", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
  grantedAt: ts("granted_at").notNull().defaultNow(),
  revokedAt: ts("revoked_at")
});

/** A role offered to an existing account: the reader role, a portal role, or both. Accepted only by that account. */
export const roleOffer = pgTable(
  "role_offer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    reader: boolean("reader").notNull(),
    portalRole: text("portal_role", { enum: ["admin", "moderator"] }),
    offeredBy: text("offered_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    revokedAt: ts("revoked_at")
  },
  (t) => [
    check("role_offer_portal_role_check", sql`${t.portalRole} in ('admin', 'moderator')`),
    check("role_offer_something_check", sql`${t.reader} or ${t.portalRole} is not null`),
    index("role_offer_user_idx").on(t.userId)
  ]
);

/** Which published version of the reader guidelines each reader accepted (0 = the built-in default). */
export const guidelineAcceptance = pgTable(
  "guideline_acceptance",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    version: bigint("version", { mode: "number" }).notNull(),
    acceptedAt: ts("accepted_at").notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.userId, t.version] })]
);

/** Append-only: a trigger rejects UPDATE and DELETE, and runtime roles may only INSERT. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    summary: jsonb("summary").notNull().default(sql`'{}'::jsonb`),
    ipHash: text("ip_hash"),
    at: ts("at").notNull().defaultNow()
  },
  (t) => [index("audit_log_at_idx").on(t.at), index("audit_log_actor_idx").on(t.actorId, t.at)]
);

export const AI_PROVIDERS = ["anthropic", "openai", "gemini", "openai_compatible"] as const;

/** An AI service the owner added. The key is AES-256-GCM encrypted (see @astro/server ai/crypto). */
export const aiService = pgTable(
  "ai_service",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider", { enum: AI_PROVIDERS }).notNull(),
    name: text("name").notNull(),
    company: text("company").notNull(),
    baseUrl: text("base_url"),
    model: text("model").notNull(),
    keyCiphertext: bytea("key_ciphertext"),
    keyIv: bytea("key_iv"),
    keyLast4: text("key_last4"),
    enabled: boolean("enabled").notNull().default(true),
    maxTokens: integer("max_tokens").notNull().default(1200),
    temperature: real("temperature").notNull().default(0.7),
    timeoutMs: integer("timeout_ms").notNull().default(30_000),
    lastTestAt: ts("last_test_at"),
    lastTestOk: boolean("last_test_ok"),
    lastError: text("last_error"),
    cooldownUntil: ts("cooldown_until"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: ts("updated_at").notNull().defaultNow()
  },
  (t) => [
    check("ai_service_provider_check", sql`${t.provider} in ('anthropic', 'openai', 'gemini', 'openai_compatible')`),
    check("ai_service_base_url_check", sql`(${t.provider} = 'openai_compatible') = (${t.baseUrl} is not null)`)
  ]
);

export const AI_ROLES = ["writer", "checker_1", "checker_2"] as const;

/** Ordered services per role: position 0 is the main service, 1+ are fallbacks. */
export const aiRoleSlot = pgTable(
  "ai_role_slot",
  {
    role: text("role", { enum: AI_ROLES }).notNull(),
    position: smallint("position").notNull(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => aiService.id, { onDelete: "cascade" })
  },
  (t) => [primaryKey({ columns: [t.role, t.position] }), check("ai_role_slot_role_check", sql`${t.role} in ('writer', 'checker_1', 'checker_2')`)]
);

export const authSchema = { user, session, account, verification, twoFactor, rateLimit };

// Text editing (plan 3, part B). Drafts per key, published snapshots per kind, and short-lived previews.
export const TEXT_KINDS = ["landing", "app", "meanings", "terms", "privacy", "guidelines"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

/** A draft override for one key (catalogue key, or "<card>.<field>" for meanings). Live only once published. */
export const textOverride = pgTable(
  "text_override",
  {
    key: text("key").primaryKey(),
    kind: text("kind", { enum: TEXT_KINDS }).notNull(),
    value: text("value").notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check("text_override_kind_check", sql`${t.kind} in ('landing', 'app', 'meanings', 'terms', 'privacy', 'guidelines')`)]
);

/** A published set of overrides for one kind. The newest row per kind is live; older rows are history. */
export const textVersion = pgTable(
  "text_version",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind", { enum: TEXT_KINDS }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, string>>().notNull(),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note")
  },
  (t) => [check("text_version_kind_check", sql`${t.kind} in ('landing', 'app', 'meanings', 'terms', 'privacy', 'guidelines')`), index("text_version_kind_idx").on(t.kind, t.id)]
);

/** A draft snapshot the app shows for 30 minutes to whoever has the id (?astro-preview=<id>). */
export const textPreview = pgTable(
  "text_preview",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: TEXT_KINDS }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, string>>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (t) => [check("text_preview_kind_check", sql`${t.kind} in ('landing', 'app', 'meanings', 'terms', 'privacy', 'guidelines')`)]
);
