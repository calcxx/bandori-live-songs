import { describe, expect, it } from "vitest";
import type { ActorEventRankingEntry } from "@/lib/eventernote/actor-events";
import {
  buildRecentEventSnapshot,
  filterRecentEventEntries,
  sortEventRankingEntries,
  sortRecentEventEntries,
} from "@/lib/eventernote/event-ranking-snapshot";

const sampleEvents: ActorEventRankingEntry[] = [
  {
    eventernoteEventId: 1,
    title: "Within Range Earlier Same Day",
    eventDate: "2026-05-01",
    venue: "A",
    attendeeCount: 320,
    sourceUrl: "https://www.eventernote.com/events/1",
    bandSlugs: ["mygo"],
    bandNames: ["MyGO!!!!!"],
  },
  {
    eventernoteEventId: 2,
    title: "Within Range Higher Count Same Day",
    eventDate: "2026-05-01",
    venue: "B",
    attendeeCount: 480,
    sourceUrl: "https://www.eventernote.com/events/2",
    bandSlugs: ["ave-mujica"],
    bandNames: ["Ave Mujica"],
  },
  {
    eventernoteEventId: 3,
    title: "Newest In Range",
    eventDate: "2026-05-06",
    venue: "C",
    attendeeCount: 150,
    sourceUrl: "https://www.eventernote.com/events/3",
    bandSlugs: ["ras"],
    bandNames: ["RAISE A SUILEN"],
  },
  {
    eventernoteEventId: 4,
    title: "Too Old",
    eventDate: "2026-03-31",
    venue: "D",
    attendeeCount: 999,
    sourceUrl: "https://www.eventernote.com/events/4",
    bandSlugs: ["roselia"],
    bandNames: ["Roselia"],
  },
  {
    eventernoteEventId: 5,
    title: "Too Far In Future",
    eventDate: "2026-05-09",
    venue: "E",
    attendeeCount: 999,
    sourceUrl: "https://www.eventernote.com/events/5",
    bandSlugs: ["popipa"],
    bandNames: ["Poppin'Party"],
  },
];

describe("filterRecentEventEntries", () => {
  it("keeps only events from 30 days before through 7 days after the current date", () => {
    const filtered = filterRecentEventEntries(sampleEvents, new Date("2026-05-01T12:00:00.000+09:00"));

    expect(filtered.map((event) => event.eventernoteEventId)).toEqual([1, 2, 3]);
  });
});

describe("sortRecentEventEntries", () => {
  it("sorts by date descending and attendee count descending within the same day", () => {
    const sorted = sortRecentEventEntries(sampleEvents.slice(0, 3));

    expect(sorted.map((event) => event.eventernoteEventId)).toEqual([3, 2, 1]);
  });
});

describe("sortEventRankingEntries", () => {
  it("sorts by date ascending and event id ascending within the same day", () => {
    const sorted = sortEventRankingEntries(sampleEvents.slice(0, 3));

    expect(sorted.map((event) => event.eventernoteEventId)).toEqual([1, 2, 3]);
  });
});

describe("buildRecentEventSnapshot", () => {
  it("stores the active date window boundaries in the snapshot", () => {
    const snapshot = buildRecentEventSnapshot(
      {
        version: 4,
        generatedAt: "2026-05-01T03:00:00.000Z",
        sourceBandCount: 12,
        scannedEventCount: 30,
        mergedEventCount: 5,
        events: sampleEvents,
      },
      new Date("2026-05-01T12:00:00.000+09:00"),
    );

    expect(snapshot.filteredFrom).toBe("2026-04-01");
    expect(snapshot.filteredThrough).toBe("2026-05-08");
    expect(snapshot.events.map((event) => event.eventernoteEventId)).toEqual([3, 2, 1]);
  });
});
