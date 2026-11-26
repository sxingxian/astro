import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@astro/tokens", "@astro/cards", "@astro/ui"]
};

export default config;
