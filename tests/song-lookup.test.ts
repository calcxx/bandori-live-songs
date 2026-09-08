import { describe, expect, it } from "vitest";
import { buildUniqueSongTitleMap, createSongLookup } from "@/lib/music/song-lookup";

const first = { id: 1, title: "STAR BEAT!〜ホシノコドウ〜" };
const second = { id: 2, title: "STAR BEAT!～ホシノコドウ～" };

describe("catalog song lookup", () => {
  it("prefers exact titles even when normalization is ambiguous", () => {
    const lookup = createSongLookup([first, second]);
    expect(lookup.matchTitle(first.title)).toBe(first);
    expect(lookup.matchTitle(second.title)).toBe(second);
    expect(lookup.matchTitle("STAR BEAT!~ホシノコドウ~")).toBeNull();
  });

  it("matches a unique normalized title and leaves unknown songs unresolved", () => {
    const lookup = createSongLookup([first]);
    expect(lookup.matchTitle("STAR BEAT!~ホシノコドウ~")).toBe(first);
    expect(lookup.matchTitle("unknown")).toBeNull();
  });

  it("does not turn a collision back into a match when an ID repeats", () => {
    const lookup = createSongLookup([first, second, first]);
    expect(lookup.matchTitle("STAR BEAT!~ホシノコドウ~")).toBeNull();
    expect(createSongLookup([first, first]).matchTitle("STAR BEAT!~ホシノコドウ~")).toBe(first);
  });

  it("allows exports to reject duplicate exact titles", () => {
    const duplicate = { ...first, id: 3 };
    const lookup = buildUniqueSongTitleMap([first, duplicate, first], (song) => song.title);
    expect(lookup.get(first.title)).toBeNull();
  });
});
