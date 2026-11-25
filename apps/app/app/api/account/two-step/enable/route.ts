import QRCode from "qrcode";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { fail, json, mutation, withCookies } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Starts 2-step setup: checks the password, returns the TOTP URI as a QR code. Backup codes are shown only after the first code is confirmed. */
export const POST = mutation(z.object({ password: z.string().min(1).max(128) }), async ({ request, body }) => {
  const { headers, response } = await getAuth().api.enableTwoFactor({ body: { password: body.password }, headers: request.headers, returnHeaders: true });
  if (response.method !== "totp") return fail(500, "unexpected_method");
  const svg = await QRCode.toString(response.totpURI, { type: "svg", margin: 1, color: { dark: "#0B0B14", light: "#EDE6D6" } });
  const secret = new URL(response.totpURI).searchParams.get("secret") ?? "";
  return withCookies(json({ totpURI: response.totpURI, qr: `data:image/svg+xml;base64,${btoa(svg)}`, secret, backupCodes: response.backupCodes }), headers);
});
