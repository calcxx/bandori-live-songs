"use client";

import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { navPillLabel } from "@/components/nav-pill";
import { RefreshWhileWarming } from "@/components/refresh-while-warming";
import { ResultsClient } from "@/components/results-client";
import { SearchForm } from "@/components/search-form";
import { ThemeToggle } from "@/components/theme-toggle";
import type { EventVisibilityRules } from "@/lib/events/event-visibility";
import {
  clearStoredSuccessfulUserId,
  isValidEventernoteUserId,
  LAST_SUCCESSFUL_USER_ID_STORAGE_KEY,
  readStoredSuccessfulUserId,
} from "@/lib/eventernote/user-id";
import { cnCopy } from "@/lib/i18n/cn";
import { navigateToDemoHome } from "@/lib/navigate-demo-home";
import { clearAwaitFreshAfterCookie } from "@/lib/manual-refresh-navigation";
import type { UserSongStatsResult } from "@/lib/stats/get-user-song-stats";

type HomePageClientProps = {
  defaultUserId: string;
  demoUserId: string;
  invalidUserId: boolean;
  result: UserSongStatsResult | null;
  defaultHideUnplayed: boolean;
  defaultHideVirtualBands: boolean;
  defaultHideSonglessActivities: boolean;
  isAdminAuthenticated: boolean;
  eventVisibilityRules: EventVisibilityRules;
};

const refreshParamNames = ["refresh", "awaitFreshAfter"];

function loadDefaultUserStats(signal?: AbortSignal) {
  return fetch("/api/default-user-stats", { signal }).then(
    (res) => res.json() as Promise<UserSongStatsResult>,
  );
}

function getWarmingMessage(copy: typeof cnCopy, result: UserSongStatsResult | null) {
  if (result?.state !== "warming") {
    return copy.warmingDescription;
  }

  return result.message.includes("初期化") ? copy.warmingCacheInit : copy.warmingCacheRefresh;
}

function WarmingTitle() {
  return (
    <h2 className="mt-2 inline-flex items-center gap-2 font-heading text-2xl font-semibold tracking-[-0.04em]">
      <span>{cnCopy.warmingTitle}</span>
      <Loader2Icon className="h-5 w-5 animate-spin text-foreground" aria-hidden="true" />
    </h2>
  );
}

export function HomePageClient({
  defaultUserId,
  demoUserId,
  invalidUserId,
  result,
  defaultHideUnplayed,
  defaultHideVirtualBands,
  defaultHideSonglessActivities,
  isAdminAuthenticated,
  eventVisibilityRules,
}: HomePageClientProps) {
  const router = useRouter();
  const trimmedUserId = defaultUserId.trim();
  const localeCopy = cnCopy;
  const hasDemoUser = demoUserId.length > 0;
  const shouldLoadDefaultUser = hasDemoUser && !trimmedUserId && !result;
  const [isRestoringStoredUser] = useState(
    () => shouldLoadDefaultUser && isValidEventernoteUserId(readStoredSuccessfulUserId()),
  );
  const [defaultUserResult, setDefaultUserResult] = useState<UserSongStatsResult | null>(null);
  const [defaultUserLoading, setDefaultUserLoading] = useState(shouldLoadDefaultUser);

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
      router.replace(`/?userId=${encodeURIComponent(storedUserId)}`, { scroll: false });
      return () => controller.abort();
    }

    clearStoredSuccessfulUserId();

    loadDefaultUserStats(controller.signal)
      .then((data) => setDefaultUserResult(data))
      .catch(() => {})
      .finally(() => setDefaultUserLoading(false));

    return () => controller.abort();
  }, [router, shouldLoadDefaultUser]);

  const displayResult = result ?? defaultUserResult;

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

  return (
    <>
      <nav id="page-top" className="sticky top-0 z-50 border-b border-border-soft bg-background/85 backdrop-blur-xl">
        <div className="@container/nav-bar mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-8">
          <Link
            href="/"
            onClick={resetToDemoHome}
            className="min-w-0 truncate font-heading text-lg font-semibold tracking-[-0.04em] hover:text-accent"
          >
            <span className="sm:hidden">{localeCopy.navTitleMobile}</span>
            <span className="hidden sm:inline">{localeCopy.navTitleDesktop}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isAdminAuthenticated ? (
              <Link href="/admin" className={navPillLabel}>
                管理
              </Link>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-8">
        <section id="search" className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-5 sm:px-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
                  <a
                    href="https://www.eventernote.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-accent"
                  >
                    {localeCopy.searchSectionTitle}
                  </a>
                </h1>
              </div>
            </div>
            <SearchForm key={defaultUserId} defaultUserId={defaultUserId} />
          </div>
        </section>

        {!trimmedUserId && hasDemoUser && displayResult ? (
          <p className="mt-4 text-center text-sm text-ink-soft">
            以下展示的是
            <a
              href={`https://www.eventernote.com/bd/user/${encodeURIComponent(demoUserId)}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground transition hover:text-accent"
            >
              示例用户
            </a>
            的数据。
          </p>
        ) : null}

        <div className="mt-8">
          {invalidUserId ? (
            <section className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
              <p className="text-sm text-ink-soft">{localeCopy.resultSectionLabel}</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.04em]">
                {localeCopy.invalidUserIdTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-8 text-ink-soft">
                {localeCopy.invalidUserIdMessage}
              </p>
            </section>
          ) : !trimmedUserId && defaultUserLoading ? (
            <section className="rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
              <WarmingTitle />
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
                <WarmingTitle />
                <p className="mt-3 max-w-3xl text-base leading-8 text-ink-soft">
                  {getWarmingMessage(localeCopy, displayResult)}
                </p>
                <p className="mt-2 text-sm text-ink-soft">{localeCopy.warmingAutoRefresh}</p>
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
              <p className="text-sm text-ink-soft">{localeCopy.resultSectionLabel}</p>
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
      </main>
    </>
  );
}
