import { describe, expect, it } from "vitest";
import { createSongResolver } from "@/lib/music/song-resolution";

const songs = [
  {
    id: 1,
    title: "ティアドロップス",
    category: "original" as const,
    bandNameJa: "Poppin'Party",
  },
  {
    id: 2,
    title: "STAR BEAT!〜ホシノコドウ〜",
    category: "original" as const,
    bandNameJa: "Poppin'Party",
  },
  {
    id: 3,
    title: "STAR BEAT!～ホシノコドウ～",
    category: "cover" as const,
    bandNameJa: null,
  },
];

describe("createSongResolver", () => {
  const resolveSong = createSongResolver(songs);

  it("resolves an exact title without confirmation", () => {
    expect(resolveSong("ティアドロップス")).toEqual({
      status: "resolved",
      songId: 1,
      title: "ティアドロップス",
    });
  });

  it("requires a selection when normalized titles are ambiguous", () => {
    const result = resolveSong("STAR BEAT!~ホシノコドウ~");

    expect(result.status).toBe("selection-required");
    if (result.status === "selection-required") {
      expect(result.candidates.map((candidate) => candidate.songId)).toEqual([
        2, 3,
      ]);
    }
  });

  it("accepts only a candidate returned for the unresolved line", () => {
    expect(resolveSong("STAR BEAT!~ホシノコドウ~", 3)).toEqual({
      status: "resolved",
      songId: 3,
      title: "STAR BEAT!～ホシノコドウ～",
    });
    expect(resolveSong("完全不同的歌曲", 3).status).toBe(
      "selection-required",
    );
  });
});
