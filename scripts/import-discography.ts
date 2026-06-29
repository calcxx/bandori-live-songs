import { pathToFileURL } from "node:url";
import { getLocalDiscographyCatalog } from "../src/lib/bandori/discography-catalog";
import { connectDatabase } from "../src/lib/db/core";
import { songs } from "../src/lib/db/schema";
import { compareSongsByReleaseDate } from "../src/lib/music/sort";
import { refreshSongLiveState } from "../src/lib/stats/refresh-song-live-state";

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function importDiscography() {
  const { db, sql } = connectDatabase(true);
  const catalogSongs = getLocalDiscographyCatalog().songs;

  try {
    await db.transaction(async (tx) => {
      await tx.delete(songs);

      const songRows = [...catalogSongs].sort(compareSongsByReleaseDate);

      for (const batch of chunk(songRows, 500)) {
        await tx.insert(songs).values(batch);
      }
    });
    await refreshSongLiveState(db);
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importDiscography().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
