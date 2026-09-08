import { loadEnvConfig } from "@next/env";
import { pathToFileURL } from "node:url";
import { asc, eq } from "drizzle-orm";
import { connectDatabase } from "../src/lib/db/core";
import { events, setlistEntries, songs } from "../src/lib/db/schema";
import { normalizeSongTitle } from "../src/lib/music/title-utils";
import type { SongCategory } from "../src/lib/music/song-category";
import { refreshSongLiveState } from "../src/lib/stats/refresh-song-live-state";

loadEnvConfig(process.cwd());

export type CleanupSongRow = {
  id: number;
  title: string;
  category: SongCategory;
};

export type CleanupEntryRow = {
  id: number;
  eventernoteEventId: number;
  rawTitle: string;
  songId: number | null;
};

export type SongReferenceCleanupPlan = {
  entryUpdates: Array<{
    entryId: number;
    songId: number;
    rawTitle: string;
  }>;
  unreferencedCoverIds: number[];
  unresolvedEntries: CleanupEntryRow[];
};

export function buildSongReferenceCleanupPlan(
  songRows: CleanupSongRow[],
  entryRows: CleanupEntryRow[],
): SongReferenceCleanupPlan {
  const songById = new Map(songRows.map((song) => [song.id, song]));
  const songByTitle = new Map(songRows.map((song) => [song.title, song]));
  const songsByNormalizedTitle = new Map<string, CleanupSongRow[]>();

  for (const song of songRows) {
    const key = normalizeSongTitle(song.title);
    const bucket = songsByNormalizedTitle.get(key) ?? [];
    bucket.push(song);
    songsByNormalizedTitle.set(key, bucket);
  }

  const entryUpdates: SongReferenceCleanupPlan["entryUpdates"] = [];
  const unresolvedEntries: CleanupEntryRow[] = [];
  const referencedSongIds = new Set<number>();

  for (const entry of entryRows) {
    const linkedSong = entry.songId === null
      ? null
      : songById.get(entry.songId) ?? null;
    const matchingSongs = linkedSong
      ? [linkedSong]
      : songByTitle.get(entry.rawTitle)
        ? [songByTitle.get(entry.rawTitle)!]
        : songsByNormalizedTitle.get(normalizeSongTitle(entry.rawTitle)) ?? [];
    const resolvedSong = matchingSongs.length === 1 ? matchingSongs[0] : null;

    if (!resolvedSong) {
      unresolvedEntries.push(entry);
      continue;
    }

    referencedSongIds.add(resolvedSong.id);
    if (entry.songId !== resolvedSong.id || entry.rawTitle !== resolvedSong.title) {
      entryUpdates.push({
        entryId: entry.id,
        songId: resolvedSong.id,
        rawTitle: resolvedSong.title,
      });
    }
  }

  return {
    entryUpdates,
    unreferencedCoverIds: songRows
      .filter((song) => song.category === "cover" && !referencedSongIds.has(song.id))
      .map((song) => song.id),
    unresolvedEntries,
  };
}

async function loadCleanupPlan(db: ReturnType<typeof connectDatabase>["db"]) {
  const [songRows, entryRows] = await Promise.all([
    db
      .select({
        id: songs.id,
        title: songs.title,
        category: songs.category,
      })
      .from(songs),
    db
      .select({
        id: setlistEntries.id,
        eventernoteEventId: events.eventernoteEventId,
        rawTitle: setlistEntries.rawTitle,
        songId: setlistEntries.songId,
      })
      .from(setlistEntries)
      .innerJoin(events, eq(events.id, setlistEntries.eventId))
      .orderBy(asc(events.eventDate), asc(events.eventernoteEventId), asc(setlistEntries.orderIndex)),
  ]);

  return buildSongReferenceCleanupPlan(songRows, entryRows);
}

function formatPlan(plan: SongReferenceCleanupPlan) {
  return {
    entryUpdates: plan.entryUpdates.length,
    unreferencedCoverIds: plan.unreferencedCoverIds,
    unresolvedEntries: plan.unresolvedEntries.map((entry) => ({
      entryId: entry.id,
      eventernoteEventId: entry.eventernoteEventId,
      rawTitle: entry.rawTitle,
    })),
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { db, sql } = connectDatabase(true);

  try {
    const plan = await loadCleanupPlan(db);
    console.info(JSON.stringify(formatPlan(plan), null, 2));

    if (plan.unresolvedEntries.length > 0) {
      throw new Error("Found setlist entries that do not resolve uniquely to the song library.");
    }

    if (!apply) {
      console.info("[song-references] dry run only; pass --apply to write changes.");
      return;
    }

    await db.transaction(async (tx) => {
      for (const update of plan.entryUpdates) {
        await tx
          .update(setlistEntries)
          .set({
            songId: update.songId,
            rawTitle: update.rawTitle,
          })
          .where(eq(setlistEntries.id, update.entryId));
      }

      for (const songId of plan.unreferencedCoverIds) {
        await tx.delete(songs).where(eq(songs.id, songId));
      }
      await refreshSongLiveState(tx);
    });

    console.info("[song-references] applied cleanup and refreshed live-state flags.");
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
