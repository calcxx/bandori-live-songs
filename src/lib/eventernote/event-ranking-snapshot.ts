import { setTimeout as delay } from "node:timers/promises";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { connectDatabase, getDb } from "@/lib/db/core";
import { emptyEventVisibilityRules } from "@/lib/events/event-visibility";
import { readEventVisibilityRulesFromDb } from "@/lib/events/event-visibility-rules-store";
import { fetchAllActorEvents, mergeActorEvents } from "./actor-events";
import { syncBandoriEventIndex } from "./bandori-event-index";
import { sanitizeEventernoteEventTitle } from "./event-meta";
import type { ActorEventRankingEntry } from "./actor-events";

export type BandoriActorEventsRefreshResult = {
  indexedEventCount: number;
  removedEventCount: number;
  updatedAt: string;
};

async function fetchMergedActorEvents() {
  const bandSeeds = BAND_SEEDS.filter((band) => band.groupType === "band" && band.eventernoteActorId !== null);
  const allEntries = [];

  for (const [index, band] of bandSeeds.entries()) {
    const actorIds = new Set([band.eventernoteActorId!, ...(band.additionalEventernoteActorIds ?? [])]);
    for (const actorId of actorIds) {
      const result = await fetchAllActorEvents(actorId, {
        slug: band.slug,
        nameJa: band.nameJa,
      });
      allEntries.push(...result.events);
      await delay(500);
    }
    console.info(`[event-ranking] fetched ${index + 1}/${bandSeeds.length} bands: ${band.nameJa}`);
  }

  return {
    mergedEvents: mergeActorEvents(allEntries),
  };
}

function sanitizeActorEventTitles(
  events: ActorEventRankingEntry[],
  titleTagsToStrip: string[],
) {
  return events.map((event) => ({
    ...event,
    title: sanitizeEventernoteEventTitle(
      event.title,
      titleTagsToStrip,
    ),
  }));
}

/** One complete crawl: synchronize bandori_event_index with actor pages and additional actor sources. */
export async function refreshBandoriActorEvents(): Promise<BandoriActorEventsRefreshResult> {
  const { mergedEvents } = await fetchMergedActorEvents();
  const db = getDb();
  const rules =
    (await readEventVisibilityRulesFromDb(db)) ??
    emptyEventVisibilityRules;
  const { indexedEventCount, removedEventCount } = await syncBandoriEventIndex(
    sanitizeActorEventTitles(mergedEvents, rules.titleTagsToStrip),
    db,
  );
  return {
    indexedEventCount,
    removedEventCount,
    updatedAt: new Date().toISOString(),
  };
}

/** Script entry: same as refreshBandoriActorEvents but uses a dedicated direct connection. */
export async function refreshBandoriActorEventsDirect(): Promise<BandoriActorEventsRefreshResult> {
  const { mergedEvents } = await fetchMergedActorEvents();
  const { db, sql: client } = connectDatabase(true);
  try {
    const rules =
      (await readEventVisibilityRulesFromDb(db)) ??
      emptyEventVisibilityRules;
    const { indexedEventCount, removedEventCount } = await syncBandoriEventIndex(
      sanitizeActorEventTitles(mergedEvents, rules.titleTagsToStrip),
      db,
    );
    return {
      indexedEventCount,
      removedEventCount,
      updatedAt: new Date().toISOString(),
    };
  } finally {
    await client.end();
  }
}
