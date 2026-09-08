import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSongStatsResult } from "@/lib/stats/get-user-song-stats";

const storage = new Map<string, string>();
const result = (userId: string): Extract<UserSongStatsResult, { state: "ok" }> => ({
  state: "ok", userId, displayName: null, staleCacheUsed: false, songs: [], matchedEvents: [],
});
beforeEach(() => {
  vi.resetModules();
  storage.clear();
  vi.stubGlobal("window", { sessionStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } });
});
afterEach(() => vi.unstubAllGlobals());

describe("home user stats cache", () => {
  it("restores successful results across module reloads with case-insensitive user IDs", async () => {
    const cache = await import("@/components/home/user-stats-cache");
    cache.writeUserStatsCache(result("User"));
    vi.resetModules();
    const restored = await import("@/components/home/user-stats-cache");
    expect(restored.readUserStatsCache("USER")).toEqual(result("User"));
  });

  it("keeps the five most recently written users", async () => {
    const cache = await import("@/components/home/user-stats-cache");
    cache.readUserStatsCache("user0");
    for (let i = 0; i < 5; i++) cache.writeUserStatsCache(result(`user${i}`));
    cache.writeUserStatsCache(result("user0"));
    cache.writeUserStatsCache(result("user5"));
    expect(cache.readUserStatsCache("user1")).toBeNull();
    expect(cache.readUserStatsCache("user0")).toEqual(result("user0"));
    expect(cache.readUserStatsCache("user5")).toEqual(result("user5"));
  });

  it("still serves in-memory results when browser storage is blocked", async () => {
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("blocked"); } });
    const cache = await import("@/components/home/user-stats-cache");
    expect(cache.readUserStatsCache("User")).toBeNull();
    cache.writeUserStatsCache(result("User"));
    expect(cache.readUserStatsCache("User")).toEqual(result("User"));
  });
});

it("merges a newly loaded page with stored users before the first cache read", async () => {
  const firstPage = await import("@/components/home/user-stats-cache");
  firstPage.writeUserStatsCache(result("PreviousUser"));
  vi.resetModules();
  const nextPage = await import("@/components/home/user-stats-cache");
  nextPage.writeUserStatsCache(result("CurrentUser"));
  expect(nextPage.readUserStatsCache("PreviousUser")).toEqual(result("PreviousUser"));
  expect(nextPage.readUserStatsCache("CurrentUser")).toEqual(result("CurrentUser"));
});
