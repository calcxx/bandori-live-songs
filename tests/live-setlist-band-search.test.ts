import { describe, expect, it } from "vitest";
import type { LiveSetlistBandSearchRecord } from "@/lib/live-setlist/band-query";
import { rankLiveSetlistCandidates } from "@/lib/live-setlist/match";

const bands: LiveSetlistBandSearchRecord[] = [
  {
    slug: "poppin-party",
    nameJa: "Poppin'Party",
    nameEn: "Poppin'Party",
    searchAliases: ["ppp", "popipa", "ポピパ"],
  },
  {
    slug: "roselia",
    nameJa: "Roselia",
    nameEn: "Roselia",
    searchAliases: [],
  },
  {
    slug: "raise-a-suilen",
    nameJa: "RAISE A SUILEN",
    nameEn: "RAISE A SUILEN",
    searchAliases: ["ras"],
  },
  {
    slug: "mygo",
    nameJa: "MyGO!!!!!",
    nameEn: "MyGO!!!!!",
    searchAliases: ["mygo"],
  },
  {
    slug: "ave-mujica",
    nameJa: "Ave Mujica",
    nameEn: "Ave Mujica",
    searchAliases: ["mujica"],
  },
  {
    slug: "mugendai-mewtype",
    nameJa: "夢限大みゅーたいぷ",
    nameEn: "Mugendai Mewtype",
    searchAliases: ["梦限大", "yumemita", "ゆめみた"],
  },
];

const candidates = [
  {
    eventernoteEventId: 4,
    title: "MyGO!!!!!×Ave Mujica 合同ライブ DAY2",
    eventDate: "2026-12-20",
    venue: null,
    performingBandSlugs: ["mygo", "ave-mujica"],
  },
  {
    eventernoteEventId: 3,
    title: "MyGO!!!!! 8th LIVE DAY1",
    eventDate: "2026-07-01",
    venue: null,
    performingBandSlugs: ["mygo"],
  },
  {
    eventernoteEventId: 2,
    title: "RAISE A SUILEN LIVE 2026",
    eventDate: "2026-02-01",
    venue: null,
    performingBandSlugs: ["raise-a-suilen"],
  },
  {
    eventernoteEventId: 1,
    title: "Roselia LIVE",
    eventDate: "2025-01-01",
    venue: null,
    performingBandSlugs: ["roselia"],
  },
];

describe("live setlist band search", () => {
  it("uses aliases as performing-band filters", () => {
    expect(rankLiveSetlistCandidates(candidates, "ras", 8, bands)).toEqual([
      candidates[2],
    ]);
    expect(
      rankLiveSetlistCandidates(candidates, "mygo mujica", 8, bands),
    ).toEqual([candidates[0]]);
  });

  it("combines band, title, and date filters", () => {
    expect(
      rankLiveSetlistCandidates(candidates, "mygo DAY1 2026", 8, bands),
    ).toEqual([candidates[1]]);
  });

  it("recognizes formal names and multilingual aliases", () => {
    expect(
      rankLiveSetlistCandidates(candidates, "Roselia", 8, bands),
    ).toEqual([candidates[3]]);

    const yumemitaCandidate = {
      eventernoteEventId: 5,
      title: "全国ツアー テスト公演",
      eventDate: "2026-08-01",
      venue: null,
      performingBandSlugs: ["mugendai-mewtype"],
    };
    expect(
      rankLiveSetlistCandidates(
        [...candidates, yumemitaCandidate],
        "梦限大",
        8,
        bands,
      ),
    ).toEqual([yumemitaCandidate]);
  });

  it("does not treat short aliases as title substrings", () => {
    expect(
      rankLiveSetlistCandidates(candidates, "Poppin'Party", 8, bands),
    ).toEqual([]);
    expect(
      rankLiveSetlistCandidates(candidates, "ppp", 8, bands),
    ).toEqual([]);
  });
});
