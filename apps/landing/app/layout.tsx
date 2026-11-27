import { copy } from "@/content/copy";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { display, ui } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://astro.midnightpoetry.studio"),
  title: copy("landing.meta.title"),
  description: copy("landing.meta.description"),
  openGraph: {
    title: copy("landing.meta.title"),
    description: copy("landing.meta.share_description"),
    url: "https://astro.midnightpoetry.studio",
    siteName: "Astro",
    type: "website"
  }
};

export const viewport: Viewport = { themeColor: "#0B0B14", colorScheme: "dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
      </body>
    </html>
  );
}
