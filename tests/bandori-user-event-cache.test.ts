import { describe, expect, it } from "vitest";
import { createBandoriUserEventSnapshots } from "@/lib/eventernote/bandori-user-events";
import type { BandoriEventIndexLookup } from "@/lib/eventernote/bandori-event-index";
import type { EventernoteEventSnapshot } from "@/lib/eventernote/parser";
import {
  getRankingEventDateWindow,
  getRecentEventDateWindow,
  toBandoriEventIndexRows,
} from "@/lib/eventernote/bandori-event-index";
import type { ActorEventRankingEntry } from "@/lib/eventernote/actor-events";
import { filterRecentEventEntries } from "@/lib/eventernote/event-ranking-snapshot";

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
        420629,
        indexEntry(420629, ["poppin-party", "roselia"], {
          title: "BanG Dream! 合同ライブ",
          venue: "武蔵野の森総合スポーツプラザ",
        }),
      ],
    ]);

    const cached = createBandoriUserEventSnapshots(
      [
        snapshot({
          eventernoteEventId: 420629,
          title: "wrong title from misaligned list row",
          venue: "wrong venue",
          actorIds: [123456],
          actorNames: ["Unrelated Artist"],
        }),
        snapshot({
          eventernoteEventId: 396309,
          actorIds: [14234],
          actorNames: ["Poppin'Party"],
        }),
      ],
      index,
    );

    expect(cached).toEqual([
      {
        eventernoteEventId: 420629,
        title: "BanG Dream! 合同ライブ",
        eventDate: "2026-01-01",
        venue: "武蔵野の森総合スポーツプラザ",
        matchedBandSlugs: ["poppin-party", "roselia"],
        sourceUrl: "https://www.eventernote.com/events/1",
      },
    ]);
  });

  it("drops events missing from the index even when list-page actors look like BanG Dream", () => {
    const cached = createBandoriUserEventSnapshots(
      [
        snapshot({
          eventernoteEventId: 999999,
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
      [438720, indexEntry(438720, ["ave-mujica"], { title: "Ave Mujica LIVE TOUR 2026「Exitus」東京公演" })],
      [
        452934,
        indexEntry(452934, ["poppin-party", "roselia"], {
          title: "Poppin'Party×Roselia 合同ライブ「DREAMS GO ON」",
        }),
      ],
      [
        430842,
        indexEntry(430842, ["poppin-party"], {
          title: "Poppin’Party New Year LIVE「Happy BanG Year!!」",
        }),
      ],
    ]);

    const cached = createBandoriUserEventSnapshots(
      [
        snapshot({ eventernoteEventId: 438720, title: "ignored" }),
        snapshot({ eventernoteEventId: 452934, title: "ignored" }),
        snapshot({ eventernoteEventId: 430842, title: "ignored" }),
      ],
      index,
    );

    expect(cached).toEqual([
      expect.objectContaining({
        eventernoteEventId: 438720,
        matchedBandSlugs: ["ave-mujica"],
      }),
      expect.objectContaining({
        eventernoteEventId: 452934,
        matchedBandSlugs: ["poppin-party", "roselia"],
      }),
      expect.objectContaining({
        eventernoteEventId: 430842,
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

describe("ranking/recent date windows from merged events", () => {
  it("filters ranking through today and recent within the rolling window", () => {
    const merged: ActorEventRankingEntry[] = [
      {
        eventernoteEventId: 2,
        title: "past",
        eventDate: "2026-07-01",
        venue: null,
        attendeeCount: 5,
        sourceUrl: "https://www.eventernote.com/events/2",
        bandSlugs: ["roselia"],
        bandNames: ["Roselia"],
      },
      {
        eventernoteEventId: 3,
        title: "near future",
        eventDate: "2026-07-12",
        venue: null,
        attendeeCount: 8,
        sourceUrl: "https://www.eventernote.com/events/3",
        bandSlugs: ["mygo"],
        bandNames: ["MyGO!!!!!"],
      },
    ];
    const now = new Date("2026-07-10T12:00:00+08:00");
    const { filteredThrough } = getRankingEventDateWindow(now);
    const rankingIds = merged
      .filter((event) => event.eventDate <= filteredThrough)
      .map((event) => event.eventernoteEventId);
    const recentIds = filterRecentEventEntries(merged, now).map((event) => event.eventernoteEventId);

    expect(getRecentEventDateWindow(now)).toEqual({
      filteredFrom: "2026-06-10",
      filteredThrough: "2026-07-17",
    });
    expect(rankingIds).toEqual([2]);
    expect(recentIds.sort()).toEqual([2, 3]);
  });
});
