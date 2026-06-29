import type { eventernoteUserCache } from "@/lib/db/schema";

type EventernoteUserCacheRow = typeof eventernoteUserCache.$inferSelect;

export type EventernoteCacheDisposition =
  | {
      mode: "warm-and-refresh";
      staleCacheUsed: false;
    }
  | {
      mode: "serve-cached";
      staleCacheUsed: boolean;
    }
  | {
      mode: "serve-stale-and-refresh";
      staleCacheUsed: true;
    };

export function getEventernoteCacheDisposition(
  cacheRow: EventernoteUserCacheRow | null,
  remoteEventCount: number | null,
): EventernoteCacheDisposition {
  if (!cacheRow) {
    return {
      mode: "warm-and-refresh",
      staleCacheUsed: false,
    };
  }

  const storedCount = cacheRow.remoteEventCount;

  // If remote count could not be fetched (site down), serve cached data without refresh.
  if (remoteEventCount === null) {
    return {
      mode: "serve-cached",
      staleCacheUsed: cacheRow.fetchStatus === "error",
    };
  }

  // If no stored count yet (legacy row), trigger a background refresh to populate it.
  if (storedCount === null || storedCount === undefined) {
    if (cacheRow.activities && (cacheRow.activities as unknown[]).length > 0) {
      return {
        mode: "serve-stale-and-refresh",
        staleCacheUsed: true,
      };
    }

    return {
      mode: "warm-and-refresh",
      staleCacheUsed: false,
    };
  }

  // Count unchanged — cache is still fresh.
  if (remoteEventCount === storedCount) {
    return {
      mode: "serve-cached",
      staleCacheUsed: cacheRow.fetchStatus === "error",
    };
  }

  // Count changed — serve cached data and refresh in background.
  return {
    mode: "serve-stale-and-refresh",
    staleCacheUsed: true,
  };
}
