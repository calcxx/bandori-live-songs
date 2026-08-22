import type { LiveSetlist } from "./types";

export const LIVE_SEARCH_HISTORY_STORAGE_KEY =
  "bdr-live-search-history";
const EXPLICIT_EMPTY_EVENT_HISTORY_STATE_KEY =
  "bdrExplicitEmptyEventSearch";

export type StoredLiveSearch = {
  query: string;
  live: LiveSetlist;
  needsRefresh?: boolean;
};

export function parseStoredLiveSearch(
  rawValue: string | null,
): StoredLiveSearch | null {
  if (!rawValue) {
    return null;
  }

  try {
    const value = JSON.parse(rawValue) as Partial<StoredLiveSearch>;
    if (
      typeof value.query !== "string" ||
      !value.live ||
      !Number.isSafeInteger(value.live.eventernoteEventId) ||
      typeof value.live.title !== "string" ||
      typeof value.live.eventDate !== "string" ||
      !Array.isArray(value.live.entries)
    ) {
      return null;
    }

    const hasPerformingBands = Array.isArray(
      value.live.performingBands,
    );
    const hasSeries = Object.prototype.hasOwnProperty.call(
      value.live,
      "series",
    );
    return {
      query: value.query,
      live: {
        ...value.live,
        performingBands: hasPerformingBands
          ? value.live.performingBands
          : [],
        series: hasSeries ? value.live.series ?? null : null,
      },
      needsRefresh:
        hasPerformingBands && hasSeries ? undefined : true,
    } as StoredLiveSearch;
  } catch {
    return null;
  }
}

export function readStoredLiveSearch() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseStoredLiveSearch(
      window.localStorage.getItem(
        LIVE_SEARCH_HISTORY_STORAGE_KEY,
      ),
    );
  } catch {
    return null;
  }
}

export function storeLiveSearch(query: string, live: LiveSetlist) {
  try {
    const record: StoredLiveSearch = {
      query,
      live,
    };
    window.localStorage.setItem(
      LIVE_SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(record),
    );
  } catch {
    // Storage may be disabled or full.
  }
}

export function clearStoredLiveSearch() {
  try {
    window.localStorage.removeItem(
      LIVE_SEARCH_HISTORY_STORAGE_KEY,
    );
  } catch {
    // Storage may be disabled.
  }
}

export function markCurrentEventSearchHistoryEntryAsExplicit() {
  if (typeof window === "undefined") {
    return;
  }

  const currentState = window.history.state;
  const state =
    currentState && typeof currentState === "object"
      ? { ...currentState }
      : {};
  window.history.replaceState(
    {
      ...state,
      [EXPLICIT_EMPTY_EVENT_HISTORY_STATE_KEY]: true,
    },
    "",
    window.location.href,
  );
}

export function isCurrentEventSearchHistoryEntryExplicit() {
  if (typeof window === "undefined") {
    return false;
  }

  const state = window.history.state;
  return Boolean(
    state &&
      typeof state === "object" &&
      state[EXPLICIT_EMPTY_EVENT_HISTORY_STATE_KEY] === true,
  );
}
