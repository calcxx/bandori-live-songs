import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  eventVisibilityRulesToFormText,
  parseEventVisibilityRulesForm,
  readEventVisibilityRulesFromFile,
} from "@/lib/events/event-visibility-rules-store";

describe("event visibility rules store", () => {
  it("parses editable textarea values into normalized rules", () => {
    expect(
      parseEventVisibilityRulesForm({
        hiddenTitleKeywordsText: " トーク \n\n舞台挨拶\nトーク ",
        hiddenEventernoteEventIdsText: "123\nabc\n456, 123 -1",
      }),
    ).toEqual({
      version: 1,
      hiddenTitleKeywords: ["トーク", "舞台挨拶"],
      hiddenEventernoteEventIds: [123, 456],
    });
  });

  it("reads seed rules from the JSON file (used by scripts/seed-visibility-rules.ts)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "bdr-rules-"));
    const filePath = path.join(dir, "event-visibility-rules.json");
    const rules = {
      version: 1 as const,
      hiddenTitleKeywords: ["トーク"],
      hiddenEventernoteEventIds: [123],
    };

    await writeFile(filePath, `${JSON.stringify(rules)}\n`, "utf8");

    expect(await readEventVisibilityRulesFromFile(filePath)).toEqual(rules);
  });

  it("formats rules for admin textarea editing", () => {
    expect(
      eventVisibilityRulesToFormText({
        version: 1,
        hiddenTitleKeywords: ["トーク", "舞台挨拶"],
        hiddenEventernoteEventIds: [123, 456],
      }),
    ).toEqual({
      hiddenTitleKeywordsText: "トーク\n舞台挨拶",
      hiddenEventernoteEventIdsText: "123\n456",
    });
  });
});
