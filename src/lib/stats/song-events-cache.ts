import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/core";
import { normalizeSongTitle } from "@/lib/music/title-utils";
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
          eventernoteEventId: events.eventernoteEventId,
          title: events.title,
          eventDate: events.eventDate,
          venue: events.venue,
        })
        .from(setlistEntries)
        .innerJoin(events, eq(setlistEntries.eventId, events.id)),
    ]);

    const songIdByTitle = new Map(songRows.map((song) => [song.title, song.id]));
    const songIdByNormalizedTitle = new Map<string, number | null>();

    for (const song of songRows) {
      const normalizedTitle = normalizeSongTitle(song.title);
      const existing = songIdByNormalizedTitle.get(normalizedTitle);

      if (existing === undefined) {
        songIdByNormalizedTitle.set(normalizedTitle, song.id);
        continue;
      }

      if (existing !== song.id) {
        songIdByNormalizedTitle.set(normalizedTitle, null);
      }
    }

    const songEventsBySongId: SongEventsBySongId = {};
    const dedupedRefs = new Set<string>();

    for (const row of setlistRows) {
      let songId = songIdByTitle.get(row.rawTitle);

      if (!songId) {
        const fallbackSongId = songIdByNormalizedTitle.get(normalizeSongTitle(row.rawTitle));
        if (fallbackSongId) {
          songId = fallbackSongId;
        }
      }

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
