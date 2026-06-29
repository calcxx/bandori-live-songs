import { load } from "cheerio";
import { z } from "zod";

const baseUrl = "https://www.eventernote.com";

export const eventernoteEventSnapshotSchema = z.object({
  eventernoteEventId: z.number().int(),
  title: z.string(),
  eventDate: z.string(),
  venue: z.string().nullable(),
  actorIds: z.array(z.number().int()),
  actorNames: z.array(z.string()),
  sourceUrl: z.string().url(),
});

export type EventernoteEventSnapshot = z.infer<typeof eventernoteEventSnapshotSchema>;

export type ParsedEventernotePage = {
  events: EventernoteEventSnapshot[];
  nextPage: number | null;
  totalCount: number | null;
  pageItemCount: number;
  discoveredPages: number[];
  missingUser: boolean;
  displayId: string | null;
  displayName: string | null;
};

export type EventernoteUserProfile = {
  displayId: string | null;
  displayName: string | null;
};

function parseEventDate(rawText: string) {
  const match = rawText.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseEventernoteId(href: string, segment: "events" | "actors") {
  const match =
    segment === "actors"
      ? href.match(/actors\/(?:.+\/)?(\d+)/)
      : href.match(/events\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function parsePaginationPages($: ReturnType<typeof load>) {
  return [...new Set(
    $(".pagination a[href*='page=']")
      .map((_, link) => Number(new URL($(link).attr("href") ?? "", baseUrl).searchParams.get("page")))
      .get()
      .filter((page) => Number.isFinite(page) && page >= 1),
  )].sort((left, right) => left - right);
}

function parseNextUserEventsPage($: ReturnType<typeof load>) {
  const paginationPages = parsePaginationPages($);
  const explicitNextHref =
    $(".pagination .next a").first().attr("href") ??
    $(".pagination .next_page a").first().attr("href") ??
    $(".pagination a[rel='next']").first().attr("href");
  const explicitNextPage = explicitNextHref ? Number(new URL(explicitNextHref, baseUrl).searchParams.get("page")) : null;

  if (explicitNextPage && !Number.isNaN(explicitNextPage)) {
    return explicitNextPage;
  }

  const activePage = Number($(".pagination li.active").first().text().trim());
  if (!Number.isNaN(activePage)) {
    const nextByActivePage = paginationPages.find((page) => page > activePage);
    if (nextByActivePage) {
      return nextByActivePage;
    }
  }

  return paginationPages.find((page) => page > 1) ?? null;
}

export function parseEventernoteUserEventsPage(html: string) {
  const $ = load(html);

  const missingUser =
    $("title").text().trim() === "Eventernote イベンターノート" &&
    $(".alert-danger")
      .text()
      .includes("指定されたユーザーは見つかりませんでした");

  const totalCount = Number($(".gb_subtitle").first().text().match(/\((\d+)件\)/)?.[1] ?? "");
  const discoveredPages = parsePaginationPages($);
  const displayId = $(".gb_users_side_profile .desc .name1").first().text().trim() || null;
  const displayName = $(".gb_users_side_profile .desc .name2").first().text().trim() || null;
  const events: EventernoteEventSnapshot[] = [];
  const primaryEventRows = $(".gb_event_list").first().children("ul").first().children("li.clearfix");
  const fallbackEventRows = $(".event_info.clearfix").filter((_, element) => $(element).parents(".event_info.clearfix").length === 0);
  const eventRows = primaryEventRows.length > 0 ? primaryEventRows : fallbackEventRows;
  const pageItemCount = eventRows.length;

  eventRows.each((_, element) => {
    const item = $(element);
    const eventCard = item.children(".event").first();
    const titleLink = eventCard.children("h4").find("a").first();
    const href = titleLink.attr("href");
    const eventernoteEventId = href ? parseEventernoteId(href, "events") : null;
    const sourceUrl = href ? new URL(href, baseUrl).toString() : null;
    const eventDate = parseEventDate(item.children(".date").find("p").first().text());
    const venue = eventCard.children(".place").first().find("a").first().text().trim() || null;
    const actorLinks = eventCard.children(".actor").find("a[href*='/actors/']");
    const actorIds = actorLinks
      .map((__, tag) => parseEventernoteId($(tag).attr("href") ?? "", "actors"))
      .get()
      .filter((value): value is number => value !== null);
    const actorNames = actorLinks
      .map((__, tag) => $(tag).text().trim())
      .get()
      .filter(Boolean);

    if (!eventernoteEventId || !sourceUrl || !eventDate) {
      return;
    }

    events.push(
      eventernoteEventSnapshotSchema.parse({
        eventernoteEventId,
        title: titleLink.text().trim(),
        eventDate,
        venue,
        actorIds,
        actorNames,
        sourceUrl,
      }),
    );
  });

  const nextPage = parseNextUserEventsPage($);

  return {
    events,
    nextPage: Number.isNaN(nextPage) ? null : nextPage,
    totalCount: Number.isNaN(totalCount) ? null : totalCount,
    pageItemCount,
    discoveredPages,
    missingUser,
    displayId,
    displayName,
  } satisfies ParsedEventernotePage;
}

export function parseEventernoteUserProfilePage(html: string): EventernoteUserProfile & { missingUser: boolean } {
  const $ = load(html);
  const missingUser =
    $("title").text().trim() === "Eventernote イベンターノート" &&
    $(".alert-danger")
      .text()
      .includes("指定されたユーザーは見つかりませんでした");

  return {
    missingUser,
    displayId: $(".gb_users_side_profile .desc .name1").first().text().trim() || null,
    displayName: $(".gb_users_side_profile .desc .name2").first().text().trim() || null,
  };
}
