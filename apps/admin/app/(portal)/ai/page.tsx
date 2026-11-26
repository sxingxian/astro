import { getSettings, validateRoles } from "@astro/server";
import { AiClient } from "@/components/ai/AiClient";
import { NoAccess } from "@/components/NoAccess";
import { listServices, listSlots } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { pageStaff } from "@/lib/page";

export const metadata = { title: "AI settings" };
export const dynamic = "force-dynamic";

const LIMIT_KEYS = ["ai_max_tokens", "ai_temperature", "ai_timeout_seconds", "ai_daily_cap_usd", "ai_per_person_per_day"] as const;

export default async function AiPage() {
  const staff = await pageStaff("ai.edit");
  if (!staff) return <NoAccess />;
  const db = getDb();
  const [services, slots, limits] = await Promise.all([listServices(db), listSlots(db), getSettings(db, LIMIT_KEYS)]);
  const readiness = validateRoles(slots, services);
  const companies = new Set(slots.map((s) => services.find((x) => x.id === s.serviceId)?.company.trim().toLowerCase())).size;
  return (
    <AiClient
      services={services.map((s) => ({ ...s, lastTestAt: s.lastTestAt?.toISOString() ?? null, cooldownUntil: s.cooldownUntil?.toISOString() ?? null }))}
      slots={slots}
      readiness={{ ...readiness, companies }}
      limits={limits}
    />
  );
}
