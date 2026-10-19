export type BandGroupType = "band" | "project-common";

export type BandSeed = {
  slug: string;
  nameJa: string;
  nameEn: string;
  displayOrder: number;
  groupType: BandGroupType;
  eventernoteActorId: number | null;
  additionalEventernoteActorIds?: number[];
  musicbrainzArtistMbid: string | null;
  supportColor: string | null;
  searchAliases: string[];
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
    musicbrainzArtistMbid: null,
    supportColor: null,
    searchAliases: [],
  },
  {
    slug: "poppin-party",
    nameJa: "Poppin'Party",
    nameEn: "Poppin'Party",
    displayOrder: 1,
    groupType: "band",
    eventernoteActorId: 14234,
    musicbrainzArtistMbid: "9cacc8a5-fb40-4584-aea2-591172da6e84",
    supportColor: "#FF3377",
    searchAliases: ["ppp", "popipa", "ポピパ"],
  },
  {
    slug: "afterglow",
    nameJa: "Afterglow",
    nameEn: "Afterglow",
    displayOrder: 2,
    groupType: "band",
    eventernoteActorId: 26775,
    musicbrainzArtistMbid: "3e0a5471-46af-4c01-bb2e-11b24c1b55fe",
    supportColor: "#EE3344",
    searchAliases: ["ag"],
  },
  {
    slug: "pastel-palettes",
    nameJa: "Pastel＊Palettes",
    nameEn: "Pastel*Palettes",
    displayOrder: 3,
    groupType: "band",
    eventernoteActorId: 26774,
    musicbrainzArtistMbid: "88ad1c3e-53f2-4279-9b75-f0b5bad6a4f6",
    supportColor: "#33DDAA",
    searchAliases: ["pp"],
  },
  {
    slug: "roselia",
    nameJa: "Roselia",
    nameEn: "Roselia",
    displayOrder: 4,
    groupType: "band",
    eventernoteActorId: 24401,
    musicbrainzArtistMbid: "adea3c3d-a84d-4f9e-ac0b-1ef71a8947a5",
    supportColor: "#3344AA",
    searchAliases: [],
  },
  {
    slug: "hello-happy-world",
    nameJa: "ハロー、ハッピーワールド！",
    nameEn: "Hello, Happy World!",
    displayOrder: 5,
    groupType: "band",
    eventernoteActorId: 26659,
    musicbrainzArtistMbid: "f547cbe6-8293-4a43-800d-f641313f304f",
    supportColor: "#FFDD00",
    searchAliases: ["hhw"],
  },
  {
    slug: "raise-a-suilen",
    nameJa: "RAISE A SUILEN",
    nameEn: "RAISE A SUILEN",
    displayOrder: 6,
    groupType: "band",
    eventernoteActorId: 39397,
    // THE THIRD(仮) events belong to RAISE A SUILEN.
    additionalEventernoteActorIds: [34386],
    musicbrainzArtistMbid: "a94984e8-ac5a-401d-8548-0f4eb2153f28",
    supportColor: "#33CCCC",
    searchAliases: ["ras"],
  },
  {
    slug: "morfonica",
    nameJa: "Morfonica",
    nameEn: "Morfonica",
    displayOrder: 7,
    groupType: "band",
    eventernoteActorId: 55819,
    musicbrainzArtistMbid: "f7b13d35-d405-4c59-8ecf-0368c8b43ddd",
    supportColor: "#33AAFF",
    searchAliases: ["monica", "モニカ"],
  },
  {
    slug: "mygo",
    nameJa: "MyGO!!!!!",
    nameEn: "MyGO!!!!!",
    displayOrder: 8,
    groupType: "band",
    eventernoteActorId: 66346,
    musicbrainzArtistMbid: "be91faa6-5277-4b73-b97c-10786db10598",
    supportColor: "#3388BB",
    searchAliases: ["mygo"],
  },
  {
    slug: "ave-mujica",
    nameJa: "Ave Mujica",
    nameEn: "Ave Mujica",
    displayOrder: 9,
    groupType: "band",
    eventernoteActorId: 70564,
    musicbrainzArtistMbid: "3d3b99e4-1a07-49d5-9c47-cd2a4c156d6c",
    supportColor: "#881144",
    searchAliases: ["mujica"],
  },
  {
    slug: "mugendai-mewtype",
    nameJa: "夢限大みゅーたいぷ",
    nameEn: "Mugendai Mewtype",
    displayOrder: 10,
    groupType: "band",
    eventernoteActorId: 75117,
    musicbrainzArtistMbid: "5304247c-e212-41cf-8121-b428ff7f7d31",
    supportColor: "#FF7788",
    searchAliases: ["梦限大", "yumemita", "ゆめみた"],
  },
  {
    slug: "millsage",
    nameJa: "millsage",
    nameEn: "millsage",
    displayOrder: 11,
    groupType: "band",
    eventernoteActorId: 89847,
    musicbrainzArtistMbid: "7c3b45e4-9af0-424f-84bc-e1a61aff7a19",
    supportColor: "#AA22EE",
    searchAliases: [],
  },
  {
    slug: "ikka-dumb-rock",
    nameJa: "一家Dumb Rock!",
    nameEn: "Ikka Dumb Rock!",
    displayOrder: 12,
    groupType: "band",
    eventernoteActorId: 89848,
    musicbrainzArtistMbid: "5ce8ca2d-7bba-4f39-80f8-8390ebddbc4d",
    supportColor: "#FFAA33",
    searchAliases: [],
  },
];

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
