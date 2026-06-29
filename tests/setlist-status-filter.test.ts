import { describe, expect, it } from "vitest";
import { filterEventsByCollectedSetlistStatus } from "@/lib/events/setlist-status-filter";

describe("filterEventsByCollectedSetlistStatus", () => {
  const events = [
    { eventernoteEventId: 1, title: "missing" },
    { eventernoteEventId: 2, title: "partial" },
    { eventernoteEventId: 3, title: "complete" },
    { eventernoteEventId: 4, title: "unknown" },
  ];

  const statusByEventId = {
    1: "missing",
    2: "partial",
    3: "complete",
  } as const;

  it("returns all events when the toggle is disabled", () => {
    expect(filterEventsByCollectedSetlistStatus(events, statusByEventId, false).map((event) => event.eventernoteEventId)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("removes partial and complete events when the toggle is enabled", () => {
    expect(filterEventsByCollectedSetlistStatus(events, statusByEventId, true).map((event) => event.eventernoteEventId)).toEqual([1, 4]);
  });
});
