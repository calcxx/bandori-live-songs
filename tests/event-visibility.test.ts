import { describe, expect, it } from "vitest";
import {
  filterEventsByVisibilityRules,
  shouldHideEventByRulesWithRules,
  type EventVisibilityRules,
} from "@/lib/events/event-visibility";

const rules: EventVisibilityRules = {
  version: 1,
  hiddenTitleKeywords: ["トークイベント", "舞台挨拶"],
  hiddenEventernoteEventIds: [12345],
};

describe("event visibility rules", () => {
  it("matches configured title keywords and event ids", () => {
    expect(
      shouldHideEventByRulesWithRules(
        {
          eventernoteEventId: 1,
          title: "昼のトークイベント",
        },
        rules,
      ),
    ).toBe(true);

    expect(
      shouldHideEventByRulesWithRules(
        {
          eventernoteEventId: 12345,
          title: "普通のライブ",
        },
        rules,
      ),
    ).toBe(true);

    expect(
      shouldHideEventByRulesWithRules(
        {
          eventernoteEventId: 2,
          title: "バンドライブ",
        },
        rules,
      ),
    ).toBe(false);
  });

  it("filters only when the toggle is enabled", () => {
    const events = [
      { eventernoteEventId: 1, title: "昼のトークイベント" },
      { eventernoteEventId: 2, title: "バンドライブ" },
    ];

    expect(
      filterEventsByVisibilityRules(events, true, rules).map((event) => event.eventernoteEventId),
    ).toEqual([2]);
    expect(
      filterEventsByVisibilityRules(events, false, rules).map((event) => event.eventernoteEventId),
    ).toEqual([1, 2]);
  });
});
