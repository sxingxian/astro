import { eq, schema, type Db } from "@astro/db";

export const DEFAULT_REVERSAL_RATE = 0.3;

/** The reversal rate from app_setting, clamped to 0..1, defaulting to 0.30. */
export async function getReversalRate(db: Db): Promise<number> {
  const [row] = await db.select({ value: schema.appSetting.value }).from(schema.appSetting).where(eq(schema.appSetting.key, "reversal_rate")).limit(1);
  const n = Number(row?.value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_REVERSAL_RATE;
}
