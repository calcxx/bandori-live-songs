import { isExcludedTrackTitle, normalizeSongTitle } from "@/lib/music/title-utils";

export type MusicBrainzRecordingSearchResult = {
  title: string;
  "first-release-date"?: string;
  video?: boolean | null;
  score?: number;
};

export function normalizeMusicBrainzDate(date: string | undefined) {
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (/^\d{4}-\d{2}$/.test(date)) return `${date}-01`;
  if (/^\d{4}$/.test(date)) return `${date}-01-01`;
  return null;
}

export function musicBrainzCorrectionKey(bandSlug: string, title: string) {
  return `${bandSlug}::${normalizeSongTitle(title)}`;
}

export function parseMusicBrainzCorrectionKey(key: string) {
  const separatorIndex = key.indexOf("::");
  if (separatorIndex < 0) return null;

  return {
    bandSlug: key.slice(0, separatorIndex),
    title: key.slice(separatorIndex + 2),
  };
}

export function chooseEarliestMusicBrainzRecording(
  targetTitle: string,
  recordings: MusicBrainzRecordingSearchResult[],
) {
  const target = normalizeSongTitle(targetTitle);
  const candidates = recordings
    .filter((recording) => !recording.video && !isExcludedTrackTitle(recording.title))
    .map((recording) => ({
      recording,
      date: normalizeMusicBrainzDate(recording["first-release-date"]),
      exactTitle: normalizeSongTitle(recording.title) === target,
    }))
    .filter((candidate): candidate is typeof candidate & { date: string } => candidate.date !== null);

  const exactTitleCandidates = candidates.filter((candidate) => candidate.exactTitle);
  const pool = exactTitleCandidates.length > 0 ? exactTitleCandidates : candidates;
  pool.sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder !== 0) return dateOrder;
    return (right.recording.score ?? 0) - (left.recording.score ?? 0);
  });

  const best = pool[0];
  if (!best) return null;

  return {
    firstReleaseDate: best.date,
    mbTitle: best.recording.title,
  };
}
