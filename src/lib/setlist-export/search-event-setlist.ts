import "server-only";

import { asc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/lib/db/core";
import { bands, events, setlistEntries, songs } from "@/lib/db/schema";
import { normalizeSongTitle } from "@/lib/music/title-utils";
import { toBandoriFansBandLabel } from "./bandori-fans-band-names";
import {
  extractDistinctiveTitleNeedle,
  scoreEventCandidateForExport,
} from "./scoring";

export { scoreEventCandidateForExport } from "./scoring";

export type SetlistExportEntry = {
  position: number;
  songTitle: string;
  bandSlug: string | null;
  bandName: string | null;
  rawTitle: string;
};

export type SetlistExportMatch = {
  eventernoteEventId: number;
  title: string;
  eventDate: string;
  venue: string | null;
  setlistStatus: "missing" | "partial" | "complete";
  entries: SetlistExportEntry[];
};

export type SetlistExportResult = {
  match: SetlistExportMatch | null;
  alternatives: Array<Pick<SetlistExportMatch, "eventernoteEventId" | "title" | "eventDate" | "setlistStatus">>;
};


async function pickBestExportMatch(
  ranked: Array<{ event: typeof events.$inferSelect; score: number }>,
  catalog: CatalogSong[],
): Promise<SetlistExportResult> {
  for (const { event } of ranked) {
    const match = await toExportMatch(event, catalog);
    if (match) {
      return {
        match,
        alternatives: ranked
          .filter((item) => item.event.id !== event.id)
          .slice(0, 5)
          .map(({ event: alternative }) => ({
            eventernoteEventId: alternative.eventernoteEventId,
            title: alternative.title,
            eventDate: alternative.eventDate,
            setlistStatus: alternative.setlistStatus,
          })),
      };
    }
  }

  return {
    match: null,
    alternatives: ranked.slice(0, 6).map(({ event }) => ({
      eventernoteEventId: event.eventernoteEventId,
      title: event.title,
      eventDate: event.eventDate,
      setlistStatus: event.setlistStatus,
    })),
  };
}

type CatalogSong = {
  id: number;
  title: string;
  bandSlug: string;
  bandNameJa: string;
  normalizedTitle: string;
};

async function loadCatalogSongs() {
  const db = getDb();
  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      bandSlug: songs.bandSlug,
      bandNameJa: bands.nameJa,
    })
    .from(songs)
    .innerJoin(bands, eq(songs.bandSlug, bands.slug));

  return rows.map((row) => ({
    ...row,
    normalizedTitle: normalizeSongTitle(row.title),
  })) satisfies CatalogSong[];
}

function resolveSongForRawTitle(rawTitle: string, catalog: CatalogSong[]) {
  const exact = catalog.find((song) => song.title === rawTitle);
  if (exact) {
    return exact;
  }

  const normalizedRaw = normalizeSongTitle(rawTitle);
  const normalizedMatches = catalog.filter((song) => song.normalizedTitle === normalizedRaw);
  if (normalizedMatches.length === 1) {
    return normalizedMatches[0];
  }

  return null;
}

async function loadSetlistEntries(eventId: number, catalog: CatalogSong[]) {
  const db = getDb();
  const rows = await db
    .select({
      orderIndex: setlistEntries.orderIndex,
      rawTitle: setlistEntries.rawTitle,
    })
    .from(setlistEntries)
    .where(eq(setlistEntries.eventId, eventId))
    .orderBy(asc(setlistEntries.orderIndex));

  return rows.map((row) => {
    const song = resolveSongForRawTitle(row.rawTitle, catalog);
    const bandSlug = song?.bandSlug ?? null;
    return {
      position: row.orderIndex,
      songTitle: song?.title ?? row.rawTitle,
      bandSlug,
      bandName: bandSlug ? toBandoriFansBandLabel(bandSlug, song?.bandNameJa ?? undefined) : null,
      rawTitle: row.rawTitle,
    } satisfies SetlistExportEntry;
  });
}

async function toExportMatch(
  event: typeof events.$inferSelect,
  catalog: CatalogSong[],
): Promise<SetlistExportMatch | null> {
  const entries = await loadSetlistEntries(event.id, catalog);
  if (entries.length === 0) {
    return null;
  }

  return {
    eventernoteEventId: event.eventernoteEventId,
    title: event.title,
    eventDate: event.eventDate,
    venue: event.venue,
    setlistStatus: event.setlistStatus,
    entries,
  };
}

export async function searchEventSetlistForExport(input: {
  title?: string;
  eventDate?: string;
  eventernoteEventId?: number;
}): Promise<SetlistExportResult> {
  const db = getDb();
  const catalog = await loadCatalogSongs();

  if (input.eventernoteEventId) {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.eventernoteEventId, input.eventernoteEventId))
      .limit(1);

    if (!event) {
      return { match: null, alternatives: [] };
    }

    return {
      match: await toExportMatch(event, catalog),
      alternatives: [],
    };
  }

  const title = input.title?.trim();
  if (!title) {
    return { match: null, alternatives: [] };
  }

  const titleNeedle = extractDistinctiveTitleNeedle(title);
  const titleConditions = [ilike(events.title, title), ilike(events.title, `%${title}%`)];
  if (titleNeedle) {
    titleConditions.push(ilike(events.title, `%${titleNeedle}%`));
  }

  const candidateLists = await Promise.all([
    db.select().from(events).where(or(...titleConditions)).limit(30),
    input.eventDate
      ? db.select().from(events).where(eq(events.eventDate, input.eventDate)).limit(50)
      : Promise.resolve([]),
  ]);

  const candidates = [
    ...new Map(
      candidateLists.flat().map((event) => [event.id, event] as const),
    ).values(),
  ];

  const ranked = candidates
    .map((event) => ({
      event,
      score: scoreEventCandidateForExport({ title, eventDate: input.eventDate }, event),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) {
    return { match: null, alternatives: [] };
  }

  if (input.eventDate) {
    const dateMatches = ranked.filter((item) => item.event.eventDate === input.eventDate);
    if (dateMatches.length > 0) {
      return pickBestExportMatch(dateMatches, catalog);
    }

    return {
      match: null,
      alternatives: ranked.slice(0, 6).map(({ event }) => ({
        eventernoteEventId: event.eventernoteEventId,
        title: event.title,
        eventDate: event.eventDate,
        setlistStatus: event.setlistStatus,
      })),
    };
  }

  return pickBestExportMatch(ranked, catalog);
}
