// Test fixture for the CPU budget check: the real Worker plus routes that burn 30 ms of CPU, in JavaScript and in
// the runtime's native Web Crypto, and that answer like signed-in routes (200 and an x-astro-pass header).
import worker from "../../src/index";

const signedIn = (request: Request, body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      "x-astro-pass": (request.headers.get("cookie") ?? "").includes("astro.pass=") ? "hit" : "refresh",
      "set-cookie": "astro.pass=fixture; Path=/api"
    }
  });

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (path === "/api/v2/spin") {
      const end = performance.now() + 30;
      let x = 0;
      while (performance.now() < end) x += Math.sqrt(x + 1);
      return signedIn(request, { x });
    }
    if (path === "/api/v2/spin-native") {
      const data = new Uint8Array(1 << 20);
      for (let i = 0; i < 40; i++) await crypto.subtle.digest("SHA-256", data);
      return signedIn(request, { ok: true });
    }
    return worker.fetch(request, env as never, ctx);
  }
};
