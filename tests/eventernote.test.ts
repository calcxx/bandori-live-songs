import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllUserEvents,
} from "@/lib/eventernote/client";
import {
  parseEventernoteUserEventsPage,
  parseEventernoteUserProfilePage,
} from "@/lib/eventernote/parser";

const samplePage = `
<!DOCTYPE html>
<html>
  <body>
    <div class="gb_users_side_profile clearfix">
      <div class="desc">
        <h2 class="name1">revast</h2>
        <h3 class="name2">Revast Display Name</h3>
      </div>
    </div>
    <div class="topic"><h1>revast/revastの参加イベント一覧 (2)</h1></div>
    <h2 class="gb_subtitle">revastさんの参加イベント一覧(2件)</h2>
    <div class="event_info clearfix">
      <div class="date">
        <p class="day6">2026-02-28 (<span class="wday6">土</span>)</p>
      </div>
      <div class="event">
        <h4><a href="/events/420629">BanG Dream! 10th Anniversary LIVE</a></h4>
        <div class="place">会場: <a href="/places/13671">Kアリーナ横浜</a></div>
        <div class="actor">
          <ul>
            <li><a href="/actors/Poppin%27Party/14234">Poppin'Party</a></li>
            <li><a href="/actors/Roselia/24401">Roselia</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="event_info clearfix">
      <div class="date">
        <p class="day0">2026-03-10 (<span class="wday0">日</span>)</p>
      </div>
      <div class="event">
        <h4><a href="/events/430000">Other Franchise Live</a></h4>
        <div class="place">会場: <a href="/places/8">Somewhere</a></div>
        <div class="actor">
          <ul>
            <li><a href="/actors/Other/1">Other</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="pagination pagination-centered">
      <ul>
        <li class="next"><a href="/users/revast/events?page=2&user_id=218053">&gt;</a></li>
      </ul>
    </div>
  </body>
</html>
`;

