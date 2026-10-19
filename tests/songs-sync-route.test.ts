import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/songs-sync/route";
import { syncRecentMusicBrainzSongs } from "@/lib/musicbrainz/recent-songs-sync";
import { revalidateTag } from "next/cache";
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/musicbrainz/recent-songs-sync", () => ({ syncRecentMusicBrainzSongs: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("returns failure status for partial syncs while invalidating successfully written data", async () => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.mocked(syncRecentMusicBrainzSongs).mockResolvedValue({ inserted: 1, updated: 0, errors: ["roselia: MusicBrainz HTTP 503"] } as Awaited<ReturnType<typeof syncRecentMusicBrainzSongs>>);
  const response = await GET(new Request("https://example.test/api/cron/songs-sync", { headers: { authorization: "Bearer test-secret" } }));
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ ok: false, inserted: 1 });
  expect(revalidateTag).toHaveBeenCalledTimes(2);
});
it("rejects unauthenticated requests before synchronization", async () => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  expect((await GET(new Request("https://example.test/api/cron/songs-sync"))).status).toBe(401);
  expect(syncRecentMusicBrainzSongs).not.toHaveBeenCalled();
});
