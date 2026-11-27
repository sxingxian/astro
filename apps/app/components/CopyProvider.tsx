"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppKey } from "@astro/copy";

const Strings = createContext<Readonly<Record<string, string>>>({});

/** The app's wording for client components, resolved on the server (published overrides or a preview). */
export function CopyProvider({ strings, children }: { strings: Readonly<Record<string, string>>; children: ReactNode }) {
  return <Strings.Provider value={strings}>{children}</Strings.Provider>;
}

/** t("app.…", { name }) in client components. Rendered as text, never HTML. */
export function useT() {
  const strings = useContext(Strings);
  return (key: AppKey, values?: Readonly<Record<string, string>>) => {
    const text = strings[key] ?? key;
    return values ? text.replace(/\{([a-z][a-z0-9_]*)\}/g, (m, k: string) => values[k] ?? m) : text;
  };
}
