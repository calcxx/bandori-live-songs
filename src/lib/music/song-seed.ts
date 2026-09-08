import { z } from "zod";
import catalogJson from "@/data/song-seed.json";

const songSeedEntrySchema = z.object({
  bandSlug: z.string(),
  title: z.string(),
  firstReleaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const songSeedSchema = z.object({
  version: z.literal(2),
  songs: z.array(songSeedEntrySchema),
});

const catalog = songSeedSchema.parse(catalogJson);

export function getSongSeed() {
  return catalog;
}
