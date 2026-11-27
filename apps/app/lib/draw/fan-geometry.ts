/**
 * The fan picker's geometry, from the approved "Fan out" prototype. The fan turns around a pivot below the cards;
 * angles are in degrees, positions in px relative to the pivot (y negative = up).
 */

const STEPS: Record<number, number> = { 78: 3, 56: 3.3, 22: 5.5 };

/**
 * The fan's size. Phones use the approved prototype's numbers; wider stages (desktop panel, mockup D2) use larger
 * cards on a larger fan, so the deck still runs past both edges. `radius` is the pivot's distance to the card tops;
 * points nearer the pivot than `inner`, or further than `outer`, are off the fan.
 */
export interface FanGeometry {
  cardW: number;
  cardH: number;
  radius: number;
  cardTop: number;
  stageH: number;
  inner: number;
  outer: number;
  lift: number;
}
// As in the prototype, the pivot sits below the stage so the fan rises from the bottom edge. The space above the
// cards is just enough for a lifted card and its raised neighbours.
export const PHONE_FAN: FanGeometry = { cardW: 70, cardH: 116, radius: 256, cardTop: 80, stageH: 290, inner: 120, outer: 390, lift: 52 };
export const DESKTOP_FAN: FanGeometry = { cardW: 104, cardH: 170, radius: 370, cardTop: 100, stageH: 410, inner: 180, outer: 560, lift: 70 };
/** Stages at least this wide get the desktop fan. */
export const DESKTOP_FAN_FROM = 600;
export const geometryFor = (width: number): FanGeometry => (width >= DESKTOP_FAN_FROM ? DESKTOP_FAN : PHONE_FAN);

/** Degrees between neighbouring cards: 78 → 3, 56 → 3.3, 22 → 5.5; other sizes in between. */
export function angleStep(size: number): number {
  const exact = STEPS[size];
  if (exact !== undefined) return exact;
  return Math.min(6, Math.max(2.5, 3 + ((78 - size) / (78 - 22)) * 2.5));
}

export const spreadOf = (size: number) => angleStep(size) * (size - 1);

/** How far either side of centre a card can sit, lifted, and still be fully on a stage this wide. */
export function safeAngle(width: number, g: FanGeometry = PHONE_FAN): number {
  // Room for the whole card, raised by its lift, so a chosen card is never pushed off the side of the stage.
  const s = Math.max(0, Math.min(1, (width / 2 - g.cardW * 0.75) / (g.radius + g.lift)));
  return Math.max(15, Math.min(72, (Math.asin(s) * 180) / Math.PI));
}

/** The furthest the fan can turn either way: enough to bring the end cards into view, no further. */
export function maxRotation(size: number, width: number, g: FanGeometry = PHONE_FAN): number {
  const m = spreadOf(size) / 2 - safeAngle(width, g);
  // Less than one card out of view still reads as a fan that fits: no sliding and no edge arrows.
  return m < angleStep(size) ? 0 : m;
}

export const clampRotation = (rot: number, size: number, width: number, g: FanGeometry = PHONE_FAN) => {
  const m = maxRotation(size, width, g);
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
export function cardLift(i: number, focus: number, picked: boolean, g: FanGeometry = PHONE_FAN): number {
  const near = focus >= 0 ? Math.max(0, 1 - Math.abs(i - focus) / 2.5) * g.lift : 0;
  return near + (picked ? Math.round(g.lift * 0.3) : 0);
}

/**
 * The card drawn under a point (relative to the pivot), or -1 when the point is off the fan. With a card lifted
 * (`focus`), its neighbours sit nudged apart, so the nearest drawn card is chosen rather than the resting slot.
 */
export function indexAt(px: number, py: number, rot: number, size: number, g: FanGeometry = PHONE_FAN, focus = -1): number {
  const dist = Math.hypot(px, py);
  if (dist < g.inner || dist > g.outer) return -1;
  const angle = (Math.atan2(px, -py) * 180) / Math.PI - rot;
  const step = angleStep(size);
  const guess = Math.round((angle + spreadOf(size) / 2) / step);
  if (focus < 0) return guess < 0 || guess > size - 1 ? -1 : guess;
  let best = -1;
  let bestDiff = Infinity;
  for (let i = Math.max(0, guess - 4); i <= Math.min(size - 1, guess + 4); i++) {
    const diff = Math.abs(cardAngle(i, size, 0, focus) - angle);
    if (diff < bestDiff) [best, bestDiff] = [i, diff];
  }
  // Past either end of the deck by more than a card: off the fan.
  return bestDiff > step ? -1 : best;
}

/** Degrees the fan turns when a finger drags `dx` px sideways: the cards' middles move with the finger. */
export const dragDegrees = (dx: number, g: FanGeometry = PHONE_FAN) => (dx / (g.radius - g.cardH / 2)) * (180 / Math.PI);

const COAST_FRICTION = 0.94;
/**
 * A flicked fan's speed (degrees per 60 Hz frame) after `frames` more frames, where `frames` is the elapsed time in
 * 60 Hz frames (1 at 60 Hz, 0.5 at 120 Hz). Stops below 0.02°/frame.
 */
export function coastStep(v: number, frames: number): number {
  const next = v * COAST_FRICTION ** frames;
  return Math.abs(next) < 0.02 ? 0 : next;
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
export function keepVisible(i: number, rot: number, size: number, width: number, g: FanGeometry = PHONE_FAN): number {
  const safe = safeAngle(width, g) - angleStep(size);
  const a = baseAngle(i, size, rot);
  let next = rot;
  if (a > safe) next -= a - safe;
  if (a < -safe) next += -safe - a;
  return clampRotation(next, size, width, g);
}
