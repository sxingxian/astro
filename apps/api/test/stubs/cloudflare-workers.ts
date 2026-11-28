// Tests run in Node, where Cloudflare's `cloudflare:workers` module doesn't exist: no startup settings, so the
// Worker's startup warm-up does nothing and each test builds what it needs.
export const env = {};
