import { load } from "cheerio";
import { z } from "zod";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const baseUrl = "https://www.eventernote.com";
const eventernotePageTimeoutMs = 8000;

export const actorEventRankingEntrySchema = z.object({
  eventernoteEventId: z.number().int(),
  title: z.string(),
  eventDate: z.string(),
  venue: z.string().nullable(),
  attendeeCount: z.number().int().nonnegative(),
  sourceUrl: z.string().url(),
  bandSlugs: z.array(z.string()),
  bandNames: z.array(z.string()),
});

export type ActorEventRankingEntry = z.infer<typeof actorEventRankingEntrySchema>;

type ActorEventPageEntry = {
  eventernoteEventId: number;
  title: string;
  eventDate: string;
  venue: string | null;
  attendeeCount: number;
  sourceUrl: string;
  sourceBandSlug: string;
  sourceBandName: string;
};

type ParsedActorEventsPage = {
  events: ActorEventPageEntry[];
  nextPage: number | null;
  totalCount: number | null;
};

function buildHeaders() {
  return {
    "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    "user-agent": userAgent,
  };
}

function parseEventernoteEventId(href: string) {
  const match = href.match(/\/events\/(\d+)/u);
  return match ? Number(match[1]) : null;
}

function parseEventDate(rawText: string) {
  const match = rawText.match(/(\d{4})-(\d{2})-(\d{2})/u);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseAttendeeCount(rawText: string) {
  const normalized = rawText.replace(/\s+/g, "").trim();
  if (!/^\d+$/u.test(normalized)) {
    return null;
  }

  const count = Number(normalized);
  return Number.isSafeInteger(count) ? count : null;
}

export function parseEventernoteActorEventsPage(
  html: string,
  sourceBand: { slug: string; nameJa: string },
): ParsedActorEventsPage {
  const $ = load(html);
  const events: ActorEventPageEntry[] = [];

  $("li.clearfix").each((_, element) => {
    const item = $(element);
    const titleLink = item.find(".event h4 a").first();
    const href = titleLink.attr("href");
    const eventernoteEventId = href ? parseEventernoteEventId(href) : null;
    const sourceUrl = href ? new URL(href, baseUrl).toString() : null;
    const title = titleLink.text().trim();
    const eventDate = parseEventDate(item.find(".date p").first().text());
    const venue = item.find(".event .place a").first().text().trim() || null;
    const attendeeCount = parseAttendeeCount(item.find(".note_count p").first().text());

    if (!eventernoteEventId || !sourceUrl || !title || !eventDate || attendeeCount === null) {
      return;
    }

    events.push({
      eventernoteEventId,
      title,
      eventDate,
      venue,
      attendeeCount,
      sourceUrl,
      sourceBandSlug: sourceBand.slug,
      sourceBandName: sourceBand.nameJa,
    });
  });

  const totalCountText = $(".crumb-content, .topic, body").text();
  const totalCountMatch = totalCountText.match(/(\d+)件のイベントが見つかりました/u);
  const nextHref =
    $(".pagination .next_page a").first().attr("href") ?? $(".pagination .next a").first().attr("href");
  const nextPageRaw = nextHref ? new URL(nextHref, baseUrl).searchParams.get("page") : null;
  const nextPage = nextPageRaw ? Number(nextPageRaw) : null;

  return {
    events,
    nextPage: Number.isNaN(nextPage) ? null : nextPage,
    totalCount: totalCountMatch ? Number(totalCountMatch[1]) : null,
  };
}

async function fetchActorEventsPage(
  actorId: number,
  sourceBand: { slug: string; nameJa: string },
  page = 1,
) {
  const url = new URL(`/actors/${actorId}/events`, baseUrl);
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  const response = await fetchWithTimeout(url, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
    timeoutMs: eventernotePageTimeoutMs,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url.toString()}: ${response.status}`);
  }

  const html = await response.text();
  return parseEventernoteActorEventsPage(html, sourceBand);
}

export async function fetchAllActorEvents(actorId: number, sourceBand: { slug: string; nameJa: string }) {
  const firstPage = await fetchActorEventsPage(actorId, sourceBand, 1);
  const events = [...firstPage.events];
  let nextPage = firstPage.nextPage;

  while (nextPage) {
    const page = await fetchActorEventsPage(actorId, sourceBand, nextPage);
    events.push(...page.events);
    nextPage = page.nextPage;
  }

  return {
    actorId,
    sourceBandSlug: sourceBand.slug,
    sourceBandName: sourceBand.nameJa,
    totalCount: firstPage.totalCount ?? events.length,
    events,
  };
}

export function mergeActorEvents(entries: ActorEventPageEntry[]): ActorEventRankingEntry[] {
  const merged = new Map<number, ActorEventRankingEntry>();

  for (const entry of entries) {
    const existing = merged.get(entry.eventernoteEventId);

    if (!existing) {
      merged.set(entry.eventernoteEventId, {
        eventernoteEventId: entry.eventernoteEventId,
        title: entry.title,
        eventDate: entry.eventDate,
        venue: entry.venue,
        attendeeCount: entry.attendeeCount,
        sourceUrl: entry.sourceUrl,
        bandSlugs: [entry.sourceBandSlug],
        bandNames: [entry.sourceBandName],
      });
      continue;
    }

    existing.attendeeCount = Math.max(existing.attendeeCount, entry.attendeeCount);
    existing.title = existing.title || entry.title;
    existing.eventDate = existing.eventDate || entry.eventDate;
    existing.venue = existing.venue || entry.venue;
    existing.sourceUrl = existing.sourceUrl || entry.sourceUrl;

    if (!existing.bandSlugs.includes(entry.sourceBandSlug)) {
      existing.bandSlugs.push(entry.sourceBandSlug);
    }

    if (!existing.bandNames.includes(entry.sourceBandName)) {
      existing.bandNames.push(entry.sourceBandName);
    }
  }

  return [...merged.values()].sort((left, right) => {
    const attendeeCompare = right.attendeeCount - left.attendeeCount;
    if (attendeeCompare !== 0) {
      return attendeeCompare;
    }

    const dateCompare = right.eventDate.localeCompare(left.eventDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return right.eventernoteEventId - left.eventernoteEventId;
  });
}
