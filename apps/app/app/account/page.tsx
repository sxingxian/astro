import { desc, eq, schema } from "@astro/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChangePassword, CheckInsToggle, DeleteAccount, RevokeSession, SignOutButton, TimeZoneForm } from "@/components/account/Forms";
import { TwoStepSetup } from "@/components/account/TwoStepSetup";
import { TabBar } from "@/components/TabBar";
import { getCopy, type T } from "@/lib/copy";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await getCopy())("app.account.meta") };
}

function deviceName(ua: string | null, t: T): string {
  if (!ua) return t("app.account.unknown_device");
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return t("app.account.device", { browser, os });
}

function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`g-${id}`} className="flex flex-col gap-2">
      <h2 id={`g-${id}`} className="m-0 ml-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="panel flex flex-col gap-5 p-5">{children}</div>
    </section>
  );
}

export default async function AccountPage() {
  const h = await headers();
  const user = await getSessionUser(h);
  if (!user) redirect("/sign-in");
  const sessions = await getDb()
    .select({ id: schema.session.id, userAgent: schema.session.userAgent, createdAt: schema.session.createdAt })
    .from(schema.session)
    .where(eq(schema.session.userId, user.id))
    .orderBy(desc(schema.session.createdAt))
    .limit(20);
  const zones = Intl.supportedValuesOf("timeZone");
  const t = await getCopy();

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-7 px-5 pb-32 pt-8">
      <header className="flex items-center gap-4">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-nebula font-display text-2xl text-gold">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <h1 className="m-0 font-display text-3xl font-medium">{t("app.account.title")}</h1>
          <p className="m-0 text-sm text-haze">{user.email} · {t("app.account.verified")}</p>
        </div>
      </header>

      <Group id="security" title={t("app.account.security")}>
        <div id="two-step" className="flex flex-col gap-3 scroll-mt-6"><h3 className="m-0 text-base font-semibold">{t("app.account.two_step")}</h3><TwoStepSetup enabled={user.twoFactorEnabled} /></div>
        <div className="flex flex-col gap-3"><h3 className="m-0 text-base font-semibold">{t("app.account.password")}</h3><ChangePassword /></div>
      </Group>

      <Group id="devices" title={t("app.account.devices")}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {sessions.map((s) => (
            <li key={s.id} className="flex min-h-11 items-center justify-between gap-3">
              <span>{deviceName(s.userAgent, t)}<span className="block text-sm text-muted">{s.id === user.sessionId ? t("app.account.this_device") : t("app.account.since", { date: s.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) })}</span></span>
              {s.id === user.sessionId ? null : <RevokeSession sessionId={s.id} device={deviceName(s.userAgent, t)} />}
            </li>
          ))}
        </ul>
      </Group>

      <Group id="preferences" title={t("app.account.preferences")}>
        <TimeZoneForm current={user.timeZone} zones={zones} />
        <CheckInsToggle enabled={user.checkInsEnabled} />
      </Group>

      <Group id="privacy" title={t("app.account.privacy")}>
        <DeleteAccount />
      </Group>

      <SignOutButton />
      <TabBar current="/account" />
    </div>
  );
}
