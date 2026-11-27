"use client";

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string; code?: string; message?: string };
}

/** JSON request to our own origin (POST unless told otherwise). Never throws; network failures come back as status 0. */
export async function postJson<T = Record<string, unknown>>(url: string, body: unknown, headers: Record<string, string> = {}, method: "POST" | "PUT" | "DELETE" = "POST"): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as ApiResult<T>["data"];
    return { ok: res.ok, status: res.status, data: data ?? ({} as ApiResult<T>["data"]) };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } as ApiResult<T>["data"] };
  }
}

export const localTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
