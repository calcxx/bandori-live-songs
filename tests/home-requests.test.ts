import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("home requests", () => {
  it("shares detail requests for one event while keeping different events separate", async () => {
    const { loadLiveSetlistDetail } = await import("@/components/home/requests");
    fetchMock.mockImplementation(async (url: string) => Response.json({ live: { url } }));
    const first = loadLiveSetlistDetail(100);
    expect(loadLiveSetlistDetail(100)).toBe(first);
    expect(await loadLiveSetlistDetail(200)).toEqual({ url: "/api/live-setlists?eventernoteEventId=200" });
    expect(await first).toEqual({ url: "/api/live-setlists?eventernoteEventId=100" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["loadLiveSetlistDetail", "loadRecentLiveSetlists", "loadOnThisDayLiveSetlists"] as const)(
    "%s retries after a failed response and retains a successful response",
    async (name) => {
      const requests = await import("@/components/home/requests");
      const load = () => requests[name](100);
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(Response.json({ live: { eventernoteEventId: 100 }, events: [] }));
      await expect(load()).rejects.toThrow("503");
      const retried = load();
      await retried;
      expect(load()).toBe(retried);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );
});
