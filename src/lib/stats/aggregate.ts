import { DEFAULT_VISIBLE_BAND_SLUGS } from "@/lib/constants/bands";
import {
  emptyEventVisibilityRules,
  filterEventsByVisibilityRules,
  type EventVisibilityRules,
} from "@/lib/events/event-visibility";
import { getCurrentReleaseDate, isReleasedByDate } from "@/lib/music/release-date";
import { compareSongsByBandThenReleaseDate, compareSongsByReleaseDate } from "@/lib/music/sort";

export type SongPoolItem = {
  id: number;
  bandSlug: string;
  bandNameJa: string;
  bandDisplayOrder: number;
  bandGroupType: "band" | "project-common";
  title: string;
  firstReleaseDate: string;
  hasBeenPlayedLive: boolean;
};

export type MatchedEventEntry = {
  eventId: number | null;
  eventernoteEventId: number;
  title: string;
  eventDate: string;
  venue: string | null;
  matchedBandSlugs: string[];
  matchedBandNames: string[];
  setlistStatus: "missing" | "partial" | "complete" | null;
  sourceUrl: string;
  heardSongIds: number[];
};

export type SongEventReference = {
  songId: number;
  eventernoteEventId: number;
  title: string;
  eventDate: string;
  venue: string | null;
  sourceUrl: string;
};

export type AggregatedSong = SongPoolItem & {
  heard: boolean;
};

export type AggregatedBandSummary = {
  slug: string;
  nameJa: string;
  displayOrder: number;
  groupType: "band" | "project-common";
  heardCount: number;
  totalCount: number;
  percentage: number;
  songs: AggregatedSong[];
};

export type AggregatedStats = {
  totalSummary: {
    heardCount: number;
    totalCount: number;
    percentage: number;
  };
  bandSummaries: AggregatedBandSummary[];
  matchedEvents: MatchedEventEntry[];
  collectedSetlistEvents: MatchedEventEntry[];
  missingSetlistEvents: MatchedEventEntry[];
  newlyHeardSongsByEventId: Record<number, SongPoolItem[]>;
};

export function aggregateUserSongStats({
  songs,
  matchedEvents,
  hideUnplayed,
  hideVirtualBands,
  hideSonglessActivities,
  eventVisibilityRules = emptyEventVisibilityRules,
  releasedThroughDate = getCurrentReleaseDate(),
}: {
  songs: SongPoolItem[];
  matchedEvents: MatchedEventEntry[];
  hideUnplayed: boolean;
  hideVirtualBands: boolean;
  hideSonglessActivities: boolean;
  eventVisibilityRules?: EventVisibilityRules;
  releasedThroughDate?: string;
}) {
  const visibleMatchedEvents = filterEventsByVisibilityRules(matchedEvents, hideSonglessActivities, eventVisibilityRules);
  const heardSongIds = new Set<number>();
  for (const event of visibleMatchedEvents) {
    for (let i = 0; i < event.heardSongIds.length; i++) {
      const songId = event.heardSongIds[i];
      if (songId) heardSongIds.add(songId);
    }
  }

  const visibleSongs = songs.filter(
    (song) =>
      song.bandGroupType === "band" &&
      isReleasedByDate(song.firstReleaseDate, releasedThroughDate) &&
      (!hideVirtualBands || DEFAULT_VISIBLE_BAND_SLUGS.has(song.bandSlug)) &&
      (hideUnplayed ? song.hasBeenPlayedLive : true),
  );
  const bandGroups = new Map<string, AggregatedBandSummary>();
  let totalHeardCount = 0;

  for (const song of visibleSongs) {
    const existing = bandGroups.get(song.bandSlug);
    const heard = heardSongIds.has(song.id);

    if (heard) totalHeardCount += 1;

    if (!existing) {
      bandGroups.set(song.bandSlug, {
        slug: song.bandSlug,
        nameJa: song.bandNameJa,
        displayOrder: song.bandDisplayOrder,
        groupType: song.bandGroupType,
        heardCount: heard ? 1 : 0,
        totalCount: 1,
        percentage: 0,
        songs: [{ ...song, heard }],
      });
      continue;
    }

    existing.totalCount += 1;
    if (heard) {
      existing.heardCount += 1;
    }
    existing.songs.push({ ...song, heard });
  }

  const bandSummaries = [...bandGroups.values()]
    .map((summary) => ({
      ...summary,
      percentage: summary.totalCount === 0 ? 0 : summary.heardCount / summary.totalCount,
      songs: summary.songs.sort(compareSongsByReleaseDate),
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder);

  const totalCount = visibleSongs.length;
  const collectedSetlistEvents: MatchedEventEntry[] = [];
  const missingSetlistEvents: MatchedEventEntry[] = [];
  const unlockVisibleSongs = songs.filter(
    (song) =>
      song.bandGroupType === "band" &&
      isReleasedByDate(song.firstReleaseDate, releasedThroughDate) &&
      (hideUnplayed ? song.hasBeenPlayedLive : true),
  );
  const unlockVisibleSongById = new Map(unlockVisibleSongs.map((song) => [song.id, song]));
  const newlyHeardSongsByEventId: Record<number, SongPoolItem[]> = {};
  const seenSongIds = new Set<number>();

  const chronologicalMatchedEvents = [...visibleMatchedEvents].sort((left, right) => {
    const dateCompare = left.eventDate.localeCompare(right.eventDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.eventernoteEventId - right.eventernoteEventId;
  });

  for (let i = 0; i < chronologicalMatchedEvents.length; i += 1) {
    const event = chronologicalMatchedEvents[i];
    const eventSongIds = [...new Set(event.heardSongIds)];
    const newlyHeardSongs: SongPoolItem[] = [];

    for (let index = 0; index < eventSongIds.length; index += 1) {
      const songId = eventSongIds[index];
      const song = unlockVisibleSongById.get(songId);

      if (!song || seenSongIds.has(songId)) {
        continue;
      }

      seenSongIds.add(songId);
      newlyHeardSongs.push(song);
    }

    if (newlyHeardSongs.length > 0) {
      newlyHeardSongsByEventId[event.eventernoteEventId] = newlyHeardSongs.sort(compareSongsByBandThenReleaseDate);
    }
  }

  for (let i = 0; i < visibleMatchedEvents.length; i++) {
    const event = visibleMatchedEvents[i];
    if (event.setlistStatus === "complete" || event.setlistStatus === "partial") {
      collectedSetlistEvents.push(event);
    } else {
      missingSetlistEvents.push(event);
    }
  }

  return {
    totalSummary: {
      heardCount: totalHeardCount,
      totalCount,
      percentage: totalCount === 0 ? 0 : totalHeardCount / totalCount,
    },
    bandSummaries,
    matchedEvents: visibleMatchedEvents,
    collectedSetlistEvents,
    missingSetlistEvents,
    newlyHeardSongsByEventId,
  } satisfies AggregatedStats;
}
