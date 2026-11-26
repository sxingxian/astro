"use client";

/** The portal's base path. Browser fetches need it; Next's <Link> and redirect() add it themselves. */
export const BASE = "/admin";

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string; code?: string; message?: string };
}

/** JSON POST to a portal path (without /admin). Never throws; network failures come back as status 0. */
export async function postJson<T = Record<string, unknown>>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as ApiResult<T>["data"];
    return { ok: res.ok, status: res.status, data: data ?? ({} as ApiResult<T>["data"]) };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } as ApiResult<T>["data"] };
  }
}
