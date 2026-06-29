import { describe, expect, it } from "vitest";
import { getCurrentReleaseDate, isReleasedByDate } from "@/lib/music/release-date";

describe("release-date helpers", () => {
  it("formats the current release date in the configured time zone", () => {
    expect(getCurrentReleaseDate(new Date("2026-06-10T16:30:00.000Z"), "Asia/Tokyo")).toBe("2026-06-11");
  });

  it("treats future release dates as unreleased", () => {
    expect(isReleasedByDate("2026-06-11", "2026-06-11")).toBe(true);
    expect(isReleasedByDate("2026-06-12", "2026-06-11")).toBe(false);
  });
});
