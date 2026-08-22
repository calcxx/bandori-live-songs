import { describe, expect, it } from "vitest";
import { buildLegacyHomeRedirectHref } from "@/lib/legacy-public-url";

describe("legacy public URLs", () => {
  it("redirects an event ID to its canonical event page", () => {
    expect(
      buildLegacyHomeRedirectHref({
        eventId: "100001",
        userId: "sample_user",
        tab: "event",
      }),
    ).toBe("/events/100001");
  });

  it("redirects a user ID and preserves refresh parameters", () => {
    expect(
      buildLegacyHomeRedirectHref({
        userId: " sample_user ",
        refresh: "1",
        awaitFreshAfter: "1777111231663",
      }),
    ).toBe(
      "/users/sample_user?refresh=1&awaitFreshAfter=1777111231663",
    );
  });

  it("redirects the legacy event tab to event search", () => {
    expect(buildLegacyHomeRedirectHref({ tab: "event" })).toBe(
      "/events",
    );
  });

  it("does not redirect an invalid explicit event to a lower-priority target", () => {
    expect(
      buildLegacyHomeRedirectHref({
        eventId: "invalid",
        userId: "sample_user",
        tab: "event",
      }),
    ).toBeNull();
  });

  it("leaves a parameter-free homepage unchanged", () => {
    expect(buildLegacyHomeRedirectHref({})).toBeNull();
  });
});
