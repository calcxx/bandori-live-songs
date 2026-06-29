import { describe, expect, it } from "vitest";
import { createBandoriUserEventSnapshots } from "@/lib/eventernote/bandori-user-events";
import type { EventernoteEventSnapshot } from "@/lib/eventernote/parser";

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

describe("bandori user event cache", () => {
  it("keeps only BanG Dream band events and stores matched band slugs instead of raw actors", () => {
    const cached = createBandoriUserEventSnapshots([
      snapshot({
        eventernoteEventId: 420629,
        actorIds: [14234, 24401, 123456],
        actorNames: ["Poppin'Party", "Roselia", "Unrelated Artist"],
      }),
      snapshot({
        eventernoteEventId: 396309,
        actorIds: [59030],
        actorNames: ["Unrelated Artist"],
      }),
    ]);

    expect(cached).toEqual([
      {
        eventernoteEventId: 420629,
        title: "test event",
        eventDate: "2026-01-01",
        venue: "test venue",
        matchedBandSlugs: ["poppin-party", "roselia"],
        sourceUrl: "https://www.eventernote.com/events/1",
      },
    ]);
    expect(JSON.stringify(cached)).not.toContain("Unrelated Artist");
    expect(JSON.stringify(cached)).not.toContain("123456");
  });

  it("keeps future BanG Dream events so date visibility is decided at query time", () => {
    const cached = createBandoriUserEventSnapshots([
      snapshot({
        eventernoteEventId: 999999,
        eventDate: "2099-01-01",
        actorIds: [66346],
        actorNames: ["MyGO!!!!!"],
      }),
    ]);

    expect(cached).toHaveLength(1);
    expect(cached[0]?.matchedBandSlugs).toEqual(["mygo"]);
  });

  it("maps representative multi-band and single-band live pages to the correct slugs", () => {
    const cached = createBandoriUserEventSnapshots([
      snapshot({
        eventernoteEventId: 438720,
        title: "Ave Mujica LIVE TOUR 2026「Exitus」東京公演",
        actorIds: [70564, 19452, 55045, 37809, 73109, 12490],
        actorNames: ["Ave Mujica", "佐々木李子", "渡瀬結月", "岡田夢以", "米澤茜", "高尾奏音"],
      }),
      snapshot({
        eventernoteEventId: 452934,
        title: "Poppin'Party×Roselia 合同ライブ「DREAMS GO ON」",
        actorIds: [14234, 2806, 14437, 13822, 2777, 5588, 24401, 21127, 1633, 12491, 2751, 42894],
        actorNames: [
          "Poppin'Party",
          "愛美",
          "大塚紗英",
          "西本りみ",
          "大橋彩香",
          "伊藤彩沙",
          "Roselia",
          "相羽あいな",
          "工藤晴香",
          "中島由貴",
          "櫻川めぐ",
          "志崎樺音",
        ],
      }),
      snapshot({
        eventernoteEventId: 430842,
        title: "Poppin’Party New Year LIVE「Happy BanG Year!!」",
        actorIds: [14234, 2806, 14437, 13822, 2777, 5588],
        actorNames: ["Poppin'Party", "愛美", "大塚紗英", "西本りみ", "大橋彩香", "伊藤彩沙"],
      }),
    ]);

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
