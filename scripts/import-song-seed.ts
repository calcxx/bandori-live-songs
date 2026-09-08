import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { getSongSeed } from "../src/lib/music/song-seed";
import { PROJECT_COMMON_SLUG } from "../src/lib/constants/bands";
import { connectDatabase } from "../src/lib/db/core";
import { songs } from "../src/lib/db/schema";
import { compareSongsByReleaseDate } from "../src/lib/music/sort";
import { refreshSongLiveState } from "../src/lib/stats/refresh-song-live-state";

loadEnvConfig(process.cwd());

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function planSongSeedImport(
  catalogSongs: Array<{
    bandSlug: string;
    title: string;
    firstReleaseDate: string;
  }>,
  existingRows: Array<{
    id: number;
    title: string;
    category: "original" | "cover" | "project-common";
  }>,
) {
  const existingByTitle = new Map(
    existingRows.map((song) => [song.title, song]),
  );
  const inserts: Array<typeof songs.$inferInsert> = [];
  const updates: Array<{
    id: number;
    bandSlug: string | null;
    firstReleaseDate: string;
  }> = [];
  const conflicts: Array<{
    title: string;
    existingCategory: "original" | "cover" | "project-common";
  }> = [];

  for (const song of catalogSongs) {
    const projectCommon = song.bandSlug === PROJECT_COMMON_SLUG;
    const category = projectCommon ? "project-common" : "original";
    const existing = existingByTitle.get(song.title);

    if (!existing) {
      inserts.push({
        bandSlug: projectCommon ? null : song.bandSlug,
        category,
        title: song.title,
        firstReleaseDate: song.firstReleaseDate,
      });
      continue;
    }

    if (existing.category !== category) {
      conflicts.push({
        title: song.title,
        existingCategory: existing.category,
      });
      continue;
    }

    updates.push({
      id: existing.id,
      bandSlug: projectCommon ? null : song.bandSlug,
      firstReleaseDate: song.firstReleaseDate,
    });
  }

  return { inserts, updates, conflicts };
}

export async function importSongSeed() {
  const { db, sql } = connectDatabase(true);
  const catalogSongs = getSongSeed().songs;

  try {
    await db.transaction(async (tx) => {
      const songRows = [...catalogSongs].sort(compareSongsByReleaseDate);
      const existingRows = await tx
        .select({
          id: songs.id,
          title: songs.title,
          category: songs.category,
        })
        .from(songs);
      const plan = planSongSeedImport(
        songRows,
        existingRows,
      );

      for (const conflict of plan.conflicts) {
        console.warn(
          `[song-seed] preserve manual ${conflict.existingCategory} song with conflicting title: ${conflict.title}`,
        );
      }
      for (const update of plan.updates) {
        await tx
          .update(songs)
          .set({
            bandSlug: update.bandSlug,
            firstReleaseDate: update.firstReleaseDate,
            updatedAt: new Date(),
          })
          .where(eq(songs.id, update.id));
      }

      for (const batch of chunk(plan.inserts, 500)) {
        await tx.insert(songs).values(batch).onConflictDoNothing({
          target: songs.title,
        });
      }
      await refreshSongLiveState(tx);
    });
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importSongSeed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
