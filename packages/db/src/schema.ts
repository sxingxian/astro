import { sql } from "drizzle-orm";
import { bigint, boolean, char, check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
  checkInsEnabled: boolean("check_ins_enabled").notNull().default(true)
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
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
  },
  (t) => [index("session_user_idx").on(t.userId)]
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

export const authSchema = { user, session, account, verification, twoFactor, rateLimit };
