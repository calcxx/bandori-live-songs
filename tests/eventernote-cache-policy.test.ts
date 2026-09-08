import { describe, expect, it } from "vitest";
import { getEventernoteCacheDisposition } from "@/lib/stats/eventernote-cache-policy";

type CacheRow = NonNullable<Parameters<typeof getEventernoteCacheDisposition>[0]>;
const now = new Date("2026-04-20T12:00:00.000Z");
const freshRow: CacheRow = {
  userId: "sample_user", displayId: "sample_user", displayName: null,
  fetchStatus: "ok", parserVersion: 2,
  activities: [{ eventernoteEventId: 1, title: "test", eventDate: "2026-01-01", venue: null,
    matchedBandSlugs: ["poppin-party"], sourceUrl: "https://www.eventernote.com/events/1" }],
  errorMessage: null, lastFetchedAt: new Date("2026-04-20T10:00:00Z"),
  expiresAt: null, refreshingStartedAt: null, remoteEventCount: 100,
};
const cached = { mode: "serve-cached", staleCacheUsed: false };
const stale = { mode: "serve-stale-and-refresh", staleCacheUsed: true };
const warming = { mode: "warm-and-refresh", staleCacheUsed: false };

describe("getEventernoteCacheDisposition", () => {
  it("warms a missing cache", () => {
    expect(getEventernoteCacheDisposition(null, 100, now)).toEqual(warming);
  });

  it.each<{
    name: string; changes: Partial<CacheRow>; remoteCount: number | null;
    expected: { mode: string; staleCacheUsed: boolean };
  }>([
    { name: "serves fresh data when counts match", changes: {}, remoteCount: 100, expected: cached },
    { name: "keeps data at exactly 24 hours", changes: { lastFetchedAt: new Date("2026-04-19T12:00:00Z") }, remoteCount: 100, expected: cached },
    { name: "refreshes one millisecond after 24 hours", changes: { lastFetchedAt: new Date("2026-04-19T11:59:59.999Z") }, remoteCount: 100, expected: stale },
    { name: "refreshes a changed count even with fresh data", changes: {}, remoteCount: 101, expected: stale },
    { name: "serves old data when upstream is unavailable", changes: { lastFetchedAt: new Date("2026-04-18T10:00:00Z") }, remoteCount: null, expected: cached },
    { name: "marks cached errors as stale", changes: { fetchStatus: "error", errorMessage: "timeout", activities: [] }, remoteCount: 100, expected: { mode: "serve-cached", staleCacheUsed: true } },
    { name: "keeps the stale error flag during upstream failure", changes: { fetchStatus: "error", errorMessage: "timeout" }, remoteCount: null, expected: { mode: "serve-cached", staleCacheUsed: true } },
    { name: "refreshes legacy rows with activities", changes: { remoteEventCount: null }, remoteCount: 100, expected: stale },
    { name: "warms legacy rows without activities", changes: { remoteEventCount: null, activities: [] }, remoteCount: 100, expected: warming },
    { name: "treats zero as a known count", changes: { remoteEventCount: 0, activities: [] }, remoteCount: 0, expected: cached },
  ])("$name", ({ changes, remoteCount, expected }) => {
    expect(getEventernoteCacheDisposition({ ...freshRow, ...changes }, remoteCount, now)).toEqual(expected);
  });
});
