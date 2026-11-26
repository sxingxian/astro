import { JournalError } from "./journal";
import { fail } from "./http";

/** Runs a journal action, turning a JournalError into its HTTP answer. */
export async function journalAction(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof JournalError) return fail(e.code === "not_found" ? 404 : 400, e.code);
    throw e;
  }
}
