import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  // OpenNext otherwise runs this package's own `build` script, which is OpenNext itself.
  buildCommand: "pnpm exec next build"
};
