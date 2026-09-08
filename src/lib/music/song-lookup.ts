import { normalizeSongTitle } from "./title-utils";

type SongIdentity = { id: number; title: string };

/** A collision remains unresolved even if the same song appears again later. */
export function buildUniqueSongTitleMap<T extends SongIdentity>(
  songs: readonly T[],
  getTitle: (song: T) => string,
) {
  const lookup = new Map<string, T | null>();
  for (const song of songs) {
    const title = getTitle(song);
    const existing = lookup.get(title);
    if (existing === undefined) {
      lookup.set(title, song);
    } else if (existing?.id !== song.id) {
      lookup.set(title, null);
    }
  }
  return lookup;
}

/** Catalog titles are unique in the database; normalized titles need not be. */
export function createSongLookup<T extends SongIdentity>(songs: readonly T[]) {
  const byId = new Map(songs.map((song) => [song.id, song]));
  const byTitle = new Map(songs.map((song) => [song.title, song]));
  const byNormalizedTitle = buildUniqueSongTitleMap(
    songs,
    (song) => normalizeSongTitle(song.title),
  );

  return {
    byId,
    byTitle,
    byNormalizedTitle,
    matchTitle(title: string): T | null {
      return byTitle.get(title) ?? byNormalizedTitle.get(normalizeSongTitle(title)) ?? null;
    },
  };
}
