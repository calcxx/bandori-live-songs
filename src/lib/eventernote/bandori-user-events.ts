import { z } from "zod";
import type { EventernoteEventSnapshot } from "./parser";
import type { BandoriEventIndexLookup } from "./bandori-event-index";

export const bandoriUserEventSnapshotSchema = z.object({
  eventernoteEventId: z.number().int(),
  title: z.string(),
  eventDate: z.string(),
  venue: z.string().nullable(),
  matchedBandSlugs: z.array(z.string()).min(1),
  sourceUrl: z.string().url(),
});

export type BandoriUserEventSnapshot = z.infer<typeof bandoriUserEventSnapshotSchema>;

/**
 * Match user-page events to BanG Dream bands via actor-page index (eventId → bands).
 * Misses are dropped; list-page actorIds are not used (upstream misalignment bug).
 */
export function createBandoriUserEventSnapshots(
  events: EventernoteEventSnapshot[],
  indexByEventId: Map<number, BandoriEventIndexLookup>,
) {
  return events.flatMap((event) => {
    const indexed = indexByEventId.get(event.eventernoteEventId);
    if (!indexed || indexed.bandSlugs.length === 0) {
      return [];
    }

    return bandoriUserEventSnapshotSchema.parse({
      eventernoteEventId: event.eventernoteEventId,
      title: indexed.title || event.title,
      eventDate: indexed.eventDate || event.eventDate,
      venue: indexed.venue ?? event.venue,
      matchedBandSlugs: [...new Set(indexed.bandSlugs)],
      sourceUrl: event.sourceUrl,
    });
  });
}
