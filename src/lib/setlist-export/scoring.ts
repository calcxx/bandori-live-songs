import { normalizeNFKC } from "@/lib/music/title-utils";

/** bandori.fans 用引号、eventernote 用 -subtitle-；匹配时忽略标点。 */
export function normalizeEventTitleForMatch(value: string) {
  return normalizeNFKC(value)
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function diceCoefficient(left: string, right: string) {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const rightPairs = new Map<string, number>();
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    rightPairs.set(pair, (rightPairs.get(pair) ?? 0) + 1);
  }

  let overlap = 0;
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    const remaining = rightPairs.get(pair) ?? 0;
    if (remaining > 0) {
      overlap += 1;
      rightPairs.set(pair, remaining - 1);
    }
  }

  return (2 * overlap) / (left.length + right.length - 2);
}

function tokenDiceCoefficient(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return (2 * overlap) / (leftTokens.size + rightTokens.size);
}

export function scoreEventTitleMatch(query: string, candidate: string) {
  const normalizedQuery = normalizeEventTitleForMatch(query);
  const normalizedCandidate = normalizeEventTitleForMatch(candidate);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  if (normalizedQuery === normalizedCandidate) {
    return 10_000;
  }

  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
    return 7_000 - Math.abs(normalizedCandidate.length - normalizedQuery.length);
  }

  const compactQuery = normalizedQuery.replaceAll(" ", "");
  const compactCandidate = normalizedCandidate.replaceAll(" ", "");
  const characterSimilarity = diceCoefficient(compactQuery, compactCandidate);
  const tokenSimilarity = tokenDiceCoefficient(normalizedQuery, normalizedCandidate);

  if (characterSimilarity < 0.28 && tokenSimilarity < 0.34) {
    return 0;
  }

  return Math.round(characterSimilarity * 4_200 + tokenSimilarity * 1_800);
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
