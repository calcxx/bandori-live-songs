import "server-only";

import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import type { z } from "zod";

import { getDb } from "@/lib/db/core";
import { eventernoteUserCache } from "@/lib/db/schema";
import { eventernoteUserEventsParserVersion, fetchUserEventCount } from "@/lib/eventernote/client";
import { cachePayloadSchema, refreshLeaseMs } from "./user-events-cache-store";
import {
  refreshCachedUserEventsDeduped,
  scheduleUserEventsRefresh,
  waitForUserEventsRefresh,
  refreshUserEventsInline,
} from "./user-events-refresh";
import {
  normalizeEventernoteUserCacheKey,
  normalizeEventernoteUserId,
} from "@/lib/eventernote/user-id";
import { readEventVisibilityRules } from "@/lib/events/event-visibility-rules-store";

import { getSongCatalog } from "./catalog-cache";
import { getEventernoteCacheDisposition } from "./eventernote-cache-policy";
import { buildMatchedEvents } from "./build-matched-events";
import type { MatchedEventEntry, SongPoolItem } from "./aggregate";

const getMatchedEventsCached = unstable_cache(
  async (
    _cacheKey: string,
    activitiesJson: string,
    catalogJson: string,
    titleTagsJson: string,
  ) => {
    const db = getDb();
    const activities = cachePayloadSchema.parse(JSON.parse(activitiesJson));
    const songsWithLiveState = JSON.parse(catalogJson) as SongPoolItem[];
    const titleTagsToStrip = JSON.parse(titleTagsJson) as string[];
    return buildMatchedEvents(
      activities,
      songsWithLiveState,
      db,
      titleTagsToStrip,
    );
  },
  ["matched-events"],
  {
    revalidate: 60 * 5,
    tags: ["song-catalog", "song-events"],
  },
);

const inlineRefreshWaitTimeoutMs = 1000 * 50;
const inlineRefreshWaitIntervalMs = 1000;

export type UserSongStatsResult =
  | {
      state: "ok";
      userId: string;
      displayName: string | null;
      staleCacheUsed: boolean;
      songs: SongPoolItem[];
      matchedEvents: MatchedEventEntry[];
    }
  | {
      state: "warming";
      userId: string;
      message: string;
      reason: "initializing" | "refreshing";
    }
  | {
      state: "not-found";
      userId: string;
    }
  | {
      state: "config-error";
      userId: string;
      message: string;
    }
  | {
      state: "upstream-error";
      userId: string;
      message: string;
    };

function hasOutdatedUserEventsParser(cacheRow: typeof eventernoteUserCache.$inferSelect | null) {
  return Boolean(cacheRow && cacheRow.parserVersion < eventernoteUserEventsParserVersion);
}

type GetUserSongStatsOptions = {
  forceRefresh?: boolean;
  awaitFreshAfter?: number;
  refreshMode?: "background" | "inline";
  refreshWaitTimeoutMs?: number;
  refreshWaitIntervalMs?: number;
};

function resolveCacheErrorResult(
  cacheRow: typeof eventernoteUserCache.$inferSelect,
  userId: string,
): UserSongStatsResult {
  if (cacheRow.errorMessage?.includes("不存在")) {
    return { state: "not-found", userId };
  }

  return {
    state: "upstream-error",
    userId,
    message: cacheRow.errorMessage ?? "抓取 Eventernote 失败。",
  };
}

