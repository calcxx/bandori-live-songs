import { describe, expect, it } from "vitest";
import { matchesSongTitleSearch } from "@/lib/music/song-search";

describe("matchesSongTitleSearch", () => {
  it("matches partial titles after normalizing punctuation and width", () => {
    expect(matchesSongTitleSearch("Yes! BanG_Dream!", "ｂａｎｇ dream")).toBe(
      true,
    );
  });

  it("uses the same fuzzy title scoring as event search", () => {
    expect(matchesSongTitleSearch("BLACK SHOUT", "BLACK SHOT")).toBe(true);
  });

  it("does not treat a very short title as a useful substring match", () => {
    expect(matchesSongTitleSearch("GO!!!", "God knows")).toBe(false);
    expect(matchesSongTitleSearch("Crow Song", "God knows")).toBe(false);
  });

  it("rejects unrelated titles", () => {
    expect(matchesSongTitleSearch("FIRE BIRD", "夢現妄想世界")).toBe(false);
  });
});
