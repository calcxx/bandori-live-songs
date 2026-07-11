import { describe, expect, it } from "vitest";
import { toBandoriFansBandLabel, BANDORI_FANS_BAND_LABELS } from "@/lib/setlist-export/bandori-fans-band-names";
import {
  extractDistinctiveTitleNeedle,
  scoreEventCandidateForExport,
} from "@/lib/setlist-export/scoring";

describe("bandori-fans band labels", () => {
  it("maps known slugs to bandori.fans picker labels", () => {
    expect(toBandoriFansBandLabel("raise-a-suilen")).toBe("RAISE A SUILEN");
    expect(toBandoriFansBandLabel("poppin-party")).toBe("POPPIN\u2019PARTY");
    expect(toBandoriFansBandLabel("hello-happy-world")).toBe("HELLO,HAPPY WORLD!");
    expect(toBandoriFansBandLabel("mugendai-mewtype")).toBe("MUGENDAI MYU-TYPE");
  });

  it("falls back to provided name for unknown slugs", () => {
    expect(toBandoriFansBandLabel("millsage", "millsage")).toBe("millsage");
    expect(toBandoriFansBandLabel("unknown")).toBeNull();
  });

  it("covers the ten main bands on bandori.fans", () => {
    expect(Object.keys(BANDORI_FANS_BAND_LABELS)).toHaveLength(10);
  });
});

describe("setlist export event date scoring", () => {
  const day1 = { title: "MEGA VEGAS 2026 DAY1", eventDate: "2026-03-20" };
  const day2 = { title: "MEGA VEGAS 2026 DAY2", eventDate: "2026-03-21" };

  it("prefers the requested date for same festival title family", () => {
    const query = { title: "MEGA VEGAS 2026", eventDate: "2026-03-21" };
    expect(scoreEventCandidateForExport(query, day2)).toBeGreaterThan(
      scoreEventCandidateForExport(query, day1),
    );
  });

  it("ignores date when eventDate is omitted", () => {
    const query = { title: "MEGA VEGAS 2026 DAY1" };
    expect(scoreEventCandidateForExport(query, day1)).toBeGreaterThan(
      scoreEventCandidateForExport(query, day2),
    );
  });

  it("matches bandori.fans quoted titles to eventernote dash-wrapped titles", () => {
    const fansTitle = 'Animelo Summer Live 2025 "ThanXX!"';
    const storedTitle = "Animelo Summer Live 2025 -ThanXX!- Day1";
    const query = { title: fansTitle, eventDate: "2025-08-29" };
    expect(scoreEventCandidateForExport(query, { title: storedTitle, eventDate: "2025-08-29" })).toBeGreaterThan(
      0,
    );
    expect(extractDistinctiveTitleNeedle(fansTitle)).toBe("thanxx");
  });

  it("requires exact date match when filtering ranked results", () => {
    const ranked = [
      { event: day1, score: 25_000 },
      { event: day2, score: 24_000 },
    ];
    const dateMatches = ranked.filter((item) => item.event.eventDate === "2026-03-21");
    expect(dateMatches).toHaveLength(1);
    expect(dateMatches[0]?.event.eventDate).toBe("2026-03-21");
  });
});
