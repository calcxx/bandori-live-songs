import "server-only";

import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/core";
import { events, setlistEntries } from "@/lib/db/schema";

export type SitemapEventEntry = {
  eventernoteEventId: number;
  updatedAt: Date;
};

export const getSitemapEventEntries = unstable_cache(
  async (): Promise<SitemapEventEntry[]> => {
    const db = getDb();

    return db
      .selectDistinct({
        eventernoteEventId: events.eventernoteEventId,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .innerJoin(setlistEntries, eq(setlistEntries.eventId, events.id))
      .orderBy(asc(events.eventernoteEventId));
  },
  ["sitemap-event-entries-v1"],
  {
    revalidate: 60 * 60 * 24,
    tags: ["sitemap-events"],
  },
);
