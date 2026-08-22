import type { SongCategory } from "./song-category";
import { rankSongTitleCandidates } from "./song-match-suggestions";
import { normalizeSongTitle } from "./title-utils";

export type ResolvableSong = {
  id: number;
  title: string;
  category: SongCategory;
  bandNameJa: string | null;
};

export type SongResolutionCandidate = {
  songId: number;
  title: string;
  category: SongCategory;
  bandLabel: string | null;
  score: number;
};

export type SongResolution =
  | { status: "resolved"; songId: number; title: string }
  | { status: "selection-required"; candidates: SongResolutionCandidate[] };

export function createSongResolver(songRows: ResolvableSong[]) {
  const songByTitle = new Map(songRows.map((song) => [song.title, song]));
  const songsByNormalizedTitle = new Map<string, ResolvableSong[]>();

  for (const song of songRows) {
    const normalized = normalizeSongTitle(song.title);
    const bucket = songsByNormalizedTitle.get(normalized) ?? [];
    bucket.push(song);
    songsByNormalizedTitle.set(normalized, bucket);
  }

  return (rawTitle: string, selectedSongId?: number): SongResolution => {
    const exact = songByTitle.get(rawTitle);
    if (exact) {
      return { status: "resolved", songId: exact.id, title: exact.title };
    }

    const normalizedMatches =
      songsByNormalizedTitle.get(normalizeSongTitle(rawTitle)) ?? [];
    if (normalizedMatches.length === 1) {
      return {
        status: "resolved",
        songId: normalizedMatches[0].id,
        title: normalizedMatches[0].title,
      };
    }

    const ranked =
      normalizedMatches.length > 1
        ? normalizedMatches.map((song) => ({ title: song.title, score: 1 }))
        : rankSongTitleCandidates(
            rawTitle,
            songRows.map((song) => song.title),
          );
    const candidates = ranked.flatMap(({ title, score }) => {
      const song = songByTitle.get(title);
      return song
        ? [
            {
              songId: song.id,
              title: song.title,
              category: song.category,
              bandLabel: song.bandNameJa,
              score: Number(score.toFixed(3)),
            },
          ]
        : [];
    });
    const selected = candidates.find(
      (candidate) => candidate.songId === selectedSongId,
    );

    return selected
      ? { status: "resolved", songId: selected.songId, title: selected.title }
      : { status: "selection-required", candidates };
  };
}
