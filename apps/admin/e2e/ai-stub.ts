import { createServer, type Server } from "node:http";

/**
 * A stand-in for Cloudflare AI Gateway on 127.0.0.1:8799 (AI_GATEWAY_URL in .dev.vars). Answers 200 to any model,
 * except "bad-model", which gets a 401 that echoes the key back, the way some providers do.
 */
export function startAiStub(port = 8799): Promise<Server> {
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const key = String(req.headers["x-api-key"] ?? req.headers["x-goog-api-key"] ?? req.headers.authorization ?? "").replace(/^Bearer /, "");
      const model = (() => {
        try {
          return JSON.parse(raw).model as string | undefined;
        } catch {
          return undefined;
        }
      })();
      res.setHeader("content-type", "application/json");
      if (model === "bad-model" || req.url?.includes("bad-model")) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: { message: `Incorrect API key provided: ${key}` } }));
        return;
      }
      res.end(JSON.stringify({ id: "stub", content: [{ type: "text", text: "OK" }] }));
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
