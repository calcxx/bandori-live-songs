import { describe, expect, it } from "vitest";
import {
  buildGoogleSetlistSearchHref,
  buildSetlistImportHref,
  parseSetlistImportEventId,
} from "@/lib/admin/setlist-import-url";

describe("admin setlist URLs", () => {
  it("builds the local setlist editor URL", () => {
    expect(buildSetlistImportHref(1234)).toBe(
      "/admin/setlist-import?event=1234",
    );
  });

  it("builds a Google query from the event title and セットリスト", () => {
    const href = buildGoogleSetlistSearchHref("MyGO!!!!! 7th LIVE");
    const url = new URL(href);

    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("q")).toBe(
      "MyGO!!!!! 7th LIVE セットリスト",
    );
  });
});


describe("setlist event input", () => {
  it.each([" 123 ", "https://www.eventernote.com/events/123", "http://eventernote.com/events/123/?ref=search"])("accepts %s", (input) => {
    expect(parseSetlistImportEventId(input)).toBe(123);
  });
  it.each([
    "https://fakeeventernote.com/events/123", "https://eventernote.com.evil.test/events/123",
    "https://www.eventernote.com/other/events/123", "https://www.eventernote.com/events/123/other",
    "ftp://www.eventernote.com/events/123", "https://user:password@www.eventernote.com/events/123",
    "0", "9007199254740992", "123abc",
  ])("rejects misleading or invalid input: %s", (input) => {
    expect(parseSetlistImportEventId(input)).toBeNull();
  });
});
