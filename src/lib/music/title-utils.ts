const EXCLUSION_PATTERNS = [
  /instrumental/i,
  /off vocal/i,
  /drama/i,
  /ドラマ(?!チック)/,
  /bonus track/i,
  /tv size/i,
  /anime size/i,
  /game size/i,
  /\bmv\b/i,
  /アフタートーク/,
];

const VERSION_SUFFIX_PATTERNS = [
  /\s*(?:-\s*)?instrumental(?:\s*-)?\s*$/i,
  /\s*\/\s*[^/]*?(ver\.?|version)[^/]*$/i,
  /\s*[（(][^()]*?(ver\.?|version|tv size|anime size|game size|remix|remaster|feat\.|featuring|パラレルver|ソロver|solo ver)[^()]*[)）]\s*$/i,
  /\s*[~〜～]\s*[^~〜～]*?(acoustic|ver\.?|version|tv size|anime size|game size|remix|remaster|feat\.|featuring|パラレルver|ソロver|solo ver)[^~〜～]*[~〜～]\s*$/i,
];

const TRAILING_CREDIT_PATTERNS = [
  /\s*\/\s*(?:CiRCLE THANKS PARTY[!！]?スペシャルバンド|CiRCLE THANKS PARTY[!！]? Special Band)$/u,
  /\s+(?:Poppin'Party|Afterglow|Pastel[*＊✽]Palettes|Roselia|ハロー、ハッピーワールド[!！]|Morfonica|RAISE A SUILEN|MyGO!!!!!|Ave Mujica|夢限大みゅーたいぷ)(?:×(?:Poppin'Party|Afterglow|Pastel[*＊✽]Palettes|Roselia|ハロー、ハッピーワールド[!！]|Morfonica|RAISE A SUILEN|MyGO!!!!!|Ave Mujica|夢限大みゅーたいぷ))+$/u,
];

const TRAILING_METADATA_PATTERNS = [
  /\s*[（(][^()（）]*?(tvアニメ|アニメ|主題歌|opテーマ|edテーマ|挿入歌|テーマソング|for nintendo switch|オープニングテーマ|エンディングテーマ)[^()（）]*[)）]\s*$/iu,
];

const nfkcMemo = new Map<string, string>();

export function normalizeNFKC(raw: string) {
  const cached = nfkcMemo.get(raw);
  if (cached !== undefined) return cached;
  const result = raw.normalize("NFKC");
  nfkcMemo.set(raw, result);
  return result;
}

export function formatSongTitleForDisplay(title: string) {
  return title
    .replace(/[‘’＇]/g, "'")
    .replace(/[“”„‟〝〞＂「」『』]/g, '"');
}

export function stripTrackIndex(rawTitle: string) {
  return rawTitle
    .replace(/^\s*(?:disc\s*\d+\s*)?/, "")
    .replace(/^\s*(?:(?:[a-z]{1,4}\s*)?\d+\s*[\.:：)\]-]+\s*|(?:[a-z]{1,4}\s*)?\d+[\t \u3000]+|[a-z]{1,4}\d+\s*)/i, "")
    .trim();
}

export function isExcludedTrackTitle(rawTitle: string) {
  const normalized = normalizeNFKC(stripTrackIndex(rawTitle));
  return EXCLUSION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function canonicalizeSongTitle(rawTitle: string) {
  let title = stripTrackIndex(rawTitle);

  for (const pattern of VERSION_SUFFIX_PATTERNS) {
    title = title.replace(pattern, "").trim();
  }

  for (const pattern of TRAILING_METADATA_PATTERNS) {
    title = title.replace(pattern, "").trim();
  }

  for (const pattern of TRAILING_CREDIT_PATTERNS) {
    title = title.replace(pattern, "").trim();
  }

  title = title.replace(/\s+/g, " ").trim();
  return title;
}

export function normalizeSongTitle(rawTitle: string) {
  return normalizeNFKC(canonicalizeSongTitle(rawTitle))
    .toLowerCase()
    .replace(/[〜～]/g, "~")
    .replace(/[‘’']/g, "'")
    .replace(/[“”„‟〝〞＂「」『』]/g, '"')
    .replace(/讚/g, "讃")
    .replace(/天下[卜ト]ーイツ\s*a to z☆/g, "天下トーイツ a to z☆")
    .replace(/\s+/g, " ")
    .trim();
}
