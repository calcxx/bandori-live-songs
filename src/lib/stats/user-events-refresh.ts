import "server-only";

import { setTimeout as sleep } from "node:timers/promises";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/lib/db/core";
import { eventernoteUserCache } from "@/lib/db/schema";
import {
  EventernoteUserNotFoundError,
  fetchAllUserEvents,
  type EventernoteUserEventsSummary,
} from "@/lib/eventernote/client";
import {
  type cachePayloadSchema,
  persistFetchedUserEventsCache,
  markUserEventsNotFound,
  releaseUserEventsAfterTransientFailure,
  tryAcquireUserEventsRefreshLease,
} from "./user-events-cache-store";

type RefreshUserEventsResult =
  | {
      status: "ok";
      displayId: string;
      displayName: string | null;
      activities: z.infer<typeof cachePayloadSchema>;
      remoteEventCount: number;
    }
  | {
      status: "not-found";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

const inFlightUserRefreshes = new Map<string, Promise<RefreshUserEventsResult>>();

async function fetchAndPersistUserEvents(
  requestedUserId: string,
  cacheUserId: string,
  db = getDb(),
  summary?: EventernoteUserEventsSummary,
): Promise<RefreshUserEventsResult> {
  try {
    const remote = await fetchAllUserEvents(
      requestedUserId,
      summary ? { summary } : undefined,
    );
    const persisted = await persistFetchedUserEventsCache(cacheUserId, remote, db);

    return {
      status: "ok",
      displayId: persisted.displayId,
      displayName: persisted.displayName,
      activities: persisted.activities,
      remoteEventCount: persisted.remoteEventCount,
    };
  } catch (error) {
    if (error instanceof EventernoteUserNotFoundError) {
      const message = "Eventernote 用户不存在或不可访问。";
      await markUserEventsNotFound(cacheUserId, message, db);

      return {
        status: "not-found",
        message,
      };
    }

    const message = error instanceof Error ? error.message : "抓取 Eventernote 失败。";
    await releaseUserEventsAfterTransientFailure(cacheUserId, db);
    console.warn("[eventernote] transient user refresh failure", {
      userId: cacheUserId,
      message,
    });

    return {
      status: "error",
      message,
    };
  }
}

export function refreshCachedUserEventsDeduped(
  requestedUserId: string,
  cacheUserId: string,
  db = getDb(),
  summary?: EventernoteUserEventsSummary,
) {
  const inFlight = inFlightUserRefreshes.get(cacheUserId);
  if (inFlight) {
    return inFlight;
  }

  // Reuse one in-flight refresh per user in a single runtime instance.
  const refreshPromise = fetchAndPersistUserEvents(requestedUserId, cacheUserId, db, summary).finally(() => {
    if (inFlightUserRefreshes.get(cacheUserId) === refreshPromise) {
      inFlightUserRefreshes.delete(cacheUserId);
    }
  });

  inFlightUserRefreshes.set(cacheUserId, refreshPromise);
  return refreshPromise;
}

export function scheduleUserEventsRefresh(
  requestedUserId: string,
  cacheUserId: string,
  displayUserId: string,
  summary?: EventernoteUserEventsSummary,
) {
  after(async () => {
    const db = getDb();
    const leaseAcquired = await tryAcquireUserEventsRefreshLease(cacheUserId, displayUserId, db);

    if (!leaseAcquired) {
      return;
    }

    await refreshCachedUserEventsDeduped(requestedUserId, cacheUserId, db, summary);
  });
}

export async function waitForUserEventsRefresh(cacheUserId: string, timeoutMs: number, intervalMs: number, db = getDb()) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const cacheRow = await db
      .select({
        refreshingStartedAt: eventernoteUserCache.refreshingStartedAt,
      })
      .from(eventernoteUserCache)
      .where(sql`lower(${eventernoteUserCache.userId}) = ${cacheUserId}`)
      .then((rows) => rows[0] ?? null);

    if (cacheRow && !cacheRow.refreshingStartedAt) {
      return true;
    }

    await sleep(intervalMs);
  }

  return false;
}

export async function refreshUserEventsInline({
  requestedUserId,
  cacheUserId,
  displayUserId,
  waitTimeoutMs,
  waitIntervalMs,
  db,
  summary,
}: {
  requestedUserId: string;
  cacheUserId: string;
  displayUserId: string;
  waitTimeoutMs: number;
  waitIntervalMs: number;
  db: ReturnType<typeof getDb>;
  summary?: EventernoteUserEventsSummary;
}) {
  const leaseAcquired = await tryAcquireUserEventsRefreshLease(cacheUserId, displayUserId, db);

  if (leaseAcquired) {
    return refreshCachedUserEventsDeduped(requestedUserId, cacheUserId, db, summary);
  }

  await waitForUserEventsRefresh(cacheUserId, waitTimeoutMs, waitIntervalMs, db);
  return null;
}
