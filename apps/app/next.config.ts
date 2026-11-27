import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@astro/copy", "@astro/tokens", "@astro/cards", "@astro/ui", "@astro/draw", "@astro/meanings", "@astro/db"]
};

export default config;

// Gives `next dev` the same Cloudflare bindings (Hyperdrive, rate limits, vars) as wrangler dev.
initOpenNextCloudflareForDev();
