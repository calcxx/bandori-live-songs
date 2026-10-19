import { fetchWithTimeout, FetchTimeoutError } from "@/lib/http/fetch-with-timeout";
import { setTimeout as waitForRetry } from "node:timers/promises";
import { parseEventernoteCalendarIcs } from "./calendar-ics";
import {
  type EventernoteEventSnapshot,
  parseEventernoteUserNumericId,
  parseEventernoteUserProfilePage,
  parseEventernoteUserEventsPage,
} from "./parser";

const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const baseUrl = "https://www.eventernote.com";
const eventernoteCountTimeoutMs = 10000;
const eventernoteCalendarTimeoutMs = 15000;
const eventernotePageTimeoutMs = 20000;
const eventernoteFallbackPageTimeoutMs = 10000;
const eventernoteBaseTotalTimeoutMs = 30000;
const eventernoteMaxTotalTimeoutMs = 120000;
const eventernoteTimeoutGraceMs = 5000;
const eventernotePageBatchSize = 4;
const eventernoteMaxFetchAttempts = 3;
const eventernoteRetryBaseDelayMs = 400;
const eventernoteUserEventsPageSize = 2000;
const eventernoteFallbackPageSize = 30;
const eventernoteUserCalendarEventLimit = 300;

// Bump this whenever cached Bandori event snapshots become semantically stale,
// including actor-id mapping updates in BAND_SEEDS.
export const eventernoteUserEventsParserVersion = 6;

export type EventernoteUserEventsSummary = {
  totalCount: number | null;
  numericUserId: number | null;
  displayId: string;
  displayName: string | null;
};

export function getEventernoteTotalTimeoutMs(totalPages: number) {
  const normalizedTotalPages = Math.max(1, Math.ceil(totalPages));
  const requestGroups =
    1 + Math.ceil(Math.max(0, normalizedTotalPages - 1) / eventernotePageBatchSize);

  return Math.min(
    eventernoteMaxTotalTimeoutMs,
    Math.max(
      eventernoteBaseTotalTimeoutMs,
      eventernoteTimeoutGraceMs + requestGroups * eventernotePageTimeoutMs,
    ),
  );
}

export class EventernoteUserNotFoundError extends Error {
  constructor(userId: string) {
    super(`Eventernote user "${userId}" was not found.`);
  }
}

class EventernoteHttpError extends Error {
  status: number;

  constructor(userId: string, status: number) {
    super(`Eventernote user "${userId}" request failed with status ${status}.`);
    this.status = status;
  }
}

function buildHeaders(extra: Record<string, string> = {}) {
  return {
    "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    "user-agent": userAgent,
    ...extra,
  };
}

async function fetchUserEventsPage(
  userId: string,
  page = 1,
  timeoutMs = eventernotePageTimeoutMs,
  limit = eventernoteUserEventsPageSize,
) {
  const url = new URL(`/users/${encodeURIComponent(userId)}/events`, baseUrl);
  url.searchParams.set("limit", String(limit));

  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  const html = await fetchWithTimeout(url, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
    timeoutMs,
  }, async (response) => {
    if (response.status === 404) {
      throw new EventernoteUserNotFoundError(userId);
    }
    if (!response.ok) {
      throw new EventernoteHttpError(userId, response.status);
    }
    return response.text();
  });

  const parsed = parseEventernoteUserEventsPage(html);

  if (parsed.missingUser) {
    throw new EventernoteUserNotFoundError(userId);
  }

  return parsed;
}

async function fetchUserEventsSummaryPage(userId: string, timeoutMs: number) {
  const url = new URL(`/users/${encodeURIComponent(userId)}/events`, baseUrl);
  url.searchParams.set("limit", "1");

  const html = await fetchWithTimeout(url, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
    timeoutMs,
  }, async (response) => {
    if (response.status === 404) {
      throw new EventernoteUserNotFoundError(userId);
    }
    if (!response.ok) {
      throw new EventernoteHttpError(userId, response.status);
    }
    return response.text();
  });

  const parsed = parseEventernoteUserEventsPage(html);

  if (parsed.missingUser) {
    throw new EventernoteUserNotFoundError(userId);
  }

  return {
    parsed,
    numericUserId: parseEventernoteUserNumericId(html),
  };
}

export async function fetchUserEventSummary(
  userId: string,
  timeoutMs = eventernoteCountTimeoutMs,
): Promise<EventernoteUserEventsSummary> {
  const { parsed, numericUserId } = await fetchUserEventsSummaryPage(
    userId,
    timeoutMs,
  );

  return {
    totalCount: parsed.totalCount,
    numericUserId,
    displayId: parsed.displayId ?? userId,
    displayName: parsed.displayName,
  };
}

