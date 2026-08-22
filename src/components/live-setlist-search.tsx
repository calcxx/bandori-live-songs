"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { CopyDefinition } from "@/lib/i18n";
import {
  clearStoredLiveSearch,
  isCurrentEventSearchHistoryEntryExplicit,
  markCurrentEventSearchHistoryEntryAsExplicit,
  readStoredLiveSearch,
  storeLiveSearch,
} from "@/lib/live-setlist/history";
import {
  buildEmptyEventSearchHref,
  buildLiveSetlistHref,
} from "@/lib/live-setlist/url";
import type {
  LiveSetlist,
  LiveSetlistCandidate,
  LiveSetlistCandidatesResponse,
  LiveSetlistResponse,
} from "@/lib/live-setlist/types";
import { normalizeQuotesForDisplay } from "@/lib/music/title-utils";

type SearchStatus = "idle" | "loading" | "ready" | "error";

export type LiveSetlistSearchRestore = {
  revision: number;
  query: string;
  live: LiveSetlist | null;
  detailStatus: SearchStatus;
};

type LiveSetlistSearchProps = {
  copy: CopyDefinition;
  defaultLive: LiveSetlist | null;
  historyRestore: LiveSetlistSearchRestore;
  onResultChange: (live: LiveSetlist | null) => void;
  onEmptyStateChange: (visible: boolean) => void;
};

function updateEventIdInUrl(
  eventernoteEventId: number | null,
  push: boolean,
) {
  const url = new URL(window.location.href);
  url.pathname =
    eventernoteEventId === null
      ? buildEmptyEventSearchHref()
      : buildLiveSetlistHref(eventernoteEventId);
  url.search = "";
  const nextUrl = `${url.pathname}${url.hash}`;
  if (push) {
    window.history.pushState(null, "", nextUrl);
  } else {
    window.history.replaceState(null, "", nextUrl);
  }
}

