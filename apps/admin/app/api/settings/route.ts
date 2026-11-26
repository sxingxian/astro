import { getSetting, parseSetting, setSetting, SETTING_KEYS, SETTINGS, type SettingKey } from "@astro/server";
import { z } from "zod";
import { inTransaction, logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { fail, json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";

export const dynamic = "force-dynamic";

// partialRecord: an enum-keyed z.record is exhaustive in Zod 4 and would add every key as undefined.
const body = z.object({ values: z.partialRecord(z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]), z.unknown()), code: z.string().max(6).optional() });

/**
 * Saves the settings that changed. Everything is validated first, so nothing is half-saved. A fresh code is needed
 * to change any AI setting (spec §1) or to turn maintenance mode on (which takes the app offline).
 */
export const POST = mutation(body, async ({ request, user, body }) => {
  requireCan(user, "settings.edit");
  const db = getDb();
  const entries = (Object.entries(body.values) as [SettingKey, unknown][]).filter(([, v]) => v !== undefined);
  for (const [key] of entries) requireCan(user, SETTINGS[key].action);
  const invalid = entries.filter(([k, v]) => !parseSetting(k, v).success).map(([k]) => k);
  if (invalid.length) return fail(400, "invalid_input", { fields: invalid });

  const touchesAi = entries.some(([k]) => SETTINGS[k].action === "ai.edit");
  const pausing = body.values.maintenance_mode === true && (await getSetting(db, "maintenance_mode")) === false;
  if (touchesAi || pausing) await stepUp(user, body.code ?? "");

  await inTransaction(async (tx) => {
    for (const [key, value] of entries) {
      const before = JSON.stringify(await getSetting(tx, key));
      if (before === JSON.stringify(parseSetting(key, value).data)) continue;
      const { to } = await setSetting(tx, user, key, value);
      await logAudit(user, request, { action: "settings.change", entity: "setting", entityId: key, summary: { setting: key, value: typeof to === "string" ? to : JSON.stringify(to) } }, tx);
    }
  });
  return json({ ok: true });
});
