import { describe, expect, it } from "vitest";
import { detectLiveSetlistSeries } from "@/lib/live-setlist/series";
import type { LiveSetlistCandidate } from "@/lib/live-setlist/types";

const candidate = (
  eventernoteEventId: number,
  title: string,
  eventDate: string,
): LiveSetlistCandidate => ({
  eventernoteEventId,
  title,
  eventDate,
  venue: null,
});

describe("live setlist series recognition", () => {
  it("groups multi-day events and keeps their day labels", () => {
    const events = [
      candidate(2, 'RAISE A SUILEN LIVE 2026「Boot IGNITION」香港公演 DAY2', "2026-08-16"),
      candidate(1, 'RAISE A SUILEN LIVE 2026「Boot IGNITION」香港公演 DAY1', "2026-08-15"),
    ];

    expect(detectLiveSetlistSeries(events[0], events)).toMatchObject({
      title: 'RAISE A SUILEN LIVE 2026「Boot IGNITION」香港公演',
      events: [
        { eventernoteEventId: 1, label: "DAY1" },
        { eventernoteEventId: 2, label: "DAY2" },
      ],
    });
  });

  it("groups tour stops by their long shared prefix", () => {
    const events = [
      candidate(10, 'MyGO!!!!! ZEPP TOUR 2025「心のはしを辿って」東京公演', "2025-03-01"),
      candidate(11, 'MyGO!!!!! ZEPP TOUR 2025「心のはしを辿って」大阪公演', "2025-03-08"),
      candidate(12, 'MyGO!!!!! ZEPP TOUR 2025「心のはしを辿って」愛知公演', "2025-03-15"),
    ];

    const series = detectLiveSetlistSeries(events[0], events);
    expect(series?.events.map((event) => event.label)).toEqual([
      "東京公演",
      "大阪公演",
      "愛知公演",
    ]);
  });

  it("does not merge tours whose year signatures differ", () => {
    const events = [
      candidate(10, 'MyGO!!!!! ZEPP TOUR 2024「彷徨する渇望」東京公演', "2024-02-12"),
      candidate(11, 'MyGO!!!!! ZEPP TOUR 2024「彷徨する渇望」大阪公演', "2024-03-22"),
      candidate(12, 'MyGO!!!!! ZEPP TOUR 2025「心のはしを辿って」東京公演', "2025-03-01"),
      candidate(13, 'MyGO!!!!! ZEPP TOUR 2025「心のはしを辿って」大阪公演', "2025-03-08"),
    ];

    expect(
      detectLiveSetlistSeries(events[0], events)?.events.map(
        (event) => event.eventernoteEventId,
      ),
    ).toEqual([10, 11]);
    expect(
      detectLiveSetlistSeries(events[2], events)?.events.map(
        (event) => event.eventernoteEventId,
      ),
    ).toEqual([12, 13]);
  });

  it("keeps the same multi-year tour signature in one series", () => {
    const events = [
      candidate(20, 'RAISE A SUILEN ZEPP TOUR 2024-2025「PANDEMONIUM」福岡公演', "2024-10-05"),
      candidate(21, 'RAISE A SUILEN ZEPP TOUR 2024-2025「PANDEMONIUM」大阪公演', "2025-01-19"),
    ];

    expect(
      detectLiveSetlistSeries(events[0], events)?.events.map(
        (event) => event.eventernoteEventId,
      ),
    ).toEqual([20, 21]);
  });

  it("does not group unrelated lives that only share a band name", () => {
    const events = [
      candidate(30, "MyGO!!!!! 7th LIVE", "2024-12-22"),
      candidate(31, "MyGO!!!!! 8th LIVE", "2025-05-03"),
    ];

    expect(detectLiveSetlistSeries(events[0], events)).toBeNull();
  });

  it("adds dates when generated tab labels would be duplicated", () => {
    const events = [
      candidate(40, "BanG Dream! Special Live 東京公演", "2026-01-01"),
      candidate(41, "BanG Dream! Special Live 東京公演", "2026-01-02"),
    ];

    expect(
      detectLiveSetlistSeries(events[0], events)?.events.map(
        (event) => event.label,
      ),
    ).toEqual(["2026-01-01", "2026-01-02"]);
  });
});
