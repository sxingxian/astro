import { formatFingerprint } from "@astro/draw";

/** Client-safe fingerprint line (same markup as the server Fingerprint). */
export function FingerprintText({ fingerprint, label }: { fingerprint: string; label: string }) {
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
      <span>{label}</span>
      <code data-testid="fingerprint" className="font-mono text-[13px] tracking-wide text-haze">{formatFingerprint(fingerprint)}</code>
    </p>
  );
}
