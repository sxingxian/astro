import { getSessionUser } from "../auth";
import { existingGuestHash } from "./guest";
import type { Actor } from "./service";

/** The person behind a read or pick: a signed-in member, or a guest with an existing cookie. */
export async function readerActor(request: Request): Promise<Actor | null> {
  const user = await getSessionUser(request.headers);
  if (user) return { kind: "user", userId: user.id, timeZone: user.timeZone };
  const guestHash = await existingGuestHash(request);
  return guestHash ? { kind: "guest", guestHash, ipHash: "", timeZone: "UTC" } : null;
}
