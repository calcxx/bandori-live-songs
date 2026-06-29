import { describe, expect, it } from "vitest";
import {
  formatBdrsongsSummary,
  resolveBdrsongsOptions,
} from "@/lib/bdrsongs/summary";
import { aggregateUserSongStats } from "@/lib/stats/aggregate";

const songs = [
  {
    id: 1,
    bandSlug: "poppin-party",
    bandNameJa: "Poppin'Party",
    bandDisplayOrder: 1,
    bandGroupType: "band" as const,
    title: "ティアドロップス",
    firstReleaseDate: "2016-02-24",
    hasBeenPlayedLive: true,
  },
  {
    id: 2,
    bandSlug: "poppin-party",
    bandNameJa: "Poppin'Party",
    bandDisplayOrder: 1,
    bandGroupType: "band" as const,
    title: "STAR BEAT!~ホシノコドウ~",
    firstReleaseDate: "2017-08-30",
    hasBeenPlayedLive: false,
  },
  {
    id: 3,
    bandSlug: "mygo",
    bandNameJa: "MyGO!!!!!",
    bandDisplayOrder: 8,
    bandGroupType: "band" as const,
    title: "迷星叫",
    firstReleaseDate: "2023-04-12",
    hasBeenPlayedLive: true,
  },
  {
    id: 4,
    bandSlug: "afterglow",
    bandNameJa: "Afterglow",
    bandDisplayOrder: 2,
    bandGroupType: "band" as const,
    title: "That Is How I Roll!",
    firstReleaseDate: "2017-06-21",
    hasBeenPlayedLive: true,
  },
];

const matchedEvents = [
  {
    eventId: 10,
    eventernoteEventId: 420629,
    title: "Test Event",
    eventDate: "2026-02-28",
    venue: "Kアリーナ横浜",
    matchedBandSlugs: ["poppin-party"],
    matchedBandNames: ["Poppin'Party"],
    setlistStatus: "complete" as const,
    sourceUrl: "https://www.eventernote.com/events/420629",
    heardSongIds: [1, 3, 4],
  },
];

describe("bdrsongs summary", () => {
  it("formats the default AstrBot text with virtual bands and unplayed songs disabled", () => {
    const stats = aggregateUserSongStats({
      songs,
      matchedEvents,
      hideUnplayed: true,
      hideVirtualBands: true,
      hideSonglessActivities: true,
    });

    expect(
      formatBdrsongsSummary({
        userId: "alice",
        displayName: "AliceP",
        stats,
        includeVirtualBands: false,
        includeUnplayedSongs: false,
      }),
    ).toBe(
      [
        "alice / AliceP",
        "现场已听原创曲：2/2",
        "Poppin'Party：1/1",
        "MyGO!!!!!：1/1",
        "模式：虚拟团 ❌  未演奏曲 ❌",
      ].join("\n"),
    );
  });

  it("uses allSongs and allBands query flags to include hidden catalog items", () => {
    expect(resolveBdrsongsOptions(new URLSearchParams("userId=alice"))).toEqual({
      userId: "alice",
      hideUnplayed: true,
      hideVirtualBands: true,
      includeUnplayedSongs: false,
      includeVirtualBands: false,
    });

    expect(resolveBdrsongsOptions(new URLSearchParams("userId=alice&allSongs=1&allBands=true"))).toEqual({
      userId: "alice",
      hideUnplayed: false,
      hideVirtualBands: false,
      includeUnplayedSongs: true,
      includeVirtualBands: true,
    });
  });
});
