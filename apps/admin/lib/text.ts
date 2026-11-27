import { allCards } from "@astro/cards";
import { catalogue, entriesFor, fill, isCopyKey, validateOverride, type CopyEntry } from "@astro/copy";
import { and, desc, eq, schema, sql, type Db } from "@astro/db";
import { fieldText, getMeaning, MEANING_FIELDS, type MeaningField } from "@astro/meanings";
import { can, defaultEmailT, HttpError, type AuditEntry, type EmailT, type Role } from "@astro/server";

export type TextKind = "landing" | "app" | "meanings";

interface Actor {
  id: string;
  role: Role;
}

type LogEntry = Omit<AuditEntry, "actorId" | "actorRole" | "ip">;

export interface PublishDeps {
  fetch: typeof fetch;
  /** The landing page's Deploy Hook. Missing in local runs: landing publishes then skip the rebuild. */
  hookUrl: string | undefined;
  now: Date;
  /** Writes an audit entry, in the transaction it's given. */
  log: (entry: LogEntry, db: Db) => Promise<void>;
}

const LANDING_GAP_MS = 2 * 60_000;
const PREVIEW_MS = 30 * 60_000;
const HOOK_TIMEOUT_MS = 10_000;
const MEANING_KEY = /^([a-z0-9-]+)\.(.+)$/;

/** The kind and rules for an editable key: catalogue wording, or a card meaning field "<cardId>.<field>". */
export function entryFor(key: string): { kind: TextKind; entry: CopyEntry } | null {
  if (isCopyKey(key)) {
    const entry = catalogue[key];
    return { kind: entry.surface === "landing" ? "landing" : "app", entry };
  }
  const m = MEANING_KEY.exec(key);
  const spec = m && MEANING_FIELDS.find((f) => f.field === m[2]);
  if (!m || !spec) return null;
  let current: string | undefined;
  try {
    current = fieldText(getMeaning(m[1]!), spec.field);
  } catch {
    return null;
  }
  if (current === undefined) return null; // e.g. "as_clarifier" on a Major
  return { kind: "meanings", entry: { key, surface: "app", group: m[1]!, label: spec.label, where: "Card library", default: current, max: spec.max, placeholders: [] } };
}

function requireKind(actor: Actor, kind: TextKind, verb: "edit" | "publish"): void {
  const action = kind === "meanings" ? (`meanings.${verb}` as const) : (`text.${verb}` as const);
  if (!can(actor.role, action)) throw new HttpError(403, "forbidden");
}

/** Saves one override as a draft. Nothing changes for visitors until it's published. */
export async function saveDraft(db: Db, actor: Actor, key: string, value: string): Promise<{ kind: TextKind }> {
  const found = entryFor(key);
  if (!found) throw new HttpError(400, "unknown_key");
  requireKind(actor, found.kind, "edit");
  const check = validateOverride(found.entry, value);
  if (!check.ok) throw new HttpError(422, check.reason);
  await db
    .insert(schema.textOverride)
    .values({ key, kind: found.kind, value, updatedBy: actor.id })
    .onConflictDoUpdate({ target: schema.textOverride.key, set: { value, updatedBy: actor.id, updatedAt: sql`now()` } });
  return { kind: found.kind };
}

/** Drops the draft override, so the next publish uses the default again. */
export async function useDefault(db: Db, actor: Actor, key: string): Promise<{ kind: TextKind }> {
  const found = entryFor(key);
  if (!found) throw new HttpError(400, "unknown_key");
  requireKind(actor, found.kind, "edit");
  await db.delete(schema.textOverride).where(eq(schema.textOverride.key, key));
  return { kind: found.kind };
}

/** Every saved override of a kind, checked again. Keys no longer in the catalogue are left out. */
async function draftSnapshot(db: Db, kind: TextKind): Promise<Record<string, string>> {
  const rows = await db.select({ key: schema.textOverride.key, value: schema.textOverride.value }).from(schema.textOverride).where(eq(schema.textOverride.kind, kind));
  const snapshot: Record<string, string> = {};
  for (const { key, value } of rows) {
    const found = entryFor(key);
    if (!found || found.kind !== kind) continue;
    if (!validateOverride(found.entry, value).ok) throw new HttpError(422, "invalid_override");
    snapshot[key] = value;
  }
  return snapshot;
}

/** Takes the landing publish slot: at most once every 2 minutes. Inside the publish transaction, so a failed publish frees it. */
async function takeLandingSlot(db: Db, now: Date): Promise<void> {
  const key = "astro-publish-landing";
  const nowMs = now.getTime();
  const rows = await db.execute(sql`
    insert into rate_limit (id, key, count, last_request) values (${key}, ${key}, 1, ${nowMs})
    on conflict (key) do update set count = rate_limit.count + 1, last_request = excluded.last_request
    where rate_limit.last_request <= ${nowMs - LANDING_GAP_MS}
    returning 1`);
  if (rows.length === 0) throw new HttpError(429, "too_soon");
}

