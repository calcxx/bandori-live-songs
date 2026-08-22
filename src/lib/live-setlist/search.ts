import "server-only";

import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { getDb } from "@/lib/db/core";
import {
  bandoriEventIndex,
  bands,
  events,
  setlistEntries,
} from "@/lib/db/schema";
import { normalizeSongTitle } from "@/lib/music/title-utils";
import { getSongCatalog } from "@/lib/stats/catalog-cache";
import {
  rankLiveSetlistCandidates,
  type SearchableLiveSetlistCandidate,
} from "./match";
import { detectLiveSetlistSeries } from "./series";
import type {
  LiveSetlist,
  LiveSetlistCandidate,
  RecentLiveSetlist,
} from "./types";

function performanceKey(songId: number | null, rawTitle: string) {
  return songId
    ? `song:${songId}`
    : `title:${normalizeSongTitle(rawTitle)}`;
}

function titlePerformanceKey(rawTitle: string) {
  return `title:${normalizeSongTitle(rawTitle)}`;
}

function getCurrentEventDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const getSearchableLiveSetlistsCached = unstable_cache(
  async () => {
    const db = getDb();
    const [candidates, searchableBands] = await Promise.all([
      db
        .selectDistinct({
          eventernoteEventId: events.eventernoteEventId,
          title: events.title,
          eventDate: events.eventDate,
          venue: events.venue,
          performingBandSlugs: bandoriEventIndex.bandSlugs,
        })
        .from(events)
        .innerJoin(setlistEntries, eq(setlistEntries.eventId, events.id))
        .leftJoin(
          bandoriEventIndex,
          eq(
            bandoriEventIndex.eventernoteEventId,
            events.eventernoteEventId,
          ),
        ),
      db
        .select({
          slug: bands.slug,
          nameJa: bands.nameJa,
          nameEn: bands.nameEn,
          searchAliases: bands.searchAliases,
        })
        .from(bands)
        .where(eq(bands.groupType, "band")),
    ]);

    return {
      candidates: candidates.map((candidate) => ({
        ...candidate,
        performingBandSlugs: candidate.performingBandSlugs ?? [],
      })) satisfies SearchableLiveSetlistCandidate[],
      bands: searchableBands,
    };
  },
  ["live-setlist-search"],
  {
    revalidate: 60 * 5,
    tags: ["song-events", "live-setlist-search"],
  },
);

const getFirstPerformanceEventIdsCached = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const db = getDb();
    const rows = await db
      .select({
        eventernoteEventId: events.eventernoteEventId,
        rawTitle: setlistEntries.rawTitle,
        songId: setlistEntries.songId,
      })
      .from(setlistEntries)
      .innerJoin(events, eq(setlistEntries.eventId, events.id))
      .orderBy(
        asc(events.eventDate),
        asc(events.eventernoteEventId),
        asc(setlistEntries.orderIndex),
      );

    const firstEventIdByTitle: Record<string, number> = {};
    for (const row of rows) {
      const keys = [
        performanceKey(row.songId, row.rawTitle),
        titlePerformanceKey(row.rawTitle),
      ];
      for (const key of keys) {
        if (!(key in firstEventIdByTitle)) {
          firstEventIdByTitle[key] = row.eventernoteEventId;
        }
      }
    }

    return firstEventIdByTitle;
  },
  ["live-setlist-first-performances"],
  {
    revalidate: 60 * 5,
    tags: ["song-events"],
  },
);

const getRecentLiveSetlistsCached = unstable_cache(
  async (limit: number): Promise<RecentLiveSetlist[]> => {
    const db = getDb();
    const rows = await db
      .selectDistinct({
        eventernoteEventId: events.eventernoteEventId,
        title: events.title,
        eventDate: events.eventDate,
        venue: events.venue,
        bandSlugs: bandoriEventIndex.bandSlugs,
        bandNames: bandoriEventIndex.bandNames,
      })
      .from(events)
      .innerJoin(setlistEntries, eq(setlistEntries.eventId, events.id))
      .leftJoin(
        bandoriEventIndex,
        eq(
          bandoriEventIndex.eventernoteEventId,
          events.eventernoteEventId,
        ),
      )
      .orderBy(
        desc(events.eventDate),
        desc(events.eventernoteEventId),
      )
      .limit(limit);

    const bandNameBySlug = new Map(
      BAND_SEEDS.map((band) => [band.slug, band.nameJa]),
    );
    return rows.map((row) => ({
      eventernoteEventId: row.eventernoteEventId,
      title: row.title,
      eventDate: row.eventDate,
      venue: row.venue,
      performingBands: (row.bandSlugs ?? []).map((slug, index) => ({
        slug,
        name: row.bandNames?.[index] ?? bandNameBySlug.get(slug) ?? slug,
      })),
    }));
  },
  ["recent-live-setlists-v2"],
  {
    revalidate: 60 * 5,
    tags: ["song-events"],
  },
);

export async function getRecentLiveSetlists(limit = 10) {
  return getRecentLiveSetlistsCached(limit);
}

