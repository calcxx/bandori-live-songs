import { eq, exists, inArray, isNull, ne, or } from "drizzle-orm";
import { getDb } from "@/lib/db/core";
import { songs, setlistEntries } from "@/lib/db/schema";
import { buildUniqueSongTitleMap } from "@/lib/music/song-lookup";
import { normalizeSongTitle } from "@/lib/music/title-utils";

type LiveStateDatabase = Pick<ReturnType<typeof getDb>, "select" | "selectDistinct" | "update">;

export async function refreshSongLiveState(db: LiveStateDatabase = getDb()) {
  const distinctSetlistRows = await db
    .selectDistinct({ rawTitle: setlistEntries.rawTitle })
    .from(setlistEntries)
    .where(isNull(setlistEntries.songId));
  const fallbackSongIds: number[] = [];

  // Current imports link song IDs. Only load and normalize the catalog for legacy entries.
  if (distinctSetlistRows.length > 0) {
    const songRows = await db.select({ id: songs.id, title: songs.title }).from(songs);
    const playedSongTitleSet = new Set(distinctSetlistRows.map((row) => row.rawTitle));
    const playedSongNormalizedTitleSet = new Set(distinctSetlistRows.map((row) => normalizeSongTitle(row.rawTitle)));
    const normalizedSongOwners = buildUniqueSongTitleMap(
      songRows,
      (song) => normalizeSongTitle(song.title),
    );

    for (const song of songRows) {
      const normalizedTitle = normalizeSongTitle(song.title);
      const matchedByExactTitle = playedSongTitleSet.has(song.title);
      const matchedByNormalizedTitle =
        normalizedSongOwners.get(normalizedTitle)?.id === song.id && playedSongNormalizedTitleSet.has(normalizedTitle);

      if (matchedByExactTitle || matchedByNormalizedTitle) {
        fallbackSongIds.push(song.id);
      }
    }
  }

  const linked = exists(
    db.select({ songId: setlistEntries.songId })
      .from(setlistEntries)
      .where(eq(setlistEntries.songId, songs.id)),
  );
  const played = fallbackSongIds.length > 0
    ? or(linked, inArray(songs.id, fallbackSongIds))!
    : linked;

  // Apply one atomic transition, leaving unchanged rows and timestamps untouched.
  await db.update(songs)
    .set({ hasBeenPlayedLive: played, updatedAt: new Date() })
    .where(ne(songs.hasBeenPlayedLive, played));
}