/** Calls the Deploy Hook. Only the response status is kept: the URL is the credential and never leaves this function. */
async function rebuildLanding(deps: PublishDeps): Promise<{ status: number }> {
  if (!deps.hookUrl) return { status: 0 };
  try {
    const res = await deps.fetch(deps.hookUrl, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(HOOK_TIMEOUT_MS) });
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}

async function publishSnapshot(db: Db, actor: Actor, kind: TextKind, snapshot: Record<string, string>, note: string, deps: PublishDeps, entry: (version: number) => LogEntry) {
  const version = await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    if (kind === "landing") await takeLandingSlot(tx, deps.now);
    const [row] = await tx
      .insert(schema.textVersion)
      .values({ kind, snapshot, publishedBy: actor.id, publishedAt: deps.now, note: note.trim() || null })
      .returning({ id: schema.textVersion.id });
    await deps.log(entry(row!.id), tx);
    return row!.id;
  });
  if (kind !== "landing") return { kind, version, rebuild: null };
  // After the commit, so the build reads the new version. The publish stands even if the hook fails.
  const rebuild = await rebuildLanding(deps);
  await deps.log({ action: "text.rebuild", entity: "text_version", entityId: String(version), summary: { version, status: rebuild.status } }, db);
  return { kind, version, rebuild };
}

/** Publishes every draft of a kind as a new version. Landing publishes also rebuild the landing page. */
export async function publish(db: Db, actor: Actor, kind: TextKind, note: string, deps: PublishDeps) {
  requireKind(actor, kind, "publish");
  const snapshot = await draftSnapshot(db, kind);
  return publishSnapshot(db, actor, kind, snapshot, note, deps, (version) => ({
    action: "text.publish",
    entity: "text_version",
    entityId: String(version),
    summary: { kind, version, changes: Object.keys(snapshot).length }
  }));
}

/** Publishes an older version's wording again, as a new version. The drafts are left as they are. */
export async function restore(db: Db, actor: Actor, versionId: number, deps: PublishDeps) {
  const [old] = await db.select({ kind: schema.textVersion.kind, snapshot: schema.textVersion.snapshot }).from(schema.textVersion).where(eq(schema.textVersion.id, versionId));
  if (!old) throw new HttpError(404, "not_found");
  requireKind(actor, old.kind, "publish");
  return publishSnapshot(db, actor, old.kind, old.snapshot, `Restored version ${versionId}`, deps, (version) => ({
    action: "text.restore",
    entity: "text_version",
    entityId: String(version),
    summary: { kind: old.kind, version, from: versionId }
  }));
}

/** Saves the current drafts as a preview the app shows for 30 minutes with ?astro-preview=<id>. App wording and meanings only. */
export async function createPreview(db: Db, actor: Actor, kind: TextKind, now: Date): Promise<{ id: string; expiresAt: Date }> {
  if (kind === "landing") throw new HttpError(400, "no_preview");
  requireKind(actor, kind, "edit");
  const snapshot = await draftSnapshot(db, kind);
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const expiresAt = new Date(now.getTime() + PREVIEW_MS);
  await db.delete(schema.textPreview).where(sql`${schema.textPreview.expiresAt} < ${now.toISOString()}`);
  await db.insert(schema.textPreview).values({ id, kind, snapshot, expiresAt });
  return { id, expiresAt };
}

/** Published versions of a kind, newest first, for the history panel. */
export async function history(db: Db, kind: TextKind, limit = 20) {
  return db
    .select({ id: schema.textVersion.id, publishedAt: schema.textVersion.publishedAt, note: schema.textVersion.note, by: schema.user.email })
    .from(schema.textVersion)
    .leftJoin(schema.user, eq(schema.user.id, schema.textVersion.publishedBy))
    .where(eq(schema.textVersion.kind, kind))
    .orderBy(desc(schema.textVersion.id))
    .limit(limit);
}

/** The published email wording, for the portal's own emails (team invites, AI key alerts). Defaults if unreadable. */
export async function emailT(db: Db): Promise<EmailT> {
  try {
    const [row] = await db.select({ snapshot: schema.textVersion.snapshot }).from(schema.textVersion).where(eq(schema.textVersion.kind, "app")).orderBy(desc(schema.textVersion.id)).limit(1);
    const o = row?.snapshot ?? {};
    return (key, values) => fill(o[key] ?? catalogue[key].default, values ?? {});
  } catch (e) {
    console.error("email wording unavailable, using defaults", e);
    return defaultEmailT;
  }
}

// ---- Screens -------------------------------------------------------------------------------------------------

export type TextTab = "landing" | "app" | "email";

export interface TextItem {
  key: string;
  group: string;
  label: string;
  where: string;
  default: string;
  max: number;
  placeholders: readonly string[];
  /** The saved draft override, if any. */
  draft: string | null;
  /** The published override, if any. */
  live: string | null;
}

export interface Pending {
  key: string;
  title: string;
}

