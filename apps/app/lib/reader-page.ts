import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./auth";
import { getDb } from "./db";
import { readerStatus } from "./readers";

/** For reader-only pages: signed out → sign in; not a reader → 404; guidelines not yet agreed → Desk asks first. */
export async function requireReaderPage(): Promise<SessionUser> {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const s = await readerStatus(getDb(), user.id);
  if (!s.reader) notFound();
  if (!s.accepted) redirect("/desk");
  return user;
}
