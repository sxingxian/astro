import { describe, expect, it } from "vitest";
import { localGreeting } from "@/lib/greeting";

describe("localGreeting", () => {
  it("greets by the hour in the person's own time zone, with the weekday and date", () => {
    const at = new Date("2026-11-27T03:30:00Z"); // 11:30 in Singapore, 19:30 the day before in Los Angeles
    expect(localGreeting("Asia/Singapore", at)).toEqual({ part: "morning", day: "Friday · 27 Nov 2026" });
    expect(localGreeting("America/Los_Angeles", at)).toEqual({ part: "evening", day: "Thursday · 26 Nov 2026" });
    expect(localGreeting("Asia/Singapore", new Date("2026-11-27T07:00:00Z")).part).toBe("afternoon");
  });
});
