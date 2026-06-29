import { eq } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { connectDatabase, getDb } from "@/lib/db/core";
import { appRuntimeSnapshots } from "@/lib/db/schema";
import {
  actorEventRankingSnapshotSchema,
  fetchAllActorEvents,
  mergeActorEvents,
  type ActorEventRankingEntry,
  type ActorEventRankingSnapshot,
} from "./actor-events";

const EVENT_RANKING_SNAPSHOT_KEY = "event-ranking";
const RECENT_EVENT_SNAPSHOT_KEY = "event-recent";

export const recentEventRankingSnapshotSchema = actorEventRankingSnapshotSchema.extend({
  filteredFrom: z.string(),
  sortMode: z.literal("date-desc-attendee-desc"),
});

export type RecentEventRankingSnapshot = z.infer<typeof recentEventRankingSnapshotSchema>;

export function getCurrentDateInShanghai(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now);
}

function shiftDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}

export function filterRecentEventEntries(events: ActorEventRankingEntry[], now = new Date()) {
  const currentDate = getCurrentDateInShanghai(now);
  const filteredFrom = shiftDateString(currentDate, -30);
  const filteredThrough = shiftDateString(currentDate, 7);

  return events.filter((event) => event.eventDate >= filteredFrom && event.eventDate <= filteredThrough);
}

