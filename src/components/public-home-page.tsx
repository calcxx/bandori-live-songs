import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { HomePageClient } from "@/components/home-page-client";
import { adminAuthCookieName, verifyAdminAuthToken } from "@/lib/admin/auth";
import {
  getDefaultUserId,
  isValidEventernoteUserId,
  normalizeEventernoteUserId,
} from "@/lib/eventernote/user-id";
import { readEventVisibilityRules } from "@/lib/events/event-visibility-rules-store";
import {
  getLiveSetlist,
  getOnThisDayLiveSetlists,
  getRecentLiveSetlists,
} from "@/lib/live-setlist/search";
import {
  awaitFreshAfterCookieName,
  decodeAwaitFreshAfterCookie,
} from "@/lib/manual-refresh-navigation";
import { getRequestLocale } from "@/lib/request-locale";
import { getUserSongStats } from "@/lib/stats/get-user-song-stats";

type PublicHomePageProps = {
  userId?: string;
  eventId?: string;
  preferredSearchMode?: "user" | "live";
  refresh?: string;
  awaitFreshAfter?: string;
};

export async function PublicHomePage({
  userId = "",
  eventId = "",
  preferredSearchMode = "user",
  refresh = "",
  awaitFreshAfter = "",
}: PublicHomePageProps) {
  const normalizedUserId = normalizeEventernoteUserId(userId);
  const invalidUserId =
    normalizedUserId.length > 0 &&
    !isValidEventernoteUserId(normalizedUserId);
  const hasExplicitUser = normalizedUserId.length > 0;
  const normalizedEventId = eventId.trim();
  const hasExplicitEvent = normalizedEventId.length > 0;
  const parsedEventId = /^\d+$/u.test(normalizedEventId)
    ? Number(normalizedEventId)
    : null;

  if (
    hasExplicitEvent &&
    (!parsedEventId ||
      !Number.isSafeInteger(parsedEventId) ||
      parsedEventId <= 0)
  ) {
    notFound();
  }

  const cookieStorePromise = cookies();
  const defaultLivePromise =
    parsedEventId === null
      ? Promise.resolve(null)
      : getLiveSetlist(parsedEventId);
  const recentLiveSetlistsPromise =
    preferredSearchMode === "live" || parsedEventId !== null
      ? getRecentLiveSetlists()
      : Promise.resolve([]);
  const onThisDayLiveSetlistsPromise =
    preferredSearchMode === "live" || parsedEventId !== null
      ? getOnThisDayLiveSetlists()
      : Promise.resolve([]);
  const eventVisibilityRulesPromise = readEventVisibilityRules();
  const localePromise = getRequestLocale();

  const [
    cookieStore,
    defaultLive,
    recentLiveSetlists,
    onThisDayLiveSetlists,
    eventVisibilityRules,
    locale,
  ] =
    await Promise.all([
      cookieStorePromise,
      defaultLivePromise,
      recentLiveSetlistsPromise,
      onThisDayLiveSetlistsPromise,
      eventVisibilityRulesPromise,
      localePromise,
    ]);

  if (hasExplicitEvent && !defaultLive) {
    notFound();
  }

  const defaultSearchMode =
    defaultLive || preferredSearchMode === "live" ? "live" : "user";
  const forceRefresh = refresh === "1";
  const awaitFreshAfterFromCookie = hasExplicitUser
    ? decodeAwaitFreshAfterCookie(
        cookieStore.get(awaitFreshAfterCookieName)?.value,
        normalizedUserId,
      )
    : undefined;
  const awaitFreshAfterMs = Number(awaitFreshAfter);
  const awaitFreshAfterFromLegacyParam =
    Number.isFinite(awaitFreshAfterMs) && awaitFreshAfterMs > 0
      ? awaitFreshAfterMs
      : undefined;
  const awaitFreshAfterValue =
    awaitFreshAfterFromCookie ?? awaitFreshAfterFromLegacyParam;

  const resultPromise =
    hasExplicitUser && !invalidUserId
      ? getUserSongStats(normalizedUserId, {
          forceRefresh,
          awaitFreshAfter: awaitFreshAfterValue,
        })
      : Promise.resolve(null);
  const isAdminAuthenticatedPromise = verifyAdminAuthToken(
    cookieStore.get(adminAuthCookieName)?.value,
  );
  const [result, isAdminAuthenticated] = await Promise.all([
    resultPromise,
    isAdminAuthenticatedPromise,
  ]);

  function cookieBool(name: string, defaultValue: boolean): boolean {
    const value = cookieStore.get(name)?.value;
    return value === undefined ? defaultValue : value === "true";
  }

  return (
    <HomePageClient
      locale={locale}
      defaultUserId={normalizedUserId}
      demoUserId={getDefaultUserId()}
      invalidUserId={invalidUserId}
      result={result}
      defaultHideUnplayed={cookieBool("bdr-hide-unplayed", true)}
      defaultHideVirtualBands={cookieBool("bdr-hide-virtual-bands", true)}
      defaultHideSonglessActivities={cookieBool(
        "bdr-hide-songless-activities",
        true,
      )}
      isAdminAuthenticated={isAdminAuthenticated}
      eventVisibilityRules={eventVisibilityRules}
      defaultLive={defaultLive}
      recentLiveSetlists={recentLiveSetlists}
      onThisDayLiveSetlists={onThisDayLiveSetlists}
      defaultSearchMode={defaultSearchMode}
    />
  );
}
