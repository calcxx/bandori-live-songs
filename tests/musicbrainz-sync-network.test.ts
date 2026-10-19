import { afterEach, expect, it, vi } from "vitest";
import {
  flagCoverWorkRecordings,
  searchRecentRecordingsByArtist,
  type MusicBrainzRecordingHit,
} from "@/lib/musicbrainz/recent-songs-sync";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => vi.unstubAllGlobals());

it("reads every search page instead of silently dropping hits after 100", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ count: 101, recordings: Array.from({ length: 100 }, (_, i) => ({ title: `Song ${i}` })) }))
    .mockResolvedValueOnce(Response.json({ count: 101, recordings: [{ title: "Last song" }] }));
  vi.stubGlobal("fetch", fetch);
  const result = await searchRecentRecordingsByArtist("artist", "2026-08-15");
  expect(result).toHaveLength(101);
  expect(result[100].title).toBe("Last song");
  expect(fetch.mock.calls[1][0]).toContain("offset=100");
});

it("retries upstream unavailability and transient network failures", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockRejectedValueOnce(new TypeError("fetch failed"))
    .mockResolvedValueOnce(Response.json({ count: 1, recordings: [{ title: "Recovered" }] }));
  vi.stubGlobal("fetch", fetch);
  expect(await searchRecentRecordingsByArtist("artist", "2026-08-15")).toMatchObject([{ title: "Recovered" }]);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("reports exhausted retries and does not retry permanent errors", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  await expect(searchRecentRecordingsByArtist("artist", "2026-08-15")).rejects.toThrow("503");
  expect(fetch).toHaveBeenCalledTimes(3);
  fetch.mockClear().mockResolvedValue(new Response(null, { status: 400 }));
  await expect(searchRecentRecordingsByArtist("artist", "2026-08-15")).rejects.toThrow("400");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("honors the shared budget before starting another request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(searchRecentRecordingsByArtist("artist", "2026-08-15", AbortSignal.abort(new Error("Budget exhausted")))).rejects.toThrow("Budget exhausted");
  expect(fetch).not.toHaveBeenCalled();
});

it("rejects truncated pagination instead of reporting a complete scan", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ count: 1, recordings: [] })));
  await expect(searchRecentRecordingsByArtist("artist", "2026-08-15")).rejects.toThrow("pagination ended");
});

it("carries the recording id so work relations can be resolved later", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ count: 1, recordings: [{ id: "rec-1", title: "Stellar Stellar" }] })));
  const result = await searchRecentRecordingsByArtist("artist", "2026-08-15");
  expect(result[0].recordingId).toBe("rec-1");
});

it("flags covers through recording work relations and leaves catalog titles untouched", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      relations: [
        { type: "performance", "target-type": "work", attributes: ["cover"], work: { title: "Stellar Stellar" } },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetch);

  const recordings: MusicBrainzRecordingHit[] = [
    { recordingId: "rec-1", title: "Stellar Stellar", firstReleaseDate: "2026-09-22" },
    { recordingId: "rec-1", title: "Stellar Stellar (Live)", firstReleaseDate: "2026-09-22" },
    { recordingId: "rec-2", title: "Already Here", firstReleaseDate: "2026-09-20" },
    { title: "No id" },
  ];
  const existing = new Map([["already here", { title: "Already Here", firstReleaseDate: "2026-01-01" }]]);

  expect(await flagCoverWorkRecordings(recordings, existing)).toBe(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain("inc=work-rels");
  expect(recordings[0].coverWorkTitle).toBe("Stellar Stellar");
  expect(recordings[2].coverWorkTitle).toBeUndefined();
});

it("rejects instead of inserting candidates whose cover lookup failed", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expect(
    flagCoverWorkRecordings([{ recordingId: "rec-1", title: "Stellar Stellar" }], new Map()),
  ).rejects.toThrow("503");
});
