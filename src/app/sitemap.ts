import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { getSitemapEventEntries } from "@/lib/sitemap/event-entries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl();
  const events = await getSitemapEventEntries();
  const eventsLastModified = events.reduce<Date | undefined>(
    (latest, event) =>
      !latest || event.updatedAt > latest ? event.updatedAt : latest,
    undefined,
  );

  return [
    { url: siteUrl },
    {
      url: `${siteUrl}/events`,
      lastModified: eventsLastModified,
    },
    ...events.map((event) => ({
      url: `${siteUrl}/events/${event.eventernoteEventId}`,
      lastModified: event.updatedAt,
    })),
    { url: `${siteUrl}/songs` },
    { url: `${siteUrl}/api` },
  ];
}
