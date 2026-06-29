import { normalizeSongTitle } from "@/lib/music/title-utils";

function countBigrams(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim();
  const tokens = normalized.length < 2 ? [normalized] : Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2));
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}

function diceCoefficient(left: string, right: string) {
  if (left === right) {
    return 1;
  }

  if (!left || !right) {
    return 0;
  }

  const leftBigrams = countBigrams(left);
  const rightBigrams = countBigrams(right);
  let overlap = 0;
  let leftSize = 0;
  let rightSize = 0;

  for (const count of leftBigrams.values()) {
    leftSize += count;
  }

  for (const count of rightBigrams.values()) {
    rightSize += count;
  }

  for (const [token, leftCount] of leftBigrams) {
    overlap += Math.min(leftCount, rightBigrams.get(token) ?? 0);
  }

  return (2 * overlap) / (leftSize + rightSize);
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function similarityScore(left: string, right: string) {
  const dice = diceCoefficient(left, right);
  const maxLength = Math.max(left.length, right.length);
  const editComponent = maxLength === 0 ? 1 : 1 - levenshteinDistance(left, right) / maxLength;
  return dice * 0.7 + editComponent * 0.3;
}

export function findClosestSongTitle(
  rawTitle: string,
  candidateTitles: string[],
  minimumScore = 0.45,
) {
  const normalizedTarget = normalizeSongTitle(rawTitle);
  let bestMatch: { title: string; score: number } | null = null;

  for (const candidateTitle of candidateTitles) {
    const normalizedCandidate = normalizeSongTitle(candidateTitle);

    if (!normalizedCandidate) {
      continue;
    }

    const score = similarityScore(normalizedTarget, normalizedCandidate);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { title: candidateTitle, score };
    }
  }

  if (!bestMatch || bestMatch.score < minimumScore) {
    return null;
  }

  return bestMatch;
}
