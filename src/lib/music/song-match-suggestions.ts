import { normalizeSongTitle } from "@/lib/music/title-utils";
import { scoreEventTitleMatch } from "@/lib/setlist-export/scoring";

function similarityScore(left: string, right: string) {
  return scoreEventTitleMatch(left, right) / 10_000;
}

export function rankSongTitleCandidates(
  rawTitle: string,
  candidateTitles: string[],
  minimumScore = 0.45,
  limit = 5,
) {
  const normalizedTarget = normalizeSongTitle(rawTitle);

  return candidateTitles
    .map((title) => ({
      title,
      score: similarityScore(
        normalizedTarget,
        normalizeSongTitle(title),
      ),
    }))
    .filter((candidate) => candidate.score >= minimumScore)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.title.localeCompare(right.title, "ja"),
    )
    .slice(0, limit);
}
