import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllUserEvents,
  fetchUserEventCount,
  fetchUserEventSummary,
} from "@/lib/eventernote/client";
import { parseEventernoteCalendarIcs } from "@/lib/eventernote/calendar-ics";
import { parseEventernoteUserNumericId } from "@/lib/eventernote/parser";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function eventCard(id: number, index: number) {
  return `
    <li class="clearfix">
      <div class="date"><p>2026-06-${String((index % 28) + 1).padStart(2, "0")}</p></div>
      <div class="event">
        <h4><a href="/events/${id}">Event ${id}</a></h4>
        <div class="place">会場: <a href="/places/1">Test Venue</a></div>
      </div>
    </li>
  `;
}

function eventsPage(count: number, numericUserId = 900002) {
  const cards = Array.from({ length: count }, (_, index) =>
    eventCard(100000 + index, index),
  ).join("");

  return `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="gb_users_side_profile clearfix">
          <div class="thumb">
            <p><img src="https://eventernote.s3.amazonaws.com/images/users/${numericUserId}/icon_s.jpg"></p>
          </div>
          <div class="desc">
            <h2 class="name1">sample_user</h2>
            <h3 class="name2">Sample Display Name</h3>
          </div>
          <a class="follow_btn" href="javascript:addFollow(${numericUserId})">フォローする</a>
        </div>
        <h2 class="gb_subtitle">sample_userさんの参加イベント一覧(${count}件)</h2>
        <div class="gb_event_list clearfix">
          <ul>${cards}</ul>
        </div>
      </body>
    </html>
  `;
}

const calendarIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//www.eventernote.com/ ICS//EN
BEGIN:VTIMEZONE
TZID:Asia/Tokyo
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0900
TZOFFSETTO:+0900
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260601
SUMMARY:Calendar Event A
LOCATION:Venue A
URL;VALUE=URI:https://www.eventernote.com/events/1001
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Asia/Tokyo:20260602T180000
SUMMARY:Calendar Event B
LOCATION:Venue B
URL;VALUE=URI:https://www.eventernote.com/events/1002
END:VEVENT
END:VCALENDAR`;

function urlOf(input: string | URL) {
  return new URL(String(input));
}

describe("Eventernote user calendar", () => {
  it("uses a size-one count request and extracts the numeric user id", async () => {
    const fetchMock = vi.fn(async (_input: string | URL) => {
      void _input;
      return new Response(eventsPage(2), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchUserEventSummary("sample_user")).resolves.toEqual({
      totalCount: 2,
      numericUserId: 900002,
      displayId: "sample_user",
      displayName: "Sample Display Name",
    });
    await expect(fetchUserEventCount("sample_user")).resolves.toBe(2);

    const url = urlOf(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/users/sample_user/events");
    expect(url.searchParams.get("limit")).toBe("1");
  });


  it("returns an empty snapshot without fetching a calendar for zero-event users", async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(eventsPage(0), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllUserEvents("sample_user");

    expect(result.events).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the ICS feed for users with at most 300 events", async () => {
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      void _init;
      const url = urlOf(input);
      if (url.pathname === "/users/sample_user/events") {
        return new Response(eventsPage(2), { status: 200 });
      }
      if (url.pathname === "/users/calendar/900002/ics") {
        return new Response(calendarIcs, {
          status: 200,
          headers: { "content-type": "text/calendar" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllUserEvents("sample_user");

    expect(result.events.map((event) => event.eventernoteEventId)).toEqual([1001, 1002]);
    expect(result.totalCount).toBe(2);
    expect(result.displayId).toBe("sample_user");

    const urls = fetchMock.mock.calls.map(([input]) => urlOf(input as string | URL));
    expect(urls.some((url) => url.searchParams.get("limit") === "2000")).toBe(false);
    const calendarCall = fetchMock.mock.calls.find(([input]) =>
      urlOf(input as string | URL).pathname === "/users/calendar/900002/ics",
    );
    expect(calendarCall?.[1]).toMatchObject({
      headers: expect.objectContaining({ accept: "text/calendar" }),
    });
  });

  it("uses a limit=2000 HTML page for users above the ICS cap", async () => {
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      void _init;
      const url = urlOf(input);
      if (url.pathname === "/users/sample_user/events") {
        return new Response(eventsPage(301), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllUserEvents("sample_user");

    expect(result.totalCount).toBe(301);
    expect(result.events).toHaveLength(301);
    const urls = fetchMock.mock.calls.map(([input]) => urlOf(input as string | URL));
    expect(urls.some((url) => url.pathname === "/users/calendar/900002/ics")).toBe(false);
    expect(
      urls.some(
        (url) =>
          url.pathname === "/users/sample_user/events" &&
          url.searchParams.get("limit") === "2000",
      ),
    ).toBe(true);
  });

  it("falls back to HTML when the ICS request fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      void _init;
      const url = urlOf(input);
      if (url.pathname === "/users/sample_user/events") {
        return new Response(eventsPage(2), { status: 200 });
      }
      if (url.pathname === "/users/calendar/900002/ics") {
        return new Response("calendar unavailable", { status: 500 });
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllUserEvents("sample_user");

    expect(result.events).toHaveLength(2);
    const urls = fetchMock.mock.calls.map(([input]) => urlOf(input as string | URL));
    expect(urls.some((url) => url.pathname === "/users/calendar/900002/ics")).toBe(true);
    expect(
      urls.some(
        (url) =>
          url.pathname === "/users/sample_user/events" &&
          url.searchParams.get("limit") === "2000",
      ),
    ).toBe(true);
  });

  it("falls back to 30-row pagination when the large HTML page fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      void _init;
      const url = urlOf(input);
      if (url.pathname !== "/users/sample_user/events") {
        return new Response("unexpected", { status: 500 });
      }

      if (url.searchParams.get("limit") === "2000") {
        return new Response("too large", { status: 500 });
      }

      return new Response(eventsPage(2), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllUserEvents("sample_user");

    expect(result.events).toHaveLength(2);
    const urls = fetchMock.mock.calls.map(([input]) => urlOf(input as string | URL));
    expect(
      urls.some(
        (url) =>
          url.pathname === "/users/sample_user/events" &&
          url.searchParams.get("limit") === "30",
      ),
    ).toBe(true);
  });
});

describe("parseEventernoteUserNumericId", () => {
  it("prefers the follow button and falls back to the avatar path", () => {
    expect(
      parseEventernoteUserNumericId(`
        <div class="gb_users_side_profile">
          <div class="thumb"><img src="https://example.com/images/users/900002/icon_s.jpg"></div>
          <a class="follow_btn" href="javascript:addFollow(900002)">follow</a>
        </div>
      `),
    ).toBe(900002);

    expect(
      parseEventernoteUserNumericId(`
        <div class="gb_users_side_profile">
          <div class="thumb"><img src="https://example.com/images/users/900003/icon_s.jpg"></div>
        </div>
      `),
    ).toBe(900003);
  });

  it("returns null when sources disagree or are absent", () => {
    expect(
      parseEventernoteUserNumericId(`
        <div class="gb_users_side_profile">
          <div class="thumb"><img src="https://example.com/images/users/1/icon_s.jpg"></div>
          <a class="follow_btn" href="javascript:addFollow(2)">follow</a>
        </div>
      `),
    ).toBeNull();
    expect(parseEventernoteUserNumericId("<html></html>")).toBeNull();
  });
});

describe("parseEventernoteCalendarIcs", () => {
  it("parses all-day and timed events, unescapes text, unfolds lines, and skips invalid rows", () => {
    const events = parseEventernoteCalendarIcs(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260601
SUMMARY:Mixed\\, Title\\;
LOCATION:Venue A
URL;VALUE=URI:https://www.eventernote.com/events/1001
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Asia/Tokyo:20260602T180000
SUMMARY:Folded
  Title
LOCATION:Venue B
URL;VALUE=URI:https://www.eventernote.com/events/1002
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260603
SUMMARY:Cancelled
URL;VALUE=URI:https://www.eventernote.com/events/1003
STATUS:CANCELLED
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260604
SUMMARY:No URL
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260601
SUMMARY:Duplicate
URL;VALUE=URI:https://www.eventernote.com/events/1001
END:VEVENT
END:VCALENDAR`);

    expect(events).toEqual([
      {
        eventernoteEventId: 1001,
        title: "Mixed, Title;",
        eventDate: "2026-06-01",
        venue: "Venue A",
        actorIds: [],
        actorNames: [],
        sourceUrl: "https://www.eventernote.com/events/1001",
      },
      {
        eventernoteEventId: 1002,
        title: "Folded Title",
        eventDate: "2026-06-02",
        venue: "Venue B",
        actorIds: [],
        actorNames: [],
        sourceUrl: "https://www.eventernote.com/events/1002",
      },
    ]);
  });
});
