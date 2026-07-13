import { describe, expect, it } from "vitest";
import { getEventernoteCacheDisposition } from "@/lib/stats/eventernote-cache-policy";

const now = new Date("2026-04-20T12:00:00.000Z");

describe("getEventernoteCacheDisposition", () => {
  it("warms cache in the background when no cache row exists", () => {
    expect(getEventernoteCacheDisposition(null, 100, now)).toEqual({
      mode: "warm-and-refresh",
      staleCacheUsed: false,
    });
  });

  it("serves cached data without refresh when remote count matches stored count", () => {
    expect(
      getEventernoteCacheDisposition(
        {
          userId: "revast",
          displayId: "revast",
          displayName: null,
          fetchStatus: "ok",
          parserVersion: 2,
          activities: [{ eventernoteEventId: 1, title: "test", eventDate: "2026-01-01", venue: null, matchedBandSlugs: ["ppp"], sourceUrl: "https://example.com" }],
          errorMessage: null,
          lastFetchedAt: new Date("2026-04-20T10:00:00.000Z"),
          expiresAt: null,
          refreshingStartedAt: null,
          remoteEventCount: 100,
        },
        100,
        now,
      ),
    ).toEqual({
      mode: "serve-cached",
      staleCacheUsed: false,
    });
  });

  it("serves stale cache and refreshes when last fetch is older than 1 day", () => {
    expect(
      getEventernoteCacheDisposition(
        {
          userId: "revast",
          displayId: "revast",
          displayName: null,
          fetchStatus: "ok",
          parserVersion: 2,
          activities: [{ eventernoteEventId: 1, title: "test", eventDate: "2026-01-01", venue: null, matchedBandSlugs: ["ppp"], sourceUrl: "https://example.com" }],
          errorMessage: null,
          lastFetchedAt: new Date("2026-04-19T11:59:00.000Z"),
          expiresAt: null,
          refreshingStartedAt: null,
          remoteEventCount: 100,
        },
        100,
        now,
      ),
    ).toEqual({
      mode: "serve-stale-and-refresh",
      staleCacheUsed: true,
    });
  });

  it("serves stale cache and refreshes when remote count differs from stored count", () => {
    expect(
      getEventernoteCacheDisposition(
        {
          userId: "revast",
          displayId: "revast",
          displayName: null,
          fetchStatus: "ok",
          parserVersion: 2,
          activities: [{ eventernoteEventId: 1, title: "test", eventDate: "2026-01-01", venue: null, matchedBandSlugs: ["ppp"], sourceUrl: "https://example.com" }],
          errorMessage: null,
          lastFetchedAt: new Date("2026-04-19T12:00:00.000Z"),
          expiresAt: null,
          refreshingStartedAt: null,
          remoteEventCount: 95,
        },
        100,
        now,
      ),
    ).toEqual({
      mode: "serve-stale-and-refresh",
      staleCacheUsed: true,
    });
  });

  it("serves cached data without refresh when remote count fetch fails (site down)", () => {
    expect(
      getEventernoteCacheDisposition(
        {
          userId: "revast",
          displayId: "revast",
          displayName: null,
          fetchStatus: "ok",
          parserVersion: 2,
          activities: [{ eventernoteEventId: 1, title: "test", eventDate: "2026-01-01", venue: null, matchedBandSlugs: ["ppp"], sourceUrl: "https://example.com" }],
          errorMessage: null,
          lastFetchedAt: new Date("2026-04-18T10:00:00.000Z"),
          expiresAt: null,
          refreshingStartedAt: null,
          remoteEventCount: 100,
        },
        null,
        now,
      ),
    ).toEqual({
      mode: "serve-cached",
      staleCacheUsed: false,
    });
  });

  it("serves stale cache for error rows so the UI can show upstream error state", () => {
    expect(
      getEventernoteCacheDisposition(
        {
          userId: "revast",
          displayId: "revast",
          displayName: null,
          fetchStatus: "error",
          parserVersion: 2,
          activities: [],
          errorMessage: "timeout",
          lastFetchedAt: new Date("2026-04-20T10:00:00.000Z"),
          expiresAt: null,
          refreshingStartedAt: null,
          remoteEventCount: 100,
        },
        100,
        now,
      ),
    ).toEqual({
      mode: "serve-cached",
      staleCacheUsed: true,
    });
  });

  it("triggers background refresh for legacy rows with no stored count but existing activities", () => {
    expect(
      getEventernoteCacheDisposition(
        {
          userId: "revast",
          displayId: "revast",
          displayName: null,
          fetchStatus: "ok",
          parserVersion: 2,
          activities: [{ eventernoteEventId: 1, title: "test", eventDate: "2026-01-01", venue: null, matchedBandSlugs: ["ppp"], sourceUrl: "https://example.com" }],
          errorMessage: null,
          lastFetchedAt: new Date("2026-04-20T10:00:00.000Z"),
          expiresAt: null,
          refreshingStartedAt: null,
          remoteEventCount: null,
        },
        100,
        now,
      ),
    ).toEqual({
      mode: "serve-stale-and-refresh",
      staleCacheUsed: true,
    });
  });

  it("warms cache for legacy rows with no stored count and no activities", () => {
    expect(
      getEventernoteCacheDisposition(
        {
          userId: "revast",
          displayId: "revast",
          displayName: null,
          fetchStatus: "ok",
          parserVersion: 2,
          activities: [],
          errorMessage: null,
          lastFetchedAt: new Date("2026-04-20T10:00:00.000Z"),
          expiresAt: null,
          refreshingStartedAt: null,
          remoteEventCount: null,
        },
        100,
        now,
      ),
    ).toEqual({
      mode: "warm-and-refresh",
      staleCacheUsed: false,
    });
  });
});
