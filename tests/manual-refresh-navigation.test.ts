import { describe, expect, it } from "vitest";
import {
  awaitFreshAfterCookieName,
  buildAwaitFreshAfterCookie,
  clearAwaitFreshAfterCookie,
  decodeAwaitFreshAfterCookie,
  encodeAwaitFreshAfterCookie,
} from "@/lib/manual-refresh-navigation";

describe("manual refresh cookie", () => {
  it("builds a short-lived site-wide cookie that round-trips the user and timestamp", () => {
    const cookie = buildAwaitFreshAfterCookie("test_user", 1777111231663);
    const [pair, ...attributes] = cookie.split("; ");
    const [name, value] = pair.split("=");
    expect(name).toBe(awaitFreshAfterCookieName);
    expect(attributes).toEqual(["path=/", "max-age=600", "samesite=lax"]);
    expect(decodeAwaitFreshAfterCookie(value, "test_user")).toBe(1777111231663);
    expect(clearAwaitFreshAfterCookie()).toBe(`${name}=; path=/; max-age=0; samesite=lax`);
  });

  it("ignores another user's refresh request", () => {
    const value = encodeAwaitFreshAfterCookie({ userId: "other", timestamp: 1777111231663 });
    expect(decodeAwaitFreshAfterCookie(value, "test_user")).toBeUndefined();
  });

  it.each([undefined, "%", "%7B", "null", encodeURIComponent(JSON.stringify({ userId: "test_user" })),
    ...[0, -1, "123"].map((timestamp) => encodeURIComponent(JSON.stringify({ userId: "test_user", timestamp }))),
  ])("ignores malformed or invalid refresh payload %s", (value) => {
    expect(decodeAwaitFreshAfterCookie(value, "test_user")).toBeUndefined();
  });
});
