import { normalizeNFKC } from "@/lib/music/title-utils";
import { normalizeBandSearchTerm } from "@/lib/live-setlist/band-query";

export type BandSearchAliasRow = {
  slug: string;
  nameJa: string;
  nameEn: string;
  searchAliases: string[];
};

export type ValidatedBandSearchAliases = {
  aliasesBySlug: Map<string, string[]>;
  totalAliasCount: number;
};

function normalizeAliasForStorage(value: string) {
  return normalizeNFKC(value).trim().replace(/\s+/gu, " ");
}

export function validateBandSearchAliases(
  bands: BandSearchAliasRow[],
  rawAliasesBySlug: ReadonlyMap<string, string>,
): ValidatedBandSearchAliases {
  const formalTermOwners = new Map<string, string>();
  const aliasTermOwners = new Map<string, string>();
  const aliasesBySlug = new Map<string, string[]>();
  let totalAliasCount = 0;

  for (const band of bands) {
    for (const name of [band.nameJa, band.nameEn]) {
      const normalized = normalizeBandSearchTerm(name);
      const existingOwner = formalTermOwners.get(normalized);
      if (!existingOwner || existingOwner === band.slug) {
        formalTermOwners.set(normalized, band.slug);
      }
    }
  }

  for (const band of bands) {
    const rawValue = rawAliasesBySlug.get(band.slug) ?? "";
    const aliases = rawValue
      .split(/\r?\n/u)
      .map(normalizeAliasForStorage)
      .filter(Boolean);

    if (aliases.length > 30) {
      throw new Error(`${band.nameJa} 的等效关键词不能超过 30 个。`);
    }

    const uniqueAliases: string[] = [];
    const seenForBand = new Set<string>();
    for (const alias of aliases) {
      const characterCount = Array.from(alias).length;
      if (characterCount < 2 || characterCount > 100) {
        throw new Error(
          `${band.nameJa} 的关键词“${alias}”长度须为 2 至 100 个字符。`,
        );
      }

      const normalized = normalizeBandSearchTerm(alias);
      if (seenForBand.has(normalized)) {
        continue;
      }
      seenForBand.add(normalized);

      const formalOwner = formalTermOwners.get(normalized);
      if (formalOwner === band.slug) {
        continue;
      }
      if (formalOwner) {
        const owner = bands.find((item) => item.slug === formalOwner);
        throw new Error(
          `关键词“${alias}”与 ${owner?.nameJa ?? formalOwner} 的正式名称重复。`,
        );
      }

      const aliasOwner = aliasTermOwners.get(normalized);
      if (aliasOwner && aliasOwner !== band.slug) {
        const owner = bands.find((item) => item.slug === aliasOwner);
        throw new Error(
          `关键词“${alias}”已用于 ${owner?.nameJa ?? aliasOwner}。`,
        );
      }

      aliasTermOwners.set(normalized, band.slug);
      uniqueAliases.push(alias);
    }

    aliasesBySlug.set(band.slug, uniqueAliases);
    totalAliasCount += uniqueAliases.length;
  }

  return { aliasesBySlug, totalAliasCount };
}
