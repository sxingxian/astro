import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { display, ui } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://astro.midnightpoetry.studio"),
  title: "Astro — Daily tarot, read slowly",
  description: "A free daily tarot card, or three pairs of Major and Minor Arcana, with meanings worth slowing down for.",
  openGraph: {
    title: "Astro — Daily tarot, read slowly",
    description: "Every day, one card turns. Free daily tarot by Midnight Poetry Studio.",
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
