import { describe, expect, it } from "vitest";
import { parseEventernoteEventMetaPage, sanitizeEventernoteEventTitle } from "@/lib/eventernote/event-meta";

describe("parseEventernoteEventMetaPage", () => {
  it("prefers og:title over h1 and extracts venue from the keyed table", () => {
    const html = `
      <html>
        <head>
          <title>BanG Dream! 10th Anniversary LIVE「In the name of BanG Dream!」 Poppin'Party Eventernote イベンターノート</title>
          <meta property="og:title" content="BanG Dream! 10th Anniversary LIVE「In the name of BanG Dream!」" />
        </head>
        <body>
          <h1>BanG Dream! 10th Anniversary LIVE「In the name of BanG Dream!」 Poppin'Party</h1>
          <time datetime="2026-02-28T15:00:00+09:00"></time>
          <table class="table">
            <tr><th>開催日時</th><td>2026-02-28(土)</td></tr>
            <tr><th>開催場所</th><td>Kアリーナ横浜</td></tr>
            <tr><th>公演名</th><td>BanG Dream! 10th Anniversary LIVE「In the name of BanG Dream!」</td></tr>
          </table>
        </body>
      </html>
    `;

    expect(parseEventernoteEventMetaPage(html, 420629)).toEqual({
      eventernoteEventId: 420629,
      title: "BanG Dream! 10th Anniversary LIVE「In the name of BanG Dream!」",
      eventDate: "2026-02-28",
      venue: "Kアリーナ横浜",
    });
  });

  it("removes known prefix and suffix tags from event titles", () => {
    expect(sanitizeEventernoteEventTitle("【出演者変更】Animelo Summer Live 2025 -ThanXX!- Day1")).toBe(
      "Animelo Summer Live 2025 -ThanXX!- Day1",
    );
    expect(sanitizeEventernoteEventTitle("【振替】 BanG Dream! Special☆LIVE")).toBe("BanG Dream! Special☆LIVE");
    expect(sanitizeEventernoteEventTitle("[振替公演] BanG Dream! Special☆LIVE")).toBe("BanG Dream! Special☆LIVE");
    expect(sanitizeEventernoteEventTitle("BanG Dream! Special☆LIVE【振替試合】")).toBe("BanG Dream! Special☆LIVE");
    expect(sanitizeEventernoteEventTitle("【時間変更】 BanG Dream! Special☆LIVE")).toBe("BanG Dream! Special☆LIVE");
    expect(sanitizeEventernoteEventTitle("BanG Dream! Special☆LIVE【時間変更】")).toBe("BanG Dream! Special☆LIVE");
    expect(sanitizeEventernoteEventTitle("BanG Dream! Special☆LIVE【出演者一部キャンセル】")).toBe(
      "BanG Dream! Special☆LIVE",
    );
    expect(sanitizeEventernoteEventTitle("【試合中止 ※ステージのみ】BanG Dream! Special☆LIVE")).toBe(
      "BanG Dream! Special☆LIVE",
    );
  });
});
