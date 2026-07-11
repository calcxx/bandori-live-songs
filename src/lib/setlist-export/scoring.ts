import { normalizeNFKC } from "@/lib/music/title-utils";

/** bandori.fans 用引号、eventernote 用 -subtitle-；匹配时忽略标点。 */
export function normalizeEventTitleForMatch(value: string) {
  return normalizeNFKC(value)
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEventTitle(value: string) {
  return normalizeEventTitleForMatch(value);
}

const TITLE_SEARCH_STOP_WORDS = new Set(["summer", "live", "dream", "special", "tour", "final", "day1", "day2"]);

/** 从标题取 ilike 用的短关键词（如 ThanXX），引号/破折号写法不同也能命中。 */
export function extractDistinctiveTitleNeedle(title: string) {
  const words = normalizeEventTitleForMatch(title)
    .split(" ")
    .filter((word) => word.length >= 4 && !/^\d{4}$/.test(word) && !TITLE_SEARCH_STOP_WORDS.has(word));
  return words.at(-1) ?? null;
}

function scoreEventTitleMatch(query: string, candidate: string) {
  const normalizedQuery = normalizeEventTitle(query);
  const normalizedCandidate = normalizeEventTitle(candidate);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  if (normalizedQuery === normalizedCandidate) {
    return 10_000;
  }

  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
    return 5_000 - Math.abs(normalizedCandidate.length - normalizedQuery.length);
  }

  return 0;
}

export function scoreEventCandidateForExport(
  query: { title: string; eventDate?: string },
  event: { title: string; eventDate: string },
) {
  const titleScore = scoreEventTitleMatch(query.title, event.title);
  if (titleScore === 0) {
    return 0;
  }

  if (!query.eventDate) {
    return titleScore;
  }

  return event.eventDate === query.eventDate ? titleScore + 20_000 : titleScore - 1_000;
}
