import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const config: NextConfig = {
  // The portal lives at astro.midnightpoetry.studio/admin; everything else on that host is the landing page.
  basePath: "/admin",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@astro/copy", "@astro/tokens", "@astro/db", "@astro/server"]
};

export default config;

initOpenNextCloudflareForDev();
