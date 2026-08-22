import {
  normalizeEventTitleForMatch,
  scoreEventTitleMatch,
} from "@/lib/setlist-export/scoring";

export function matchesSongTitleSearch(title: string, rawQuery: string) {
  const query = rawQuery.trim();
  if (query.length === 0) return true;

  const normalizedQuery = normalizeEventTitleForMatch(query).replaceAll(
    " ",
    "",
  );
  const normalizedTitle = normalizeEventTitleForMatch(title).replaceAll(
    " ",
    "",
  );
  if (!normalizedQuery || !normalizedTitle) return false;
  if (normalizedTitle.includes(normalizedQuery)) return true;
  if (normalizedQuery.includes(normalizedTitle)) {
    return normalizedTitle.length / normalizedQuery.length >= 0.6;
  }

  return scoreEventTitleMatch(query, title) >= 2_000;
}
