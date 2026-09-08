import { describe, expect, it } from "vitest";
import { rankSongTitleCandidates } from "@/lib/music/song-match-suggestions";

describe("song-match-suggestions", () => {
  const catalog = [
    "STAR BEAT!~ホシノコドウ~",
    "Takin' my Heart",
    "Choir 'S' Choir",
    "証命讃歌",
  ];

  it("finds the closest catalog title for common punctuation differences", () => {
    const [result] = rankSongTitleCandidates("STAR BEAT!〜ホシノコドウ〜", catalog);
    expect(result?.title).toBe("STAR BEAT!~ホシノコドウ~");
    expect(result?.score).toBeGreaterThan(0.9);
  });

  it("finds the closest catalog title for quote variants", () => {
    const [result] = rankSongTitleCandidates("Choir ‘S’ Choir", catalog);
    expect(result?.title).toBe("Choir 'S' Choir");
  });

  it("does not suggest unrelated titles", () => {
    const [result] = rankSongTitleCandidates("完全不同的歌", catalog);
    expect(result).toBeUndefined();
  });

  it("uses fuzzy-search-style containment matching", () => {
    const [result] = rankSongTitleCandidates(
      "STAR BEAT ホシノコドウ",
      ["STAR BEAT!〜ホシノコドウ〜", "ティアドロップス"],
    );

    expect(result?.title).toBe("STAR BEAT!〜ホシノコドウ〜");
  });
});

it("orders candidates by score, honors the threshold and caps suggestions", () => {
  const titles = ["STAR BEAT extended", "STAR BEAT", "完全不同的歌"];
  expect(rankSongTitleCandidates("STAR BEAT", titles, 0.45, 2).map(({ title }) => title))
    .toEqual(["STAR BEAT", "STAR BEAT extended"]);
  expect(rankSongTitleCandidates("STAR BEAT", titles, 0.9).map(({ title }) => title))
    .toEqual(["STAR BEAT"]);
  expect(rankSongTitleCandidates("STAR BEAT", titles, 0.45, 1)).toHaveLength(1);
  expect(rankSongTitleCandidates("STAR BEAT", [])).toEqual([]);
});
