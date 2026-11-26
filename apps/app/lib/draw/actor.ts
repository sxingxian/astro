import { getSessionUser, type SessionUser } from "../auth";
import { existingGuestHash } from "./guest";
import type { Actor } from "./service";

export interface Viewer {
  actor: Actor | null;
  user: SessionUser | null;
}

/** Who is looking: a signed-in member, a guest with an existing cookie, or nobody yet. */
export async function viewer(headers: Headers): Promise<Viewer> {
  const user = await getSessionUser(headers);
  if (user) return { user, actor: { kind: "user", userId: user.id, timeZone: user.timeZone } };
  const guestHash = await existingGuestHash(headers);
  return { user: null, actor: guestHash ? { kind: "guest", guestHash, ipHash: "", timeZone: "UTC" } : null };
}

/** The person behind a read or pick request. */
export async function readerActor(request: Request): Promise<Actor | null> {
  return (await viewer(request.headers)).actor;
}
