import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { BAND_SEEDS } from "../src/lib/constants/bands";
import { connectDatabase } from "../src/lib/db/core";
import { bands } from "../src/lib/db/schema";

export async function seedBands() {
  const { db, sql: connection } = connectDatabase(true);

  try {
    await db
      .insert(bands)
      .values(
        BAND_SEEDS.map((band) => ({
          slug: band.slug,
          nameJa: band.nameJa,
          nameEn: band.nameEn,
          displayOrder: band.displayOrder,
          groupType: band.groupType,
          eventernoteActorId: band.eventernoteActorId,
        })),
      )
      .onConflictDoUpdate({
        target: bands.slug,
        set: {
          nameJa: sql`excluded.name_ja`,
          nameEn: sql`excluded.name_en`,
          displayOrder: sql`excluded.display_order`,
          groupType: sql`excluded.group_type`,
          eventernoteActorId: sql`excluded.eventernote_actor_id`,
          updatedAt: new Date(),
        },
      });
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedBands().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
