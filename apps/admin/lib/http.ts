import { can, createMutation, HttpError, type Action } from "@astro/server";
import { getStaff, type Staff } from "./auth";
import { getEnv } from "./env";

export { fail, json, withCookies, HttpError } from "@astro/server";

/** A staff member who has finished 2-step setup. Portal actions need one. */
async function readyStaff(headers: Headers): Promise<Staff | null> {
  const staff = await getStaff(headers);
  return staff?.twoFactorEnabled ? staff : null;
}

/** A state-changing portal route: same-origin check, a staff member with 2-step on, Zod-validated body. */
export const mutation = createMutation({ allowedOrigin: () => getEnv().ADMIN_URL, getUser: readyStaff });

/** For staff still setting up 2-step sign-in: the only routes they may use. */
export const setupMutation = createMutation({ allowedOrigin: () => getEnv().ADMIN_URL, getUser: getStaff });

/** Throws 403 unless the staff member's role allows `action`. Call first in every portal route. */
export function requireCan(staff: Staff, action: Action): void {
  if (!can(staff.role, action)) throw new HttpError(403, "forbidden");
}
