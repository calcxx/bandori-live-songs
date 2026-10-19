import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllActorEvents,
  mergeActorEvents,
  parseEventernoteActorEventsPage,
} from "@/lib/eventernote/actor-events";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseEventernoteActorEventsPage", () => {
  it("extracts event list rows with attendee counts and next page", () => {
    const html = `
      <html>
        <body>
          <div class="crumb-content">108件のイベントが見つかりました。</div>
          <div class="pagination"><span class="next_page"><a href="/actors/66346/events?page=2">></a></span></div>
          <ul>
            <li class="clearfix">
              <div class="date"><p>2026-03-01 (日)</p></div>
              <div class="event">
                <h4><a href="/events/100005">MyGO!!!!!×Ave Mujica ツーマンライブ「“moment / memory”」</a></h4>
                <div class="place">会場: <a href="/places/999">Kアリーナ横浜</a></div>
              </div>
              <div class="note_count"><p title="参加者数">622</p></div>
            </li>
          </ul>
        </body>
      </html>
    `;

    const parsed = parseEventernoteActorEventsPage(html, {
      slug: "mygo",
      nameJa: "MyGO!!!!!",
    });

    expect(parsed.totalCount).toBe(108);
    expect(parsed.nextPage).toBe(2);
    expect(parsed.events).toEqual([
      {
        eventernoteEventId: 100005,
        title: "MyGO!!!!!×Ave Mujica ツーマンライブ「“moment / memory”」",
        eventDate: "2026-03-01",
        venue: "Kアリーナ横浜",
        attendeeCount: 622,
        sourceUrl: "https://www.eventernote.com/events/100005",
        sourceBandSlug: "mygo",
        sourceBandName: "MyGO!!!!!",
      },
    ]);
  });
});

describe("mergeActorEvents", () => {
  it("dedupes events across band pages and merges band labels", () => {
    const merged = mergeActorEvents([
      {
        eventernoteEventId: 100005,
        title: "moment / memory",
        eventDate: "2026-03-01",
        venue: "Kアリーナ横浜",
        attendeeCount: 622,
        sourceUrl: "https://www.eventernote.com/events/100005",
        sourceBandSlug: "mygo",
        sourceBandName: "MyGO!!!!!",
      },
      {
        eventernoteEventId: 100005,
        title: "moment / memory",
        eventDate: "2026-03-01",
        venue: "Kアリーナ横浜",
        attendeeCount: 622,
        sourceUrl: "https://www.eventernote.com/events/100005",
        sourceBandSlug: "ave-mujica",
        sourceBandName: "Ave Mujica",
      },
    ]);

    expect(merged).toEqual([
      {
        eventernoteEventId: 100005,
        title: "moment / memory",
        eventDate: "2026-03-01",
        venue: "Kアリーナ横浜",
        attendeeCount: 622,
        sourceUrl: "https://www.eventernote.com/events/100005",
        bandSlugs: ["mygo", "ave-mujica"],
        bandNames: ["MyGO!!!!!", "Ave Mujica"],
      },
    ]);
  });
});

describe("fetchAllActorEvents", () => {
  it("requests one large page via limit=1000", async () => {
    const html = `
      <html>
        <body>
          <div class="crumb-content">1件のイベントが見つかりました。</div>
          <ul>
            <li class="clearfix">
              <div class="date"><p>2026-03-01 (日)</p></div>
              <div class="event">
                <h4><a href="/events/900000401">Fixture Live</a></h4>
                <div class="place">会場: <a href="/places/999">Test Venue</a></div>
              </div>
              <div class="note_count"><p title="参加者数">622</p></div>
            </li>
          </ul>
        </body>
      </html>
    `;
    const fetchMock = vi.fn(async (_input: string | URL) => {
      void _input;
      return new Response(html, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllActorEvents(24401, {
      slug: "roselia",
      nameJa: "Roselia",
    });

    expect(result.events).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/actors/24401/events");
    expect(url.searchParams.get("limit")).toBe("1000");
  });
});
