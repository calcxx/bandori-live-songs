import { describe, expect, it } from "vitest";
import {
  collectEventYears,
  filterEventsByYearAndBand,
  toggleSelection,
} from "@/lib/admin/list-event-filters";
import type { ActorEventRankingEntry } from "@/lib/eventernote/actor-events";
import { formatSetlistEntriesText } from "@/app/admin/setlist-import/types";

function event(partial: Partial<ActorEventRankingEntry> & Pick<ActorEventRankingEntry, "eventernoteEventId" | "eventDate" | "bandSlugs">): ActorEventRankingEntry {
  return {
    title: `Event ${partial.eventernoteEventId}`,
    venue: null,
    attendeeCount: 1,
    sourceUrl: `https://www.eventernote.com/events/${partial.eventernoteEventId}`,
    bandNames: partial.bandSlugs,
    ...partial,
  };
}

const sample = [
  event({ eventernoteEventId: 1, eventDate: "2024-01-01", bandSlugs: ["poppin-party"] }),
  event({ eventernoteEventId: 2, eventDate: "2025-06-01", bandSlugs: ["roselia"] }),
  event({ eventernoteEventId: 3, eventDate: "2025-07-01", bandSlugs: ["poppin-party", "roselia"] }),
];

describe("list event filters", () => {
  it("collects sorted unique years", () => {
    expect(collectEventYears(sample)).toEqual(["2024", "2025"]);
  });

  it("treats empty selections as unrestricted", () => {
    expect(filterEventsByYearAndBand(sample, [], []).map((item) => item.eventernoteEventId)).toEqual([1, 2, 3]);
  });

  it("filters by year OR within the year dimension", () => {
    expect(filterEventsByYearAndBand(sample, ["2025"], []).map((item) => item.eventernoteEventId)).toEqual([2, 3]);
  });

  it("filters by band intersection and ANDs with years", () => {
    expect(
      filterEventsByYearAndBand(sample, ["2025"], ["poppin-party"]).map((item) => item.eventernoteEventId),
    ).toEqual([3]);
  });

  it("toggles selection values", () => {
    expect(toggleSelection(["2024"], "2025")).toEqual(["2024", "2025"]);
    expect(toggleSelection(["2024", "2025"], "2024")).toEqual(["2025"]);
  });
});

describe("formatSetlistEntriesText", () => {
  it("joins titles as newline-separated setlist text", () => {
    expect(formatSetlistEntriesText(["A", "B"])).toBe("A\nB");
  });
});
