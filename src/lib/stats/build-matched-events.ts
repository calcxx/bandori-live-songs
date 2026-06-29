import "server-only";

import { asc, inArray } from "drizzle-orm";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { getDb } from "@/lib/db/core";
import { events, setlistEntries } from "@/lib/db/schema";
import { shouldIncludeEventInSongStats } from "@/lib/eventernote/match-rules";
import { normalizeSongTitle } from "@/lib/music/title-utils";
import type { BandoriUserEventSnapshot } from "@/lib/eventernote/bandori-user-events";
import type { MatchedEventEntry, SongPoolItem } from "./aggregate";

function dedupBandsBySlug(bands: typeof BAND_SEEDS) {
  const seen = new Set<string>();
  const result: typeof BAND_SEEDS = [];
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (!seen.has(band.slug)) {
      seen.add(band.slug);
      result.push(band);
    }
  }
  return result;
}

function mergeBandsDeduped(existing: typeof BAND_SEEDS, incoming: typeof BAND_SEEDS) {
  const seen = new Set<string>();
  const result: typeof BAND_SEEDS = [];
  for (let i = 0; i < existing.length; i++) {
    const band = existing[i];
    seen.add(band.slug);
    result.push(band);
  }
  for (let i = 0; i < incoming.length; i++) {
    const band = incoming[i];
    if (!seen.has(band.slug)) {
      seen.add(band.slug);
      result.push(band);
    }
  }
  return result;
}

export async function buildMatchedEvents(
  activities: BandoriUserEventSnapshot[],
  songsWithLiveState: SongPoolItem[],
  db: ReturnType<typeof getDb> = getDb(),
): Promise<MatchedEventEntry[]> {
  const bandBySlug = new Map(BAND_SEEDS.map((band) => [band.slug, band]));

  const matchedSnapshotMap = new Map<
    number,
    {
      snapshot: BandoriUserEventSnapshot;
      matchedBands: typeof BAND_SEEDS;
    }
  >();

  for (const snapshot of activities) {
    if (!shouldIncludeEventInSongStats(snapshot)) continue;

    const matchedBands = snapshot.matchedBandSlugs
      .map((slug) => bandBySlug.get(slug))
      .filter((band): band is (typeof BAND_SEEDS)[number] => Boolean(band));
    const dedupedBands = dedupBandsBySlug(matchedBands);

    if (dedupedBands.length === 0) continue;

    const existing = matchedSnapshotMap.get(snapshot.eventernoteEventId);
    if (!existing) {
      matchedSnapshotMap.set(snapshot.eventernoteEventId, {
        snapshot,
        matchedBands: dedupedBands,
      });
      continue;
    }

    matchedSnapshotMap.set(snapshot.eventernoteEventId, {
      snapshot: existing.snapshot,
      matchedBands: mergeBandsDeduped(existing.matchedBands, dedupedBands),
    });
  }

  const matchedSnapshots = [...matchedSnapshotMap.values()];

  if (matchedSnapshots.length === 0) {
    return [];
  }

  const matchedEventernoteIds = matchedSnapshots.map(({ snapshot }) => snapshot.eventernoteEventId);

  const eventRows = await db
    .select()
    .from(events)
    .where(inArray(events.eventernoteEventId, matchedEventernoteIds));
  const eventRowByEventernoteId = new Map(eventRows.map((event) => [event.eventernoteEventId, event]));

  const setlistRows = eventRows.length
    ? await db
        .select({
          eventId: setlistEntries.eventId,
          orderIndex: setlistEntries.orderIndex,
          rawTitle: setlistEntries.rawTitle,
        })
        .from(setlistEntries)
        .where(inArray(setlistEntries.eventId, eventRows.map((event) => event.id)))
        .orderBy(asc(setlistEntries.eventId), asc(setlistEntries.orderIndex))
    : [];

  const songIdByTitle = new Map(songsWithLiveState.map((song) => [song.title, song.id]));
  const songIdByNormalizedTitle = new Map<string, number | null>();
  for (const song of songsWithLiveState) {
    const normalizedTitle = normalizeSongTitle(song.title);
    const existing = songIdByNormalizedTitle.get(normalizedTitle);
    if (existing === undefined) {
      songIdByNormalizedTitle.set(normalizedTitle, song.id);
      continue;
    }
    if (existing !== song.id) {
      songIdByNormalizedTitle.set(normalizedTitle, null);
    }
  }

  const heardSongIdsByEventId = new Map<number, number[]>();
  for (const row of setlistRows) {
    const bucket = heardSongIdsByEventId.get(row.eventId) ?? [];
    let songId = songIdByTitle.get(row.rawTitle);
    if (!songId) {
      const fallbackSongId = songIdByNormalizedTitle.get(normalizeSongTitle(row.rawTitle));
      if (fallbackSongId) songId = fallbackSongId;
    }
    if (songId) bucket.push(songId);
    heardSongIdsByEventId.set(row.eventId, bucket);
  }

  return matchedSnapshots
    .map(({ snapshot, matchedBands }) => {
      const eventRecord = eventRowByEventernoteId.get(snapshot.eventernoteEventId) ?? null;
      return {
        eventId: eventRecord?.id ?? null,
        eventernoteEventId: snapshot.eventernoteEventId,
        title: snapshot.title,
        eventDate: snapshot.eventDate,
        venue: snapshot.venue,
        matchedBandSlugs: matchedBands.map((band) => band.slug),
        matchedBandNames: matchedBands.map((band) => band.nameJa),
        setlistStatus: eventRecord?.setlistStatus ?? null,
        sourceUrl: snapshot.sourceUrl,
        heardSongIds: eventRecord ? heardSongIdsByEventId.get(eventRecord.id) ?? [] : [],
      };
    })
    .sort((left, right) => {
      const dateCompare = right.eventDate.localeCompare(left.eventDate);
      if (dateCompare !== 0) return dateCompare;
      return right.eventernoteEventId - left.eventernoteEventId;
    });
}
