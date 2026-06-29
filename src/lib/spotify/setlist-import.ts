import * as cheerio from "cheerio";

type SpotifyResourceType = "playlist" | "album" | "track";

type SpotifyResource = {
  type: SpotifyResourceType;
  id: string;
};

export type SpotifySetlistImportResult = {
  sourceTitle: string;
  resourceType: SpotifyResourceType;
  tracks: string[];
};

const spotifyIdPattern = /^[A-Za-z0-9]{10,}$/u;

export function parseSpotifyResource(input: string): SpotifyResource | null {
  const trimmed = input.trim();

  const uriMatch = trimmed.match(/^spotify:(playlist|album|track):([A-Za-z0-9]+)$/iu);
  if (uriMatch) {
    return {
      type: uriMatch[1].toLowerCase() as SpotifyResourceType,
      id: uriMatch[2],
    };
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");
    if (hostname !== "open.spotify.com") {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const embedIndex = parts[0] === "embed" ? 1 : parts[0]?.startsWith("intl-") ? 1 : 0;
    const type = parts[embedIndex];
    const id = parts[embedIndex + 1];

    if (type !== "playlist" && type !== "album" && type !== "track") {
      return null;
    }

    if (!id || !spotifyIdPattern.test(id)) {
      return null;
    }

    return { type, id };
  } catch {
    return null;
  }
}

function buildSpotifyEmbedUrl(resource: SpotifyResource) {
  return `https://open.spotify.com/embed/${resource.type}/${resource.id}`;
}

function getNextData(html: string) {
  const $ = cheerio.load(html);
  const rawNextData = $("#__NEXT_DATA__").text().trim();
  if (!rawNextData) {
    throw new Error("Spotify 页面结构已变化，未找到曲目数据。");
  }

  try {
    return JSON.parse(rawNextData) as unknown;
  } catch {
    throw new Error("Spotify 曲目数据解析失败。");
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getNestedRecord(value: unknown, path: string[]) {
  let cursor: unknown = value;
  for (const key of path) {
    const record = getRecord(cursor);
    if (!record) {
      return null;
    }
    cursor = record[key];
  }

  return getRecord(cursor);
}

export function parseSpotifyEmbedPage(html: string, expectedType?: SpotifyResourceType): SpotifySetlistImportResult {
  const nextData = getNextData(html);
  const entity = getNestedRecord(nextData, ["props", "pageProps", "state", "data", "entity"]);
  if (!entity) {
    throw new Error("Spotify 页面结构已变化，未找到曲目数据。");
  }

  const resourceType = entity.type;
  if (resourceType !== "playlist" && resourceType !== "album" && resourceType !== "track") {
    throw new Error("暂不支持该 Spotify 链接类型。");
  }

  if (expectedType && resourceType !== expectedType) {
    throw new Error("Spotify 返回的资源类型与链接不一致。");
  }

  const sourceTitle = typeof entity.title === "string" && entity.title.trim().length > 0
    ? entity.title.trim()
    : "Spotify 歌单";

  if (resourceType === "track") {
    return {
      sourceTitle,
      resourceType,
      tracks: [sourceTitle],
    };
  }

  const trackList = Array.isArray(entity.trackList) ? entity.trackList : [];
  const tracks = trackList
    .map((track) => getRecord(track)?.title)
    .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
    .map((title) => title.trim());

  if (tracks.length === 0) {
    throw new Error("没有从 Spotify 链接中解析到歌曲。");
  }

  return {
    sourceTitle,
    resourceType,
    tracks,
  };
}

export async function fetchSpotifySetlist(input: string): Promise<SpotifySetlistImportResult> {
  const resource = parseSpotifyResource(input);
  if (!resource) {
    throw new Error("请填写 Spotify playlist、album 或 track 链接。");
  }

  const response = await fetch(buildSpotifyEmbedUrl(resource), {
    headers: {
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7",
      "User-Agent": "Mozilla/5.0 (compatible; bdrsongs-setlist-import/1.0)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Spotify 链接读取失败（HTTP ${response.status}）。`);
  }

  return parseSpotifyEmbedPage(await response.text(), resource.type);
}
