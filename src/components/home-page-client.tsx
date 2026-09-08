"use client";

import Link from "next/link";
import { readUserStatsCache, writeUserStatsCache } from "./home/user-stats-cache";
import {
  loadLiveSetlistDetail,
  loadRecentLiveSetlists,
  loadOnThisDayLiveSetlists,
  loadDefaultUserStats,
} from "./home/requests";
import { Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { LiveSetlistResult } from "@/components/live-setlist-result";
import {
  LiveSetlistSearch,
  type LiveSetlistSearchRestore,
} from "@/components/live-setlist-search";
import { RecentLiveSetlists } from "@/components/recent-live-setlists";
import { LocaleToggle } from "@/components/locale-toggle";
import { navPillLabel } from "@/components/nav-pill";
import { PublicFooter } from "@/components/public-footer";
import { RefreshWhileWarming } from "@/components/refresh-while-warming";
import { ResultsClient } from "@/components/results-client";
import { SearchForm } from "@/components/search-form";
import { SongsStatsNavLink } from "@/components/songs-stats-nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import type { EventVisibilityRules } from "@/lib/events/event-visibility";
import {
  clearStoredSuccessfulUserId,
  isValidEventernoteUserId,
  LAST_SUCCESSFUL_USER_ID_STORAGE_KEY,
  normalizeEventernoteUserCacheKey,
  normalizeEventernoteUserId,
  readStoredSuccessfulUserId,
} from "@/lib/eventernote/user-id";
import { getCopy, type Locale } from "@/lib/i18n";
import type { CopyDefinition } from "@/lib/i18n";
import {
  readStoredLiveSearch,
  storeLiveSearch,
} from "@/lib/live-setlist/history";
import type {
  LiveSetlist,
  RecentLiveSetlist,
} from "@/lib/live-setlist/types";
import {
  buildEmptyEventSearchHref,
  buildLiveSetlistHref,
} from "@/lib/live-setlist/url";
import { navigateToDemoHome } from "@/lib/navigate-demo-home";
import { clearAwaitFreshAfterCookie } from "@/lib/manual-refresh-navigation";
import { parsePublicPagePath } from "@/lib/public-page-path";
import { buildUserHref } from "@/lib/public-url";
import type { UserSongStatsResult } from "@/lib/stats/get-user-song-stats";

type HomePageClientProps = {
  locale: Locale;
  defaultUserId: string;
  demoUserId: string;
  invalidUserId: boolean;
  result: UserSongStatsResult | null;
  defaultHideUnplayed: boolean;
  defaultHideVirtualBands: boolean;
  defaultHideSonglessActivities: boolean;
  isAdminAuthenticated: boolean;
  eventVisibilityRules: EventVisibilityRules;
  defaultLive: LiveSetlist | null;
  recentLiveSetlists: RecentLiveSetlist[];
  onThisDayLiveSetlists: RecentLiveSetlist[];
  defaultSearchMode: SearchMode;
};

const refreshParamNames = ["refresh", "awaitFreshAfter"];
type SearchMode = "user" | "live";

function getWarmingMessage(copy: CopyDefinition, result: UserSongStatsResult | null) {
  if (result?.state !== "warming") {
    return copy.warmingDescription;
  }

  return result.reason === "initializing" ? copy.warmingCacheInit : copy.warmingCacheRefresh;
}

function WarmingTitle({ copy }: { copy: CopyDefinition }) {
  return (
    <h2 className="mt-2 inline-flex items-center gap-2 font-heading text-2xl font-semibold tracking-[-0.04em]">
      <span>{copy.warmingTitle}</span>
      <Loader2Icon className="h-5 w-5 animate-spin text-foreground" aria-hidden="true" />
    </h2>
  );
}

export function HomePageClient({
  locale,
  defaultUserId,
  demoUserId,
  invalidUserId,
  result,
  defaultHideUnplayed,
  defaultHideVirtualBands,
  defaultHideSonglessActivities,
  isAdminAuthenticated,
  eventVisibilityRules,
  defaultLive,
  recentLiveSetlists,
  onThisDayLiveSetlists,
  defaultSearchMode,
}: HomePageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const publicPagePath = parsePublicPagePath(pathname);
  const pathDefaultSearchMode =
    publicPagePath?.kind === "events" ||
    publicPagePath?.kind === "event"
      ? "live"
      : publicPagePath?.kind === "home" ||
          publicPagePath?.kind === "user"
        ? "user"
        : defaultSearchMode;
  const pathDefaultLive =
    publicPagePath?.kind === "event" &&
    defaultLive?.eventernoteEventId ===
      publicPagePath.eventernoteEventId
      ? defaultLive
      : null;
  const trimmedUserId = defaultUserId.trim();
  const [activeLocale, setActiveLocale] = useState(locale);
  const localeCopy = getCopy(activeLocale);
  const shouldLoadDefaultUser = !trimmedUserId && !result;
  const [isRestoringStoredUser] = useState(
    () =>
      defaultSearchMode === "user" &&
      shouldLoadDefaultUser &&
      isValidEventernoteUserId(readStoredSuccessfulUserId()),
  );
  const [defaultUserResult, setDefaultUserResult] = useState<UserSongStatsResult | null>(null);
  const [defaultUserLoading, setDefaultUserLoading] = useState(shouldLoadDefaultUser);
  // Client-side search mode state lets the tab switch render instantly;
  // the server navigation commits later and re-syncs the props below.
  const [searchMode, setSearchMode] = useState(pathDefaultSearchMode);
  const [pendingUserTarget, setPendingUserTarget] = useState<string | null>(null);
  const [selectedLive, setSelectedLive] =
    useState<LiveSetlist | null>(pathDefaultLive);
  const [showRecentLiveSetlists, setShowRecentLiveSetlists] =
    useState(publicPagePath?.kind === "events");
  const [availableRecentLiveSetlists, setAvailableRecentLiveSetlists] =
    useState(recentLiveSetlists);
  const [availableOnThisDayLiveSetlists, setAvailableOnThisDayLiveSetlists] =
    useState(onThisDayLiveSetlists);
  const [liveSearchRestore, setLiveSearchRestore] =
    useState<LiveSetlistSearchRestore>({
      revision: 0,
      query: "",
      live: null,
      detailStatus: "idle",
    });
  const seriesNavigationSequenceRef = useRef(0);
  const historyRestoreRevisionRef = useRef(0);
  const selectedLiveRef = useRef(selectedLive);

  // Adjust client state when the committed server props change
  // (render-time sync, see react.dev/learn/you-might-not-need-an-effect).
  const propsSyncKey = `${defaultSearchMode}:${defaultUserId}:${defaultLive?.eventernoteEventId ?? ""}`;
  const [lastPropsSyncKey, setLastPropsSyncKey] = useState(propsSyncKey);
  if (lastPropsSyncKey !== propsSyncKey) {
    setLastPropsSyncKey(propsSyncKey);
    setSearchMode(pathDefaultSearchMode);
    setPendingUserTarget(null);
    setSelectedLive(pathDefaultLive);
    setShowRecentLiveSetlists(publicPagePath?.kind === "events");
  }

  useEffect(() => {
    selectedLiveRef.current = selectedLive;
  }, [selectedLive]);

  useEffect(() => {
    function restoreLiveSearch(
      restore: Omit<LiveSetlistSearchRestore, "revision">,
    ) {
      historyRestoreRevisionRef.current += 1;
      setLiveSearchRestore({
        ...restore,
        revision: historyRestoreRevisionRef.current,
      });
    }

    function handlePopState() {
      const target = parsePublicPagePath(window.location.pathname);
      if (!target) return;

      const navigationSequence = ++seriesNavigationSequenceRef.current;

      if (target.kind === "events") {
        setSearchMode("live");
        setPendingUserTarget(null);
        setSelectedLive(null);
        setShowRecentLiveSetlists(true);
        restoreLiveSearch({
          query: "",
          live: null,
          detailStatus: "idle",
        });
        return;
      }

      if (target.kind === "event") {
        setSearchMode("live");
        setPendingUserTarget(null);
        setShowRecentLiveSetlists(false);

        const stored = readStoredLiveSearch();
        const currentLive = selectedLiveRef.current;
        const restoredLive =
          currentLive?.eventernoteEventId === target.eventernoteEventId
            ? currentLive
            : stored?.live.eventernoteEventId ===
                target.eventernoteEventId
              ? stored.live
              : null;
        const restoredQuery =
          stored?.live.eventernoteEventId === target.eventernoteEventId
            ? stored.query
            : (restoredLive?.title ?? "");

        if (restoredLive) {
          setSelectedLive(restoredLive);
          restoreLiveSearch({
            query: restoredQuery,
            live: restoredLive,
            detailStatus: "ready",
          });
          return;
        }

        setSelectedLive(null);
        restoreLiveSearch({
          query: "",
          live: null,
          detailStatus: "loading",
        });
        void loadLiveSetlistDetail(target.eventernoteEventId)
          .then((live) => {
            const activeTarget = parsePublicPagePath(
              window.location.pathname,
            );
            if (
              navigationSequence !==
                seriesNavigationSequenceRef.current ||
              activeTarget?.kind !== "event" ||
              activeTarget.eventernoteEventId !==
                target.eventernoteEventId
            ) {
              return;
            }

            storeLiveSearch(live.title, live);
            setSelectedLive(live);
            restoreLiveSearch({
              query: live.title,
              live,
              detailStatus: "ready",
            });
          })
          .catch((error) => {
            const activeTarget = parsePublicPagePath(
              window.location.pathname,
            );
            if (
              navigationSequence !==
                seriesNavigationSequenceRef.current ||
              activeTarget?.kind !== "event" ||
              activeTarget.eventernoteEventId !==
                target.eventernoteEventId
            ) {
              return;
            }
            console.error("Failed to restore live setlist history", error);
            restoreLiveSearch({
              query: "",
              live: null,
              detailStatus: "error",
            });
          });
        return;
      }

      setSearchMode("user");
      setShowRecentLiveSetlists(false);
      if (target.kind === "home") {
        setPendingUserTarget(null);
        return;
      }

      const normalizedUserId = normalizeEventernoteUserId(target.userId);
      setPendingUserTarget(
        isValidEventernoteUserId(normalizedUserId)
          ? normalizedUserId
          : null,
      );
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleSearchModeChange(mode: SearchMode) {
    if (mode === searchMode) {
      return;
    }

    setSearchMode(mode);

    if (mode === "live") {
      setPendingUserTarget(null);
      const storedLive =
        selectedLive ?? readStoredLiveSearch()?.live ?? null;
      setSelectedLive(storedLive);
      setShowRecentLiveSetlists(storedLive === null);
      window.history.pushState(
        null,
        "",
        storedLive
          ? buildLiveSetlistHref(storedLive.eventernoteEventId)
          : buildEmptyEventSearchHref(),
      );
      return;
    }

    const storedUserId =
      trimmedUserId || readStoredSuccessfulUserId();
    const normalizedStoredUserId = normalizeEventernoteUserId(storedUserId);
    const hasValidStoredUser = isValidEventernoteUserId(normalizedStoredUserId);
    const shouldUseDefaultUser =
      !hasValidStoredUser ||
      normalizeEventernoteUserCacheKey(normalizedStoredUserId) ===
        normalizeEventernoteUserCacheKey(demoUserId);
    setPendingUserTarget(
      shouldUseDefaultUser ? null : normalizedStoredUserId,
    );

    if (shouldUseDefaultUser) {
      // The default user is already being loaded in this client shell while
      // the activity view is visible. Keep that state alive instead of
      // remounting the shell through an App Router navigation, which would
      // briefly restore its loading state before reading the session cache.
      clearStoredSuccessfulUserId();
      window.history.pushState(null, "", "/");
      return;
    }

    router.push(
      buildUserHref(normalizedStoredUserId),
      { scroll: false },
    );
  }

  function prefetchSeriesLive(eventernoteEventId: number) {
    if (eventernoteEventId === selectedLive?.eventernoteEventId) {
      return;
    }
    void loadLiveSetlistDetail(eventernoteEventId).catch(() => {});
  }

  async function handleSeriesLiveChange(eventernoteEventId: number) {
    if (eventernoteEventId === selectedLive?.eventernoteEventId) {
      return true;
    }

    const navigationSequence = ++seriesNavigationSequenceRef.current;
    try {
      const live = await loadLiveSetlistDetail(eventernoteEventId);
      if (navigationSequence !== seriesNavigationSequenceRef.current) {
        return false;
      }

      const storedQuery =
        readStoredLiveSearch()?.query ?? selectedLive?.title ?? live.title;
      storeLiveSearch(storedQuery, live);
      setSelectedLive(live);

      const url = new URL(window.location.href);
      url.pathname = buildLiveSetlistHref(eventernoteEventId);
      url.search = "";
      window.history.replaceState(null, "", `${url.pathname}${url.hash}`);
      return true;
    } catch (error) {
      console.error("Failed to switch live setlist", error);
      return false;
    }
  }

  function resetToDemoHome(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    navigateToDemoHome();
  }

  useEffect(() => {
    if (!shouldLoadDefaultUser) {
      return;
    }

    const controller = new AbortController();
    const storedUserId = readStoredSuccessfulUserId();

    if (isValidEventernoteUserId(storedUserId)) {
      if (defaultSearchMode === "user") {
        router.replace(
          buildUserHref(storedUserId),
          { scroll: false },
        );
        return () => controller.abort();
      }
    } else {
      clearStoredSuccessfulUserId();
    }

    const cachedDefaultUserResult = readUserStatsCache(demoUserId);
    if (cachedDefaultUserResult) {
      // The demo user stats were already loaded in this tab session;
      // show them instantly instead of refetching on every remount.
      const frame = window.requestAnimationFrame(() => {
        setDefaultUserResult(cachedDefaultUserResult);
        setDefaultUserLoading(false);
      });
      return () => {
        controller.abort();
        window.cancelAnimationFrame(frame);
      };
    }

    loadDefaultUserStats(controller.signal)
      .then((data) => setDefaultUserResult(data))
      .catch(() => {})
      .finally(() => setDefaultUserLoading(false));

    return () => controller.abort();
  }, [defaultSearchMode, demoUserId, router, shouldLoadDefaultUser]);

  const displayResult = result ?? defaultUserResult;

  useEffect(() => {
    if (result?.state === "ok") {
      writeUserStatsCache(result);
    }
  }, [result]);

  useEffect(() => {
    if (defaultUserResult?.state === "ok") {
      writeUserStatsCache(defaultUserResult);
    }
  }, [defaultUserResult]);

  useEffect(() => {
    if (availableRecentLiveSetlists.length > 0) {
      return;
    }

    let cancelled = false;
    void loadRecentLiveSetlists()
      .then((events) => {
        if (!cancelled) {
          setAvailableRecentLiveSetlists(events);
        }
      })
      .catch((error) => {
        console.error("Failed to load recent live setlists", error);
      });

    return () => {
      cancelled = true;
    };
  }, [availableRecentLiveSetlists.length]);

  useEffect(() => {
    if (availableOnThisDayLiveSetlists.length > 0) {
      return;
    }

    let cancelled = false;
    void loadOnThisDayLiveSetlists()
      .then((events) => {
        if (!cancelled) {
          setAvailableOnThisDayLiveSetlists(events);
        }
      })
      .catch((error) => {
        console.error("Failed to load on-this-day live setlists", error);
      });

    return () => {
      cancelled = true;
    };
  }, [availableOnThisDayLiveSetlists.length]);

  // While a user-mode navigation is in flight, only render stats that
  // already match the target user; otherwise fall back to the session
  // cache for an instant render, and only then to a loading state.
  const pendingUserStatsMatch =
    pendingUserTarget !== null &&
    displayResult?.state === "ok" &&
    normalizeEventernoteUserId(displayResult.userId).toLowerCase() ===
      pendingUserTarget.toLowerCase();
  const optimisticUserStats =
    pendingUserTarget === null || pendingUserStatsMatch
      ? null
      : readUserStatsCache(pendingUserTarget);
  const userStatsPending =
    pendingUserTarget !== null &&
    !pendingUserStatsMatch &&
    optimisticUserStats === null;

  useEffect(() => {
    if (!trimmedUserId || !displayResult || displayResult.state === "warming") {
      return;
    }

    document.cookie = clearAwaitFreshAfterCookie();
    if (displayResult.state === "ok") {
      try {
        window.localStorage.setItem(LAST_SUCCESSFUL_USER_ID_STORAGE_KEY, displayResult.userId);
      } catch {
        // Storage may be disabled by the browser.
      }
    }
  }, [displayResult, trimmedUserId]);

  useEffect(() => {
    document.title = localeCopy.metadataTitle;
  }, [localeCopy.metadataTitle]);

  return (
    <>
      <nav id="page-top" className="sticky top-0 z-50 border-b border-border-soft bg-background/85 backdrop-blur-xl">
        <div className="@container/nav-bar mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              onClick={resetToDemoHome}
              className="min-w-0 truncate font-heading text-lg font-semibold tracking-[-0.04em] hover:text-accent"
            >
              <span className="sm:hidden">{localeCopy.navTitleMobile}</span>
              <span className="hidden sm:inline">{localeCopy.navTitleDesktop}</span>
            </Link>
            <SongsStatsNavLink copy={localeCopy} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isAdminAuthenticated ? (
              <Link href="/admin" className={navPillLabel}>
                {localeCopy.adminNav}
              </Link>
            ) : null}
            <LocaleToggle locale={activeLocale} onLocaleChange={setActiveLocale} />
            <ThemeToggle copy={localeCopy} />
          </div>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-8">
        <section id="search" className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2">
              <div className="min-w-0">
                <h1
                  className="whitespace-nowrap font-heading text-2xl font-semibold tracking-[-0.04em] sm:text-3xl"
                >
                  {searchMode === "user" ? (
                    <a
                      href="https://www.eventernote.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="transition hover:text-accent"
                    >
                      {localeCopy.searchSectionTitle}
                    </a>
                  ) : (
                    localeCopy.liveSearchSectionTitle
                  )}
                </h1>
              </div>
              <div
                role="radiogroup"
                aria-label={localeCopy.searchModeAria}
                className="inline-flex h-8 shrink-0 items-center rounded-full border border-border-soft bg-panel-strong p-0.5"
              >
                {(["user", "live"] as const).map((mode) => {
                  const active = searchMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`inline-flex h-7 items-center justify-center rounded-full px-2 text-sm font-medium leading-none sm:px-3 ${
                        active
                          ? "bg-foreground text-background shadow-sm"
                          : "text-ink-soft hover:text-foreground"
                      }`}
                      onClick={() => handleSearchModeChange(mode)}
                    >
                      {mode === "user"
                        ? localeCopy.searchModeUser
                        : localeCopy.searchModeLive}
                    </button>
                  );
                })}
              </div>
            </div>
            <Activity mode={searchMode === "user" ? "visible" : "hidden"}>
              <SearchForm
                key={pendingUserTarget ?? defaultUserId}
                defaultUserId={pendingUserTarget ?? defaultUserId}
                copy={localeCopy}
              />
            </Activity>
            <Activity mode={searchMode === "live" ? "visible" : "hidden"}>
              <LiveSetlistSearch
                defaultLive={pathDefaultLive}
                historyRestore={liveSearchRestore}
                copy={localeCopy}
                onResultChange={setSelectedLive}
                onEmptyStateChange={setShowRecentLiveSetlists}
              />
            </Activity>
          </div>
        </section>

        {/* Loaded song-event state belongs to one setlist only. */}
        <Activity mode={searchMode === "live" ? "visible" : "hidden"}>
          {selectedLive ? (
            <LiveSetlistResult
              key={selectedLive.eventernoteEventId}
              live={selectedLive}
              copy={localeCopy}
              onNavigateToLive={handleSeriesLiveChange}
              onPrefetchLive={prefetchSeriesLive}
            />
          ) : showRecentLiveSetlists ? (
            <>
              <RecentLiveSetlists
                events={availableOnThisDayLiveSetlists}
                copy={localeCopy}
                title={localeCopy.onThisDaySetlistsTitle}
              />
              <RecentLiveSetlists
                events={availableRecentLiveSetlists}
                copy={localeCopy}
              />
            </>
          ) : null}
        </Activity>

        <Activity mode={searchMode === "user" ? "visible" : "hidden"}>
          {pendingUserTarget === null && !trimmedUserId && displayResult ? (
            <p className="mt-4 text-center text-sm text-ink-soft">
              {localeCopy.demoPrefix}
              <span className="font-medium text-foreground">
                {localeCopy.demoLinkLabel}
              </span>
              {localeCopy.demoSuffix}
            </p>
          ) : null}

          <div className="mt-8">
            {optimisticUserStats ? (
                <ResultsClient
                  userId={optimisticUserStats.userId}
                  displayName={optimisticUserStats.displayName}
                  songs={optimisticUserStats.songs}
                  matchedEvents={optimisticUserStats.matchedEvents}
                  defaultHideUnplayed={defaultHideUnplayed}
                  defaultHideVirtualBands={defaultHideVirtualBands}
                  defaultHideSonglessActivities={defaultHideSonglessActivities}
                  eventVisibilityRules={eventVisibilityRules}
                  copy={localeCopy}
                />
              ) : userStatsPending ? (
                <section className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
                  <WarmingTitle copy={localeCopy} />
                  <p className="mt-3 max-w-3xl text-base leading-8 text-ink-soft">
                    {localeCopy.warmingDescription}
                  </p>
                </section>
              ) : invalidUserId ? (
                <section className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
                  <p className="text-sm text-ink-soft">
                    {localeCopy.resultSectionLabel}
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.04em]">
                    {localeCopy.invalidUserIdTitle}
                  </h2>
                  <p className="mt-3 max-w-3xl text-base leading-8 text-ink-soft">
                    {localeCopy.invalidUserIdMessage}
                  </p>
                </section>
              ) : !trimmedUserId && defaultUserLoading ? (
                <section className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
                  <WarmingTitle copy={localeCopy} />
                  <p className="mt-3 max-w-3xl text-base leading-8 text-ink-soft">
                    {isRestoringStoredUser
                      ? localeCopy.restoringUserDescription
                      : localeCopy.warmingDescription}
                  </p>
                </section>
              ) : !displayResult ? null : displayResult.state === "ok" ? (
                <>
                  <ResultsClient
                    userId={displayResult.userId}
                    displayName={displayResult.displayName}
                    songs={displayResult.songs}
                    matchedEvents={displayResult.matchedEvents}
                    defaultHideUnplayed={defaultHideUnplayed}
                    defaultHideVirtualBands={defaultHideVirtualBands}
                    defaultHideSonglessActivities={defaultHideSonglessActivities}
                    eventVisibilityRules={eventVisibilityRules}
                    copy={localeCopy}
                  />
                  {displayResult.staleCacheUsed ? (
                    <RefreshWhileWarming
                      enabled
                      userId={trimmedUserId || displayResult.userId}
                      removeParamNames={refreshParamNames}
                      maxAttempts={40}
                    />
                  ) : null}
                </>
              ) : displayResult.state === "warming" ? (
                <>
                  <section className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
                    <WarmingTitle copy={localeCopy} />
                    <p className="mt-3 max-w-3xl text-base leading-8 text-ink-soft">
                      {getWarmingMessage(localeCopy, displayResult)}
                    </p>
                    <p className="mt-2 text-sm text-ink-soft">
                      {localeCopy.warmingAutoRefresh}
                    </p>
                  </section>
                  <RefreshWhileWarming
                    enabled
                    userId={trimmedUserId || displayResult.userId}
                    removeParamNames={refreshParamNames}
                    maxAttempts={40}
                  />
                </>
              ) : (
                <section className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
                  <p className="text-sm text-ink-soft">
                    {localeCopy.resultSectionLabel}
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.04em]">
                    {displayResult.state === "not-found"
                      ? localeCopy.notFoundTitle
                      : displayResult.state === "config-error"
                        ? localeCopy.configErrorTitle
                        : localeCopy.upstreamErrorTitle}
                  </h2>
                  <p className="mt-3 max-w-3xl text-base leading-8 text-ink-soft">
                    {displayResult.state === "not-found"
                      ? localeCopy.notFoundMessage(displayResult.userId)
                      : displayResult.state === "config-error"
                        ? localeCopy.configErrorMessage
                        : localeCopy.upstreamErrorMessage}
                  </p>
                </section>
            )}
          </div>
        </Activity>
      </main>
      <PublicFooter copy={localeCopy} />
    </>
  );
}
