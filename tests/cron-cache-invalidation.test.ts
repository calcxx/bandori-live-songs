import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshEvents, syncSongs, revalidateTag } = vi.hoisted(() => ({
  refreshEvents: vi.fn(), syncSongs: vi.fn(), revalidateTag: vi.fn(),
}));
vi.mock("@/lib/eventernote/event-ranking-snapshot", () => ({ refreshBandoriActorEvents: refreshEvents }));
vi.mock("@/lib/musicbrainz/recent-songs-sync", () => ({ syncRecentMusicBrainzSongs: syncSongs }));
vi.mock("next/cache", () => ({ revalidateTag }));
import { GET as refresh } from "@/app/api/cron/event-ranking/route";
import { GET as sync } from "@/app/api/cron/songs-sync/route";

function request(path: string) {
  return new Request(`https://example.test${path}`, { headers: { authorization: "Bearer test-cron-secret" } });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  vi.clearAllMocks();
  refreshEvents.mockResolvedValue({ indexedEventCount: 2, removedEventCount: 0, updatedAt: "2026-09-06" });
  syncSongs.mockResolvedValue({ inserted: 0, updated: 0, errors: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe("cron cache invalidation", () => {
  it("rejects unauthorized calls before writes or invalidation", async () => {
    expect((await refresh(new Request("https://example.test/api/cron/event-ranking"))).status).toBe(401);
    expect((await sync(new Request("https://example.test/api/cron/songs-sync"))).status).toBe(401);
    expect(refreshEvents).not.toHaveBeenCalled();
    expect(syncSongs).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("expires all index-dependent payloads after a successful event sync", async () => {
    expect((await refresh(request("/api/cron/event-ranking"))).status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([
      ["open-api-v1", { expire: 0 }], ["song-events", { expire: 0 }],
      ["live-setlist-search", { expire: 0 }],
    ]);
  });

  it("does not invalidate when the event sync fails", async () => {
    refreshEvents.mockRejectedValue(new Error("database unavailable"));
    await expect(refresh(request("/api/cron/event-ranking"))).rejects.toThrow("database unavailable");
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([
    { inserted: 1, updated: 0 }, { inserted: 0, updated: 1 },
  ])("invalidates after song changes: %j", async (changes) => {
    syncSongs.mockResolvedValue({ ...changes, errors: [] });
    expect((await sync(request("/api/cron/songs-sync"))).status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([
      ["song-catalog", { expire: 0 }], ["open-api-v1", { expire: 0 }],
    ]);
  });

  it("keeps caches for no-op syncs and dry runs", async () => {
    await sync(request("/api/cron/songs-sync"));
    syncSongs.mockResolvedValue({ inserted: 1, updated: 1, errors: [] });
    await sync(request("/api/cron/songs-sync?dryRun=1"));
    expect(syncSongs).toHaveBeenLastCalledWith(expect.objectContaining({ dryRun: true }));
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
