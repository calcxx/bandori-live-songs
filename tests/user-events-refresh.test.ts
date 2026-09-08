import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/core", () => ({ getDb: () => ({}) }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/eventernote/client", () => ({
  fetchAllUserEvents: vi.fn(),
  EventernoteUserNotFoundError: class extends Error {},
}));
vi.mock("@/lib/stats/user-events-cache-store", () => ({
  persistFetchedUserEventsCache: vi.fn(),
  markUserEventsNotFound: vi.fn(),
  releaseUserEventsAfterTransientFailure: vi.fn(),
  tryAcquireUserEventsRefreshLease: vi.fn(),
}));

import { after } from "next/server";
import { EventernoteUserNotFoundError, fetchAllUserEvents } from "@/lib/eventernote/client";
import { persistFetchedUserEventsCache, markUserEventsNotFound, releaseUserEventsAfterTransientFailure, tryAcquireUserEventsRefreshLease } from "@/lib/stats/user-events-cache-store";
import { refreshCachedUserEventsDeduped, scheduleUserEventsRefresh } from "@/lib/stats/user-events-refresh";

const remote = { userId: "User", displayId: "User", displayName: null, events: [], totalCount: 0 };
const persisted = { displayId: "User", displayName: null, activities: [], remoteEventCount: 0 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchAllUserEvents).mockResolvedValue(remote);
  vi.mocked(persistFetchedUserEventsCache).mockResolvedValue(persisted);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("user event refresh coordination", () => {
  it("shares concurrent refreshes and releases the in-flight entry after completion", async () => {
    const first = refreshCachedUserEventsDeduped("User", "user");
    expect(refreshCachedUserEventsDeduped("USER", "user")).toBe(first);
    await expect(first).resolves.toEqual({ status: "ok", ...persisted });
    expect(fetchAllUserEvents).toHaveBeenCalledTimes(1);
    expect(persistFetchedUserEventsCache).toHaveBeenCalledWith("user", remote, {});
    await refreshCachedUserEventsDeduped("User", "user");
    expect(fetchAllUserEvents).toHaveBeenCalledTimes(2);
  });

  it("releases transient failures without marking the user missing and allows retry", async () => {
    vi.mocked(fetchAllUserEvents).mockRejectedValueOnce(new Error("timeout"));
    await expect(refreshCachedUserEventsDeduped("User", "user")).resolves.toEqual({ status: "error", message: "timeout" });
    expect(releaseUserEventsAfterTransientFailure).toHaveBeenCalledWith("user", {});
    expect(markUserEventsNotFound).not.toHaveBeenCalled();
    await expect(refreshCachedUserEventsDeduped("User", "user")).resolves.toMatchObject({ status: "ok" });
  });

  it("records a confirmed missing user separately from transient failures", async () => {
    vi.mocked(fetchAllUserEvents).mockRejectedValueOnce(new EventernoteUserNotFoundError("missing"));
    await expect(refreshCachedUserEventsDeduped("User", "user")).resolves.toMatchObject({ status: "not-found" });
    expect(markUserEventsNotFound).toHaveBeenCalledOnce();
    expect(releaseUserEventsAfterTransientFailure).not.toHaveBeenCalled();
  });

  it.each([false, true])("background refresh fetches only when the lease is acquired: %s", async (acquired) => {
    vi.mocked(tryAcquireUserEventsRefreshLease).mockResolvedValue(acquired);
    scheduleUserEventsRefresh("User", "user", "User");
    expect(fetchAllUserEvents).not.toHaveBeenCalled();
    const callback = vi.mocked(after).mock.calls[0][0];
    if (typeof callback !== "function") throw new Error("Expected an after callback");
    await callback();
    expect(fetchAllUserEvents).toHaveBeenCalledTimes(acquired ? 1 : 0);
  });
});