async function fetchUserCalendarEvents(numericUserId: number) {
  const url = new URL(`/users/calendar/${numericUserId}/ics`, baseUrl);
  const ics = await fetchWithTimeout(url, {
    headers: buildHeaders({ accept: "text/calendar" }),
    next: { revalidate: 0 },
    timeoutMs: eventernoteCalendarTimeoutMs,
  }, async (response) => {
    if (!response.ok) {
      throw new EventernoteHttpError(String(numericUserId), response.status);
    }
    return response.text();
  });

  if (!ics.trimStart().startsWith("BEGIN:VCALENDAR")) {
    throw new Error("Eventernote calendar response was not an ICS document.");
  }

  return parseEventernoteCalendarIcs(ics);
}

function isRetryableEventernoteError(error: unknown) {
  if (error instanceof EventernoteUserNotFoundError) {
    return false;
  }

  if (error instanceof FetchTimeoutError) {
    return true;
  }

  if (error instanceof EventernoteHttpError) {
    return [408, 425, 429, 500, 502, 503, 504].includes(error.status);
  }

  // In Node runtime, transient network failures usually surface as TypeError (e.g. fetch failed).
  if (error instanceof TypeError) {
    return true;
  }

  return false;
}

async function fetchUserEventsBatch(
  userId: string,
  pageNumbers: number[],
  remainingTimeout: () => number,
  limit: number,
  pageTimeoutMs: number,
) {
  const results: Array<{ pageNumber: number; page: Awaited<ReturnType<typeof fetchUserEventsPage>> }> = [];

  for (let index = 0; index < pageNumbers.length; index += eventernotePageBatchSize) {
    const pageChunk = pageNumbers.slice(index, index + eventernotePageBatchSize);
    const chunkResults = await Promise.all(
      pageChunk.map(async (pageNumber) => {
        const page = await fetchUserEventsPage(
          userId,
          pageNumber,
          Math.min(pageTimeoutMs, remainingTimeout()),
          limit,
        );
        return { pageNumber, page };
      }),
    );

    results.push(...chunkResults);
  }

  return results;
}

async function fetchAllUserEventsHtmlOnce(
  userId: string,
  summary: EventernoteUserEventsSummary,
  limit: number,
  pageTimeoutMs: number,
) {
  const startedAt = Date.now();
  let totalTimeoutMs = eventernoteBaseTotalTimeoutMs;
  const remainingTimeout = () => Math.max(1000, totalTimeoutMs - (Date.now() - startedAt));

  const firstPage = await fetchUserEventsPage(
    userId,
    1,
    Math.min(pageTimeoutMs, remainingTimeout()),
    limit,
  );
  const events: EventernoteEventSnapshot[] = [];
  const uniqueEventIds = new Set<number>();
  const fetchedPages = new Set<number>([1]);
  const pagesToFetch = new Set<number>();

  const appendEvents = (pageEvents: EventernoteEventSnapshot[]) => {
    for (const event of pageEvents) {
      if (uniqueEventIds.has(event.eventernoteEventId)) {
        continue;
      }

      uniqueEventIds.add(event.eventernoteEventId);
      events.push(event);
    }
  };

  appendEvents(firstPage.events);

  const maxDiscoveredPage = firstPage.discoveredPages[firstPage.discoveredPages.length - 1] ?? 1;
  const estimatedTotalPages =
    firstPage.totalCount !== null && firstPage.pageItemCount > 0
      ? Math.max(1, Math.ceil(firstPage.totalCount / firstPage.pageItemCount))
      : 1;
  const initialLastPage = Math.max(maxDiscoveredPage, estimatedTotalPages);
  totalTimeoutMs = getEventernoteTotalTimeoutMs(initialLastPage);

  for (let page = 2; page <= initialLastPage; page += 1) {
    pagesToFetch.add(page);
  }

  if (firstPage.nextPage && firstPage.nextPage > 1) {
    pagesToFetch.add(firstPage.nextPage);
  }

  for (const page of firstPage.discoveredPages) {
    if (page > 1) {
      pagesToFetch.add(page);
    }
  }

  while (pagesToFetch.size > 0) {
    if (Date.now() - startedAt >= totalTimeoutMs) {
      throw new FetchTimeoutError(`Eventernote user event fetch exceeded ${totalTimeoutMs}ms.`);
    }

    const batchPages = [...pagesToFetch].filter((page) => !fetchedPages.has(page)).sort((left, right) => left - right);
    pagesToFetch.clear();

    if (batchPages.length === 0) {
      break;
    }

    const batchResults = await fetchUserEventsBatch(
      userId,
      batchPages,
      remainingTimeout,
      limit,
      pageTimeoutMs,
    );

    for (const { pageNumber, page } of batchResults) {
      if (fetchedPages.has(pageNumber)) {
        continue;
      }

      fetchedPages.add(pageNumber);
      appendEvents(page.events);

      if (page.nextPage && page.nextPage > 1 && !fetchedPages.has(page.nextPage)) {
        pagesToFetch.add(page.nextPage);
      }

      for (const discoveredPage of page.discoveredPages) {
        if (discoveredPage > 1 && !fetchedPages.has(discoveredPage)) {
          pagesToFetch.add(discoveredPage);
        }
      }
    }
  }

  return {
    userId,
    displayId: firstPage.displayId ?? summary.displayId,
    displayName: firstPage.displayName ?? summary.displayName,
    totalCount: firstPage.totalCount ?? events.length,
    events,
  };
}

