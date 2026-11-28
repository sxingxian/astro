import type { T } from "@astro/copy";
import { app } from "@astro/copy/app";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CopyProvider } from "@/components/CopyProvider";
import { api } from "./api";

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
  twoFactor: boolean;
  reader: boolean;
  timeZone: string;
}

export interface SessionData {
  user: SessionUser | null;
  wording: { app: Record<string, string>; meanings: Record<string, string> };
  maintenance: { on: boolean; title: string; body: string };
  preview: boolean;
  config: { turnstileMode: "on" | "off"; turnstileSiteKey: string };
}

export type { T };

interface Session extends SessionData {
  t: T;
}

const Ctx = createContext<Session | null>(null);

/** The app's wording: built-in defaults with the owner's published overrides (or a preview) on top. */
export function appStrings(overrides: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(app)) out[k] = overrides[k] ?? v.default;
  return out;
}

const fill = (text: string, values?: Readonly<Record<string, string>>) => (values ? text.replace(/\{([a-z][a-z0-9_]*)\}/g, (m, k: string) => values[k] ?? m) : text);

/** Loads who is signed in, the wording and the maintenance state once per page, then renders the page. */
export function SessionProvider({ children, fallback, failed }: { children: ReactNode; fallback: ReactNode; failed: ReactNode }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    api<SessionData>("/api/session").then(setData, () => setError(true));
  }, []);
  const value = useMemo<Session | null>(() => {
    if (!data) return null;
    const strings = appStrings(data.wording.app);
    return { ...data, t: (key, values) => fill(strings[key] ?? key, values) };
  }, [data]);
  if (error) return <>{failed}</>;
  if (!value) return <>{fallback}</>;
  return (
    <Ctx.Provider value={value}>
      <CopyProvider strings={appStrings(value.wording.app)}>{children}</CopyProvider>
    </Ctx.Provider>
  );
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

/** Sets the tab title the way the Next.js app did ("Journal · Astro"). */
export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · Astro` : "Astro";
  }, [title]);
}
