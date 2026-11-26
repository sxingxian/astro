import { getSettings } from "@astro/server";
import { NoAccess } from "@/components/NoAccess";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { getDb } from "@/lib/db";
import { pageStaff } from "@/lib/page";

export const metadata = { title: "Site settings" };
export const dynamic = "force-dynamic";

/** The settings this screen edits. AI spending limits live on the owner's AI settings screen. */
const KEYS = ["contact_email", "reversal_rate", "guest_daily_cap", "disclaimer_note", "social_links", "maintenance_mode"] as const;

export default async function SettingsPage() {
  const staff = await pageStaff("settings.edit");
  if (!staff) return <NoAccess />;
  return <SettingsClient initial={await getSettings(getDb(), KEYS)} />;
}
