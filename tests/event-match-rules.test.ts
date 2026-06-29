import { describe, expect, it } from "vitest";
import type { EventernoteEventSnapshot } from "@/lib/eventernote/parser";
import { shouldIncludeEventInSongStats } from "@/lib/eventernote/match-rules";

function buildSnapshot(overrides: Partial<EventernoteEventSnapshot>): EventernoteEventSnapshot {
  return {
    eventernoteEventId: 420629,
    title: "BanG Dream! LIVE",
    eventDate: "2026-04-19",
    venue: "Kアリーナ横浜",
    actorIds: [14234],
    actorNames: ["Poppin'Party"],
    sourceUrl: "https://www.eventernote.com/events/420629",
    ...overrides,
  };
}

describe("shouldIncludeEventInSongStats", () => {
  it("excludes events scheduled after current JST date", () => {
    const now = new Date("2026-04-18T16:00:00.000Z"); // 2026-04-19 01:00 JST
    const futureEvent = buildSnapshot({ eventDate: "2026-04-20" });
    const sameDayEvent = buildSnapshot({ eventDate: "2026-04-19" });

    expect(shouldIncludeEventInSongStats(futureEvent, now)).toBe(false);
    expect(shouldIncludeEventInSongStats(sameDayEvent, now)).toBe(true);
  });

  it("keeps same-day events even if the title previously matched blocked keywords", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const snapshots = [
      buildSnapshot({ title: "BanG Dream! トーク Special", eventDate: "2026-04-19" }),
      buildSnapshot({ title: "BanG Dream! radio 公開収録", eventDate: "2026-04-19" }),
      buildSnapshot({ title: "BanG Dream! 舞台挨拶", eventDate: "2026-04-19" }),
    ];

    for (const snapshot of snapshots) {
      expect(shouldIncludeEventInSongStats(snapshot, now)).toBe(true);
    }
  });

  it("keeps regular past or same-day band lives", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const snapshot = buildSnapshot({ title: "Poppin'Party LIVE 2026" });

    expect(shouldIncludeEventInSongStats(snapshot, now)).toBe(true);
  });
});