export function sortRecentEventEntries(events: ActorEventRankingEntry[]) {
  return [...events].sort((left, right) => {
    const dateCompare = right.eventDate.localeCompare(left.eventDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const attendeeCompare = right.attendeeCount - left.attendeeCount;
    if (attendeeCompare !== 0) {
      return attendeeCompare;
    }

    return right.eventernoteEventId - left.eventernoteEventId;
  });
}

export function sortEventRankingEntries(events: ActorEventRankingEntry[]) {
  return [...events].sort((left, right) => {
    const dateCompare = left.eventDate.localeCompare(right.eventDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.eventernoteEventId - right.eventernoteEventId;
  });
}

async function fetchMergedActorEvents() {
  const bandSeeds = BAND_SEEDS.filter((band) => band.groupType === "band" && band.eventernoteActorId !== null);
  const allEntries = [];

  for (const [index, band] of bandSeeds.entries()) {
    const result = await fetchAllActorEvents(band.eventernoteActorId!, {
      slug: band.slug,
      nameJa: band.nameJa,
    });
    allEntries.push(...result.events);
    console.info(`[event-ranking] fetched ${index + 1}/${bandSeeds.length} bands: ${band.nameJa}`);
    await delay(500);
  }

  return {
    bandSeeds,
    allEntries,
    mergedEvents: mergeActorEvents(allEntries),
  };
}

export async function buildEventRankingSnapshot(now = new Date()): Promise<ActorEventRankingSnapshot> {
  const { bandSeeds, allEntries, mergedEvents } = await fetchMergedActorEvents();
  const filteredThrough = getCurrentDateInShanghai(now);
  const eligibleEvents = mergedEvents.filter((event) => event.eventDate <= filteredThrough);

  return {
    version: 4,
    generatedAt: new Date().toISOString(),
    filteredThrough,
    sourceBandCount: bandSeeds.length,
    scannedEventCount: allEntries.length,
    mergedEventCount: mergedEvents.length,
    events: sortEventRankingEntries(eligibleEvents),
  };
}

export function buildRecentEventSnapshot(
  sourceSnapshot: Pick<
    ActorEventRankingSnapshot,
    "version" | "generatedAt" | "sourceBandCount" | "scannedEventCount" | "mergedEventCount" | "events"
  >,
  now = new Date(),
): RecentEventRankingSnapshot {
  const currentDate = getCurrentDateInShanghai(now);
  const filteredFrom = shiftDateString(currentDate, -30);
  const filteredThrough = shiftDateString(currentDate, 7);

  return recentEventRankingSnapshotSchema.parse({
    version: sourceSnapshot.version,
    generatedAt: sourceSnapshot.generatedAt,
    filteredFrom,
    filteredThrough,
    sortMode: "date-desc-attendee-desc",
    sourceBandCount: sourceSnapshot.sourceBandCount,
    scannedEventCount: sourceSnapshot.scannedEventCount,
    mergedEventCount: sourceSnapshot.mergedEventCount,
    events: sortRecentEventEntries(filterRecentEventEntries(sourceSnapshot.events, now)),
  });
}

export async function buildRecentEventRankingSnapshot(now = new Date()): Promise<RecentEventRankingSnapshot> {
  const { bandSeeds, allEntries, mergedEvents } = await fetchMergedActorEvents();

  return buildRecentEventSnapshot(
    {
      version: 4,
      generatedAt: new Date().toISOString(),
      sourceBandCount: bandSeeds.length,
      scannedEventCount: allEntries.length,
      mergedEventCount: mergedEvents.length,
      events: mergedEvents,
    },
    now,
  );
}

async function saveRuntimeSnapshot(snapshotKey: string, snapshot: ActorEventRankingSnapshot | RecentEventRankingSnapshot) {
  const db = getDb();
  await db
    .insert(appRuntimeSnapshots)
    .values({
      snapshotKey,
      payload: snapshot,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appRuntimeSnapshots.snapshotKey,
      set: {
        payload: snapshot,
        updatedAt: new Date(),
      },
    });
}

async function saveRuntimeSnapshotDirect(
  snapshotKey: string,
  snapshot: ActorEventRankingSnapshot | RecentEventRankingSnapshot,
) {
  const { db, sql } = connectDatabase(true);

  try {
    await db
      .insert(appRuntimeSnapshots)
      .values({
        snapshotKey,
        payload: snapshot,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appRuntimeSnapshots.snapshotKey,
        set: {
          payload: snapshot,
          updatedAt: new Date(),
        },
      });
  } finally {
    await sql.end();
  }
}

export async function saveEventRankingSnapshotDirect(snapshot: ActorEventRankingSnapshot) {
  await saveRuntimeSnapshotDirect(EVENT_RANKING_SNAPSHOT_KEY, snapshot);
}

export async function saveRecentEventSnapshot(snapshot: RecentEventRankingSnapshot) {
  await saveRuntimeSnapshot(RECENT_EVENT_SNAPSHOT_KEY, snapshot);
}

export async function saveRecentEventSnapshotDirect(snapshot: RecentEventRankingSnapshot) {
  await saveRuntimeSnapshotDirect(RECENT_EVENT_SNAPSHOT_KEY, snapshot);
}

async function getStoredSnapshot<T>(snapshotKey: string, parser: z.ZodType<T>) {
  const db = getDb();
  const [row] = await db
    .select({
      payload: appRuntimeSnapshots.payload,
    })
    .from(appRuntimeSnapshots)
    .where(eq(appRuntimeSnapshots.snapshotKey, snapshotKey))
    .limit(1);

  return row ? parser.parse(row.payload) : null;
}

export async function getStoredEventRankingSnapshot() {
  return getStoredSnapshot(EVENT_RANKING_SNAPSHOT_KEY, actorEventRankingSnapshotSchema);
}

export async function getStoredRecentEventSnapshot() {
  return getStoredSnapshot(RECENT_EVENT_SNAPSHOT_KEY, recentEventRankingSnapshotSchema);
}

// ponytail: DB is the only source. Missing row = refresh not run yet; surface it loudly.
export async function getEventRankingSnapshot() {
  const snapshot = await getStoredEventRankingSnapshot();
  if (!snapshot) {
    throw new Error(
      "Event ranking snapshot not seeded. Run `npm run data:refresh:event-ranking` to populate it.",
    );
  }
  return snapshot;
}

export async function getRecentEventSnapshot() {
  const snapshot = await getStoredRecentEventSnapshot();
  if (!snapshot) {
    throw new Error(
      "Recent event snapshot not seeded. Run `npm run data:refresh:event-recent` to populate it.",
    );
  }
  return snapshot;
}
