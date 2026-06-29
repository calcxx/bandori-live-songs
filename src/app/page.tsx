import { cookies } from "next/headers";
import { HomePageClient } from "@/components/home-page-client";
import { adminAuthCookieName, verifyAdminAuthToken } from "@/lib/admin/auth";
import {
  getDefaultUserId,
  isValidEventernoteUserId,
  normalizeEventernoteUserId,
} from "@/lib/eventernote/user-id";
import { awaitFreshAfterCookieName, decodeAwaitFreshAfterCookie } from "@/lib/manual-refresh-navigation";
import { readEventVisibilityRules } from "@/lib/events/event-visibility-rules-store";
import { getUserSongStats } from "@/lib/stats/get-user-song-stats";

export const runtime = "nodejs";

type PageProps = {
  searchParams: Promise<{
    userId?: string;
    refresh?: string;
    awaitFreshAfter?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { userId = "", refresh = "", awaitFreshAfter = "" } = await searchParams;
  const normalizedUserId = normalizeEventernoteUserId(userId);
  const invalidUserId = normalizedUserId.length > 0 && !isValidEventernoteUserId(normalizedUserId);
  const hasExplicitUser = normalizedUserId.length > 0;
  const forceRefresh = refresh === "1";
  const cookieStore = await cookies();
  const awaitFreshAfterFromCookie = hasExplicitUser
    ? decodeAwaitFreshAfterCookie(cookieStore.get(awaitFreshAfterCookieName)?.value, normalizedUserId)
    : undefined;
  const awaitFreshAfterMs = Number(awaitFreshAfter);
  const awaitFreshAfterFromLegacyParam =
    Number.isFinite(awaitFreshAfterMs) && awaitFreshAfterMs > 0 ? awaitFreshAfterMs : undefined;
  const awaitFreshAfterValue = awaitFreshAfterFromCookie ?? awaitFreshAfterFromLegacyParam;
  const result =
    hasExplicitUser && !invalidUserId
      ? await getUserSongStats(normalizedUserId, { forceRefresh, awaitFreshAfter: awaitFreshAfterValue })
      : null;

  function cookieBool(name: string, defaultVal: boolean): boolean {
    const val = cookieStore.get(name)?.value;
    return val === undefined ? defaultVal : val === "true";
  }

  const defaultHideUnplayed = cookieBool("bdr-hide-unplayed", true);
  const defaultHideVirtualBands = cookieBool("bdr-hide-virtual-bands", true);
  const defaultHideSonglessActivities = cookieBool("bdr-hide-songless-activities", true);
  const isAdminAuthenticated = await verifyAdminAuthToken(cookieStore.get(adminAuthCookieName)?.value);
  const eventVisibilityRules = await readEventVisibilityRules();

  const demoUserId = getDefaultUserId();

  return (
    <HomePageClient
      defaultUserId={normalizedUserId}
      demoUserId={demoUserId}
      invalidUserId={invalidUserId}
      result={result}
      defaultHideUnplayed={defaultHideUnplayed}
      defaultHideVirtualBands={defaultHideVirtualBands}
      defaultHideSonglessActivities={defaultHideSonglessActivities}
      isAdminAuthenticated={isAdminAuthenticated}
      eventVisibilityRules={eventVisibilityRules}
    />
  );
}
