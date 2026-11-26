import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { display, ui } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Astro admin", template: "%s · Astro admin" },
  robots: { index: false, follow: false }
};

export const viewport: Viewport = { themeColor: "#0B0B14", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the nonce makes every page render per request, which the nonce CSP requires.
  await headers();
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
