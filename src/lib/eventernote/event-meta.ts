import { load } from "cheerio";
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

const EVENT_TITLE_TAGS = [
  "出演者変更",
  "振替",
  "振替公演",
  "振替試合",
  "時間変更",
  "試合中止 ※ステージのみ",
  "出演者一部キャンセル",
] as const;

const EVENT_TITLE_TAG_PATTERN = EVENT_TITLE_TAGS
  .map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
  .join("|");

const TITLE_PREFIX_TAG_PATTERN = new RegExp(
  `^\\s*[【\\[]\\s*(?:${EVENT_TITLE_TAG_PATTERN})\\s*[】\\]]\\s*`,
  "u",
);
const TITLE_SUFFIX_TAG_PATTERN = new RegExp(
  `\\s*[【\\[]\\s*(?:${EVENT_TITLE_TAG_PATTERN})\\s*[】\\]]\\s*$`,
  "u",
);

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

export function sanitizeEventernoteEventTitle(input: string) {
  let title = normalizeText(input);

  while (TITLE_PREFIX_TAG_PATTERN.test(title) || TITLE_SUFFIX_TAG_PATTERN.test(title)) {
    title = title.replace(TITLE_PREFIX_TAG_PATTERN, "").replace(TITLE_SUFFIX_TAG_PATTERN, "").trim();
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

export function parseEventernoteEventMetaPage(html: string, eventernoteEventId: number): EventernoteEventMeta {
  const $ = load(html);
  const ogTitle = normalizeText($("meta[property='og:title']").attr("content") ?? "");
  const titleTag = normalizeText($("title").text()).replace(/\s*Eventernote.*$/u, "").trim();
  const title = sanitizeEventernoteEventTitle(
    ogTitle ||
      extractKeyedTableValue(html, ["公演名", "タイトル"]) ||
      titleTag,
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
  const response = await fetchWithTimeout(url, {
    headers: {
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "user-agent": EVENTERNOTE_USER_AGENT,
    },
    next: { revalidate: 0 },
    timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`无法读取 Eventernote 活动页面（HTTP ${response.status}）`);
  }

  const html = await response.text();
  return parseEventernoteEventMetaPage(html, eventernoteEventId);
}
