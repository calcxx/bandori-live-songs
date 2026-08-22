import { normalizeNFKC } from "@/lib/music/title-utils";

export type LiveSetlistBandSearchRecord = {
  slug: string;
  nameJa: string;
  nameEn: string;
  searchAliases: string[];
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeBandSearchTerm(value: string) {
  return normalizeWhitespace(normalizeNFKC(value)).toLocaleLowerCase("en-US");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function extractBandSearchFilters(
  rawTitle: string,
  bands: LiveSetlistBandSearchRecord[],
) {
  let title = normalizeWhitespace(normalizeNFKC(rawTitle));
  const bandSlugs = new Set<string>();
  const terms = bands
    .flatMap((band) =>
      [band.nameJa, band.nameEn, ...band.searchAliases].map((term) => ({
        slug: band.slug,
        term: normalizeWhitespace(normalizeNFKC(term)),
      })),
    )
    .filter(({ term }) => term.length > 0)
    .sort((left, right) => right.term.length - left.term.length);

  for (const { slug, term } of terms) {
    const pattern = new RegExp(
      `(^|\\s)${escapeRegExp(term)}(?=\\s|$)`,
      "giu",
    );
    if (!pattern.test(title)) {
      continue;
    }

    bandSlugs.add(slug);
    title = normalizeWhitespace(title.replace(pattern, " "));
  }

  return {
    title,
    bandSlugs: [...bandSlugs],
  };
}
