import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The pages are built ahead into static files (free-plan design). Client components are shared with the old Next.js
// app until Stage 2 removes it: "@/…" points at apps/app, and next/navigation at a small shim.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "next/navigation", replacement: at("./src/shims/navigation.ts") },
      { find: /^@\/(.*)$/, replacement: `${at("../app/")}$1` }
    ]
  },
  build: { outDir: "dist", sourcemap: false, assetsInlineLimit: 0 },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8791" } }
});
