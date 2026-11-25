/** A quick, local strength hint. The server still enforces length and checks breach lists. */
export function passwordHint(pw: string): { label: string; ok: boolean } {
  if (pw.length === 0) return { label: "At least 12 characters. Checked against known breached passwords.", ok: false };
  if (pw.length < 12) return { label: `${12 - pw.length} more character${pw.length === 11 ? "" : "s"} needed.`, ok: false };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 16 || kinds >= 3) return { label: "Strong.", ok: true };
  return { label: "Good. A longer passphrase is even stronger.", ok: true };
}
