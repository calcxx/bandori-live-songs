import { z } from "zod";
import catalogJson from "@/data/discography-catalog.json";

const discographyCatalogSongSchema = z.object({
  bandSlug: z.string(),
  title: z.string(),
  firstReleaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const discographyCatalogSchema = z.object({
  version: z.literal(2),
  sourceUrl: z.string().url(),
  savedAt: z.string().datetime(),
  songCount: z.number().int().nonnegative(),
  songs: z.array(discographyCatalogSongSchema),
});

const catalog = discographyCatalogSchema.parse(catalogJson);

export function getLocalDiscographyCatalog() {
  return catalog;
}
