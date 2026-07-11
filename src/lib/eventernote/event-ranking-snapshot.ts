import { setTimeout as delay } from "node:timers/promises";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { connectDatabase, getDb } from "@/lib/db/core";
import { fetchAllActorEvents, mergeActorEvents } from "./actor-events";
import { getRecentEventDateWindow, upsertBandoriEventIndex } from "./bandori-event-index";
import type { ActorEventRankingEntry } from "./actor-events";

export type BandoriActorEventsRefreshResult = {
  indexedEventCount: number;
  updatedAt: string;
};

export { getCurrentDateInShanghai, getRecentEventDateWindow } from "./bandori-event-index";

export function filterRecentEventEntries(events: ActorEventRankingEntry[], now = new Date()) {
  const { filteredFrom, filteredThrough } = getRecentEventDateWindow(now);
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

/** One crawl: upsert bandori_event_index only. */
export async function refreshBandoriActorEvents(): Promise<BandoriActorEventsRefreshResult> {
  const { mergedEvents } = await fetchMergedActorEvents();
  const indexedEventCount = await upsertBandoriEventIndex(mergedEvents, getDb());
  return {
    indexedEventCount,
    updatedAt: new Date().toISOString(),
  };
}

/** Script entry: same as refreshBandoriActorEvents but uses a dedicated direct connection. */
export async function refreshBandoriActorEventsDirect(): Promise<BandoriActorEventsRefreshResult> {
  const { mergedEvents } = await fetchMergedActorEvents();
  const { db, sql: client } = connectDatabase(true);
  try {
    const indexedEventCount = await upsertBandoriEventIndex(mergedEvents, db);
    return {
      indexedEventCount,
      updatedAt: new Date().toISOString(),
    };
  } finally {
    await client.end();
  }
}
