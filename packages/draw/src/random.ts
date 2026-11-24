export type RandomInt = (maxExclusive: number) => number;

const RANGE = 2 ** 32;

/**
 * Uniform integer in [0, maxExclusive) from the platform CSPRNG.
 * Uses rejection sampling so no value is favoured.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > RANGE) {
    throw new RangeError(`maxExclusive must be an integer from 1 to 2^32, got ${maxExclusive}`);
  }
  if (maxExclusive === 1) return 0;
  const limit = RANGE - (RANGE % maxExclusive);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const value = buf[0] as number;
    if (value < limit) return value % maxExclusive;
  }
}
