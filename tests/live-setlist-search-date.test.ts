import { describe, expect, it } from "vitest";
import {
  isValidLiveSetlistDate,
  parseLiveSetlistSearch,
} from "@/lib/live-setlist/date";
import { rankLiveSetlistCandidates } from "@/lib/live-setlist/match";

const candidates = [
  {
    eventernoteEventId: 3,
    title: "同日イベント B",
    eventDate: "2024-02-29",
    venue: null,
  },
  {
    eventernoteEventId: 2,
    title: "同日イベント A",
    eventDate: "2024-02-29",
    venue: null,
  },
  {
    eventernoteEventId: 1,
    title: "別日イベント",
    eventDate: "2024-02-28",
    venue: null,
  },
];

describe("live setlist date search", () => {
  it("validates calendar dates in ISO format", () => {
    expect(isValidLiveSetlistDate("2024-02-29")).toBe(true);
    expect(isValidLiveSetlistDate("2023-02-29")).toBe(false);
    expect(isValidLiveSetlistDate("2024-04-31")).toBe(false);
    expect(isValidLiveSetlistDate("2024/02/29")).toBe(false);
  });

  it("supports year, month, and day searches with multiple separators", () => {
    expect(rankLiveSetlistCandidates(candidates, "2024")).toEqual(
      candidates,
    );
    expect(rankLiveSetlistCandidates(candidates, "2024-2")).toEqual(
      candidates,
    );
    expect(rankLiveSetlistCandidates(candidates, "2024.02")).toEqual(
      candidates,
    );
    expect(rankLiveSetlistCandidates(candidates, "2024.02.29")).toEqual(
      candidates.slice(0, 2),
    );
    expect(rankLiveSetlistCandidates(candidates, "2024/2/29")).toEqual(
      candidates.slice(0, 2),
    );
    const titleAndDateResults = rankLiveSetlistCandidates(
      candidates,
      "同日イベント A 2024.2",
    );
    expect(titleAndDateResults[0]).toEqual(candidates[1]);
    expect(titleAndDateResults.every((candidate) => candidate.eventDate.startsWith("2024-02"))).toBe(true);
    expect(rankLiveSetlistCandidates(candidates, "2024-03-1")).toEqual([]);
  });

  it("removes the date token before title matching", () => {
    expect(parseLiveSetlistSearch("2024 MyGO")).toEqual({
      title: "MyGO",
      dateFilter: { kind: "year", value: "2024" },
      invalidDateToken: false,
    });
    expect(parseLiveSetlistSearch("2024-02-29 MyGO")).toEqual({
      title: "MyGO",
      dateFilter: { kind: "day", value: "2024-02-29" },
      invalidDateToken: false,
    });
    expect(parseLiveSetlistSearch("MyGO 2024-2")).toEqual({
      title: "MyGO",
      dateFilter: { kind: "month", value: "2024-02" },
      invalidDateToken: false,
    });
    expect(parseLiveSetlistSearch("MyGO 2024/2/29")).toEqual({
      title: "MyGO",
      dateFilter: { kind: "day", value: "2024-02-29" },
      invalidDateToken: false,
    });
  });

  it("rejects invalid dates in the supported formats", () => {
    expect(parseLiveSetlistSearch("2024.02.30").invalidDateToken).toBe(true);
    expect(parseLiveSetlistSearch("2024/13").invalidDateToken).toBe(true);
    expect(parseLiveSetlistSearch("2024-2/29").invalidDateToken).toBe(true);
  });
});
