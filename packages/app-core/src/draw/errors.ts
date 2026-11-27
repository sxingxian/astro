export type DrawErrorCode = "daily_limit" | "guest_spread" | "bad_positions" | "wrong_stage" | "stage_done" | "not_found" | "rate_limited";

const STATUS: Record<DrawErrorCode, number> = {
  daily_limit: 409,
  guest_spread: 403,
  bad_positions: 400,
  wrong_stage: 409,
  stage_done: 409,
  not_found: 404,
  rate_limited: 429
};

/** A rule the draw refused. Messages and details never contain deck orders, orientations or salts. */
export class DrawError extends Error {
  readonly status: number;
  constructor(
    readonly code: DrawErrorCode,
    readonly details: Record<string, string> = {}
  ) {
    super(code);
    this.name = "DrawError";
    this.status = STATUS[code];
  }
}