async function fetchAllUserEventsHtml(
  userId: string,
  summary: EventernoteUserEventsSummary,
) {
  try {
    return await fetchAllUserEventsHtmlOnce(
      userId,
      summary,
      eventernoteUserEventsPageSize,
      eventernotePageTimeoutMs,
    );
  } catch (error) {
    if (error instanceof EventernoteUserNotFoundError) {
      throw error;
    }

    // A very large limit can exceed upstream limits or the per-request budget.
    // Fall back to the previous 30-row pagination rather than failing the user.
    return fetchAllUserEventsHtmlOnce(
      userId,
      summary,
      eventernoteFallbackPageSize,
      eventernoteFallbackPageTimeoutMs,
    );
  }
}

async function fetchAllUserEventsOnce(
  userId: string,
  summaryOverride?: EventernoteUserEventsSummary,
) {
  const summary = summaryOverride ?? await fetchUserEventSummary(userId);

  if (summary.totalCount === 0) {
    return {
      userId,
      displayId: summary.displayId,
      displayName: summary.displayName,
      totalCount: 0,
      events: [] as EventernoteEventSnapshot[],
    };
  }

  if (
    summary.totalCount !== null &&
    summary.totalCount <= eventernoteUserCalendarEventLimit &&
    summary.numericUserId !== null
  ) {
    try {
      const events = await fetchUserCalendarEvents(summary.numericUserId);

      if (events.length > 0) {
        return {
          userId,
          displayId: summary.displayId,
          displayName: summary.displayName,
          totalCount: summary.totalCount,
          events,
        };
      }
    } catch {
      // Fall through to HTML. The calendar feed is an optimization, not a
      // completeness requirement for this path.
    }
  }

  return fetchAllUserEventsHtml(userId, summary);
}

export async function fetchAllUserEvents(
  userId: string,
  options: { summary?: EventernoteUserEventsSummary } = {},
) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= eventernoteMaxFetchAttempts; attempt += 1) {
    try {
      return await fetchAllUserEventsOnce(userId, options.summary);
    } catch (error) {
      lastError = error;

      const shouldRetry = attempt < eventernoteMaxFetchAttempts && isRetryableEventernoteError(error);
      if (!shouldRetry) {
        throw error;
      }

      await waitForRetry(eventernoteRetryBaseDelayMs * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("抓取 Eventernote 失败。");
}

export async function fetchUserEventCount(
  userId: string,
  timeoutMs = eventernoteCountTimeoutMs,
): Promise<number | null> {
  try {
    const summary = await fetchUserEventSummary(userId, timeoutMs);
    return summary.totalCount;
  } catch {
    return null;
  }
}

export async function fetchEventernoteUserProfile(
  userId: string,
  timeoutMs = eventernoteCountTimeoutMs,
) {
  const url = new URL(`/users/${encodeURIComponent(userId)}`, baseUrl);
  const html = await fetchWithTimeout(url, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
    timeoutMs,
  }, async (response) => {
    if (response.status === 404) {
      throw new EventernoteUserNotFoundError(userId);
    }
    if (!response.ok) {
      throw new EventernoteHttpError(userId, response.status);
    }
    return response.text();
  });

  const parsed = parseEventernoteUserProfilePage(html);

  if (parsed.missingUser || !parsed.displayId) {
    throw new EventernoteUserNotFoundError(userId);
  }

  return {
    userId,
    displayId: parsed.displayId,
    displayName: parsed.displayName,
  };
}
