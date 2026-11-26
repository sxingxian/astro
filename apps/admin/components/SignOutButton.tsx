"use client";

import { BASE, postJson } from "@/lib/client";

export function SignOutButton() {
  return (
    <button type="button" className="btn w-full" onClick={async () => { await postJson("/api/sign-out", {}); window.location.assign(`${BASE}/sign-in`); }}>
      Sign out
    </button>
  );
}
