import { HttpError, requireStepUp, StepUpFailed } from "@astro/server";
import type { Staff } from "./auth";
import { getDb } from "./db";
import { getEnv } from "./env";

/** Checks a fresh authenticator code for a sensitive action; a failure becomes a 403 the dialog can explain. */
export async function stepUp(staff: Staff, code: string): Promise<void> {
  try {
    await requireStepUp(getDb(), { userId: staff.id, code, authSecret: getEnv().BETTER_AUTH_SECRET, now: new Date() });
  } catch (e) {
    if (e instanceof StepUpFailed) throw new HttpError(403, `step_up_${e.reason}`);
    throw e;
  }
}
