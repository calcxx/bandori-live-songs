/**
 * Shared comparators for sorting songs.
 */

type SongLike = {
  firstReleaseDate: string | null;
  title: string;
};

/** Ascending by firstReleaseDate, then ascending by title (ja locale). */
export function compareSongsByReleaseDate(left: SongLike, right: SongLike) {
  const dateCompare = (left.firstReleaseDate ?? "9999-12-31").localeCompare(
    right.firstReleaseDate ?? "9999-12-31",
  );
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return left.title.localeCompare(right.title, "ja");
}
