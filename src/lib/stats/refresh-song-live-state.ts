import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/core";
import { songs, setlistEntries } from "@/lib/db/schema";
import { normalizeSongTitle } from "@/lib/music/title-utils";

export async function refreshSongLiveState(db = getDb()) {
  const [songRows, distinctSetlistRows] = await Promise.all([
    db.select({ id: songs.id, title: songs.title }).from(songs),
    db.selectDistinct({ rawTitle: setlistEntries.rawTitle }).from(setlistEntries),
  ]);

  const playedSongTitleSet = new Set(distinctSetlistRows.map((row) => row.rawTitle));
  const playedSongNormalizedTitleSet = new Set(distinctSetlistRows.map((row) => normalizeSongTitle(row.rawTitle)));
  const normalizedSongOwners = new Map<string, number | null>();

  for (const song of songRows) {
    const normalizedTitle = normalizeSongTitle(song.title);
    const existing = normalizedSongOwners.get(normalizedTitle);

    if (existing === undefined) {
      normalizedSongOwners.set(normalizedTitle, song.id);
      continue;
    }

    if (existing !== song.id) {
      normalizedSongOwners.set(normalizedTitle, null);
    }
  }

  const nextPlayedSongIds = new Set<number>();

  for (const song of songRows) {
    const normalizedTitle = normalizeSongTitle(song.title);
    const matchedByExactTitle = playedSongTitleSet.has(song.title);
    const matchedByNormalizedTitle =
      normalizedSongOwners.get(normalizedTitle) === song.id && playedSongNormalizedTitleSet.has(normalizedTitle);

    if (matchedByExactTitle || matchedByNormalizedTitle) {
      nextPlayedSongIds.add(song.id);
    }
  }

  await db.update(songs).set({
    hasBeenPlayedLive: false,
    updatedAt: new Date(),
  });

  if (nextPlayedSongIds.size > 0) {
    await db
      .update(songs)
      .set({ hasBeenPlayedLive: true, updatedAt: new Date() })
      .where(inArray(songs.id, [...nextPlayedSongIds]));
  }
}
