import { describe, expect, it } from "vitest";
import { createBandoriUserEventSnapshots } from "@/lib/eventernote/bandori-user-events";
import type { BandoriEventIndexLookup } from "@/lib/eventernote/bandori-event-index";
import type { EventernoteEventSnapshot } from "@/lib/eventernote/parser";
import { toBandoriEventIndexRows } from "@/lib/eventernote/bandori-event-index";
import type { ActorEventRankingEntry } from "@/lib/eventernote/actor-events";

function snapshot(overrides: Partial<EventernoteEventSnapshot>): EventernoteEventSnapshot {
  return {
    eventernoteEventId: 1,
    title: "test event",
    eventDate: "2026-01-01",
    venue: "test venue",
    actorIds: [],
    actorNames: [],
    sourceUrl: "https://www.eventernote.com/events/1",
    ...overrides,
  };
}

function indexEntry(
  eventernoteEventId: number,
  bandSlugs: string[],
  overrides: Partial<BandoriEventIndexLookup> = {},
): BandoriEventIndexLookup {
  return {
    eventernoteEventId,
    title: "indexed title",
    eventDate: "2026-01-01",
    venue: "indexed venue",
    sourceUrl: `https://www.eventernote.com/events/${eventernoteEventId}`,
    bandSlugs,
    ...overrides,
  };
}

describe("bandori user event cache", () => {
  it("keeps only index hits and prefers index metadata over list-page fields", () => {
    const index = new Map<number, BandoriEventIndexLookup>([
      [
        101,
        indexEntry(101, ["poppin-party", "roselia"], {
          title: "Indexed Bandori Test Live",
          venue: "Indexed Test Venue",
        }),
      ],
    ]);

    const cached = createBandoriUserEventSnapshots(
      [
        snapshot({
          eventernoteEventId: 101,
          title: "wrong title from misaligned list row",
          venue: "wrong venue",
          actorIds: [999],
          actorNames: ["Unrelated Artist"],
        }),
        snapshot({
          eventernoteEventId: 102,
          actorIds: [14234],
          actorNames: ["Poppin'Party"],
        }),
      ],
      index,
    );

    expect(cached).toEqual([
      {
        eventernoteEventId: 101,
        title: "Indexed Bandori Test Live",
        eventDate: "2026-01-01",
        venue: "Indexed Test Venue",
        matchedBandSlugs: ["poppin-party", "roselia"],
        sourceUrl: "https://www.eventernote.com/events/1",
      },
    ]);
  });

  it("drops events missing from the index even when list-page actors look like BanG Dream", () => {
    const cached = createBandoriUserEventSnapshots(
      [
        snapshot({
          eventernoteEventId: 103,
          eventDate: "2099-01-01",
          actorIds: [66346],
          actorNames: ["MyGO!!!!!"],
        }),
      ],
      new Map(),
    );

    expect(cached).toEqual([]);
  });

  it("maps multi-band and single-band lives from index band slugs", () => {
    const index = new Map<number, BandoriEventIndexLookup>([
      [201, indexEntry(201, ["ave-mujica"], { title: "Example Band Live" })],
      [
        202,
        indexEntry(202, ["poppin-party", "roselia"], {
          title: "Example Joint Live",
        }),
      ],
      [
        203,
        indexEntry(203, ["poppin-party"], {
          title: "Example Single-Band Live",
        }),
      ],
    ]);

    const cached = createBandoriUserEventSnapshots(
      [
        snapshot({ eventernoteEventId: 201, title: "ignored" }),
        snapshot({ eventernoteEventId: 202, title: "ignored" }),
        snapshot({ eventernoteEventId: 203, title: "ignored" }),
      ],
      index,
    );

    expect(cached).toEqual([
      expect.objectContaining({
        eventernoteEventId: 201,
        matchedBandSlugs: ["ave-mujica"],
      }),
      expect.objectContaining({
        eventernoteEventId: 202,
        matchedBandSlugs: ["poppin-party", "roselia"],
      }),
      expect.objectContaining({
        eventernoteEventId: 203,
        matchedBandSlugs: ["poppin-party"],
      }),
    ]);
  });
});

describe("bandori event index rows", () => {
  it("maps merged actor entries into upsert rows", () => {
    const entries: ActorEventRankingEntry[] = [
      {
        eventernoteEventId: 1,
        title: "A",
        eventDate: "2026-01-01",
        venue: null,
        attendeeCount: 10,
        sourceUrl: "https://www.eventernote.com/events/1",
        bandSlugs: ["poppin-party"],
        bandNames: ["Poppin'Party"],
      },
    ];
    const now = new Date("2026-07-10T00:00:00.000Z");
    expect(toBandoriEventIndexRows(entries, now)).toEqual([
      {
        eventernoteEventId: 1,
        title: "A",
        eventDate: "2026-01-01",
        venue: null,
        sourceUrl: "https://www.eventernote.com/events/1",
        attendeeCount: 10,
        bandSlugs: ["poppin-party"],
        bandNames: ["Poppin'Party"],
        updatedAt: now,
      },
    ]);
  });
});
