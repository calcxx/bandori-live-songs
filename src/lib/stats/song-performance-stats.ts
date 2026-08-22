import "server-only";

import {
  asc,
  countDistinct,
  desc,
  eq,
} from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/core";
import {
  bandoriEventIndex,
  events,
  setlistEntries,
  songs,
} from "@/lib/db/schema";
import type { SongCategory } from "@/lib/music/song-category";

export type SongPerformanceStat = {
  id: number;
  title: string;
  bandSlug: string | null;
  category: SongCategory;
  firstReleaseDate: string | null;
  performanceCount: number;
};

export type SongStatsEventCounts = {
  all: number;
  byBandSlug: Record<string, number>;
};

const getSongPerformanceStatsCached = unstable_cache(
  async (): Promise<SongPerformanceStat[]> => {
    const rows = await getDb()
      .select({
        id: songs.id,
        title: songs.title,
        bandSlug: songs.bandSlug,
        category: songs.category,
        firstReleaseDate: songs.firstReleaseDate,
        performanceCount: countDistinct(setlistEntries.eventId),
      })
      .from(songs)
      .leftJoin(setlistEntries, eq(setlistEntries.songId, songs.id))
      .groupBy(
        songs.id,
        songs.title,
        songs.bandSlug,
        songs.category,
        songs.firstReleaseDate,
      )
      .orderBy(
        desc(countDistinct(setlistEntries.eventId)),
        asc(songs.firstReleaseDate),
        asc(songs.title),
      );

    return rows.map((row) => ({
      ...row,
      performanceCount: Number(row.performanceCount),
    }));
  },
  ["song-performance-stats-v2"],
  {
    revalidate: 60 * 5,
    tags: ["song-catalog", "song-events"],
  },
);

export function getSongPerformanceStats() {
  return getSongPerformanceStatsCached();
}

const getSongStatsEventCountsCached = unstable_cache(
  async (): Promise<SongStatsEventCounts> => {
    const rows = await getDb()
      .selectDistinct({
        eventId: events.id,
        bandSlugs: bandoriEventIndex.bandSlugs,
      })
      .from(events)
      .innerJoin(
        setlistEntries,
        eq(setlistEntries.eventId, events.id),
      )
      .leftJoin(
        bandoriEventIndex,
        eq(
          bandoriEventIndex.eventernoteEventId,
          events.eventernoteEventId,
        ),
      );

    const byBandSlug: Record<string, number> = {};
    for (const row of rows) {
      for (const bandSlug of new Set(row.bandSlugs ?? [])) {
        byBandSlug[bandSlug] = (byBandSlug[bandSlug] ?? 0) + 1;
      }
    }

    return {
      all: rows.length,
      byBandSlug,
    };
  },
  ["song-stats-event-counts-v1"],
  {
    revalidate: 60 * 5,
    tags: ["song-events", "open-api-v1"],
  },
);

export function getSongStatsEventCounts() {
  return getSongStatsEventCountsCached();
}
