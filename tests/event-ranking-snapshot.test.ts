import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";
import * as schema from "@/lib/db/schema";
import {
  getRecentEventDateWindow,
  listRankingEventsFromIndex,
  listRecentEventsFromIndex,
} from "@/lib/eventernote/bandori-event-index";

// Exercise the real query builder and row mapping, without opening a database connection.
function queryRecorder(rows: unknown[][] = []) {
  const unsafe = vi.fn<(query: string, params: unknown[]) => { values: () => Promise<unknown[][]> }>(
    (query) => ({ values: async () => query.includes("max(") ? [[null]] : rows }),
  );
  const client = { options: { parsers: {}, serializers: {} }, unsafe };
  const db = drizzle(client as unknown as Sql, { schema });
  return { db, unsafe };
}

describe("event index queries", () => {
  it("limits recent events to an inclusive Shanghai date window and orders ties consistently", async () => {
    const { db, unsafe } = queryRecorder();
    const result = await listRecentEventsFromIndex(new Date("2026-04-30T16:30:00Z"), db);
    expect(result).toEqual({
      events: [], updatedAt: null,
      filteredFrom: "2026-04-01", filteredThrough: "2026-05-08",
    });
    const [query, params] = unsafe.mock.calls.find(([query]) => !query.includes("max("))!;
    expect(query).toContain('"event_date" >= $1');
    expect(query).toContain('"event_date" <= $2');
    expect(params).toEqual(["2026-04-01", "2026-05-08"]);
    expect(query).toMatch(/order by .*"event_date" desc, .*"attendee_count" desc, .*"eventernote_event_id" desc$/);
  });

  it("lists the full index including future events in ascending date and ID order", async () => {
    const { db, unsafe } = queryRecorder([
      [7, "Future live", "2099-01-01", null, "https://www.eventernote.com/events/7", 8, ["mygo"], ["MyGO!!!!!"]],
    ]);
    expect(await listRankingEventsFromIndex(db)).toEqual({
      events: [{
        eventernoteEventId: 7, title: "Future live", eventDate: "2099-01-01", venue: null,
        sourceUrl: "https://www.eventernote.com/events/7", attendeeCount: 8,
        bandSlugs: ["mygo"], bandNames: ["MyGO!!!!!"],
      }],
      updatedAt: null,
    });
    const [query, params] = unsafe.mock.calls.find(([query]) => !query.includes("max("))!;
    expect(query).not.toContain(" where ");
    expect(params).toEqual([]);
    expect(query).toMatch(/order by .*"event_date" asc, .*"eventernote_event_id" asc$/);
  });

  it("computes recent windows across year boundaries", () => {
    expect(getRecentEventDateWindow(new Date("2025-12-31T16:30:00Z"))).toEqual({
      filteredFrom: "2025-12-02", filteredThrough: "2026-01-08",
    });
  });
});
