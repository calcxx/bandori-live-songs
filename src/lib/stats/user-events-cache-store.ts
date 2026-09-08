import "server-only";

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/core";
import { eventernoteUserCache } from "@/lib/db/schema";
import { lookupBandoriEventIndex } from "@/lib/eventernote/bandori-event-index";
import {
  bandoriUserEventSnapshotSchema,
  createBandoriUserEventSnapshots,
} from "@/lib/eventernote/bandori-user-events";
import {
  eventernoteUserEventsParserVersion,
  type fetchAllUserEvents,
} from "@/lib/eventernote/client";

export const refreshLeaseMs = 1000 * 60 * 5;
export const cachePayloadSchema = z.array(bandoriUserEventSnapshotSchema);

export async function persistFetchedUserEventsCache(
  cacheUserId: string,
  remote: Awaited<ReturnType<typeof fetchAllUserEvents>>,
  db = getDb(),
) {
  const now = new Date();
  const indexByEventId = await lookupBandoriEventIndex(
    remote.events.map((event) => event.eventernoteEventId),
    db,
  );
  const activities = cachePayloadSchema.parse(createBandoriUserEventSnapshots(remote.events, indexByEventId));
  const remoteEventCount = remote.totalCount;

  await db
    .insert(eventernoteUserCache)
    .values({
      userId: cacheUserId,
      displayId: remote.displayId,
      displayName: remote.displayName,
      parserVersion: eventernoteUserEventsParserVersion,
      activities,
      fetchStatus: "ok",
      errorMessage: null,
      lastFetchedAt: now,
      expiresAt: null,
      refreshingStartedAt: null,
      remoteEventCount,
    })
    .onConflictDoUpdate({
      target: eventernoteUserCache.userId,
      set: {
        displayId: remote.displayId,
        displayName: remote.displayName,
        parserVersion: eventernoteUserEventsParserVersion,
        activities,
        fetchStatus: "ok",
        errorMessage: null,
        lastFetchedAt: now,
        expiresAt: null,
        refreshingStartedAt: null,
        remoteEventCount,
      },
    });

  return {
    displayId: remote.displayId,
    displayName: remote.displayName,
    activities,
    remoteEventCount,
  };
}

export async function markUserEventsNotFound(
  cacheUserId: string,
  errorMessage: string,
  db = getDb(),
) {
  const now = new Date();

  const existingRow = await db
    .select({
      activities: eventernoteUserCache.activities,
    })
    .from(eventernoteUserCache)
    .where(eq(eventernoteUserCache.userId, cacheUserId))
    .then((rows) => rows[0] ?? null);

  const hasExistingActivities = existingRow && (existingRow.activities as unknown[]).length > 0;

  await db
    .update(eventernoteUserCache)
    .set({
      fetchStatus: "error",
      errorMessage,
      lastFetchedAt: now,
      expiresAt: null,
      refreshingStartedAt: null,
      // Preserve existing activities if available; only clear if this is a fresh row with no data.
      ...(hasExistingActivities ? {} : { activities: [] }),
    })
    .where(eq(eventernoteUserCache.userId, cacheUserId));
}

export async function releaseUserEventsAfterTransientFailure(
  cacheUserId: string,
  db = getDb(),
) {
  const existingRow = await db
    .select({
      activities: eventernoteUserCache.activities,
      fetchStatus: eventernoteUserCache.fetchStatus,
      errorMessage: eventernoteUserCache.errorMessage,
      remoteEventCount: eventernoteUserCache.remoteEventCount,
    })
    .from(eventernoteUserCache)
    .where(eq(eventernoteUserCache.userId, cacheUserId))
    .then((rows) => rows[0] ?? null);

  if (!existingRow) {
    return;
  }

  const hasSuccessfulCache =
    existingRow.remoteEventCount !== null ||
    existingRow.activities.length > 0;
  const isKnownMissingUser =
    existingRow.fetchStatus === "error" &&
    existingRow.errorMessage?.includes("不存在");

  if (isKnownMissingUser) {
    await db
      .update(eventernoteUserCache)
      .set({ refreshingStartedAt: null })
      .where(eq(eventernoteUserCache.userId, cacheUserId));
    return;
  }

  if (hasSuccessfulCache) {
    await db
      .update(eventernoteUserCache)
      .set({
        fetchStatus: "ok",
        errorMessage: null,
        refreshingStartedAt: null,
      })
      .where(eq(eventernoteUserCache.userId, cacheUserId));
    return;
  }

  // A failed first fetch has no reusable data. Removing its lease row avoids
  // persisting a transient upstream outage as a user-level cache error.
  await db
    .delete(eventernoteUserCache)
    .where(eq(eventernoteUserCache.userId, cacheUserId));
}

export async function tryAcquireUserEventsRefreshLease(cacheUserId: string, displayUserId: string, db = getDb()) {
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - refreshLeaseMs);

  // For cache misses, create a placeholder row and acquire lease in one step.
  const insertedRows = await db
    .insert(eventernoteUserCache)
    .values({
      userId: cacheUserId,
      displayId: displayUserId,
      displayName: null,
      fetchStatus: "ok",
      parserVersion: eventernoteUserEventsParserVersion,
      activities: [],
      errorMessage: null,
      lastFetchedAt: now,
      expiresAt: null,
      refreshingStartedAt: now,
      remoteEventCount: null,
    })
    .onConflictDoNothing()
    .returning({ userId: eventernoteUserCache.userId });

  if (insertedRows.length > 0) {
    return true;
  }

  const rows = await db
    .update(eventernoteUserCache)
    .set({
      refreshingStartedAt: now,
    })
    .where(
      and(
        eq(eventernoteUserCache.userId, cacheUserId),
        or(isNull(eventernoteUserCache.refreshingStartedAt), lt(eventernoteUserCache.refreshingStartedAt, leaseCutoff)),
      ),
    )
    .returning({ userId: eventernoteUserCache.userId });

  return rows.length > 0;
}
