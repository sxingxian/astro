import { createDb, eq, schema } from "@astro/db";

/** The notice shown while the app is paused. (Part B makes this editable text.) */
export const MAINTENANCE_COPY = {
  title: "Astro is resting for a moment",
  body: "Please come back shortly. Your readings and journal are safe."
};

let cached: { on: boolean; at: number } | null = null;

/**
 * Whether the owner has paused the app. Each isolate re-reads it at most once per `ttlSeconds`, so a busy app
 * costs one tiny query a minute, not one per request. If the read fails, the last answer (or "off") stands:
 * a database hiccup shouldn't show everyone the maintenance page.
 */
export async function isMaintenance(connectionString: string, ttlSeconds: number, now = Date.now()): Promise<boolean> {
  if (cached && now - cached.at < ttlSeconds * 1000) return cached.on;
  const db = createDb(connectionString);
  try {
    const [row] = await db.select({ value: schema.appSetting.value }).from(schema.appSetting).where(eq(schema.appSetting.key, "maintenance_mode")).limit(1);
    cached = { on: row?.value === true, at: now };
  } catch (e) {
    console.error("maintenance check failed", e instanceof Error ? e.message : e);
    cached = { on: cached?.on ?? false, at: now };
  } finally {
    await db.$client.end({ timeout: 1 }).catch(() => {});
  }
  return cached.on;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A self-contained page for the 503 response: no scripts, no app shell, nothing that needs the database. */
export function maintenanceHtml(): string {
  const { title, body } = MAINTENANCE_COPY;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)} · Astro</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0B14;color:#EDE6D6;font-family:Inter,system-ui,sans-serif;padding:24px;box-sizing:border-box}main{max-width:440px;text-align:center;display:flex;flex-direction:column;gap:12px}h1{margin:0;font:500 32px/1.2 'Cormorant Garamond',Georgia,serif}p{margin:0;color:#B9B4CF;line-height:1.6}svg{margin:0 auto}</style></head>
<body><main><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" fill="none" stroke="#D8B46A" stroke-width="1.4" stroke-linejoin="round"/></svg><h1>${escape(title)}</h1><p>${escape(body)}</p></main></body></html>`;
}
