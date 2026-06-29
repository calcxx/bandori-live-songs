/**
 * Shared comparators for sorting songs.
 */

type SongLike = {
  firstReleaseDate: string;
  title: string;
};

type BandSongLike = SongLike & {
  bandDisplayOrder: number;
};

/** Ascending by firstReleaseDate, then ascending by title (ja locale). */
export function compareSongsByReleaseDate(left: SongLike, right: SongLike) {
  const dateCompare = left.firstReleaseDate.localeCompare(right.firstReleaseDate);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return left.title.localeCompare(right.title, "ja");
}

/** Ascending by bandDisplayOrder, then by firstReleaseDate, then by title (ja locale). */
export function compareSongsByBandThenReleaseDate(left: BandSongLike, right: BandSongLike) {
  const bandCompare = left.bandDisplayOrder - right.bandDisplayOrder;
  if (bandCompare !== 0) {
    return bandCompare;
  }

  return compareSongsByReleaseDate(left, right);
}
