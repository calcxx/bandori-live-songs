import type {
  LiveSetlistCandidate,
  LiveSetlistSeries,
  LiveSetlistSeriesEvent,
} from "./types";

const MINIMUM_PREFIX_LENGTH = 12;
const MINIMUM_PREFIX_COVERAGE = 0.45;
const SERIES_YEAR_PATTERN = /(?:19|20)\d{2}/gu;

function normalizeSeriesTitle(title: string) {
  return title
    .normalize("NFKC")
    .replace(/[‘’＇]/gu, "'")
    .replace(/[“”„‟〝〞＂]/gu, '"')
    .replace(/[〜～]/gu, "~")
    .replace(/\s+/gu, " ")
    .trim();
}

function longestCommonPrefix(left: string, right: string) {
  const leftChars = Array.from(left);
  const rightChars = Array.from(right);
  const length = Math.min(leftChars.length, rightChars.length);
  let index = 0;
  while (
    index < length &&
    leftChars[index]?.toLocaleLowerCase() ===
      rightChars[index]?.toLocaleLowerCase()
  ) {
    index += 1;
  }
  return leftChars.slice(0, index).join("");
}

function extractSeriesYears(title: string) {
  return title.match(SERIES_YEAR_PATTERN) ?? [];
}

function hasCompatibleSeriesYears(left: string, right: string) {
  const leftYears = extractSeriesYears(left);
  const rightYears = extractSeriesYears(right);
  return (
    leftYears.length === rightYears.length &&
    leftYears.every((year, index) => year === rightYears[index])
  );
}

function trimPrefixToBoundary(prefix: string) {
  const cleanedPrefix = prefix.trimEnd();
  const trailingCharacter = Array.from(cleanedPrefix).at(-1) ?? "";
  if (trailingCharacter && !/[A-Za-z0-9]/u.test(trailingCharacter)) {
    return cleanedPrefix
      .replace(/[\s\-–—~〜～@＠:：·・|/]+$/gu, "")
      .trim();
  }

  const boundaries = [" ", "@", "＠", "【", "[", "（", "("];
  const boundaryIndex = Math.max(
    ...boundaries.map((boundary) => cleanedPrefix.lastIndexOf(boundary)),
  );
  if (boundaryIndex < 0) {
    return "";
  }

  return cleanedPrefix
    .slice(0, boundaryIndex)
    .replace(/[\s\-–—~〜～@＠:：·・|/]+$/gu, "")
    .trim();
}

function qualifiesForPrefix(title: string, prefix: string) {
  const normalizedTitle = title.toLocaleLowerCase();
  const normalizedPrefix = prefix.toLocaleLowerCase();
  return (
    normalizedTitle.startsWith(normalizedPrefix) &&
    Array.from(prefix).length >= MINIMUM_PREFIX_LENGTH &&
    Array.from(prefix).length / Array.from(title).length >=
      MINIMUM_PREFIX_COVERAGE
  );
}

function buildSeriesLabel(title: string, prefix: string) {
  return title
    .slice(prefix.length)
    .replace(/^[\s\-–—~〜～@＠:：·・|/]+/gu, "")
    .trim();
}

function addDisambiguatedLabels(
  events: Array<LiveSetlistCandidate & { normalizedTitle: string }>,
  prefix: string,
): LiveSetlistSeriesEvent[] {
  const baseLabels = events.map((event) =>
    buildSeriesLabel(event.normalizedTitle, prefix),
  );
  const labelCounts = new Map<string, number>();
  for (const label of baseLabels) {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  return events.map((event, index) => {
    const seriesEvent: LiveSetlistCandidate = {
      eventernoteEventId: event.eventernoteEventId,
      title: event.title,
      eventDate: event.eventDate,
      venue: event.venue,
    };
    const rawLabel = baseLabels[index] ?? "";
    if (!rawLabel) {
      return { ...seriesEvent, label: event.eventDate };
    }
    const baseLabel = rawLabel;
    const label =
      (labelCounts.get(rawLabel) ?? 0) > 1
        ? `${baseLabel} · ${event.eventDate}`
        : baseLabel;
    return { ...seriesEvent, label };
  });
}

export function detectLiveSetlistSeries(
  current: LiveSetlistCandidate,
  candidates: LiveSetlistCandidate[],
): LiveSetlistSeries | null {
  const normalizedCandidates = candidates.map((candidate) => ({
    ...candidate,
    normalizedTitle: normalizeSeriesTitle(candidate.title),
  }));
  const normalizedCurrent = normalizeSeriesTitle(current.title);
  const possiblePrefixes = new Set<string>();

  for (const candidate of normalizedCandidates) {
    if (candidate.eventernoteEventId === current.eventernoteEventId) {
      continue;
    }
    if (
      !hasCompatibleSeriesYears(
        normalizedCurrent,
        candidate.normalizedTitle,
      )
    ) {
      continue;
    }
    const prefix = trimPrefixToBoundary(
      longestCommonPrefix(normalizedCurrent, candidate.normalizedTitle),
    );
    if (
      qualifiesForPrefix(normalizedCurrent, prefix) &&
      qualifiesForPrefix(candidate.normalizedTitle, prefix)
    ) {
      possiblePrefixes.add(prefix);
    }
  }

  const groups = [...possiblePrefixes]
    .map((prefix) => ({
      prefix,
      events: normalizedCandidates.filter(
        (candidate) =>
          hasCompatibleSeriesYears(
            normalizedCurrent,
            candidate.normalizedTitle,
          ) && qualifiesForPrefix(candidate.normalizedTitle, prefix),
      ),
    }))
    .filter(({ events }) => events.length >= 2)
    .sort(
      (left, right) =>
        right.events.length - left.events.length ||
        Array.from(right.prefix).length - Array.from(left.prefix).length,
    );

  const selected = groups[0];
  if (!selected) {
    return null;
  }

  const sortedEvents = selected.events.toSorted(
    (left, right) =>
      left.eventDate.localeCompare(right.eventDate) ||
      left.eventernoteEventId - right.eventernoteEventId,
  );

  return {
    title: selected.prefix,
    events: addDisambiguatedLabels(sortedEvents, selected.prefix),
  };
}
