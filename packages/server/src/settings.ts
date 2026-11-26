import { eq, inArray, schema, type Db } from "@astro/db";
import { z } from "zod";
import { HttpError } from "./http";
import { can, type Action, type Role } from "./roles";

const httpsUrl = z.url({ protocol: /^https$/ }).max(300);

/** Every setting the portal can change: its rules, its default, and the action needed to change it. */
export const SETTINGS = {
  reversal_rate: { schema: z.number().min(0).max(1), default: 0.3, action: "settings.edit" },
  guest_daily_cap: { schema: z.number().int().min(1).max(20), default: 3, action: "settings.edit" },
  maintenance_mode: { schema: z.boolean(), default: false, action: "settings.edit" },
  contact_email: { schema: z.union([z.literal(""), z.email().max(254)]), default: "", action: "settings.edit" },
  social_links: { schema: z.array(httpsUrl).max(6), default: [] as string[], action: "settings.edit" },
  disclaimer_note: { schema: z.string().trim().max(500), default: "For reflection and entertainment. Readings are not a substitute for medical, legal or financial advice.", action: "settings.edit" },
  ai_daily_cap_usd: { schema: z.number().min(0).max(1000), default: 20, action: "ai.edit" },
  ai_per_person_per_day: { schema: z.number().int().min(0).max(50), default: 5, action: "ai.edit" }
} as const satisfies Record<string, { schema: z.ZodType; default: unknown; action: Action }>;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function parseSetting<K extends SettingKey>(key: K, value: unknown) {
  return SETTINGS[key].schema.safeParse(value) as z.ZodSafeParseResult<SettingValue<K>>;
}

/** A stored value if it's still valid, otherwise the default. Never throws on bad data. */
export async function getSetting<K extends SettingKey>(db: Pick<Db, "select">, key: K): Promise<SettingValue<K>> {
  const [row] = await db.select({ value: schema.appSetting.value }).from(schema.appSetting).where(eq(schema.appSetting.key, key)).limit(1);
  const parsed = row ? parseSetting(key, row.value) : null;
  return parsed?.success ? parsed.data : (SETTINGS[key].default as SettingValue<K>);
}

/** Several settings in one query, each falling back to its default. */
export async function getSettings<K extends SettingKey>(db: Db, keys: readonly K[]): Promise<{ [P in K]: SettingValue<P> }> {
  const rows = await db.select().from(schema.appSetting).where(inArray(schema.appSetting.key, keys as unknown as string[]));
  const out = {} as { [P in K]: SettingValue<P> };
  for (const k of keys) {
    const parsed = parseSetting(k, rows.find((r) => r.key === k)?.value);
    out[k] = (parsed.success ? parsed.data : SETTINGS[k].default) as SettingValue<typeof k>;
  }
  return out;
}

/**
 * Checks the person may change it, validates and stores one setting. The caller writes the audit entry with the
 * returned before and after values (@astro/server has no secret for the IP hash).
 */
export async function setSetting<K extends SettingKey>(db: Db, actor: { role: Role }, key: K, value: unknown): Promise<{ from: SettingValue<K>; to: SettingValue<K> }> {
  if (!can(actor.role, SETTINGS[key].action)) throw new HttpError(403, "forbidden");
  const parsed = parseSetting(key, value);
  if (!parsed.success) throw new SettingInvalid(key);
  const from = await getSetting(db, key);
  await db.insert(schema.appSetting).values({ key, value: parsed.data }).onConflictDoUpdate({ target: schema.appSetting.key, set: { value: parsed.data } });
  return { from, to: parsed.data };
}

export class SettingInvalid extends HttpError {
  constructor(readonly key: SettingKey) {
    super(400, `invalid_${key}`);
  }
}
