import "server-only";

import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { getDb } from "@/lib/db/core";
import {
  bandoriEventIndex,
  bands,
  events,
  setlistEntries,
  songs,
} from "@/lib/db/schema";
import { createSongLookup } from "@/lib/music/song-lookup";
import type {
  PublicApiBand,
  PublicApiEventDetail,
  PublicApiEventSummary,
  PublicApiSong,
} from "./schemas";

export const publicApiCacheTag = "open-api-v1";

export type PublicApiSnapshot = {
  bands: PublicApiBand[];
  songs: PublicApiSong[];
  events: PublicApiEventDetail[];
  eventsBySongId: Record<string, PublicApiEventSummary[]>;
};

type CompactSetlistEntry = {
  position: number;
  title: string;
  songId: number | null;
};

type CompactEvent = PublicApiEventSummary & {
  setlist: CompactSetlistEntry[];
};

function toEventSummary(
  event: PublicApiEventDetail,
): PublicApiEventSummary {
  return {
    eventernoteEventId: event.eventernoteEventId,
    title: event.title,
    eventDate: event.eventDate,
    venue: event.venue,
    performingBandSlugs: event.performingBandSlugs,
    setlistStatus: event.setlistStatus,
    sourceUrl: event.sourceUrl,
  };
}

export const getPublicApiCatalog = unstable_cache(
  async () => {
    const db = getDb();
    const [bandRows, songRows] = await Promise.all([
      db
        .select({
          slug: bands.slug,
          nameJa: bands.nameJa,
          nameEn: bands.nameEn,
          displayOrder: bands.displayOrder,
          groupType: bands.groupType,
          eventernoteActorId: bands.eventernoteActorId,
        })
        .from(bands)
        .orderBy(asc(bands.displayOrder)),
      db
        .select({
          id: songs.id,
          title: songs.title,
          category: songs.category,
          bandSlug: songs.bandSlug,
          firstReleaseDate: songs.firstReleaseDate,
          hasBeenPlayedLive: songs.hasBeenPlayedLive,
        })
        .from(songs)
        .orderBy(asc(songs.id)),
    ]);
    const seedBySlug = new Map(
      BAND_SEEDS.map((band) => [band.slug, band]),
    );
    const publicBands: PublicApiBand[] = bandRows.map((band) => {
      const seed = seedBySlug.get(band.slug);
      return {
        ...band,
        supportColor: seed?.supportColor ?? null,
        musicbrainzArtistMbid:
          seed?.musicbrainzArtistMbid ?? null,
      };
    });
    const publicSongs: PublicApiSong[] = songRows;
    return { bands: publicBands, songs: publicSongs };
  },
  ["open-api-v1-catalog"],
  {
    revalidate: 60 * 5,
    tags: [publicApiCacheTag],
  },
);

const getPublicApiCompactEvents = unstable_cache(
  async (): Promise<CompactEvent[]> => {
    const db = getDb();
    const rows = await db
      .select({
        eventernoteEventId: events.eventernoteEventId,
        eventTitle: events.title,
        eventDate: events.eventDate,
        venue: events.venue,
        setlistStatus: events.setlistStatus,
        performingBandSlugs: bandoriEventIndex.bandSlugs,
        position: setlistEntries.orderIndex,
        entryTitle: setlistEntries.rawTitle,
        songId: setlistEntries.songId,
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
      )
      .orderBy(
        asc(events.eventDate),
        asc(events.eventernoteEventId),
        asc(setlistEntries.orderIndex),
      );
    const eventById = new Map<number, CompactEvent>();
    for (const row of rows) {
      let event = eventById.get(row.eventernoteEventId);
      if (!event) {
        event = {
          eventernoteEventId: row.eventernoteEventId,
          title: row.eventTitle,
          eventDate: row.eventDate,
          venue: row.venue,
          performingBandSlugs: [
            ...new Set(row.performingBandSlugs ?? []),
          ],
          setlistStatus: row.setlistStatus,
          sourceUrl: `https://www.eventernote.com/events/${row.eventernoteEventId}`,
          setlist: [],
        };
        eventById.set(row.eventernoteEventId, event);
      }
      event.setlist.push({
        position: row.position,
        title: row.entryTitle,
        songId: row.songId,
      });
    }
    return [...eventById.values()];
  },
  ["open-api-v1-events"],
  {
    revalidate: 60 * 5,
    tags: [publicApiCacheTag],
  },
);

/**
 * Compose two independently cached payloads. Keeping the compact event
 * payload separate avoids Next.js's 2 MB limit for a single cache value.
 */
export async function getPublicApiSnapshot(): Promise<PublicApiSnapshot> {
  const [{ bands: publicBands, songs: publicSongs }, compactEvents] =
    await Promise.all([
      getPublicApiCatalog(),
      getPublicApiCompactEvents(),
    ]);
  const songLookup = createSongLookup(publicSongs);
  // The public API does not use empty normalized titles as fallback matches.
  songLookup.byNormalizedTitle.delete("");

  const publicEvents: PublicApiEventDetail[] = compactEvents.map(
    (event) => ({
      ...toEventSummary({
        ...event,
        setlist: [],
      }),
      setlist: event.setlist.map((entry) => ({
        position: entry.position,
        title: entry.title,
        song:
          (entry.songId === null
            ? null
            : songLookup.byId.get(entry.songId)) ??
          songLookup.matchTitle(entry.title),
      })),
    }),
  );
  const eventsBySongId: Record<
    string,
    PublicApiEventSummary[]
  > = {};
  const seenSongEvents = new Set<string>();
  for (const event of publicEvents) {
    const summary = toEventSummary(event);
    for (const entry of event.setlist) {
      if (!entry.song) continue;
      const dedupeKey = `${entry.song.id}:${event.eventernoteEventId}`;
      if (seenSongEvents.has(dedupeKey)) continue;
      seenSongEvents.add(dedupeKey);
      const key = String(entry.song.id);
      const bucket = eventsBySongId[key] ?? [];
      bucket.push(summary);
      eventsBySongId[key] = bucket;
    }
  }
  for (const eventList of Object.values(eventsBySongId)) {
    eventList.sort(
      (left, right) =>
        right.eventDate.localeCompare(left.eventDate) ||
        right.eventernoteEventId - left.eventernoteEventId,
    );
  }

  return {
    bands: publicBands,
    songs: publicSongs,
    events: publicEvents,
    eventsBySongId,
  };
}