const missingUserPage = `
<!DOCTYPE html>
<html>
  <head><title>Eventernote イベンターノート</title></head>
  <body>
    <div class="alert alert-danger">
      <p>指定されたユーザーは見つかりませんでした</p>
    </div>
  </body>
</html>
`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function buildUserEventsPage(options: {
  totalCount: number;
  pageItems: Array<{ id: number; title: string; date: string }>;
  paginationPages?: number[];
  includeNext?: number | null;
}) {
  const { totalCount, pageItems, paginationPages = [], includeNext = null } = options;
  const paginationLinks = paginationPages
    .map((page) => `<li><a href="/users/revast/events?page=${page}&user_id=218053">${page}</a></li>`)
    .join("");
  const nextLink =
    typeof includeNext === "number"
      ? `<li class="next"><a href="/users/revast/events?page=${includeNext}&user_id=218053">&gt;</a></li>`
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="gb_users_side_profile clearfix">
          <div class="desc">
            <h2 class="name1">revast</h2>
            <h3 class="name2">Revast Display Name</h3>
          </div>
        </div>
        <h2 class="gb_subtitle">revastさんの参加イベント一覧(${totalCount}件)</h2>
        ${pageItems
          .map(
            (item) => `
              <div class="event_info clearfix">
                <div class="date"><p>${item.date}</p></div>
                <div class="event">
                  <h4><a href="/events/${item.id}">${item.title}</a></h4>
                  <div class="place">会場: <a href="/places/1">Kアリーナ横浜</a></div>
                  <div class="actor"><a href="/actors/Poppin%27Party/14234">Poppin'Party</a></div>
                </div>
              </div>
            `,
          )
          .join("")}
        <div class="pagination pagination-centered">
          <ul>
            ${paginationLinks}
            ${nextLink}
          </ul>
        </div>
      </body>
    </html>
  `;
}

describe("parseEventernoteUserEventsPage", () => {
  it("extracts events and next page", () => {
    const parsed = parseEventernoteUserEventsPage(samplePage);

    expect(parsed.totalCount).toBe(2);
    expect(parsed.nextPage).toBe(2);
    expect(parsed.displayId).toBe("revast");
    expect(parsed.displayName).toBe("Revast Display Name");
    expect(parsed.events).toEqual([
      {
        eventernoteEventId: 420629,
        title: "BanG Dream! 10th Anniversary LIVE",
        eventDate: "2026-02-28",
        venue: "Kアリーナ横浜",
        actorIds: [14234, 24401],
        actorNames: ["Poppin'Party", "Roselia"],
        sourceUrl: "https://www.eventernote.com/events/420629",
      },
      {
        eventernoteEventId: 430000,
        title: "Other Franchise Live",
        eventDate: "2026-03-10",
        venue: "Somewhere",
        actorIds: [1],
        actorNames: ["Other"],
        sourceUrl: "https://www.eventernote.com/events/430000",
      },
    ]);
  });

  it("detects missing users from the error page", () => {
    const parsed = parseEventernoteUserEventsPage(missingUserPage);
    expect(parsed.missingUser).toBe(true);
    expect(parsed.events).toHaveLength(0);
  });

  it("extracts next page from next_page pagination", () => {
    const html = samplePage.replace(
      '<li class="next"><a href="/users/revast/events?page=2&user_id=218053">&gt;</a></li>',
      '<li class="next_page"><a href="/users/revast/events?page=2&user_id=218053">&gt;</a></li>',
    );

    expect(parseEventernoteUserEventsPage(html).nextPage).toBe(2);
  });

  it("falls back to numbered pagination when next class is missing", () => {
    const html = samplePage.replace(
      '<li class="next"><a href="/users/revast/events?page=2&user_id=218053">&gt;</a></li>',
      '<li><a href="/users/revast/events?page=2&user_id=218053">2</a></li>',
    );

    expect(parseEventernoteUserEventsPage(html).nextPage).toBe(2);
  });

  it("keeps actors scoped to their event row when event cards are nested", () => {
    const nestedPage = `
      <h2 class="gb_subtitle">DDyfさんの参加イベント一覧(2件)</h2>
      <div class="event_info clearfix">
        <div class="date"><p>2025-06-14</p></div>
        <div class="event">
          <h4><a href="/events/413398">RAISE A SUILEN LIVE</a></h4>
          <div class="place">会場: <a href="/places/1">有明アリーナ</a></div>
          <div class="actor">
            <a href="/actors/RAISE%20A%20SUILEN/39397">RAISE A SUILEN</a>
            <a href="/actors/%E5%A4%A2%E9%99%90%E5%A4%A7%E3%81%BF%E3%82%85%E3%83%BC%E3%81%9F%E3%81%84%E3%81%B7/75117">夢限大みゅーたいぷ</a>
          </div>
          <div class="event">
            <h4><a href="/events/396309">Liella! Live</a></h4>
            <div class="actor"><a href="/actors/Liella%21/59030">Liella!</a></div>
          </div>
        </div>
      </div>
      <div class="event_info clearfix">
        <div class="date"><p>2025-06-13</p></div>
        <div class="event">
          <h4><a href="/events/396309">Liella! Live</a></h4>
          <div class="place">会場: <a href="/places/5">大阪城ホール</a></div>
          <div class="actor"><a href="/actors/Liella%21/59030">Liella!</a></div>
        </div>
      </div>
    `;

    const parsed = parseEventernoteUserEventsPage(nestedPage);
    expect(parsed.events.find((event) => event.eventernoteEventId === 396309)?.actorIds).toEqual([59030]);
  });

  it("ignores duplicated nested event blocks outside the primary event list", () => {
    const duplicateBlockPage = `
      <h2 class="gb_subtitle">DDyfさんの参加イベント一覧(3件)</h2>
      <div class="gb_event_list">
        <ul>
          <li class="clearfix past">
            <div class="date"><p>2025-08-16</p></div>
            <div class="event">
              <h4><a href="/events/422619">SUMMER SONIC 2025 東京会場 1日目</a></h4>
              <div class="place">会場: <a href="/places/1">ZOZOマリンスタジアム</a></div>
              <div class="actor"><a href="/actors/Other/1">Other</a></div>
            </div>
          </li>
          <li class="clearfix past">
            <div class="date"><p>2025-08-17</p></div>
            <div class="event">
              <h4><a href="/events/425156">DAY3：U-NEXT MUSIC FES LoveLive! Series EXPO STAGE ～Right now!～</a></h4>
              <div class="place">会場: <a href="/places/2">Kアリーナ横浜</a></div>
              <div class="actor"><a href="/actors/Other/2">Other 2</a></div>
            </div>
          </li>
          <li class="clearfix past">
            <div class="date"><p>2025-08-18</p></div>
            <div class="event">
              <h4><a href="/events/433452">【出演者変更】ラブライブ！スーパースター!! Liella! Special LoveLive! ～Connect the Stars～</a></h4>
              <div class="place">会場: <a href="/places/3">大阪城ホール</a></div>
              <div class="actor"><a href="/actors/Liella%21/59030">Liella!</a></div>
            </div>
          </li>
        </ul>
      </div>
      <div class="tracking-preview">
        <div class="event_info clearfix">
          <div class="date"><p>2025-08-17</p></div>
          <div class="event">
            <h4><a href="/events/425156">DAY3：U-NEXT MUSIC FES LoveLive! Series EXPO STAGE ～Right now!～</a></h4>
            <div class="actor"><a href="/actors/Other/2">Other 2</a></div>
          </div>
        </div>
        <div class="event_info clearfix">
          <div class="date"><p>2025-08-18</p></div>
          <div class="event">
            <h4><a href="/events/433452">【出演者変更】ラブライブ！スーパースター!! Liella! Special LoveLive! ～Connect the Stars～</a></h4>
            <div class="actor"><a href="/actors/Liella%21/59030">Liella!</a></div>
          </div>
        </div>
      </div>
    `;

    const parsed = parseEventernoteUserEventsPage(duplicateBlockPage);

    expect(parsed.pageItemCount).toBe(3);
    expect(parsed.events.map((event) => event.eventernoteEventId)).toEqual([422619, 425156, 433452]);
  });

  it("extracts display_id and nickname from the profile block", () => {
    expect(parseEventernoteUserProfilePage(samplePage)).toEqual({
      missingUser: false,
      displayId: "revast",
      displayName: "Revast Display Name",
    });
  });
});

describe("fetchAllUserEvents", () => {
  it("fetches discovered pages concurrently after page 1", async () => {
    const page1 = buildUserEventsPage({
      totalCount: 3,
      pageItems: [{ id: 500001, title: "Event 1", date: "2026-03-01" }],
      paginationPages: [2, 3],
      includeNext: 2,
    });
    const page2 = buildUserEventsPage({
      totalCount: 3,
      pageItems: [{ id: 500002, title: "Event 2", date: "2026-03-02" }],
    });
    const page3 = buildUserEventsPage({
      totalCount: 3,
      pageItems: [{ id: 500003, title: "Event 3", date: "2026-03-03" }],
    });

    let inFlight = 0;
    let maxInFlight = 0;

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page") ?? "1");

      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);

      try {
        if (page > 1) {
          await new Promise((resolve) => {
            setTimeout(resolve, 20);
          });
        }

        if (page === 1) {
          return new Response(page1, { status: 200 });
        }

        if (page === 2) {
          return new Response(page2, { status: 200 });
        }

        if (page === 3) {
          return new Response(page3, { status: 200 });
        }

        return new Response("", { status: 404 });
      } finally {
        inFlight -= 1;
      }
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllUserEvents("revast");

    expect(result.events).toHaveLength(3);
    expect(maxInFlight).toBeGreaterThanOrEqual(2);
  });

  it("limits pagination concurrency for users with many pages", async () => {
    const totalCount = 10;
    let inFlight = 0;
    let maxInFlight = 0;

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page") ?? "1");

      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);

      try {
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });

        return new Response(
          buildUserEventsPage({
            totalCount,
            pageItems: [{ id: 500000 + page, title: `Event ${page}`, date: `2026-03-${String(page).padStart(2, "0")}` }],
          }),
          { status: 200 },
        );
      } finally {
        inFlight -= 1;
      }
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllUserEvents("revast");

    expect(result.events).toHaveLength(totalCount);
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("returns partial results when Eventernote page counts are inconsistent", async () => {
    const incompletePage = samplePage
      .replace("revastさんの参加イベント一覧(2件)", "revastさんの参加イベント一覧(3件)")
      .replace('<li class="next"><a href="/users/revast/events?page=2&user_id=218053">&gt;</a></li>', "");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(incompletePage, { status: 200 })),
    );

    const result = await fetchAllUserEvents("revast");

    expect(result.events).toHaveLength(2);
    expect(result.totalCount).toBe(3);
  });

  it("deduplicates repeated event rows instead of returning duplicate activities", async () => {
    const page1 = `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="gb_users_side_profile clearfix">
            <div class="desc">
              <h2 class="name1">revast</h2>
              <h3 class="name2">Revast Display Name</h3>
            </div>
          </div>
          <h2 class="gb_subtitle">revastさんの参加イベント一覧(3件)</h2>
          <div class="event_info clearfix">
            <div class="date"><p>2026-03-01</p></div>
            <div class="event">
              <h4><a href="/events/500001">Other Event 1</a></h4>
              <div class="place">会場: <a href="/places/2">Somewhere</a></div>
              <div class="actor"><a href="/actors/Other/1">Other</a></div>
            </div>
          </div>
          <div class="pagination pagination-centered">
            <ul>
              <li><a href="/users/revast/events?page=2&user_id=218053">2</a></li>
              <li class="next"><a href="/users/revast/events?page=2&user_id=218053">&gt;</a></li>
            </ul>
          </div>
        </body>
      </html>
    `;
    const page2 = `
      <!DOCTYPE html>
      <html>
        <body>
          <h2 class="gb_subtitle">revastさんの参加イベント一覧(3件)</h2>
          <div class="event_info clearfix">
            <div class="date"><p>2026-03-02</p></div>
            <div class="event">
              <h4><a href="/events/500002">Bandori Event</a></h4>
              <div class="place">会場: <a href="/places/1">Kアリーナ横浜</a></div>
              <div class="actor"><a href="/actors/Poppin%27Party/14234">Poppin'Party</a></div>
            </div>
          </div>
          <div class="event_info clearfix">
            <div class="date"><p>2026-03-01</p></div>
            <div class="event">
              <h4><a href="/events/500001">Other Event 1</a></h4>
              <div class="place">会場: <a href="/places/2">Somewhere</a></div>
              <div class="actor"><a href="/actors/Other/1">Other</a></div>
            </div>
          </div>
        </body>
      </html>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        const page = Number(url.searchParams.get("page") ?? "1");
        return new Response(page === 1 ? page1 : page2, { status: 200 });
      }),
    );

    const result = await fetchAllUserEvents("revast");

    expect(result.events.map((event) => event.eventernoteEventId)).toEqual([500001, 500002]);
    expect(result.totalCount).toBe(3);
  });
});
