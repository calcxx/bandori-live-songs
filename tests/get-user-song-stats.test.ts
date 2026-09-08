import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ cacheRows: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (callback: unknown) => callback }));
vi.mock("@/lib/db/core", () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: () => Promise.resolve(state.cacheRows) }) }),
}) }));
vi.mock("@/lib/eventernote/client", () => ({
  eventernoteUserEventsParserVersion: 3,
  fetchUserEventCount: vi.fn(),
}));
vi.mock("@/lib/events/event-visibility-rules-store", () => ({
  readEventVisibilityRules: async () => ({ titleTagsToStrip: [] }),
}));
vi.mock("@/lib/stats/catalog-cache", () => ({ getSongCatalog: async () => ({ songsWithLiveState: [] }) }));
vi.mock("@/lib/stats/build-matched-events", () => ({ buildMatchedEvents: vi.fn(async () => []) }));
vi.mock("@/lib/stats/user-events-refresh", () => ({
  refreshCachedUserEventsDeduped: vi.fn(),
  scheduleUserEventsRefresh: vi.fn(),
  waitForUserEventsRefresh: vi.fn(),
  refreshUserEventsInline: vi.fn(),
}));

import { getUserSongStats } from "@/lib/stats/get-user-song-stats";
import { fetchUserEventCount } from "@/lib/eventernote/client";
import { refreshCachedUserEventsDeduped, scheduleUserEventsRefresh, refreshUserEventsInline } from "@/lib/stats/user-events-refresh";

const now = new Date("2026-09-06T00:00:00Z");
const successfulRefresh = { status: "ok" as const, displayId: "User", displayName: "Display", activities: [], remoteEventCount: 0 };
const cache = () => ({
  userId: "user", displayId: "User", displayName: null,
  parserVersion: 3, activities: [], remoteEventCount: 0,
  fetchStatus: "ok", errorMessage: null, lastFetchedAt: now,
  expiresAt: null, refreshingStartedAt: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("DATABASE_URL", "postgres://example.invalid/test");
  state.cacheRows = [cache()];
  vi.mocked(fetchUserEventCount).mockResolvedValue(0);
  vi.mocked(refreshCachedUserEventsDeduped).mockResolvedValue(successfulRefresh);
  vi.mocked(refreshUserEventsInline).mockResolvedValue(successfulRefresh);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("user stats cache transitions", () => {
  it("serves a current cache without refreshing", async () => {
    await expect(getUserSongStats("User")).resolves.toMatchObject({ state: "ok", staleCacheUsed: false });
    expect(scheduleUserEventsRefresh).not.toHaveBeenCalled();
    expect(refreshCachedUserEventsDeduped).not.toHaveBeenCalled();
  });

  it("upgrades an old payload before validating its shape against the current schema", async () => {
    state.cacheRows = [{ ...cache(), parserVersion: 1, activities: [{ legacy: true }] }];
    await expect(getUserSongStats("User")).resolves.toMatchObject({ state: "ok", displayName: "Display", staleCacheUsed: false });
    expect(fetchUserEventCount).not.toHaveBeenCalled();
  });

  it("does not apply an old error or schedule another refresh after an upgrade succeeds", async () => {
    state.cacheRows = [{ ...cache(), parserVersion: 1, fetchStatus: "error", errorMessage: "用户不存在" }];
    await expect(getUserSongStats("User")).resolves.toMatchObject({ state: "ok", staleCacheUsed: false });
    expect(scheduleUserEventsRefresh).not.toHaveBeenCalled();
  });

  it("returns the upstream error when an old payload cannot be refreshed", async () => {
    state.cacheRows = [{ ...cache(), parserVersion: 1, activities: [{ legacy: true }] }];
    vi.mocked(refreshCachedUserEventsDeduped).mockResolvedValue({ status: "error", message: "timeout" });
    await expect(getUserSongStats("User")).resolves.toMatchObject({ state: "upstream-error", message: "timeout" });
  });

  it("warms a cache miss without a redundant count fetch", async () => {
    state.cacheRows = [];
    await expect(getUserSongStats("User")).resolves.toMatchObject({ state: "warming", reason: "initializing" });
    expect(fetchUserEventCount).not.toHaveBeenCalled();
    expect(scheduleUserEventsRefresh).toHaveBeenCalledOnce();
  });
});
