import type { ReactNode } from "react";
import { ChangePassword, CheckInsToggle, DeleteAccount, GiveUpReader, RevokeSession, SignOutButton, TimeZoneForm } from "@/components/account/Forms";
import { TwoStepSetup } from "@/components/account/TwoStepSetup";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle, type T } from "../session";
import { AppShell } from "../shell/AppShell";

interface AccountData {
  user: { id: string; sessionId: string; email: string; name: string; timeZone: string; timeZoneChangedAt: string | null; checkInsEnabled: boolean; twoFactorEnabled: boolean };
  sessions: { id: string; userAgent: string | null; createdAt: string }[];
  reader: boolean;
}

// Ported from apps/app/app/account/page.tsx (same markup); data from GET /api/account.
function deviceName(ua: string | null, t: T): string {
  if (!ua) return t("app.account.unknown_device");
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return t("app.account.device", { browser, os });
}

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`g-${id}`} className="flex flex-col gap-2">
      <h2 id={`g-${id}`} className="m-0 ml-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="panel flex flex-col gap-5 p-5">{children}</div>
    </section>
  );
}

export default function AccountPage() {
  const { t } = useSession();
  useTitle(t("app.account.meta"));
  const { data, error } = useData<AccountData>("/api/account");
  if (error) return <AppShell current="account"><Failed error={error} /></AppShell>;
  if (!data) return <AppShell current="account"><Loading /></AppShell>;
  const { user, sessions, reader } = data;
  const zones = Intl.supportedValuesOf("timeZone");

  return (
    <AppShell current="account">
    <div data-page className="mx-auto flex max-w-[560px] flex-col gap-7 px-5 pb-32 pt-8 lg:max-w-[880px] lg:pb-16">
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
              <span>{deviceName(s.userAgent, t)}<span className="block text-sm text-muted">{s.id === user.sessionId ? t("app.account.this_device") : t("app.account.since", { date: new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) })}</span></span>
              {s.id === user.sessionId ? null : <RevokeSession sessionId={s.id} device={deviceName(s.userAgent, t)} />}
            </li>
          ))}
        </ul>
      </Group>

      <Group id="preferences" title={t("app.account.preferences")}>
        <TimeZoneForm current={user.timeZone} zones={zones} />
        <CheckInsToggle enabled={user.checkInsEnabled} />
      </Group>

      {reader ? (
        <Group id="reader" title={t("app.account.reader")}>
          <GiveUpReader />
        </Group>
      ) : null}

      <Group id="privacy" title={t("app.account.privacy")}>
        <DeleteAccount />
      </Group>

      <SignOutButton />
    </div>
    </AppShell>
  );
}