export async function getUserSongStats(
  userId: string,
  {
    forceRefresh = false,
    awaitFreshAfter,
    refreshMode = "background",
    refreshWaitTimeoutMs = inlineRefreshWaitTimeoutMs,
    refreshWaitIntervalMs = inlineRefreshWaitIntervalMs,
  }: GetUserSongStatsOptions = {},
): Promise<UserSongStatsResult> {
  const requestedUserId = normalizeEventernoteUserId(userId);
  const cacheUserId = normalizeEventernoteUserCacheKey(requestedUserId);

  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    return {
      state: "config-error",
      userId: requestedUserId,
      message: "尚未配置 DATABASE_URL / DIRECT_URL，无法访问 PostgreSQL。",
    };
  }

  const db = getDb();
  const [{ songsWithLiveState }, cacheRow, eventRules] = await Promise.all([
    getSongCatalog(),
    db
      .select()
      .from(eventernoteUserCache)
      .where(sql`lower(${eventernoteUserCache.userId}) = ${cacheUserId}`)
      .then((rows) => rows[0] ?? null),
    readEventVisibilityRules(),
  ]);
  const refreshCacheUserId = cacheRow?.userId ?? cacheUserId;
  const displayUserId = cacheRow?.displayId ?? requestedUserId;
  const displayName = cacheRow?.displayName ?? null;

  const needsParserUpgrade = hasOutdatedUserEventsParser(cacheRow);
  // Old parser versions may have stored a different payload shape. Fetch the
  // replacement before applying the current schema or cache policy to it.
  const cachedActivities = cacheRow && !needsParserUpgrade
    ? cachePayloadSchema.parse(cacheRow.activities)
    : [];
  const isKnownMissingUser = Boolean(
    cacheRow?.fetchStatus === "error" &&
      cacheRow.errorMessage?.includes("不存在"),
  );
  const isRetryableEmptyFailure = Boolean(
    cacheRow?.fetchStatus === "error" &&
      !isKnownMissingUser &&
      cacheRow.remoteEventCount === null &&
      cachedActivities.length === 0,
  );
  const cacheRowForDisposition = isRetryableEmptyFailure
    ? null
    : cacheRow;

  // Cache misses already need the complete first page, so a separate count
  // request would fetch the same Eventernote page twice. Existing transient
  // failures also retry the complete fetch directly.
  const remoteEventCount =
    cacheRowForDisposition && !isKnownMissingUser && !needsParserUpgrade
      ? await fetchUserEventCount(requestedUserId)
      : null;

  const cacheDisposition = getEventernoteCacheDisposition(
    cacheRowForDisposition,
    remoteEventCount,
  );
  const staleCacheUsed = cacheDisposition.staleCacheUsed;
  const activities = cachedActivities;
  const hasFreshEnoughCache =
    typeof awaitFreshAfter === "number" &&
    cacheRow !== null &&
    new Date(cacheRow.lastFetchedAt).getTime() >= awaitFreshAfter;

  async function buildOkResult({
    cacheKeyTime,
    nextDisplayUserId,
    nextDisplayName,
    nextActivities,
    nextStaleCacheUsed,
  }: {
    cacheKeyTime: number;
    nextDisplayUserId: string;
    nextDisplayName: string | null;
    nextActivities: z.infer<typeof cachePayloadSchema>;
    nextStaleCacheUsed: boolean;
  }): Promise<UserSongStatsResult> {
    const matchedEvents = await getMatchedEventsCached(
      `${refreshCacheUserId}:${cacheKeyTime}`,
      JSON.stringify(nextActivities),
      JSON.stringify(songsWithLiveState),
      JSON.stringify(eventRules.titleTagsToStrip),
    );

    return {
      state: "ok",
      userId: nextDisplayUserId,
      displayName: nextDisplayName,
      staleCacheUsed: nextStaleCacheUsed,
      songs: songsWithLiveState,
      matchedEvents,
    };
  }

  async function refreshInlineOrWait(): Promise<UserSongStatsResult> {
    const refreshResult = await refreshUserEventsInline({
      requestedUserId,
      cacheUserId: refreshCacheUserId,
      displayUserId,
      waitTimeoutMs: refreshWaitTimeoutMs,
      waitIntervalMs: refreshWaitIntervalMs,
      db,
    });

    if (refreshResult === null) {
      return getUserSongStats(requestedUserId, {
        awaitFreshAfter,
        refreshMode: "background",
      });
    }

    if (refreshResult.status === "not-found") {
      return {
        state: "not-found",
        userId: displayUserId,
      };
    }

    if (refreshResult.status === "error") {
      return {
        state: "upstream-error",
        userId: displayUserId,
        message: refreshResult.message,
      };
    }

    return buildOkResult({
      cacheKeyTime: Date.now(),
      nextDisplayUserId: refreshResult.displayId,
      nextDisplayName: refreshResult.displayName,
      nextActivities: refreshResult.activities,
      nextStaleCacheUsed: false,
    });
  }

  if (forceRefresh) {
    if (refreshMode === "inline") {
      return refreshInlineOrWait();
    }

    scheduleUserEventsRefresh(requestedUserId, refreshCacheUserId, displayUserId);

    return {
      state: "warming",
      userId: displayUserId,
      message: "正在刷新 Eventernote 缓存，请稍候。",
      reason: "refreshing",
    };
  }

  if (needsParserUpgrade) {
    const refreshResult = await refreshCachedUserEventsDeduped(requestedUserId, refreshCacheUserId, db);

    if (refreshResult.status === "not-found") {
      return {
        state: "not-found",
        userId: displayUserId,
      };
    }

    if (refreshResult.status === "error") {
      return {
        state: "upstream-error",
        userId: displayUserId,
        message: refreshResult.message,
      };
    }

    return buildOkResult({
      cacheKeyTime: Date.now(),
      nextDisplayUserId: refreshResult.displayId,
      nextDisplayName: refreshResult.displayName ?? displayName,
      nextActivities: refreshResult.activities,
      nextStaleCacheUsed: false,
    });
  }

  if (typeof awaitFreshAfter === "number" && !hasFreshEnoughCache) {
    if (refreshMode === "inline") {
      return refreshInlineOrWait();
    }

    scheduleUserEventsRefresh(requestedUserId, refreshCacheUserId, displayUserId);

    return {
      state: "warming",
      userId: displayUserId,
      message: "正在刷新 Eventernote 缓存，请稍候。",
      reason: "refreshing",
    };
  }

  if (cacheDisposition.mode === "warm-and-refresh") {
    if (refreshMode === "inline") {
      return refreshInlineOrWait();
    }

    scheduleUserEventsRefresh(requestedUserId, refreshCacheUserId, displayUserId);

    return {
      state: "warming",
      userId: displayUserId,
      message: "正在初始化该用户的 Eventernote 缓存，请稍候。",
      reason: "initializing",
    };
  }

  if (cacheDisposition.mode === "serve-stale-and-refresh") {
    scheduleUserEventsRefresh(requestedUserId, refreshCacheUserId, displayUserId);

    return buildOkResult({
      cacheKeyTime: cacheRow!.lastFetchedAt.getTime(),
      nextDisplayUserId: displayUserId,
      nextDisplayName: displayName,
      nextActivities: activities,
      nextStaleCacheUsed: true,
    });
  }

  if (cacheRow?.fetchStatus === "error") {
    const isFreshEnough = typeof awaitFreshAfter === "number" && hasFreshEnoughCache;
    if (isFreshEnough || activities.length === 0) {
      return resolveCacheErrorResult(cacheRow, displayUserId);
    }
  }

  const refreshingInProgress =
    cacheRow &&
    cacheRow.refreshingStartedAt &&
    new Date(cacheRow.refreshingStartedAt).getTime() >= Date.now() - refreshLeaseMs;

  if (refreshingInProgress && activities.length === 0) {
    if (refreshMode === "inline") {
      const ready = await waitForUserEventsRefresh(
        refreshCacheUserId,
        refreshWaitTimeoutMs,
        refreshWaitIntervalMs,
        db,
      );

      if (ready) {
        return getUserSongStats(requestedUserId, {
          awaitFreshAfter,
          refreshMode: "background",
        });
      }
    }

    return {
      state: "warming",
      userId: displayUserId,
      message: "正在刷新 Eventernote 缓存，请稍候。",
      reason: "refreshing",
    };
  }

  return buildOkResult({
    cacheKeyTime: cacheRow?.lastFetchedAt?.getTime() ?? 0,
    nextDisplayUserId: displayUserId,
    nextDisplayName: displayName,
    nextActivities: activities,
    nextStaleCacheUsed: staleCacheUsed,
  });
}
