// Test fixture for the CPU budget check: the real Worker plus one route that burns 30 ms of CPU, so the check
// can be shown to fail on a heavy request.
import worker from "../../src/index";

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === "/api/v2/spin") {
      const end = performance.now() + 30;
      let x = 0;
      while (performance.now() < end) x += Math.sqrt(x + 1);
      return new Response(JSON.stringify({ x }), { headers: { "content-type": "application/json" } });
    }
    return worker.fetch(request, env as never, ctx);
  }
};