const getOnThisDayLiveSetlistsCached = unstable_cache(
  async (currentDate: string): Promise<RecentLiveSetlist[]> => {
    const db = getDb();
    const monthDay = currentDate.slice(5);
    const rows = await db
      .selectDistinct({
        eventernoteEventId: events.eventernoteEventId,
        title: events.title,
        eventDate: events.eventDate,
        venue: events.venue,
        bandSlugs: bandoriEventIndex.bandSlugs,
        bandNames: bandoriEventIndex.bandNames,
      })
      .from(events)
      .innerJoin(setlistEntries, eq(setlistEntries.eventId, events.id))
      .leftJoin(
        bandoriEventIndex,
        eq(
          bandoriEventIndex.eventernoteEventId,
          events.eventernoteEventId,
        ),
      )
      .where(
        and(
          lt(events.eventDate, currentDate),
          sql`to_char(${events.eventDate}, 'MM-DD') = ${monthDay}`,
        ),
      )
      .orderBy(desc(events.eventDate), desc(events.eventernoteEventId));

    const bandNameBySlug = new Map(
      BAND_SEEDS.map((band) => [band.slug, band.nameJa]),
    );
    return rows.map((row) => ({
      eventernoteEventId: row.eventernoteEventId,
      title: row.title,
      eventDate: row.eventDate,
      venue: row.venue,
      performingBands: (row.bandSlugs ?? []).map((slug, index) => ({
        slug,
        name: row.bandNames?.[index] ?? bandNameBySlug.get(slug) ?? slug,
      })),
    }));
  },
  ["on-this-day-live-setlists"],
  {
    revalidate: 60 * 5,
    tags: ["song-events", "live-setlist-search"],
  },
);

export async function getOnThisDayLiveSetlists() {
  return getOnThisDayLiveSetlistsCached(getCurrentEventDate());
}

export async function searchLiveSetlistCandidates(
  rawQuery: string,
  limit = 8,
): Promise<LiveSetlistCandidate[]> {
  const { candidates, bands } = await getSearchableLiveSetlistsCached();

  return rankLiveSetlistCandidates(candidates, rawQuery, limit, bands).map(
    (candidate) => ({
      eventernoteEventId: candidate.eventernoteEventId,
      title: candidate.title,
      eventDate: candidate.eventDate,
      venue: candidate.venue,
    }),
  );
}

export async function getLiveSetlist(
  eventernoteEventId: number,
): Promise<LiveSetlist | null> {
  const db = getDb();
  const [
    rows,
    catalog,
    firstPerformanceEventIds,
    indexedEvents,
    searchableLiveSetlists,
  ] = await Promise.all([
    db
      .select({
        eventernoteEventId: events.eventernoteEventId,
        title: events.title,
        eventDate: events.eventDate,
        venue: events.venue,
        position: setlistEntries.orderIndex,
        entryTitle: setlistEntries.rawTitle,
        songId: setlistEntries.songId,
      })
      .from(events)
      .innerJoin(setlistEntries, eq(setlistEntries.eventId, events.id))
      .where(eq(events.eventernoteEventId, eventernoteEventId))
      .orderBy(asc(setlistEntries.orderIndex)),
    getSongCatalog(),
    getFirstPerformanceEventIdsCached(),
    db
      .select({
        bandSlugs: bandoriEventIndex.bandSlugs,
        bandNames: bandoriEventIndex.bandNames,
      })
      .from(bandoriEventIndex)
      .where(eq(bandoriEventIndex.eventernoteEventId, eventernoteEventId))
      .limit(1),
    getSearchableLiveSetlistsCached(),
  ]);

  const first = rows[0];
  if (!first) {
    return null;
  }

  const songById = new Map(
    catalog.songsWithLiveState.map((song) => [song.id, song]),
  );
  const songByTitle = new Map(
    catalog.songsWithLiveState.map((song) => [song.title, song]),
  );
  const songByNormalizedTitle = new Map<
    string,
    (typeof catalog.songsWithLiveState)[number] | null
  >();

  for (const song of catalog.songsWithLiveState) {
    const normalizedTitle = normalizeSongTitle(song.title);
    const existing = songByNormalizedTitle.get(normalizedTitle);
    if (existing === undefined) {
      songByNormalizedTitle.set(normalizedTitle, song);
    } else if (existing?.id !== song.id) {
      songByNormalizedTitle.set(normalizedTitle, null);
    }
  }

  const bandNameBySlug = new Map(
    BAND_SEEDS.map((band) => [band.slug, band.nameJa]),
  );
  const indexedEvent = indexedEvents[0];
  const performingBands = (indexedEvent?.bandSlugs ?? []).map(
    (slug, index) => ({
      slug,
      name:
        indexedEvent?.bandNames[index] ??
        bandNameBySlug.get(slug) ??
        slug,
    }),
  );

  return {
    eventernoteEventId: first.eventernoteEventId,
    title: first.title,
    eventDate: first.eventDate,
    venue: first.venue,
    performingBands,
    series: detectLiveSetlistSeries(
      {
        eventernoteEventId: first.eventernoteEventId,
        title: first.title,
        eventDate: first.eventDate,
        venue: first.venue,
      },
      searchableLiveSetlists.candidates,
    ),
    entries: rows.map((row) => {
      const normalizedTitle = normalizeSongTitle(row.entryTitle);
      const song =
        (row.songId ? songById.get(row.songId) : null) ??
        songByTitle.get(row.entryTitle) ??
        songByNormalizedTitle.get(normalizedTitle) ??
        null;
      const key = performanceKey(song?.id ?? null, row.entryTitle);
      const firstPerformanceEventId =
        firstPerformanceEventIds[key] ??
        firstPerformanceEventIds[titlePerformanceKey(row.entryTitle)];

      return {
        position: row.position,
        title: row.entryTitle,
        songId: song?.id ?? null,
        category: song?.category ?? null,
        bandSlug:
          song?.category === "original" ? song.bandSlug : null,
        firstReleaseDate: song?.firstReleaseDate ?? null,
        isFirstPerformance:
          firstPerformanceEventId === first.eventernoteEventId,
      };
    }),
  };
}
