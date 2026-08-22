import { scoreEventCandidateForExport } from "@/lib/setlist-export/scoring";
import {
  extractBandSearchFilters,
  type LiveSetlistBandSearchRecord,
} from "./band-query";
import { parseLiveSetlistSearch } from "./date";
import type { LiveSetlistCandidate } from "./types";

export type SearchableLiveSetlistCandidate = LiveSetlistCandidate & {
  performingBandSlugs?: string[];
};

export function rankLiveSetlistCandidates(
  candidates: SearchableLiveSetlistCandidate[],
  rawQuery: string,
  limit = 8,
  bands: LiveSetlistBandSearchRecord[] = [],
) {
  const { title: titleWithBands, dateFilter, invalidDateToken } =
    parseLiveSetlistSearch(rawQuery);
  const { title, bandSlugs } = extractBandSearchFilters(
    titleWithBands,
    bands,
  );

  if (
    invalidDateToken ||
    (title.length > 0 && title.length < 2) ||
    (title.length === 0 && !dateFilter && bandSlugs.length === 0)
  ) {
    return [];
  }

  return candidates
    .filter((candidate) => {
      if (
        bandSlugs.length > 0 &&
        !bandSlugs.every((slug) =>
          (candidate.performingBandSlugs ?? []).includes(slug),
        )
      ) {
        return false;
      }
      if (!dateFilter) {
        return true;
      }
      if (dateFilter.kind === "day") {
        return candidate.eventDate === dateFilter.value;
      }
      return candidate.eventDate.startsWith(dateFilter.value);
    })
    .map((candidate) => ({
      candidate,
      score: title
        ? scoreEventCandidateForExport(
            { title },
            { title: candidate.title, eventDate: candidate.eventDate },
          )
        : 0,
    }))
    .filter(({ score }) => title.length === 0 || score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.candidate.eventDate.localeCompare(left.candidate.eventDate) ||
        right.candidate.eventernoteEventId - left.candidate.eventernoteEventId,
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
