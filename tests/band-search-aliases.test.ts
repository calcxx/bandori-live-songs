import { describe, expect, it } from "vitest";
import {
  validateBandSearchAliases,
  type BandSearchAliasRow,
} from "@/lib/admin/band-search-aliases";

const bands: BandSearchAliasRow[] = [
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
];

describe("band search alias validation", () => {
  it("normalizes whitespace and removes duplicates", () => {
    const result = validateBandSearchAliases(
      bands,
      new Map([
        ["mygo", "mygo\nMYGO\n  test   phrase  "],
        ["ave-mujica", "mujica"],
      ]),
    );

    expect(result.aliasesBySlug.get("mygo")).toEqual([
      "mygo",
      "test phrase",
    ]);
    expect(result.totalAliasCount).toBe(3);
  });

  it("omits redundant formal names", () => {
    const result = validateBandSearchAliases(
      bands,
      new Map([
        ["mygo", "MyGO!!!!!\nmygo"],
        ["ave-mujica", "Ave Mujica\nmujica"],
      ]),
    );

    expect(result.aliasesBySlug.get("mygo")).toEqual(["mygo"]);
    expect(result.aliasesBySlug.get("ave-mujica")).toEqual(["mujica"]);
  });

  it("rejects aliases shared by different bands", () => {
    expect(() =>
      validateBandSearchAliases(
        bands,
        new Map([
          ["mygo", "shared"],
          ["ave-mujica", "SHARED"],
        ]),
      ),
    ).toThrow("关键词“SHARED”已用于 MyGO!!!!!。");
  });

  it("rejects aliases matching another band's formal name", () => {
    expect(() =>
      validateBandSearchAliases(
        bands,
        new Map([
          ["mygo", "Ave Mujica"],
          ["ave-mujica", ""],
        ]),
      ),
    ).toThrow("关键词“Ave Mujica”与 Ave Mujica 的正式名称重复。");
  });

  it("rejects aliases shorter than the public search minimum", () => {
    expect(() =>
      validateBandSearchAliases(
        bands,
        new Map([
          ["mygo", "m"],
          ["ave-mujica", ""],
        ]),
      ),
    ).toThrow("长度须为 2 至 100 个字符");
  });
});