export interface LiveVersion {
  id: number;
  publishedAt: string;
  /** Landing only: the Deploy Hook's answer to the last rebuild request (0 = no answer). */
  rebuildStatus: number | null;
}

export interface HistoryRow {
  id: number;
  publishedAt: string;
  by: string | null;
  note: string | null;
}

const kindOf = (tab: TextTab): TextKind => (tab === "landing" ? "landing" : "app");

async function liveOf(db: Db, kind: TextKind): Promise<{ id: number; publishedAt: Date; snapshot: Record<string, string> } | null> {
  const [row] = await db
    .select({ id: schema.textVersion.id, publishedAt: schema.textVersion.publishedAt, snapshot: schema.textVersion.snapshot })
    .from(schema.textVersion)
    .where(eq(schema.textVersion.kind, kind))
    .orderBy(desc(schema.textVersion.id))
    .limit(1);
  return row ?? null;
}

async function draftsOf(db: Db, kind: TextKind): Promise<Record<string, string>> {
  const rows = await db.select({ key: schema.textOverride.key, value: schema.textOverride.value }).from(schema.textOverride).where(eq(schema.textOverride.kind, kind));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Keys whose draft differs from what's published (a new override, a changed one, or one going back to default). */
function pendingKeys(drafts: Record<string, string>, live: Record<string, string>): string[] {
  return [...new Set([...Object.keys(drafts), ...Object.keys(live)])].filter((k) => drafts[k] !== live[k] && entryFor(k) !== null).sort();
}

async function lastRebuild(db: Db, version: number): Promise<number | null> {
  const [row] = await db
    .select({ summary: schema.auditLog.summary })
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.action, "text.rebuild"), eq(schema.auditLog.entityId, String(version))))
    .orderBy(desc(schema.auditLog.id))
    .limit(1);
  const status = (row?.summary as { status?: unknown } | undefined)?.status;
  return typeof status === "number" ? status : null;
}

const historyRows = async (db: Db, kind: TextKind): Promise<HistoryRow[]> =>
  (await history(db, kind, 10)).map((h) => ({ id: h.id, publishedAt: h.publishedAt.toISOString(), by: h.by, note: h.note }));

/** Everything the Text screen shows for one tab. App and Emails share one published set ("app"). */
export async function textScreen(db: Db, tab: TextTab) {
  const kind = kindOf(tab);
  const [drafts, live] = await Promise.all([draftsOf(db, kind), liveOf(db, kind)]);
  const published = live?.snapshot ?? {};
  const items: TextItem[] = entriesFor(tab).map((e) => ({ key: e.key, group: e.group, label: e.label, where: e.where, default: e.default, max: e.max, placeholders: e.placeholders, draft: drafts[e.key] ?? null, live: published[e.key] ?? null }));
  const pending: Pending[] = pendingKeys(drafts, published).map((key) => {
    const e = entryFor(key)!.entry;
    return { key, title: `${e.group} · ${e.label}` };
  });
  return {
    kind,
    items,
    pending,
    live: live ? { id: live.id, publishedAt: live.publishedAt.toISOString(), rebuildStatus: kind === "landing" ? await lastRebuild(db, live.id) : null } : null,
    history: await historyRows(db, kind)
  };
}

export interface CardField {
  key: string;
  field: MeaningField;
  label: string;
  max: number;
  default: string;
  draft: string | null;
  live: string | null;
}

/** Everything the Card library shows: the list of cards, one card's fields, what's waiting to publish, and history. */
export async function cardScreen(db: Db, cardId: string) {
  const [drafts, live] = await Promise.all([draftsOf(db, "meanings"), liveOf(db, "meanings")]);
  const published = live?.snapshot ?? {};
  const pending = pendingKeys(drafts, published);
  const changed = new Set(pending.map((k) => k.slice(0, k.indexOf("."))));
  const cards = allCards.map((c) => ({ id: c.id, name: c.name, numeral: c.numeral, group: c.suit ?? "majors", draft: changed.has(c.id) }));
  const card = allCards.find((c) => c.id === cardId) ?? allCards[0]!;
  const meaning = getMeaning(card.id);
  const fields: CardField[] = MEANING_FIELDS.flatMap((f) => {
    const text = fieldText(meaning, f.field);
    if (text === undefined) return [];
    const key = `${card.id}.${f.field}`;
    return [{ key, field: f.field, label: f.label, max: f.max, default: text, draft: drafts[key] ?? null, live: published[key] ?? null }];
  });
  const name = (id: string) => allCards.find((c) => c.id === id)?.name ?? id;
  return {
    cards,
    card: { id: card.id, name: card.name, numeral: card.numeral },
    fields,
    pending: pending.map((key) => {
      const [id, ...rest] = key.split(".");
      const label = MEANING_FIELDS.find((f) => f.field === rest.join("."))?.label ?? rest.join(".");
      return { key, title: `${name(id!)} · ${label}` };
    }),
    live: live ? { id: live.id, publishedAt: live.publishedAt.toISOString(), rebuildStatus: null } : null,
    history: await historyRows(db, "meanings")
  };
}
