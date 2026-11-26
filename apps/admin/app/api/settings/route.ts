import { getSetting, parseSetting, setSetting, SETTING_KEYS, SETTINGS, type SettingKey } from "@astro/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { fail, json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";

export const dynamic = "force-dynamic";

// partialRecord: an enum-keyed z.record is exhaustive in Zod 4 and would add every key as undefined.
const body = z.object({ values: z.partialRecord(z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]), z.unknown()), code: z.string().max(6).optional() });

/**
 * Saves the settings that changed. Everything is validated first, so nothing is half-saved. Turning maintenance
 * mode on (which takes the app offline) needs a fresh code.
 */
export const POST = mutation(body, async ({ request, user, body }) => {
  requireCan(user, "settings.edit");
  const db = getDb();
  const entries = (Object.entries(body.values) as [SettingKey, unknown][]).filter(([, v]) => v !== undefined);
  for (const [key] of entries) requireCan(user, SETTINGS[key].action);
  const invalid = entries.filter(([k, v]) => !parseSetting(k, v).success).map(([k]) => k);
  if (invalid.length) return fail(400, "invalid_input", { fields: invalid });

  if (body.values.maintenance_mode === true && (await getSetting(db, "maintenance_mode")) === false) await stepUp(user, body.code ?? "");

  for (const [key, value] of entries) {
    const before = JSON.stringify(await getSetting(db, key));
    if (before === JSON.stringify(parseSetting(key, value).data)) continue;
    const { to } = await setSetting(db, user, key, value);
    await logAudit(user, request, { action: "settings.change", entity: "setting", entityId: key, summary: { setting: key, value: (typeof to === "string" ? to : JSON.stringify(to)).slice(0, 200) } });
  }
  return json({ ok: true });
});
