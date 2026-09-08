import { describe, expect, it } from "vitest";
import { scoreEventCandidateForExport } from "@/lib/setlist-export/scoring";

describe("event title candidate scoring", () => {
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
    expect(scoreEventCandidateForExport(query, day1)).toBe(
      scoreEventCandidateForExport(query, { ...day1, eventDate: day2.eventDate }),
    );
  });

  it("matches bandori.fans quoted titles to eventernote dash-wrapped titles", () => {
    const fansTitle = 'Animelo Summer Live 2025 "ThanXX!"';
    const storedTitle = "Animelo Summer Live 2025 -ThanXX!- Day1";
    const query = { title: fansTitle, eventDate: "2025-08-29" };
    expect(scoreEventCandidateForExport(query, { title: storedTitle, eventDate: "2025-08-29" })).toBeGreaterThan(
      0,
    );
  });

  it("tolerates small spelling mistakes in manual searches", () => {
    const score = scoreEventCandidateForExport(
      { title: "Rosellia 2nd Live Zeit" },
      { title: "Roselia 2nd Live「Zeit」", eventDate: "2017-10-08" },
    );
    expect(score).toBeGreaterThan(3_000);
  });

  it("does not match unrelated events that only share generic words", () => {
    const score = scoreEventCandidateForExport(
      { title: "Roselia 2nd Live Zeit" },
      { title: "RAISE A SUILEN SPECIAL LIVE", eventDate: "2024-01-01" },
    );
    expect(score).toBe(0);
  });
});
