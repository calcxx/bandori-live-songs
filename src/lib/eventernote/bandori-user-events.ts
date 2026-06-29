import { z } from "zod";
import { BAND_SEEDS } from "@/lib/constants/bands";
import type { EventernoteEventSnapshot } from "./parser";

const bandByActorId = new Map(
  BAND_SEEDS.flatMap((band) =>
    band.eventernoteActorId === null ? [] : [[band.eventernoteActorId, band] as const],
  ),
);

export const bandoriUserEventSnapshotSchema = z.object({
  eventernoteEventId: z.number().int(),
  title: z.string(),
  eventDate: z.string(),
  venue: z.string().nullable(),
  matchedBandSlugs: z.array(z.string()).min(1),
  sourceUrl: z.string().url(),
});

export type BandoriUserEventSnapshot = z.infer<typeof bandoriUserEventSnapshotSchema>;

export function createBandoriUserEventSnapshots(events: EventernoteEventSnapshot[]) {
  return events.flatMap((event) => {
    const matchedBandSlugs = [
      ...new Set(
        event.actorIds
          .map((actorId) => bandByActorId.get(actorId)?.slug)
          .filter((slug): slug is string => Boolean(slug)),
      ),
    ];

    if (matchedBandSlugs.length === 0) {
      return [];
    }

    return bandoriUserEventSnapshotSchema.parse({
      eventernoteEventId: event.eventernoteEventId,
      title: event.title,
      eventDate: event.eventDate,
      venue: event.venue,
      matchedBandSlugs,
      sourceUrl: event.sourceUrl,
    });
  });
}
