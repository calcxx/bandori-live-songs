import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllActorEvents } from "@/lib/eventernote/actor-events";
import { syncBandoriEventIndex } from "@/lib/eventernote/bandori-event-index";
import { refreshBandoriActorEvents } from "@/lib/eventernote/event-ranking-snapshot";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/db/core", () => ({ getDb: () => ({}), connectDatabase: vi.fn() }));
vi.mock("@/lib/events/event-visibility-rules-store", () => ({ readEventVisibilityRulesFromDb: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/eventernote/bandori-event-index", () => ({ syncBandoriEventIndex: vi.fn() }));
vi.mock("@/lib/eventernote/actor-events", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/eventernote/actor-events")>(),
  fetchAllActorEvents: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(syncBandoriEventIndex).mockResolvedValue({ indexedEventCount: 3, removedEventCount: 0 });
  vi.mocked(fetchAllActorEvents).mockImplementation(async (actorId, band) => {
    const ids = actorId === 34386 ? [900000301, 900000302] : actorId === 39397 ? [900000302] : actorId === 24401 ? [900000301] : [];
    return {
      actorId, sourceBandSlug: band.slug, sourceBandName: band.nameJa, totalCount: ids.length,
      events: ids.map(eventernoteEventId => ({
        eventernoteEventId, title: `Live ${eventernoteEventId}`, eventDate: "2018-03-25", venue: null,
        sourceUrl: `https://www.eventernote.com/events/${eventernoteEventId}`, attendeeCount: 10,
        sourceBandSlug: band.slug, sourceBandName: band.nameJa,
      })),
    };
  });
});

describe("additional actor sources", () => {
  it("fetches THE THIRD as RAS, deduplicates shared events and preserves co-performing bands", async () => {
    await refreshBandoriActorEvents();
    expect(fetchAllActorEvents).toHaveBeenCalledWith(34386, { slug: "raise-a-suilen", nameJa: "RAISE A SUILEN" });
    expect(fetchAllActorEvents).toHaveBeenCalledWith(39397, { slug: "raise-a-suilen", nameJa: "RAISE A SUILEN" });
    const [entries] = vi.mocked(syncBandoriEventIndex).mock.calls[0];
    expect(entries.filter(event => event.eventernoteEventId === 900000302)).toHaveLength(1);
    expect(entries.find(event => event.eventernoteEventId === 900000302)?.bandSlugs).toEqual(["raise-a-suilen"]);
    expect(entries.find(event => event.eventernoteEventId === 900000301)).toMatchObject({
      bandSlugs: ["roselia", "raise-a-suilen"], bandNames: ["Roselia", "RAISE A SUILEN"],
    });
  });

  it("does not replace the index when an additional actor source fails", async () => {
    const fetch = vi.mocked(fetchAllActorEvents).getMockImplementation()!;
    vi.mocked(fetchAllActorEvents).mockImplementation((actorId, band) => {
      if (actorId === 34386) throw new Error("Incomplete actor event fetch");
      return fetch(actorId, band);
    });
    await expect(refreshBandoriActorEvents()).rejects.toThrow("Incomplete actor event fetch");
    expect(syncBandoriEventIndex).not.toHaveBeenCalled();
  });
});
