import { describe, expect, it } from "vitest";
import {
  filterMusicBrainzRecordingsForBand,
  isReleaseDateInWindow,
  lookbackSinceDate,
  type ExistingSongRef,
} from "@/lib/musicbrainz/recent-songs-sync";
import { normalizeSongTitle } from "@/lib/music/title-utils";

function existingMap(entries: ExistingSongRef[]) {
  return new Map(entries.map((entry) => [normalizeSongTitle(entry.title), entry]));
}

describe("lookbackSinceDate", () => {
  it("returns UTC calendar date seven days before now", () => {
    expect(lookbackSinceDate(new Date("2026-07-15T08:30:00.000Z"), 7)).toBe("2026-07-08");
  });
});

describe("release date helpers", () => {
  it("keeps dates on or after the since boundary", () => {
    expect(isReleaseDateInWindow("2026-07-08", "2026-07-08")).toBe(true);
    expect(isReleaseDateInWindow("2026-07-09", "2026-07-08")).toBe(true);
    expect(isReleaseDateInWindow("2026-07-07", "2026-07-08")).toBe(false);
  });
});

describe("filterMusicBrainzRecordingsForBand", () => {
  const sinceDate = "2026-07-08";

  it("canonicalizes version titles and skips titles already in the catalog", () => {
    const result = filterMusicBrainzRecordingsForBand(
      "poppin-party",
      [
        {
          title: "NO GIRL NO CRY/Poppin'Party Ver.",
          firstReleaseDate: "2026-07-10",
        },
        {
          title: "Brand New Song",
          firstReleaseDate: "2026-07-12",
        },
      ],
      sinceDate,
      existingMap([{ title: "NO GIRL NO CRY", firstReleaseDate: "2018-01-01" }]),
    );

    expect(result.skippedExisting).toBe(1);
    expect(result.toUpdate).toEqual([]);
    expect(result.toInsert).toEqual([
      {
        bandSlug: "poppin-party",
        title: "Brand New Song",
        firstReleaseDate: "2026-07-12",
        rawTitle: "Brand New Song",
      },
    ]);
    expect(result.decisions.map((d) => d.action)).toEqual(["skip", "insert"]);
  });

  it("updates first release date when an earlier digital release appears", () => {
    const result = filterMusicBrainzRecordingsForBand(
      "mygo",
      [
        {
          title: "素寄曲",
          firstReleaseDate: "2026-07-10",
        },
      ],
      sinceDate,
      existingMap([{ title: "素寄曲", firstReleaseDate: "2026-08-01" }]),
    );

    expect(result.toInsert).toEqual([]);
    expect(result.toUpdate).toEqual([
      {
        bandSlug: "mygo",
        title: "素寄曲",
        previousDate: "2026-08-01",
        firstReleaseDate: "2026-07-10",
        rawTitle: "素寄曲",
      },
    ]);
    expect(result.decisions[0]).toMatchObject({
      action: "update-date",
      previousDate: "2026-08-01",
      firstReleaseDate: "2026-07-10",
    });
  });

  it("does not update when musicbrainz date is not earlier", () => {
    const result = filterMusicBrainzRecordingsForBand(
      "mygo",
      [{ title: "素寄曲", firstReleaseDate: "2026-08-01" }],
      sinceDate,
      existingMap([{ title: "素寄曲", firstReleaseDate: "2026-07-10" }]),
    );

    expect(result.toUpdate).toEqual([]);
    expect(result.skippedExisting).toBe(1);
  });

  it("excludes instrumental and other non-song tracks", () => {
    const result = filterMusicBrainzRecordingsForBand(
      "roselia",
      [
        {
          title: "FIRE BIRD -instrumental-",
          firstReleaseDate: "2026-07-10",
        },
        {
          title: "FIRE BIRD",
          firstReleaseDate: "2026-07-10",
        },
      ],
      sinceDate,
      new Map(),
    );

    expect(result.skippedExcluded).toBe(1);
    expect(result.toInsert).toEqual([
      {
        bandSlug: "roselia",
        title: "FIRE BIRD",
        firstReleaseDate: "2026-07-10",
        rawTitle: "FIRE BIRD",
      },
    ]);
  });

  it("excludes recordings marked as covers by MusicBrainz metadata", () => {
    const result = filterMusicBrainzRecordingsForBand(
      "millsage",
      [
        {
          title: "青のすみか",
          disambiguation: "cover",
          firstReleaseDate: "2026-08-28",
        },
        {
          title: "MATSURI BAYASHI",
          firstReleaseDate: "2026-11-25",
          releaseTitles: ["バンドリ！ ガールズバンドパーティ！ カバーコレクションVol.11"],
        },
        {
          title: "everscape",
          firstReleaseDate: "2026-08-31",
        },
      ],
      sinceDate,
      new Map(),
    );

    expect(result.skippedExcluded).toBe(2);
    expect(result.toInsert).toEqual([
      {
        bandSlug: "millsage",
        title: "everscape",
        firstReleaseDate: "2026-08-31",
        rawTitle: "everscape",
      },
    ]);
    expect(result.decisions.slice(0, 2)).toEqual([
      expect.objectContaining({ action: "skip", reason: "excluded" }),
      expect.objectContaining({ action: "skip", reason: "excluded" }),
    ]);
  });

  it("dedupes multiple versions of the same new song within one batch", () => {
    const result = filterMusicBrainzRecordingsForBand(
      "mygo",
      [
        {
          title: "名無声",
          firstReleaseDate: "2026-07-11",
        },
        {
          title: "名無声 (Anime ver.)",
          firstReleaseDate: "2026-07-11",
        },
      ],
      sinceDate,
      new Map(),
    );

    expect(result.skippedExisting).toBe(1);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toInsert[0]?.title).toBe("名無声");
  });

  it("skips video recordings and incomplete dates", () => {
    const result = filterMusicBrainzRecordingsForBand(
      "ave-mujica",
      [
        {
          title: "Music Video Only",
          firstReleaseDate: "2026-07-10",
          video: true,
        },
        {
          title: "Partial Date Song",
          firstReleaseDate: "2026-07",
        },
        {
          title: "Too Old",
          firstReleaseDate: "2026-07-01",
        },
      ],
      sinceDate,
      new Map(),
    );

    expect(result.toInsert).toEqual([]);
  });
});


it("does not propose database writes for impossible release dates", () => {
  const result = filterMusicBrainzRecordingsForBand(
    "roselia", [{ title: "Invalid date song", firstReleaseDate: "2026-99-99" }],
    "2026-01-01", new Map(),
  );
  expect(result.toInsert).toEqual([]);
  expect(result.toUpdate).toEqual([]);
  expect(result.decisions).toMatchObject([{ action: "skip", reason: "incomplete-date" }]);
});
