import { fetchWithTimeout, FetchTimeoutError } from "@/lib/http/fetch-with-timeout";
import { setTimeout as waitForRetry } from "node:timers/promises";
import {
  type EventernoteEventSnapshot,
  parseEventernoteUserProfilePage,
  parseEventernoteUserEventsPage,
} from "./parser";

const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const baseUrl = "https://www.eventernote.com";
const eventernotePageTimeoutMs = 10000;
const eventernoteTotalTimeoutMs = 30000;
const eventernotePageBatchSize = 4;
const eventernoteMaxFetchAttempts = 3;
const eventernoteRetryBaseDelayMs = 400;

// Bump this whenever cached Bandori event snapshots become semantically stale,
// including actor-id mapping updates in BAND_SEEDS.
export const eventernoteUserEventsParserVersion = 5;

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

function buildHeaders() {
  return {
    "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    "user-agent": userAgent,
  };
}

async function fetchUserEventsPage(userId: string, page = 1, timeoutMs = eventernotePageTimeoutMs) {
  const url = new URL(`/users/${encodeURIComponent(userId)}/events`, baseUrl);

  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  const response = await fetchWithTimeout(url, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
    timeoutMs,
  });

  if (response.status === 404) {
    throw new EventernoteUserNotFoundError(userId);
  }

  if (!response.ok) {
    throw new EventernoteHttpError(userId, response.status);
  }

  const html = await response.text();

  const parsed = parseEventernoteUserEventsPage(html);

  if (parsed.missingUser) {
    throw new EventernoteUserNotFoundError(userId);
  }

  return parsed;
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
) {
  const results: Array<{ pageNumber: number; page: Awaited<ReturnType<typeof fetchUserEventsPage>> }> = [];

  for (let index = 0; index < pageNumbers.length; index += eventernotePageBatchSize) {
    const pageChunk = pageNumbers.slice(index, index + eventernotePageBatchSize);
    const chunkResults = await Promise.all(
      pageChunk.map(async (pageNumber) => {
        const page = await fetchUserEventsPage(userId, pageNumber, Math.min(eventernotePageTimeoutMs, remainingTimeout()));
        return { pageNumber, page };
      }),
    );

    results.push(...chunkResults);
  }

  return results;
}

async function fetchAllUserEventsOnce(userId: string) {
  const startedAt = Date.now();
  const remainingTimeout = () => Math.max(1000, eventernoteTotalTimeoutMs - (Date.now() - startedAt));

  const firstPage = await fetchUserEventsPage(userId, 1, Math.min(eventernotePageTimeoutMs, remainingTimeout()));
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
    if (Date.now() - startedAt >= eventernoteTotalTimeoutMs) {
      throw new Error(`Eventernote user event fetch exceeded ${eventernoteTotalTimeoutMs}ms.`);
    }

    const batchPages = [...pagesToFetch].filter((page) => !fetchedPages.has(page)).sort((left, right) => left - right);
    pagesToFetch.clear();

    if (batchPages.length === 0) {
      break;
    }

    const batchResults = await fetchUserEventsBatch(userId, batchPages, remainingTimeout);

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
    displayId: firstPage.displayId ?? userId,
    displayName: firstPage.displayName,
    totalCount: firstPage.totalCount ?? events.length,
    events,
  };
}

export async function fetchAllUserEvents(userId: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= eventernoteMaxFetchAttempts; attempt += 1) {
    try {
      return await fetchAllUserEventsOnce(userId);
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

export async function fetchUserEventCount(userId: string, timeoutMs = eventernotePageTimeoutMs): Promise<number | null> {
  try {
    const url = new URL(`/users/${encodeURIComponent(userId)}/events`, baseUrl);
    const response = await fetchWithTimeout(url, {
      headers: buildHeaders(),
      next: { revalidate: 0 },
      timeoutMs,
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const parsed = parseEventernoteUserEventsPage(html);

    if (parsed.missingUser) {
      return null;
    }

    return parsed.totalCount;
  } catch {
    return null;
  }
}

export async function fetchEventernoteUserProfile(userId: string, timeoutMs = eventernotePageTimeoutMs) {
  const url = new URL(`/users/${encodeURIComponent(userId)}`, baseUrl);
  const response = await fetchWithTimeout(url, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
    timeoutMs,
  });

  const html = await response.text();

  if (response.status === 404) {
    throw new EventernoteUserNotFoundError(userId);
  }

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
