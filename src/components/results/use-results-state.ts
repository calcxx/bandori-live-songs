"use client";

import { useMemo, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { getBandSupportColor } from "@/lib/constants/bands";
import type { EventVisibilityRules } from "@/lib/events/event-visibility";
import {
  aggregateUserSongStats,
  type MatchedEventEntry,
  type SongEventReference,
  type SongPoolItem,
} from "@/lib/stats/aggregate";

const persistedStateChangedEvent = "bdr-persisted-state";

function readPersistedBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(key);
  return stored === null ? fallback : stored === "true";
}

function subscribePersistedState(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(persistedStateChangedEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(persistedStateChangedEvent, onStoreChange);
  };
}

function usePersistedState(key: string, serverDefault: boolean): [boolean, (value: boolean) => void] {
  const state = useSyncExternalStore(
    subscribePersistedState,
    () => readPersistedBoolean(key, serverDefault),
    () => serverDefault,
  );

  const setPersistedState = (value: boolean) => {
    window.localStorage.setItem(key, String(value));
    document.cookie = `${key}=${value}; path=/; max-age=${31536000}; samesite=lax`;
    window.dispatchEvent(new Event(persistedStateChangedEvent));
  };

  return [state, setPersistedState];
}

export type UseResultsStateOptions = {
  songs: SongPoolItem[];
  matchedEvents: MatchedEventEntry[];
  defaultHideUnplayed: boolean;
  defaultHideVirtualBands: boolean;
  defaultHideSonglessActivities: boolean;
  eventVisibilityRules: EventVisibilityRules;
};

export function useResultsState({
  songs,
  matchedEvents,
  defaultHideUnplayed,
  defaultHideVirtualBands,
  defaultHideSonglessActivities,
  eventVisibilityRules,
}: UseResultsStateOptions) {
  const [hideUnplayed, setHideUnplayed] = usePersistedState("bdr-hide-unplayed", defaultHideUnplayed);
  const [hideVirtualBands, setHideVirtualBands] = usePersistedState("bdr-hide-virtual-bands", defaultHideVirtualBands);
  const [hideSonglessActivities, setHideSonglessActivities] = usePersistedState(
    "bdr-hide-songless-activities",
    defaultHideSonglessActivities,
  );
  const [expandedBands, setExpandedBands] = useState<Record<string, boolean>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});
  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [songEventsBySongId, setSongEventsBySongId] = useState<Record<number, SongEventReference[]>>({});
  const [loadedBands, setLoadedBands] = useState<Record<string, boolean>>({});
  const [loadingBands, setLoadingBands] = useState<Record<string, boolean>>({});

  const stats = useMemo(
    () =>
      aggregateUserSongStats({
        songs,
        matchedEvents,
        hideUnplayed,
        hideVirtualBands,
        hideSonglessActivities,
        eventVisibilityRules,
      }),
    [songs, matchedEvents, hideUnplayed, hideVirtualBands, hideSonglessActivities, eventVisibilityRules],
  );

  const bandSummaries = stats.bandSummaries;

  const attendedEventIds = useMemo(
    () => new Set(stats.matchedEvents.map((event) => event.eventernoteEventId)),
    [stats.matchedEvents],
  );

  const bandSummaryColumns = useMemo(() => {
    const columns: [typeof bandSummaries, typeof bandSummaries] = [[], []];

    for (const [index, summary] of bandSummaries.entries()) {
      columns[index % 2].push(summary);
    }

    return columns;
  }, [bandSummaries]);

  const totalProgressSegments = useMemo(
    () =>
      bandSummaries
        .filter((summary) => summary.heardCount > 0)
        .map((summary) => {
          const supportColor = getBandSupportColor(summary.slug) ?? "var(--accent)";

          return {
            slug: summary.slug,
            label: summary.nameJa,
            width: stats.totalSummary.totalCount === 0 ? 0 : (summary.heardCount / stats.totalSummary.totalCount) * 100,
            supportColor,
          };
        }),
    [bandSummaries, stats.totalSummary.totalCount],
  );

  async function loadBandSongEvents(slug: string, songIds: number[]) {
    if (loadedBands[slug] || loadingBands[slug] || songIds.length === 0) {
      return;
    }

    setLoadingBands((previous) => ({
      ...previous,
      [slug]: true,
    }));

    try {
      const response = await fetch(`/api/song-events?songIds=${songIds.join(",")}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        songEventsBySongId: Record<string, SongEventReference[]>;
      };

      setSongEventsBySongId((previous) => ({
        ...previous,
        ...Object.fromEntries(
          Object.entries(payload.songEventsBySongId).map(([songId, refs]) => [Number(songId), refs]),
        ),
      }));
      setLoadedBands((previous) => ({
        ...previous,
        [slug]: true,
      }));
    } catch (error) {
      console.error("Failed to load song events", error);
    } finally {
      setLoadingBands((previous) => ({
        ...previous,
        [slug]: false,
      }));
    }
  }

  function openSongEvents(slug: string, songId: number, songIds: number[]) {
    setActiveSongId(songId);
    void loadBandSongEvents(slug, songIds);
  }

  function toggleBandSongs(slug: string, songIds: number[]) {
    setExpandedBands((previous) => ({
      ...previous,
      [slug]: !(previous[slug] ?? false),
    }));

    if (!(expandedBands[slug] ?? false)) {
      void loadBandSongEvents(slug, songIds);
    }
  }

  function toggleSongEvents(slug: string, songId: number, songIds: number[]) {
    void loadBandSongEvents(slug, songIds);
    setActiveSongId((previous) => (previous === songId ? null : songId));
  }

  function handleSongPointerEnter(
    event: ReactPointerEvent<HTMLDivElement>,
    slug: string,
    songId: number,
    songIds: number[],
  ) {
    if (event.pointerType !== "mouse") {
      return;
    }

    openSongEvents(slug, songId, songIds);
  }

  function handleSongPointerLeave(event: ReactPointerEvent<HTMLDivElement>, songId: number) {
    if (event.pointerType !== "mouse") {
      return;
    }

    setActiveSongId((previous) => (previous === songId ? null : previous));
  }

  function toggleEventUnlocks(eventernoteEventId: number) {
    setExpandedEvents((previous) => ({
      ...previous,
      [eventernoteEventId]: !(previous[eventernoteEventId] ?? false),
    }));
  }

  return {
    hideUnplayed,
    setHideUnplayed,
    hideVirtualBands,
    setHideVirtualBands,
    hideSonglessActivities,
    setHideSonglessActivities,
    expandedBands,
    expandedEvents,
    activeSongId,
    songEventsBySongId,
    loadedBands,
    loadingBands,
    stats,
    bandSummaries,
    attendedEventIds,
    bandSummaryColumns,
    totalProgressSegments,
    toggleBandSongs,
    toggleSongEvents,
    handleSongPointerEnter,
    handleSongPointerLeave,
    toggleEventUnlocks,
  };
}
