/** Why an API call didn't give data: signed out, paused, missing, or anything else. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

/**
 * GET from the data Worker. Always same-origin and never cached by the browser. Passes `astro-preview` along, so
 * draft wording and documents can be previewed on any screen.
 */
export async function api<T>(path: string): Promise<T> {
  const preview = new URLSearchParams(window.location.search).get("astro-preview");
  const url = preview ? `${path}${path.includes("?") ? "&" : "?"}astro-preview=${encodeURIComponent(preview)}` : path;
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
  } catch {
    throw new ApiError(0, "network");
  }
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new ApiError(res.status, body.error ?? "request_failed");
}