export function LiveSetlistSearch({
  copy,
  defaultLive,
  historyRestore,
  onResultChange,
  onEmptyStateChange,
}: LiveSetlistSearchProps) {
  const [query, setQuery] = useState(defaultLive?.title ?? "");
  const [selectedQuery, setSelectedQuery] = useState<string | null>(
    defaultLive?.title ?? null,
  );
  const [candidates, setCandidates] = useState<LiveSetlistCandidate[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [detailStatus, setDetailStatus] = useState<SearchStatus>(
    defaultLive ? "ready" : "idle",
  );
  const [isComposing, setIsComposing] = useState(false);
  const [lastHistoryRestoreRevision, setLastHistoryRestoreRevision] =
    useState(historyRestore.revision);
  const debounceTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const candidateRequestRef = useRef<AbortController | null>(null);
  const detailRequestRef = useRef<AbortController | null>(null);
  const didRestoreInitialSearchRef = useRef(false);

  if (lastHistoryRestoreRevision !== historyRestore.revision) {
    setLastHistoryRestoreRevision(historyRestore.revision);
    setQuery(historyRestore.query);
    setSelectedQuery(historyRestore.live ? historyRestore.query : null);
    setCandidates([]);
    setSearchStatus("idle");
    setDetailStatus(historyRestore.detailStatus);
    setIsComposing(false);
  }

  useEffect(() => {
    candidateRequestRef.current?.abort();
    detailRequestRef.current?.abort();
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
    }
  }, [historyRestore.revision]);

  useEffect(() => {
    if (didRestoreInitialSearchRef.current) {
      return;
    }
    didRestoreInitialSearchRef.current = true;

    if (defaultLive) {
      storeLiveSearch(defaultLive.title, defaultLive);
      onEmptyStateChange(false);
      return;
    }
    if (isCurrentEventSearchHistoryEntryExplicit()) {
      onEmptyStateChange(true);
      return;
    }
    const stored = readStoredLiveSearch();
    if (!stored) {
      onEmptyStateChange(true);
      return;
    }
    onEmptyStateChange(false);
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      setQuery(stored.query);
      setSelectedQuery(stored.query);
      setDetailStatus("ready");
      updateEventIdInUrl(stored.live.eventernoteEventId, false);
      onResultChange(stored.live);
    });

    if (stored.needsRefresh) {
      fetch(
        `/api/live-setlists?eventernoteEventId=${stored.live.eventernoteEventId}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Stored live setlist refresh failed.");
          }
          return (await response.json()) as LiveSetlistResponse;
        })
        .then((data) => {
          storeLiveSearch(stored.query, data.live);
          onResultChange(data.live);
        })
        .catch((error) => {
          if ((error as Error).name !== "AbortError") {
            console.error("Failed to refresh stored live setlist", error);
          }
        });
    }

    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
    };
  }, [defaultLive, onEmptyStateChange, onResultChange]);

  const searchCandidates = useCallback(async (value: string) => {
    const normalized = value.trim();
    if (normalized.length < 2) {
      setCandidates([]);
      setSearchStatus("idle");
      return;
    }

    candidateRequestRef.current?.abort();
    const controller = new AbortController();
    candidateRequestRef.current = controller;
    setSearchStatus("loading");

    try {
      const response = await fetch(
        `/api/live-setlists?q=${encodeURIComponent(normalized)}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error("Live search failed.");
      }

      const data = (await response.json()) as LiveSetlistCandidatesResponse;
      setCandidates(data.candidates);
      setSearchStatus("ready");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setCandidates([]);
        setSearchStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    if (isComposing || query === selectedQuery) {
      return;
    }

    if (query.trim().length < 2) {
      candidateRequestRef.current?.abort();
      return;
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      void searchCandidates(query);
    }, 250);

    return () => {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [isComposing, query, searchCandidates, selectedQuery]);

  useEffect(
    () => () => {
      candidateRequestRef.current?.abort();
      detailRequestRef.current?.abort();
    },
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
    }
    void searchCandidates(query);
  }

  async function selectCandidate(candidate: LiveSetlistCandidate) {
    candidateRequestRef.current?.abort();
    detailRequestRef.current?.abort();
    const controller = new AbortController();
    detailRequestRef.current = controller;

    const selectedSearchQuery = query;
    onEmptyStateChange(false);
    setSelectedQuery(selectedSearchQuery);
    setCandidates([]);
    setSearchStatus("idle");
    setDetailStatus("loading");
    onResultChange(null);

    try {
      const response = await fetch(
        `/api/live-setlists?eventernoteEventId=${candidate.eventernoteEventId}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error("Live setlist request failed.");
      }

      const data = (await response.json()) as LiveSetlistResponse;
      storeLiveSearch(selectedSearchQuery, data.live);
      markCurrentEventSearchHistoryEntryAsExplicit();
      updateEventIdInUrl(data.live.eventernoteEventId, true);
      onResultChange(data.live);
      setDetailStatus("ready");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setDetailStatus("error");
      }
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 sm:gap-3">
        <label className="sr-only" htmlFor="live-title">
          {copy.liveSearchInputLabel}
        </label>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="relative">
              <input
                ref={inputRef}
                id="live-title"
                type="search"
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  setSelectedQuery(null);
                  setCandidates([]);
                  setSearchStatus("idle");
                  setDetailStatus("idle");
                  updateEventIdInUrl(null, false);
                  onResultChange(null);
                  onEmptyStateChange(nextQuery.trim().length === 0);
                  if (nextQuery.trim().length === 0) {
                    clearStoredLiveSearch();
                  }
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                autoComplete="off"
                placeholder={copy.liveSearchPlaceholder}
                className="min-h-13 w-full rounded-[1.25rem] border border-border-soft bg-panel-strong px-4 pr-12 text-base outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query.length > 0 ? (
                <button
                  type="button"
                  aria-label={copy.liveSearchClearAria}
                  className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft transition hover:bg-background hover:text-foreground"
                  onClick={() => {
                    candidateRequestRef.current?.abort();
                    detailRequestRef.current?.abort();
                    if (debounceTimeoutRef.current !== null) {
                      window.clearTimeout(debounceTimeoutRef.current);
                    }
                    setQuery("");
                    setSelectedQuery(null);
                    setCandidates([]);
                    setSearchStatus("idle");
                    setDetailStatus("idle");
                    clearStoredLiveSearch();
                    updateEventIdInUrl(null, false);
                    onResultChange(null);
                    onEmptyStateChange(true);
                  }}
                >
                  <XIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {candidates.length > 0 ? (
              <ul
                aria-label={copy.liveSearchCandidatesAria}
                className="mt-2 max-h-80 overflow-y-auto rounded-[1.15rem] border border-border-soft bg-panel-strong p-1 shadow-lg"
              >
                {candidates.map((candidate) => (
                  <li key={candidate.eventernoteEventId}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start rounded-xl px-2.5 py-1.5 text-left hover:bg-background"
                      onClick={() => void selectCandidate(candidate)}
                    >
                      <span className="text-sm font-medium leading-snug text-foreground">
                        {normalizeQuotesForDisplay(candidate.title)}
                      </span>
                      <span className="mt-0.5 text-xs leading-snug text-ink-soft">
                        {candidate.eventDate}
                        <span className="mx-1.5">·</span>
                        {candidate.venue ?? copy.venueMissing}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchStatus === "loading" ? (
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-ink-soft">
                <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
                {copy.liveSearchLoading}
              </p>
            ) : searchStatus === "ready" ? (
              <p className="mt-2 text-sm text-ink-soft">{copy.liveSearchEmpty}</p>
            ) : searchStatus === "error" ? (
              <p className="mt-2 text-sm text-red-500" role="alert">
                {copy.liveSearchError}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={query.trim().length < 2}
            className="inline-flex min-h-13 items-center justify-center rounded-[1.25rem] bg-foreground px-5 font-medium text-background hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copy.liveSearchSubmit}
          </button>
        </div>
      </form>

      {detailStatus === "loading" ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink-soft">
          <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
          {copy.liveSetlistLoading}
        </p>
      ) : detailStatus === "error" ? (
        <p className="mt-3 text-sm text-red-500" role="alert">
          {copy.liveSearchError}
        </p>
      ) : null}
    </div>
  );
}
