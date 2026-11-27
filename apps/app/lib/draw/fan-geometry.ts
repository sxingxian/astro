/**
 * The fan picker's geometry, from the approved "Fan out" prototype. The fan turns around a pivot below the cards;
 * angles are in degrees, positions in px relative to the pivot (y negative = up).
 */

const STEPS: Record<number, number> = { 78: 3, 56: 3.3, 22: 5.5 };
/** Cards closer to the pivot than this, or further away, are not under the finger. */
const RING = { inner: 120, outer: 390 };
/** Distance from the pivot to the cards' centre line, used to work out how much of the fan a screen shows. */
const RADIUS = 256;

/** Degrees between neighbouring cards: 78 → 3, 56 → 3.3, 22 → 5.5; other sizes in between. */
export function angleStep(size: number): number {
  const exact = STEPS[size];
  if (exact !== undefined) return exact;
  return Math.min(6, Math.max(2.5, 3 + ((78 - size) / (78 - 22)) * 2.5));
}

export const spreadOf = (size: number) => angleStep(size) * (size - 1);

/** How far either side of centre a card can sit and still be fully on a screen this wide. */
export function safeAngle(width: number): number {
  const s = Math.max(0, Math.min(1, (width / 2 - 30) / RADIUS));
  return Math.max(30, Math.min(72, (Math.asin(s) * 180) / Math.PI));
}

/** The furthest the fan can turn either way: enough to bring the end cards into view, no further. */
export const maxRotation = (size: number, width: number) => Math.max(0, spreadOf(size) / 2 - safeAngle(width));

export const clampRotation = (rot: number, size: number, width: number) => {
  const m = maxRotation(size, width);
  return Math.max(-m, Math.min(m, rot));
};

/** A card's resting angle with the fan turned by `rot`. */
export const baseAngle = (i: number, size: number, rot: number) => -spreadOf(size) / 2 + i * angleStep(size) + rot;

/** A card's angle with the neighbours of the lifted card nudged apart. */
export function cardAngle(i: number, size: number, rot: number, focus: number): number {
  const base = baseAngle(i, size, rot);
  if (focus < 0) return base;
  const d = i - focus;
  const gap = Math.max(0, 5 - angleStep(size)) * 0.6;
  return base + Math.sign(d) * Math.min(Math.abs(d), 3) * gap;
}

/** How high a card lifts: the one under the finger most, its neighbours a little; picked cards stay raised. */
export function cardLift(i: number, focus: number, picked: boolean): number {
  const near = focus >= 0 ? Math.max(0, 1 - Math.abs(i - focus) / 2.5) * 52 : 0;
  return near + (picked ? 16 : 0);
}

/** The card under a point (relative to the pivot), or -1 when the point is off the fan. */
export function indexAt(px: number, py: number, rot: number, size: number): number {
  const dist = Math.hypot(px, py);
  if (dist < RING.inner || dist > RING.outer) return -1;
  const angle = (Math.atan2(px, -py) * 180) / Math.PI - rot;
  const i = Math.round((angle + spreadOf(size) / 2) / angleStep(size));
  return i < 0 || i > size - 1 ? -1 : i;
}

/**
 * How fast the fan turns (degrees per frame) with the pointer at `x`. Zero outside the edge zone; on entering it,
 * a steady 45% of `speed`, rising to `speed` at the edge. Positive near the left edge (turns the fan right to bring
 * the left-hand cards in), negative near the right.
 */
export function edgeVelocity(x: number, width: number, zone = 115, speed = 3): number {
  let near = 0;
  if (x < zone) near = 1 - Math.max(0, x) / zone;
  else if (x > width - zone) near = -(1 - Math.max(0, width - x) / zone);
  if (near === 0) return 0;
  const mag = speed * 0.45 + speed * 0.55 * Math.abs(near);
  return near > 0 ? mag : -mag;
}

/** The rotation that keeps card `i` in view, changed as little as possible. */
export function keepVisible(i: number, rot: number, size: number, width: number): number {
  const safe = safeAngle(width) - angleStep(size);
  const a = baseAngle(i, size, rot);
  let next = rot;
  if (a > safe) next -= a - safe;
  if (a < -safe) next += -safe - a;
  return clampRotation(next, size, width);
}
