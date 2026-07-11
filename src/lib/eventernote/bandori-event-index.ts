import { and, asc, desc, gte, inArray, lte, max, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/core";
import { bandoriEventIndex } from "@/lib/db/schema";
import type { ActorEventRankingEntry } from "./actor-events";

export type BandoriEventIndexLookup = {
  eventernoteEventId: number;
  title: string;
  eventDate: string;
  venue: string | null;
  sourceUrl: string;
  bandSlugs: string[];
};

const UPSERT_BATCH_SIZE = 200;

export function getCurrentDateInShanghai(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now);
}

export function shiftDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}

export function getRecentEventDateWindow(now = new Date()) {
  const currentDate = getCurrentDateInShanghai(now);
  return {
    filteredFrom: shiftDateString(currentDate, -30),
    filteredThrough: shiftDateString(currentDate, 7),
  };
}

export function getRankingEventDateWindow(now = new Date()) {
  return {
    filteredThrough: getCurrentDateInShanghai(now),
  };
}

export function toBandoriEventIndexRows(entries: ActorEventRankingEntry[], now = new Date()) {
  return entries.map((entry) => ({
    eventernoteEventId: entry.eventernoteEventId,
    title: entry.title,
    eventDate: entry.eventDate,
    venue: entry.venue,
    sourceUrl: entry.sourceUrl,
    attendeeCount: entry.attendeeCount,
    bandSlugs: entry.bandSlugs,
    bandNames: entry.bandNames,
    updatedAt: now,
  }));
}

export async function upsertBandoriEventIndex(
  entries: ActorEventRankingEntry[],
  db: ReturnType<typeof getDb> = getDb(),
) {
  const rows = toBandoriEventIndexRows(entries);
  if (rows.length === 0) {
    return 0;
  }

  for (let offset = 0; offset < rows.length; offset += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + UPSERT_BATCH_SIZE);
    await db
      .insert(bandoriEventIndex)
      .values(batch)
      .onConflictDoUpdate({
        target: bandoriEventIndex.eventernoteEventId,
        set: {
          title: sql`excluded.title`,
          eventDate: sql`excluded.event_date`,
          venue: sql`excluded.venue`,
          sourceUrl: sql`excluded.source_url`,
          attendeeCount: sql`excluded.attendee_count`,
          bandSlugs: sql`excluded.band_slugs`,
          bandNames: sql`excluded.band_names`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  return rows.length;
}

export async function lookupBandoriEventIndex(
  eventernoteEventIds: number[],
  db: ReturnType<typeof getDb> = getDb(),
): Promise<Map<number, BandoriEventIndexLookup>> {
  const uniqueIds = [...new Set(eventernoteEventIds)];
  const result = new Map<number, BandoriEventIndexLookup>();
  if (uniqueIds.length === 0) {
    return result;
  }

  const rows = await db
    .select({
      eventernoteEventId: bandoriEventIndex.eventernoteEventId,
      title: bandoriEventIndex.title,
      eventDate: bandoriEventIndex.eventDate,
      venue: bandoriEventIndex.venue,
      sourceUrl: bandoriEventIndex.sourceUrl,
      bandSlugs: bandoriEventIndex.bandSlugs,
    })
    .from(bandoriEventIndex)
    .where(inArray(bandoriEventIndex.eventernoteEventId, uniqueIds));

  for (const row of rows) {
    result.set(row.eventernoteEventId, {
      eventernoteEventId: row.eventernoteEventId,
      title: row.title,
      eventDate: row.eventDate,
      venue: row.venue,
      sourceUrl: row.sourceUrl,
      bandSlugs: row.bandSlugs,
    });
  }

  return result;
}

export type ListBandoriEventIndexOptions = {
  from?: string;
  through?: string;
  order: "ranking" | "recent";
};

function toRankingEntry(row: {
  eventernoteEventId: number;
  title: string;
  eventDate: string;
  venue: string | null;
  sourceUrl: string;
  attendeeCount: number;
  bandSlugs: string[];
  bandNames: string[];
}): ActorEventRankingEntry {
  return {
    eventernoteEventId: row.eventernoteEventId,
    title: row.title,
    eventDate: row.eventDate,
    venue: row.venue,
    sourceUrl: row.sourceUrl,
    attendeeCount: row.attendeeCount,
    bandSlugs: row.bandSlugs,
    bandNames: row.bandNames,
  };
}

export async function listBandoriEventIndex(
  options: ListBandoriEventIndexOptions,
  db: ReturnType<typeof getDb> = getDb(),
): Promise<ActorEventRankingEntry[]> {
  const conditions = [];
  if (options.from) {
    conditions.push(gte(bandoriEventIndex.eventDate, options.from));
  }
  if (options.through) {
    conditions.push(lte(bandoriEventIndex.eventDate, options.through));
  }

  const orderBy =
    options.order === "ranking"
      ? [asc(bandoriEventIndex.eventDate), asc(bandoriEventIndex.eventernoteEventId)]
      : [
          desc(bandoriEventIndex.eventDate),
          desc(bandoriEventIndex.attendeeCount),
          desc(bandoriEventIndex.eventernoteEventId),
        ];

  const rows = await db
    .select({
      eventernoteEventId: bandoriEventIndex.eventernoteEventId,
      title: bandoriEventIndex.title,
      eventDate: bandoriEventIndex.eventDate,
      venue: bandoriEventIndex.venue,
      sourceUrl: bandoriEventIndex.sourceUrl,
      attendeeCount: bandoriEventIndex.attendeeCount,
      bandSlugs: bandoriEventIndex.bandSlugs,
      bandNames: bandoriEventIndex.bandNames,
    })
    .from(bandoriEventIndex)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...orderBy);

  return rows.map(toRankingEntry);
}

export async function getBandoriEventIndexUpdatedAt(
  db: ReturnType<typeof getDb> = getDb(),
): Promise<Date | null> {
  const [row] = await db.select({ updatedAt: max(bandoriEventIndex.updatedAt) }).from(bandoriEventIndex);
  return row?.updatedAt ?? null;
}

export async function listRankingEventsFromIndex(now = new Date(), db: ReturnType<typeof getDb> = getDb()) {
  const { filteredThrough } = getRankingEventDateWindow(now);
  const [events, updatedAt] = await Promise.all([
    listBandoriEventIndex({ through: filteredThrough, order: "ranking" }, db),
    getBandoriEventIndexUpdatedAt(db),
  ]);
  return { events, filteredThrough, updatedAt };
}

export async function listRecentEventsFromIndex(now = new Date(), db: ReturnType<typeof getDb> = getDb()) {
  const { filteredFrom, filteredThrough } = getRecentEventDateWindow(now);
  const [events, updatedAt] = await Promise.all([
    listBandoriEventIndex({ from: filteredFrom, through: filteredThrough, order: "recent" }, db),
    getBandoriEventIndexUpdatedAt(db),
  ]);
  return { events, filteredFrom, filteredThrough, updatedAt };
}
