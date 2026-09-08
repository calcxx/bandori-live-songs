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
      candidate(2, 'Example Band LIVE 2026「Sample Ignition」香港公演 DAY2', "2026-08-16"),
      candidate(1, 'Example Band LIVE 2026「Sample Ignition」香港公演 DAY1', "2026-08-15"),
    ];

    expect(detectLiveSetlistSeries(events[0], events)).toMatchObject({
      title: 'Example Band LIVE 2026「Sample Ignition」香港公演',
      events: [
        { eventernoteEventId: 1, label: "DAY1" },
        { eventernoteEventId: 2, label: "DAY2" },
      ],
    });
  });

  it("groups day labels attached directly after a closing quote", () => {
    const events = [
      candidate(
        101,
        'Example Band 9th LIVE「Sample Story」DAY1',
        "2026-07-18",
      ),
      candidate(
        102,
        'Example Band 9th LIVE「Sample Story」DAY2',
        "2026-07-19",
      ),
    ];

    expect(detectLiveSetlistSeries(events[0], events)).toMatchObject({
      title: 'Example Band 9th LIVE「Sample Story」',
      events: [
        { eventernoteEventId: 101, label: "DAY1" },
        { eventernoteEventId: 102, label: "DAY2" },
      ],
    });
  });

  it("keeps complete Japanese quotes when the quoted titles differ", () => {
    const events = [
      candidate(
        1,
        'Example Project 9th LIVE「First Story」1日目',
        "2021-08-21",
      ),
      candidate(
        2,
        'Example Project 9th LIVE「First Story」2日目',
        "2021-08-22",
      ),
      candidate(
        3,
        'Example Project 9th LIVE「Second Story」1日目',
        "2021-09-04",
      ),
      candidate(
        4,
        'Example Project 9th LIVE「Second Story」2日目',
        "2021-09-05",
      ),
    ];

    expect(detectLiveSetlistSeries(events[2], events)).toMatchObject({
      title: "Example Project 9th LIVE",
      events: [
        { eventernoteEventId: 1, label: "「First Story」1日目" },
        { eventernoteEventId: 2, label: "「First Story」2日目" },
        { eventernoteEventId: 3, label: "「Second Story」1日目" },
        { eventernoteEventId: 4, label: "「Second Story」2日目" },
      ],
    });
  });

  it("groups tour stops by their long shared prefix", () => {
    const events = [
      candidate(10, 'Example Band TOUR 2025「Sample Journey」東京公演', "2025-03-01"),
      candidate(11, 'Example Band TOUR 2025「Sample Journey」大阪公演', "2025-03-08"),
      candidate(12, 'Example Band TOUR 2025「Sample Journey」愛知公演', "2025-03-15"),
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
      candidate(10, 'Example Band TOUR 2024「Earlier Story」東京公演', "2024-02-12"),
      candidate(11, 'Example Band TOUR 2024「Earlier Story」大阪公演', "2024-03-22"),
      candidate(12, 'Example Band TOUR 2025「Later Story」東京公演', "2025-03-01"),
      candidate(13, 'Example Band TOUR 2025「Later Story」大阪公演', "2025-03-08"),
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
      candidate(20, 'Example Band TOUR 2024-2025「Long Journey」福岡公演', "2024-10-05"),
      candidate(21, 'Example Band TOUR 2024-2025「Long Journey」大阪公演', "2025-01-19"),
    ];

    expect(
      detectLiveSetlistSeries(events[0], events)?.events.map(
        (event) => event.eventernoteEventId,
      ),
    ).toEqual([20, 21]);
  });

  it("does not group unrelated lives that only share a band name", () => {
    const events = [
      candidate(30, "Example Band 7th LIVE", "2024-12-22"),
      candidate(31, "Example Band 8th LIVE", "2025-05-03"),
    ];

    expect(detectLiveSetlistSeries(events[0], events)).toBeNull();
  });

  it("adds dates when generated tab labels would be duplicated", () => {
    const events = [
      candidate(40, "Example Project Special Live 東京公演", "2026-01-01"),
      candidate(41, "Example Project Special Live 東京公演", "2026-01-02"),
    ];

    expect(
      detectLiveSetlistSeries(events[0], events)?.events.map(
        (event) => event.label,
      ),
    ).toEqual(["2026-01-01", "2026-01-02"]);
  });
});
