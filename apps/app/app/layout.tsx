import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { CopyProvider } from "@/components/CopyProvider";
import { PreviewBar } from "@/components/PreviewBar";
import { getAppStrings, getCopy, getPreviewing } from "@/lib/copy";
import { display, ui } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { default: "Astro", template: "%s · Astro" }, description: (await getCopy())("app.meta.description"), robots: { index: false } };
}

export const viewport: Viewport = { themeColor: "#0B0B14", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the nonce makes every page render per request, which the nonce CSP requires.
  await headers();
  const [t, strings, previewing] = await Promise.all([getCopy(), getAppStrings(), getPreviewing()]);
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <a href="#main" className="skip-link">{t("app.layout.skip")}</a>
        <CopyProvider strings={strings}>
          {previewing ? <PreviewBar /> : null}
          <main id="main" tabIndex={-1} className="outline-none">{children}</main>
        </CopyProvider>
      </body>
    </html>
  );
}
