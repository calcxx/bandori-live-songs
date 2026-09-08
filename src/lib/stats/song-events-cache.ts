import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/core";
import { createSongLookup } from "@/lib/music/song-lookup";
import { events, setlistEntries, songs } from "@/lib/db/schema";
import type { SongEventReference } from "./aggregate";

type SongEventsBySongId = Record<number, SongEventReference[]>;

const getSongEventsBySongIdCached = unstable_cache(
  async (): Promise<SongEventsBySongId> => {
    const db = getDb();
    const [songRows, setlistRows] = await Promise.all([
      db.select({ id: songs.id, title: songs.title }).from(songs),
      db
        .select({
          rawTitle: setlistEntries.rawTitle,
          songId: setlistEntries.songId,
          eventernoteEventId: events.eventernoteEventId,
          title: events.title,
          eventDate: events.eventDate,
          venue: events.venue,
        })
        .from(setlistEntries)
        .innerJoin(events, eq(setlistEntries.eventId, events.id)),
    ]);

    const songLookup = createSongLookup(songRows);

    const songEventsBySongId: SongEventsBySongId = {};
    const dedupedRefs = new Set<string>();

    for (const row of setlistRows) {
      const songId = row.songId ?? songLookup.matchTitle(row.rawTitle)?.id;
      if (!songId) {
        continue;
      }

      const dedupeKey = `${songId}:${row.eventernoteEventId}`;
      if (dedupedRefs.has(dedupeKey)) {
        continue;
      }
      dedupedRefs.add(dedupeKey);

      const bucket = songEventsBySongId[songId] ?? [];
      bucket.push({
        songId,
        eventernoteEventId: row.eventernoteEventId,
        title: row.title,
        eventDate: row.eventDate,
        venue: row.venue,
        sourceUrl: `https://www.eventernote.com/events/${row.eventernoteEventId}`,
      });
      songEventsBySongId[songId] = bucket;
    }

    for (const refs of Object.values(songEventsBySongId)) {
      refs.sort((left, right) => {
        const dateCompare = right.eventDate.localeCompare(left.eventDate);
        if (dateCompare !== 0) {
          return dateCompare;
        }

        return right.eventernoteEventId - left.eventernoteEventId;
      });
    }

    return songEventsBySongId;
  },
  ["song-events"],
  {
    revalidate: 60 * 5,
    tags: ["song-events"],
  },
);

export async function getSongEventsForSongIds(songIds: number[]) {
  if (songIds.length === 0) {
    return {} as SongEventsBySongId;
  }

  const songEventsBySongId = await getSongEventsBySongIdCached();

  return Object.fromEntries(
    songIds.map((songId) => [songId, songEventsBySongId[songId] ?? []]),
  ) satisfies SongEventsBySongId;
}
