import { load } from "cheerio";
import { defaultEventTitleTagsToStrip } from "@/lib/events/event-visibility";
import { readEventVisibilityRules } from "@/lib/events/event-visibility-rules-store";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

const EVENTERNOTE_BASE_URL = "https://www.eventernote.com";
const EVENTERNOTE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

export type EventernoteEventMeta = {
  eventernoteEventId: number;
  title: string;
  eventDate: string;
  venue: string | null;
};

function parseDateFromText(input: string) {
  const match = input.match(/(\d{4})[-/.年](\d{2})[-/.月](\d{2})/u);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function createTitleTagPatterns(titleTags: readonly string[]) {
  const tagPattern = [...new Set(
    titleTags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
  )]
    .map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("|");
  if (!tagPattern) {
    return null;
  }

  return {
    prefix: new RegExp(
      `^\\s*[【\\[]\\s*(?:${tagPattern})\\s*[】\\]]\\s*`,
      "u",
    ),
    suffix: new RegExp(
      `\\s*[【\\[]\\s*(?:${tagPattern})\\s*[】\\]]\\s*$`,
      "u",
    ),
  };
}

export function sanitizeEventernoteEventTitle(
  input: string,
  titleTags: readonly string[] = defaultEventTitleTagsToStrip,
) {
  let title = normalizeText(input);
  const patterns = createTitleTagPatterns(titleTags);
  if (!patterns) {
    return title;
  }

  while (patterns.prefix.test(title) || patterns.suffix.test(title)) {
    title = title
      .replace(patterns.prefix, "")
      .replace(patterns.suffix, "")
      .trim();
  }

  return title;
}

function normalizeLabel(input: string) {
  return normalizeText(input).replace(/[：:]/g, "");
}

function extractKeyedTableValue(html: string, keys: string[]) {
  const $ = load(html);
  const normalizedKeys = new Set(keys.map((key) => normalizeLabel(key)));

  for (const row of $("table tr").toArray()) {
    const cells = $(row).children("th,td").toArray();

    for (let index = 0; index < cells.length - 1; index += 2) {
      const label = normalizeLabel($(cells[index]).text());
      if (!normalizedKeys.has(label)) {
        continue;
      }

      const value = normalizeText($(cells[index + 1]).text());
      if (value) {
        return value;
      }
    }
  }

  return null;
}

export function parseEventernoteEventMetaPage(
  html: string,
  eventernoteEventId: number,
  titleTags: readonly string[] = defaultEventTitleTagsToStrip,
): EventernoteEventMeta {
  const $ = load(html);
  const ogTitle = normalizeText($("meta[property='og:title']").attr("content") ?? "");
  const titleTag = normalizeText($("title").text()).replace(/\s*Eventernote.*$/u, "").trim();
  const title = sanitizeEventernoteEventTitle(
    ogTitle ||
      extractKeyedTableValue(html, ["公演名", "タイトル"]) ||
      titleTag,
    titleTags,
  );

  const eventDate =
    $("time[datetime]")
      .map((_, element) => parseDateFromText($(element).attr("datetime") ?? ""))
      .get()
      .find((value): value is string => Boolean(value)) ??
    parseDateFromText(extractKeyedTableValue(html, ["開催日時", "日程"]) ?? "") ??
    parseDateFromText($(".table").first().text()) ??
    parseDateFromText($.text());

  const venue = extractKeyedTableValue(html, ["開催場所", "場所", "会場"]);

  if (!title || !eventDate) {
    throw new Error("无法从 Eventernote 页面解析活动标题或日期，请确认链接/编号是否正确。");
  }

  return {
    eventernoteEventId,
    title,
    eventDate,
    venue,
  };
}

export async function fetchEventMetaFromEventernote(eventernoteEventId: number, timeoutMs = 8000) {
  const url = `${EVENTERNOTE_BASE_URL}/events/${eventernoteEventId}`;
  const [html, rules] = await Promise.all([
    fetchWithTimeout(url, {
      headers: {
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        "user-agent": EVENTERNOTE_USER_AGENT,
      },
      next: { revalidate: 0 },
      timeoutMs,
    }, async (response) => {
      if (!response.ok) {
        throw new Error(`无法读取 Eventernote 活动页面（HTTP ${response.status}）`);
      }
      return response.text();
    }),
    readEventVisibilityRules(),
  ]);

  return parseEventernoteEventMetaPage(
    html,
    eventernoteEventId,
    rules.titleTagsToStrip,
  );
}
