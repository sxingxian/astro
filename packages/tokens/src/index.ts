export { contrastRatio } from "./contrast";

export const colors = {
  night: "#0B0B14",
  ink: "#14142A",
  nebula: "#2A2350",
  gold: "#D8B46A",
  moon: "#EDE6D6",
  muted: "#8C88A6",
  error: "#E26D6D",
  paper: "#F4EEE2",
  inkDay: "#1B1830",
  goldDeep: "#7A5A1E"
} as const;

export const ease = {
  out: "cubic-bezier(0.23,1,0.32,1)",
  inOut: "cubic-bezier(0.77,0,0.175,1)"
} as const;

/** Durations in milliseconds. UI transitions stay at or under 300 ms. */
export const duration = { press: 140, hover: 200, ui: 240 } as const;
