import "server-only";

import { eq, lte } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/core";
import { bands, songs } from "@/lib/db/schema";
import { getCurrentReleaseDate } from "@/lib/music/release-date";
import type { SongPoolItem } from "./aggregate";

type SongCatalog = {
  songsWithLiveState: SongPoolItem[];
};

const getSongCatalogCached = unstable_cache(
  async (releasedThroughDate: string): Promise<SongCatalog> => {
    const db = getDb();
    const songRows = await db
      .select({
        id: songs.id,
        bandSlug: songs.bandSlug,
        bandNameJa: bands.nameJa,
        bandDisplayOrder: bands.displayOrder,
        bandGroupType: bands.groupType,
        title: songs.title,
        firstReleaseDate: songs.firstReleaseDate,
        hasBeenPlayedLive: songs.hasBeenPlayedLive,
      })
      .from(songs)
      .innerJoin(bands, eq(songs.bandSlug, bands.slug))
      .where(lte(songs.firstReleaseDate, releasedThroughDate));

    return {
      songsWithLiveState: songRows satisfies SongPoolItem[],
    };
  },
  ["song-catalog"],
  {
    revalidate: 60 * 5,
    tags: ["song-catalog"],
  },
);

export async function getSongCatalog() {
  return getSongCatalogCached(getCurrentReleaseDate());
}
