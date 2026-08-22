import { describe, expect, it } from "vitest";
import { parsePublicPagePath } from "@/lib/public-page-path";

describe("parsePublicPagePath", () => {
  it("recognizes empty and detailed event routes", () => {
    expect(parsePublicPagePath("/events")).toEqual({ kind: "events" });
    expect(parsePublicPagePath("/events/100001")).toEqual({
      kind: "event",
      eventernoteEventId: 100001,
    });
  });

  it("recognizes home and decoded user routes", () => {
    expect(parsePublicPagePath("/")).toEqual({ kind: "home" });
    expect(parsePublicPagePath("/users/sample_user")).toEqual({
      kind: "user",
      userId: "sample_user",
    });
  });

  it("rejects unrelated or invalid routes", () => {
    expect(parsePublicPagePath("/songs")).toBeNull();
    expect(parsePublicPagePath("/events/0")).toBeNull();
  });
});
