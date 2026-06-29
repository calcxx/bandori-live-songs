export type BandGroupType = "band" | "project-common";

export type BandSeed = {
  slug: string;
  nameJa: string;
  nameEn: string;
  displayOrder: number;
  groupType: BandGroupType;
  eventernoteActorId: number | null;
  supportColor: string | null;
  aliases: string[];
};

export const PROJECT_COMMON_SLUG = "project-common";

export const BAND_SEEDS: BandSeed[] = [
  {
    slug: PROJECT_COMMON_SLUG,
    nameJa: "企划共通",
    nameEn: "Project Common",
    displayOrder: 0,
    groupType: "project-common",
    eventernoteActorId: null,
    supportColor: null,
    aliases: ["企划共通", "Project Common"],
  },
  {
    slug: "poppin-party",
    nameJa: "Poppin'Party",
    nameEn: "Poppin'Party",
    displayOrder: 1,
    groupType: "band",
    eventernoteActorId: 14234,
    supportColor: "#FF3377",
    aliases: ["Poppin'Party", "Poppin&#039;Party"],
  },
  {
    slug: "afterglow",
    nameJa: "Afterglow",
    nameEn: "Afterglow",
    displayOrder: 2,
    groupType: "band",
    eventernoteActorId: 26775,
    supportColor: "#EE3344",
    aliases: ["Afterglow"],
  },
  {
    slug: "pastel-palettes",
    nameJa: "Pastel＊Palettes",
    nameEn: "Pastel*Palettes",
    displayOrder: 3,
    groupType: "band",
    eventernoteActorId: 26774,
    supportColor: "#33DDAA",
    aliases: ["Pastel＊Palettes", "Pastel*Palettes", "Pastel✽Palettes"],
  },
  {
    slug: "roselia",
    nameJa: "Roselia",
    nameEn: "Roselia",
    displayOrder: 4,
    groupType: "band",
    eventernoteActorId: 24401,
    supportColor: "#3344AA",
    aliases: ["Roselia"],
  },
  {
    slug: "hello-happy-world",
    nameJa: "ハロー、ハッピーワールド！",
    nameEn: "Hello, Happy World!",
    displayOrder: 5,
    groupType: "band",
    eventernoteActorId: 26659,
    supportColor: "#FFDD00",
    aliases: ["ハロー、ハッピーワールド！", "ハロー、ハッピーワールド!", "Hello, Happy World!"],
  },
  {
    slug: "raise-a-suilen",
    nameJa: "RAISE A SUILEN",
    nameEn: "RAISE A SUILEN",
    displayOrder: 6,
    groupType: "band",
    eventernoteActorId: 39397,
    supportColor: "#33CCCC",
    aliases: ["RAISE A SUILEN", "RAISEASUILEN"],
  },
  {
    slug: "morfonica",
    nameJa: "Morfonica",
    nameEn: "Morfonica",
    displayOrder: 7,
    groupType: "band",
    eventernoteActorId: 55819,
    supportColor: "#33AAFF",
    aliases: ["Morfonica", "Morƒonica"],
  },
  {
    slug: "mygo",
    nameJa: "MyGO!!!!!",
    nameEn: "MyGO!!!!!",
    displayOrder: 8,
    groupType: "band",
    eventernoteActorId: 66346,
    supportColor: "#3388BB",
    aliases: ["MyGO!!!!!"],
  },
  {
    slug: "ave-mujica",
    nameJa: "Ave Mujica",
    nameEn: "Ave Mujica",
    displayOrder: 9,
    groupType: "band",
    eventernoteActorId: 70564,
    supportColor: "#881144",
    aliases: ["Ave Mujica"],
  },
  {
    slug: "mugendai-mewtype",
    nameJa: "夢限大みゅーたいぷ",
    nameEn: "Mugendai Mewtype",
    displayOrder: 10,
    groupType: "band",
    eventernoteActorId: 75117,
    supportColor: "#FF7788",
    aliases: ["夢限大みゅーたいぷ", "夢限大MewType", "Mugendai Mewtype", "BDP Yumemita"],
  },
  {
    slug: "millsage",
    nameJa: "millsage",
    nameEn: "millsage",
    displayOrder: 11,
    groupType: "band",
    eventernoteActorId: 89847,
    supportColor: "#AA22EE",
    aliases: ["millsage", "みるさーじゅ"],
  },
  {
    slug: "ikka-dumb-rock",
    nameJa: "一家Dumb Rock!",
    nameEn: "Ikka Dumb Rock!",
    displayOrder: 12,
    groupType: "band",
    eventernoteActorId: 89848,
    supportColor: "#FFAA33",
    aliases: ["一家Dumb Rock!", "一家Dumb Rock！", "いっかだんらん"],
  },
];

const commonArtistMarkers = [
  "シャッフルユニット",
  "その他",
  "Various Artists",
  "CiRCLE THANKS PARTY! Special Band",
];

const COMMON_ARTIST_MARKERS = new Set(commonArtistMarkers.map((value) => value.toLowerCase()));

export const BAND_ALIAS_TO_SLUG = new Map(
  BAND_SEEDS.flatMap((band) =>
    band.aliases.map((alias) => [alias.toLowerCase(), band.slug] as const),
  ),
);

export const DEFAULT_VISIBLE_BAND_SLUGS = new Set([
  "poppin-party",
  "roselia",
  "morfonica",
  "raise-a-suilen",
  "mygo",
  "ave-mujica",
  "mugendai-mewtype",
]);
const BAND_SUPPORT_COLOR_MAP = new Map(
  BAND_SEEDS
    .filter((band): band is BandSeed & { supportColor: string } => band.supportColor !== null)
    .map((band) => [band.slug, band.supportColor] as const),
);

export function getBandSupportColor(slug: string) {
  return BAND_SUPPORT_COLOR_MAP.get(slug) ?? null;
}

export function getBandTextColor(slug: string) {
  if (slug === "ave-mujica") return "var(--ave-mujica-highlight)";
  if (slug === "roselia") return "var(--roselia-highlight)";
  if (slug === "hello-happy-world") return "var(--hello-happy-highlight)";
  return getBandSupportColor(slug);
}

export function resolveBandSlugFromArtistLabels(labels: string[]) {
  const matchedSlugs = new Set<string>();

  for (const label of labels) {
    const normalized = label.trim().toLowerCase();
    const slug = BAND_ALIAS_TO_SLUG.get(normalized);

    if (slug && slug !== PROJECT_COMMON_SLUG) {
      matchedSlugs.add(slug);
      continue;
    }

    if (COMMON_ARTIST_MARKERS.has(normalized)) {
      return PROJECT_COMMON_SLUG;
    }
  }

  if (matchedSlugs.size > 1) {
    return PROJECT_COMMON_SLUG;
  }

  return matchedSlugs.size === 1 ? [...matchedSlugs][0] : null;
}
