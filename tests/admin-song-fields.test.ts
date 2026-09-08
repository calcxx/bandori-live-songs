import { describe, expect, it } from "vitest";
import { parseSongFields } from "@/lib/admin/song-fields";

const original = { categoryValue: "original", bandSlug: "roselia", releaseDate: "2024-02-29" };

describe("song form fields", () => {
  it("returns typed database fields for valid originals", () => {
    expect(parseSongFields(original)).toEqual({ success: true, data: {
      category: "original", bandSlug: "roselia", firstReleaseDate: "2024-02-29",
    } });
  });
  it.each([
    { categoryValue: "unknown" }, { bandSlug: "unknown" }, { releaseDate: "" },
    { releaseDate: "2023-02-29" }, { releaseDate: "2026-04-31" },
  ])("rejects invalid originals: %j", (overrides) => {
    expect(parseSongFields({ ...original, ...overrides }).success).toBe(false);
  });
  it.each(["cover", "project-common"])("removes band association and allows a missing date for %s", (categoryValue) => {
    expect(parseSongFields({ ...original, categoryValue, releaseDate: "" })).toEqual({
      success: true, data: { category: categoryValue, bandSlug: null, firstReleaseDate: null },
    });
  });
  it("validates optional cover release dates too", () => {
    expect(parseSongFields({ ...original, categoryValue: "cover", releaseDate: "2026-02-30" }).success).toBe(false);
  });
});
