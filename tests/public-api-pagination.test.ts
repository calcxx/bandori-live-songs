import { describe, expect, it } from "vitest";
import { paginateById, parseLimit, PublicApiParameterError } from "@/lib/public-api/pagination";

const items = [{ id: 10 }, { id: 7 }, { id: 42 }];
const options = {
  items, limit: 2, rawCursor: null, resource: "songs", fingerprint: "same-query",
  getId: (item: { id: number }) => item.id,
};

describe("public API pagination", () => {
  it("accepts the default and both limit boundaries", () => {
    expect(parseLimit(null)).toBe(500);
    expect(parseLimit("1")).toBe(1);
    expect(parseLimit("1000")).toBe(1000);
  });

  it.each(["0", "1001", "-1", "1.5", "1e2", "2junk", "", " 2"])("rejects invalid limit %j", (value) => {
    expect(() => parseLimit(value)).toThrow(PublicApiParameterError);
  });

  it("continues in the supplied ordering without repeats and stops at the final page", () => {
    const first = paginateById(options);
    expect(first.data).toEqual([{ id: 10 }, { id: 7 }]);
    expect(first.nextCursor).not.toBeNull();
    const second = paginateById({ ...options, rawCursor: first.nextCursor });
    expect(second).toEqual({ data: [{ id: 42 }], nextCursor: null });
  });

  it("does not emit a cursor for an empty or exactly full final page", () => {
    expect(paginateById({ ...options, items: [] })).toEqual({ data: [], nextCursor: null });
    expect(paginateById({ ...options, limit: items.length })).toEqual({ data: items, nextCursor: null });
  });

  it.each([
    { name: "changed filters", changes: { fingerprint: "other" } },
    { name: "a different resource", changes: { resource: "events" } },
  ])("rejects cursor reuse with $name", ({ changes }) => {
    const { nextCursor } = paginateById(options);
    expect(() => paginateById({ ...options, ...changes, rawCursor: nextCursor }))
      .toThrow(expect.objectContaining({ code: "cursor_mismatch" }));
  });

  it("reports an expired cursor when its anchor was removed", () => {
    const { nextCursor } = paginateById(options);
    expect(() => paginateById({ ...options, items: [{ id: 10 }, { id: 42 }], rawCursor: nextCursor }))
      .toThrow(expect.objectContaining({ code: "cursor_expired" }));
  });

  it.each(["not-json", "null", JSON.stringify({ v: 2, resource: "songs", fingerprint: "same-query", lastId: 7 }),
    JSON.stringify({ v: 1, resource: "songs", fingerprint: "same-query", lastId: -1 }),
  ])("rejects malformed cursor payload %s", (payload) => {
    const rawCursor = Buffer.from(payload).toString("base64url");
    expect(() => paginateById({ ...options, rawCursor }))
      .toThrow(expect.objectContaining({ code: "invalid_cursor" }));
  });
});
