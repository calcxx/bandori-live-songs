import { describe, expect, it } from "vitest";
import {
  awaitFreshAfterCookieName,
  decodeAwaitFreshAfterCookie,
  encodeAwaitFreshAfterCookie,
} from "@/lib/manual-refresh-navigation";

describe("manual refresh navigation", () => {
  it("keeps awaitFreshAfter out of the visible URL and stores it in a cookie payload", () => {
    expect(encodeAwaitFreshAfterCookie({ userId: "DDyf", timestamp: 1777111231663 })).toBe(
      "%7B%22userId%22%3A%22DDyf%22%2C%22timestamp%22%3A1777111231663%7D",
    );
    expect(awaitFreshAfterCookieName).toBe("bdr-await-fresh-after");
  });

  it("decodes awaitFreshAfter payload case-insensitively by user id", () => {
    const cookieValue = encodeAwaitFreshAfterCookie({
      userId: "DDyf",
      timestamp: 1777111231663,
    });

    expect(decodeAwaitFreshAfterCookie(cookieValue, "ddyf")).toBe(1777111231663);
  });
});
