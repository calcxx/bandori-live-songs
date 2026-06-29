import { describe, expect, it } from "vitest";
import { findClosestSongTitle } from "@/lib/music/song-match-suggestions";

describe("song-match-suggestions", () => {
  const catalog = [
    "STAR BEAT!~ホシノコドウ~",
    "Takin' my Heart",
    "Choir 'S' Choir",
    "証命讃歌",
  ];

  it("finds the closest catalog title for common punctuation differences", () => {
    const result = findClosestSongTitle("STAR BEAT!〜ホシノコドウ〜", catalog);
    expect(result?.title).toBe("STAR BEAT!~ホシノコドウ~");
    expect(result?.score).toBeGreaterThan(0.9);
  });

  it("finds the closest catalog title for quote variants", () => {
    const result = findClosestSongTitle("Choir ‘S’ Choir", catalog);
    expect(result?.title).toBe("Choir 'S' Choir");
  });

  it("does not suggest unrelated titles", () => {
    const result = findClosestSongTitle("完全不同的歌", catalog);
    expect(result).toBeNull();
  });
});
