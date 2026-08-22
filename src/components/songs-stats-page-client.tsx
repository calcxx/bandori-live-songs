"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEvent,
  type MouseEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LocaleToggle } from "@/components/locale-toggle";
import { navPillLabel } from "@/components/nav-pill";
import { PublicFooter } from "@/components/public-footer";
import { SongsStatsNavLink } from "@/components/songs-stats-nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BAND_SEEDS,
  getBandSupportColor,
  getBandTextColor,
} from "@/lib/constants/bands";
import { getCopy, type Locale } from "@/lib/i18n";
import { buildLiveSetlistHref } from "@/lib/live-setlist/url";
import { matchesSongTitleSearch } from "@/lib/music/song-search";
import { formatSongTitleForDisplay, normalizeQuotesForDisplay } from "@/lib/music/title-utils";
import type { SongEventReference } from "@/lib/stats/aggregate";
import type {
  SongPerformanceStat,
  SongStatsEventCounts,
} from "@/lib/stats/song-performance-stats";

const allBandsValue = "all";

type SortColumn = "performanceCount" | "firstReleaseDate";
type SortDirection = "asc" | "desc";

function compareNullableDates(
  left: string | null,
  right: string | null,
) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function compareText(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function SongsStatsPageClient({
  locale,
  stats,
  eventCounts,
  initialBandSlug,
  initialSearchQuery,
  releasedThroughDate,
  isAdminAuthenticated,
}: {
  locale: Locale;
  stats: SongPerformanceStat[];
  eventCounts: SongStatsEventCounts;
  initialBandSlug: string;
  initialSearchQuery: string;
  releasedThroughDate: string;
  isAdminAuthenticated: boolean;
}) {
  const [activeLocale, setActiveLocale] = useState(locale);
  const [activeBandSlug, setActiveBandSlug] = useState(initialBandSlug);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [sortColumn, setSortColumn] =
    useState<SortColumn>("performanceCount");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");
  const [songEventsBySongId, setSongEventsBySongId] = useState<
    Record<number, SongEventReference[]>
  >({});
  const [loadedSongIds, setLoadedSongIds] = useState<
    Record<number, boolean>
  >({});
  const [loadingSongIds, setLoadingSongIds] = useState<
    Record<number, boolean>
  >({});
  const copy = getCopy(activeLocale);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const availableBandSlugs = useMemo(
    () =>
      new Set(
        stats.flatMap((song) =>
          song.category === "original" && song.bandSlug
            ? [song.bandSlug]
            : [],
        ),
      ),
    [stats],
  );
  const bandOptions = useMemo(
    () =>
      BAND_SEEDS.filter(
        (band) =>
          band.groupType === "band" &&
          availableBandSlugs.has(band.slug),
      ),
    [availableBandSlugs],
  );
  const visibleStats = useMemo(() => {
    const bandFilteredStats =
      activeBandSlug === allBandsValue
        ? stats
        : stats.filter(
            (song) =>
              song.category === "original" &&
              song.bandSlug === activeBandSlug,
          );
    const filteredStats = deferredSearchQuery
      ? bandFilteredStats.filter((song) =>
          matchesSongTitleSearch(song.title, deferredSearchQuery),
        )
      : bandFilteredStats.filter(
          (song) =>
            song.category === "original" &&
            song.firstReleaseDate !== null &&
            song.firstReleaseDate <= releasedThroughDate,
        );

    return [...filteredStats].sort((left, right) => {
      if (
        sortColumn === "firstReleaseDate" &&
        (left.firstReleaseDate === null ||
          right.firstReleaseDate === null)
      ) {
        if (left.firstReleaseDate === right.firstReleaseDate) return 0;
        return left.firstReleaseDate === null ? 1 : -1;
      }

      const valueDelta =
        sortColumn === "performanceCount"
          ? left.performanceCount - right.performanceCount
          : compareNullableDates(
              left.firstReleaseDate,
              right.firstReleaseDate,
            );

      if (valueDelta !== 0) {
        return sortDirection === "asc" ? valueDelta : -valueDelta;
      }

      if (sortColumn === "performanceCount") {
        const releaseDateDelta =
          compareNullableDates(
            left.firstReleaseDate,
            right.firstReleaseDate,
          );
        if (releaseDateDelta !== 0) return releaseDateDelta;
      }

      return compareText(left.title, right.title);
    });
  }, [
    activeBandSlug,
    deferredSearchQuery,
    releasedThroughDate,
    sortColumn,
    sortDirection,
    stats,
  ]);
  const recordedEventCount =
    activeBandSlug === allBandsValue
      ? eventCounts.all
      : (eventCounts.byBandSlug[activeBandSlug] ?? 0);

  useEffect(() => {
    document.title = `${copy.songStatsTitle} | ${copy.navTitleDesktop}`;
  }, [copy.navTitleDesktop, copy.songStatsTitle]);

  function updateUrl(slug: string, query: string) {
    const params = new URLSearchParams();
    if (slug !== allBandsValue) {
      params.set("band", slug);
    }
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `/songs?${search}` : "/songs",
    );
  }

  function selectBand(slug: string) {
    setActiveBandSlug(slug);
    setSearchQuery("");
    setActiveSongId(null);
    updateUrl(slug, "");
  }

  function updateSearchQuery(query: string) {
    setSearchQuery(query);
    setActiveBandSlug(allBandsValue);
    setActiveSongId(null);
    updateUrl(allBandsValue, query);
  }

  function toggleSort(column: SortColumn) {
    setActiveSongId(null);
    if (sortColumn === column) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortColumn(column);
    setSortDirection("desc");
  }

  function renderSortIcon(column: SortColumn) {
    if (sortColumn !== column) {
      return (
        <ArrowUpDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
      );
    }

    return sortDirection === "asc" ? (
      <ArrowUpIcon className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <ArrowDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
    );
  }

  async function loadSongEvents(songId: number) {
    if (loadedSongIds[songId] || loadingSongIds[songId]) {
      return;
    }

    setLoadingSongIds((previous) => ({
      ...previous,
      [songId]: true,
    }));
    try {
      const response = await fetch(
        `/api/song-events?songIds=${songId}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as {
        songEventsBySongId: Record<string, SongEventReference[]>;
      };
      setSongEventsBySongId((previous) => ({
        ...previous,
        [songId]: payload.songEventsBySongId[String(songId)] ?? [],
      }));
      setLoadedSongIds((previous) => ({
        ...previous,
        [songId]: true,
      }));
    } catch (error) {
      console.error("Failed to load song events", error);
    } finally {
      setLoadingSongIds((previous) => ({
        ...previous,
        [songId]: false,
      }));
    }
  }

  function toggleSongEvents(song: SongPerformanceStat) {
    if (song.performanceCount === 0) return;
    void loadSongEvents(song.id);
    setActiveSongId((current) =>
      current === song.id ? null : song.id,
    );
  }

  function handleSongRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    song: SongPerformanceStat,
  ) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleSongEvents(song);
  }

  function handleSongRowClick(
    event: MouseEvent<HTMLTableRowElement>,
    song: SongPerformanceStat,
  ) {
    const target = event.target as Element;
    if (target.closest("[data-song-events-popover]")) return;
    toggleSongEvents(song);
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border-soft bg-background/85 backdrop-blur-xl">
        <div className="@container/nav-bar mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              className="min-w-0 truncate font-heading text-lg font-semibold tracking-[-0.04em] hover:text-accent"
            >
              <span className="sm:hidden">{copy.navTitleMobile}</span>
              <span className="hidden sm:inline">{copy.navTitleDesktop}</span>
            </Link>
            <SongsStatsNavLink copy={copy} active />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isAdminAuthenticated ? (
              <Link href="/admin" className={navPillLabel}>
                {copy.adminNav}
              </Link>
            ) : null}
            <LocaleToggle
              locale={activeLocale}
              onLocaleChange={setActiveLocale}
            />
            <ThemeToggle copy={copy} />
          </div>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-8">
        <section>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {copy.songStatsTitle}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {copy.songStatsDescription}
          </p>
        </section>

        <section
          className="mt-6 flex flex-wrap gap-2"
          aria-label={copy.songStatsNav}
        >
          <button
            type="button"
            aria-pressed={activeBandSlug === allBandsValue}
            onClick={() => selectBand(allBandsValue)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              activeBandSlug === allBandsValue
                ? "border-foreground bg-foreground text-background"
                : "border-border-soft bg-panel text-ink-soft hover:border-foreground hover:text-foreground"
            }`}
          >
            {copy.songStatsAllBands}
          </button>
          {bandOptions.map((band) => {
            const active = activeBandSlug === band.slug;
            const supportColor =
              getBandSupportColor(band.slug) ?? "var(--accent)";
            const textColor =
              getBandTextColor(band.slug) ?? supportColor;
            const displayName =
              band.slug === "hello-happy-world"
                ? "Hello, Happy World!"
                : band.nameJa;

            return (
              <button
                key={band.slug}
                type="button"
                aria-pressed={active}
                onClick={() => selectBand(band.slug)}
                className="rounded-full border bg-panel px-3 py-1.5 text-sm transition hover:bg-panel-strong"
                style={{
                  borderColor: active ? supportColor : "var(--border)",
                  color: active ? textColor : "var(--ink-soft)",
                  backgroundColor: active
                    ? `color-mix(in srgb, ${supportColor} 7%, transparent)`
                    : "var(--panel)",
                }}
              >
                {displayName}
              </button>
            );
          })}
        </section>

        <div className="relative mt-5">
          <label htmlFor="song-search" className="sr-only">
            {copy.songStatsSearchInputLabel}
          </label>
          <SearchIcon
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <input
            id="song-search"
            type="search"
            value={searchQuery}
            onChange={(event) => updateSearchQuery(event.target.value)}
            autoComplete="off"
            placeholder={copy.songStatsSearchPlaceholder}
            className="min-h-12 w-full rounded-[1.15rem] border border-border-soft bg-panel px-11 pr-12 text-base outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {searchQuery.length > 0 ? (
            <button
              type="button"
              aria-label={copy.songStatsSearchClearAria}
              onClick={() => updateSearchQuery("")}
              className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft transition hover:bg-panel-strong hover:text-foreground"
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <p
          className="mt-4 flex items-baseline gap-2 text-sm text-ink-soft"
          aria-live="polite"
        >
          <span>
            {deferredSearchQuery
              ? copy.songStatsSearchResultsLabel
              : copy.songStatsRecordedEventsLabel}
          </span>
          <strong className="font-medium tabular-nums text-foreground">
            {deferredSearchQuery
              ? visibleStats.length
              : recordedEventCount}
          </strong>
          <span>
            {deferredSearchQuery
              ? copy.songStatsSearchResultsUnit
              : copy.songStatsRecordedEventsUnit}
          </span>
        </p>

        <section className="mt-3 rounded-[1.15rem] border border-border-soft bg-panel">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border-soft bg-panel-strong text-xs text-ink-soft">
              <tr>
                <th
                  scope="col"
                  className="rounded-tl-[1.1rem] px-4 py-3 font-medium sm:px-5"
                >
                  {copy.songStatsSongColumn}
                </th>
                <th
                  scope="col"
                  className="w-16 px-2 py-3 text-right font-medium sm:w-20 sm:px-4"
                  aria-sort={
                    sortColumn === "performanceCount"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("performanceCount")}
                    className="ml-auto inline-flex items-center gap-1 transition hover:text-foreground"
                  >
                    <span>{copy.songStatsCountColumn}</span>
                    {renderSortIcon("performanceCount")}
                  </button>
                </th>
                <th
                  scope="col"
                  className="w-32 rounded-tr-[1.1rem] px-4 py-3 text-right font-medium sm:w-40 sm:px-5"
                  aria-sort={
                    sortColumn === "firstReleaseDate"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("firstReleaseDate")}
                    className="ml-auto inline-flex items-center gap-1 transition hover:text-foreground"
                  >
                    <span>{copy.songStatsReleaseDateColumn}</span>
                    {renderSortIcon("firstReleaseDate")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {visibleStats.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-sm text-ink-soft sm:px-5"
                  >
                    {copy.songStatsSearchEmpty}
                  </td>
                </tr>
              ) : null}
              {visibleStats.map((song) => {
                const textColor =
                  (song.bandSlug
                    ? getBandTextColor(song.bandSlug)
                    : null) ?? "var(--foreground)";
                const isActive = activeSongId === song.id;
                const relatedEvents =
                  songEventsBySongId[song.id] ?? [];
                const eventsLoaded = loadedSongIds[song.id] ?? false;
                const eventsLoading =
                  loadingSongIds[song.id] ?? false;

                return (
                  <tr
                    key={song.id}
                    role={
                      song.performanceCount > 0 ? "button" : undefined
                    }
                    tabIndex={song.performanceCount > 0 ? 0 : undefined}
                    aria-expanded={
                      song.performanceCount > 0 ? isActive : undefined
                    }
                    aria-controls={
                      song.performanceCount > 0
                        ? `song-events-${song.id}`
                        : undefined
                    }
                    onClick={
                      song.performanceCount > 0
                        ? (event) => handleSongRowClick(event, song)
                        : undefined
                    }
                    onKeyDown={
                      song.performanceCount > 0
                        ? (event) =>
                            handleSongRowKeyDown(event, song)
                        : undefined
                    }
                    className="transition hover:bg-panel-strong data-[interactive=true]:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    data-interactive={song.performanceCount > 0}
                  >
                    <td className="relative min-w-0 px-4 py-2.5 font-medium sm:px-5">
                      <span
                        className="min-w-0 text-left"
                        style={{ color: textColor }}
                      >
                        {formatSongTitleForDisplay(song.title)}
                      </span>
                      {song.category === "cover" ? (
                        <span className="ml-2 inline-flex rounded-full border border-border-soft px-1.5 py-0.5 align-middle text-[0.65rem] font-normal leading-none text-ink-soft">
                          {copy.coverSongBadge}
                        </span>
                      ) : null}
                      {isActive ? (
                        <div
                          id={`song-events-${song.id}`}
                          data-song-events-popover
                          className="absolute left-0 top-full z-20 mt-2 w-[calc(100vw-2rem)] max-w-[calc(64rem-2rem)] rounded-[1rem] border border-border-soft bg-panel px-3 py-3 text-left font-normal text-foreground shadow-lg sm:w-[calc(100vw-4rem)] sm:max-w-[calc(64rem-4rem)]"
                        >
                          <button
                            type="button"
                            aria-label={copy.closeSongEventsAria}
                            onClick={() => setActiveSongId(null)}
                            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-soft text-ink-soft transition hover:border-foreground hover:text-foreground"
                          >
                            <XIcon
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </button>
                          {relatedEvents.length > 0 ? (
                            <>
                              {song.firstReleaseDate ? (
                                <p className="text-xs text-ink-soft">
                                  {copy.releaseDateLabel(
                                    song.firstReleaseDate,
                                  )}
                                </p>
                              ) : null}
                              <p
                                className={`${song.firstReleaseDate ? "mt-1.5" : ""} text-xs text-ink-soft`}
                              >
                                {copy.relatedEventsLabel(
                                  relatedEvents.length,
                                )}
                              </p>
                              <div className="mt-1.5 space-y-1.5">
                                {relatedEvents.map((event) => (
                                  <Link
                                    key={`${song.id}-${event.eventernoteEventId}`}
                                    href={buildLiveSetlistHref(
                                      event.eventernoteEventId,
                                    )}
                                    className="block text-sm leading-5 transition hover:text-accent"
                                  >
                                    <span className="font-medium">
                                      {event.eventDate}
                                    </span>
                                    <span className="mx-1.5 text-ink-soft">
                                      ·
                                    </span>
                                    <span>
                                      {normalizeQuotesForDisplay(event.title)}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </>
                          ) : !eventsLoaded || eventsLoading ? (
                            <p className="text-sm text-ink-soft">
                              {copy.loadingEvents}
                            </p>
                          ) : (
                            <p className="text-sm text-ink-soft">
                              {copy.noSongEvents}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-foreground sm:px-4">
                      {song.performanceCount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink-soft sm:px-5">
                      {song.firstReleaseDate ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
      <PublicFooter copy={copy} />
    </>
  );
}
