import { normalizeEventernoteUserCacheKey } from "@/lib/eventernote/user-id";
import type { UserSongStatsResult } from "@/lib/stats/get-user-song-stats";

type UserStatsOkResult = Extract<UserSongStatsResult, { state: "ok" }>;

// Session-level cache of successfully loaded user stats. The in-memory
// map is mirrored to sessionStorage so it also survives full page loads
// (e.g. following an event link) within the same browser tab, letting
// already loaded user pages render instantly on return while the server
// navigation revalidates.
const userStatsStorageKey = "bdr-user-stats-cache-v1";
const userStatsOkCache = new Map<string, UserStatsOkResult>();
const userStatsCacheLimit = 5;
let userStatsCacheHydrated = false;

function isCachedUserStats(value: unknown): value is UserStatsOkResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<UserStatsOkResult>;
  return (
    candidate.state === "ok" &&
    typeof candidate.userId === "string" &&
    Array.isArray(candidate.songs) &&
    Array.isArray(candidate.matchedEvents)
  );
}

function hydrateUserStatsCache() {
  if (userStatsCacheHydrated || typeof window === "undefined") {
    return;
  }
  userStatsCacheHydrated = true;
  try {
    const raw = window.sessionStorage.getItem(userStatsStorageKey);
    if (!raw) {
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return;
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (isCachedUserStats(value)) {
        userStatsOkCache.set(key, value);
      }
    }
  } catch {
    // Storage may be disabled or contain invalid data.
  }
}

export function writeUserStatsCache(result: UserStatsOkResult) {
  // A server-rendered result can arrive before the first read on a new page.
  hydrateUserStatsCache();
  const key = normalizeEventernoteUserCacheKey(result.userId);
  userStatsOkCache.delete(key);
  userStatsOkCache.set(key, result);
  while (userStatsOkCache.size > userStatsCacheLimit) {
    const oldestKey = userStatsOkCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    userStatsOkCache.delete(oldestKey);
  }
  try {
    window.sessionStorage.setItem(
      userStatsStorageKey,
      JSON.stringify(Object.fromEntries(userStatsOkCache)),
    );
  } catch {
    // Storage may be disabled by the browser.
  }
}

export function readUserStatsCache(userId: string) {
  hydrateUserStatsCache();
  return userStatsOkCache.get(normalizeEventernoteUserCacheKey(userId)) ?? null;
}
