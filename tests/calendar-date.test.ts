import { describe, expect, it } from "vitest";
import { isValidIsoDate } from "@/lib/calendar-date";

describe("ISO calendar dates", () => {
  it.each(["2024-02-29", "2000-02-29", "2026-12-31", "0001-01-01"])("accepts %s", (date) => {
    expect(isValidIsoDate(date)).toBe(true);
  });
  it.each([undefined, "2026", "2026-07", "2024/02/29", "2023-02-29", "1900-02-29", "2024-04-31", "2026-00-10", "2026-13-01", "2026-01-00", "0000-01-01"])("rejects %s", (date) => {
    expect(isValidIsoDate(date)).toBe(false);
  });
});
