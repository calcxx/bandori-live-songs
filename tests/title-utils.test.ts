import { describe, expect, it } from "vitest";
import {
  canonicalizeSongTitle,
  formatSongTitleForDisplay,
  isExcludedTrackTitle,
  normalizeSongTitle,
} from "@/lib/music/title-utils";

describe("title-utils", () => {
  it("removes track numbers and version suffixes", () => {
    expect(canonicalizeSongTitle("1.どきどきデエト -instrumental-")).toBe("どきどきデエト");
    expect(canonicalizeSongTitle("1 どきどきデエト")).toBe("どきどきデエト");
    expect(canonicalizeSongTitle("M02 迷星叫")).toBe("迷星叫");
    expect(canonicalizeSongTitle("EN1 壱雫空")).toBe("壱雫空");
    expect(canonicalizeSongTitle("02. 灼熱 Bonfire!(パラレルver.)")).toBe("灼熱 Bonfire!");
    expect(canonicalizeSongTitle("1000回潤んだ空")).toBe("1000回潤んだ空");
    expect(canonicalizeSongTitle("NO GIRL NO CRY/Poppin'Party Ver.")).toBe("NO GIRL NO CRY");
    expect(canonicalizeSongTitle("STAR BEAT!~ホシノコドウ~ ~Popipa Acoustic Ver.~")).toBe(
      "STAR BEAT!~ホシノコドウ~",
    );
    expect(canonicalizeSongTitle("CiRCLE THANKS MUSiC♪/CiRCLE THANKS PARTY!スペシャルバンド")).toBe(
      "CiRCLE THANKS MUSiC♪",
    );
    expect(canonicalizeSongTitle("Yes! BanG_Dream! Poppin'Party×Morfonica")).toBe("Yes! BanG_Dream!");
  });

  it("removes trailing metadata parentheticals", () => {
    expect(
      canonicalizeSongTitle("Moonlight Walk(TVアニメ「進化の実 ~知らないうちに勝ち組人生〜」EDテーマ)"),
    ).toBe("Moonlight Walk");
    expect(
      canonicalizeSongTitle("キミが始まる!(「バンドリ! ガールズバンドパーティ! for Nintendo Switch」主題歌)"),
    ).toBe("キミが始まる!");
    expect(canonicalizeSongTitle("‘S/’ The Way")).toBe("‘S/’ The Way");
  });

  it("preserves full-width punctuation in canonical title output", () => {
    expect(canonicalizeSongTitle("ときめきエクスペリエンス！")).toBe("ときめきエクスペリエンス！");
    expect(canonicalizeSongTitle("ゴーカ！ごーかい！？ファントムシーフ！")).toBe(
      "ゴーカ！ごーかい！？ファントムシーフ！",
    );
  });

  it("normalizes whitespace and punctuation for matching", () => {
    expect(normalizeSongTitle("STAR BEAT!〜ホシノコドウ〜")).toBe("star beat!~ホシノコドウ~");
    expect(normalizeSongTitle("  CiRCLE   THANKS MUSiC♪ ")).toBe("circle thanks music♪");
    expect(normalizeSongTitle("Choir ‘S’ Choir")).toBe("choir 's' choir");
    expect(normalizeSongTitle('"Say cheese!!!!!"')).toBe(normalizeSongTitle("“Say cheese!!!!!”"));
    expect(normalizeSongTitle("天下卜ーイツA to Z☆")).toBe(normalizeSongTitle("天下トーイツ A to Z☆"));
  });

  it("uses half-width quotation marks for display", () => {
    expect(formatSongTitleForDisplay("「迷星叫」 “Choir ‘S’ Choir”")).toBe(
      "\"迷星叫\" \"Choir 'S' Choir\"",
    );
  });

  it("filters out instrumental and drama tracks", () => {
    expect(isExcludedTrackTitle("3.どきどきデエト -instrumental-")).toBe(true);
    expect(isExcludedTrackTitle("4. ドラマパート")).toBe(true);
    expect(isExcludedTrackTitle("ドラマチック!アライブ")).toBe(false);
    expect(isExcludedTrackTitle("「もういちど ルミナス」MV")).toBe(true);
    expect(isExcludedTrackTitle("2nd LIVE「そのままを抱きしめて」アフタートーク")).toBe(true);
    expect(isExcludedTrackTitle("2. Game Changer")).toBe(false);
  });
});
