import type {
  LiveSetlist,
  LiveSetlistResponse,
  RecentLiveSetlist,
  RecentLiveSetlistsResponse,
} from "@/lib/live-setlist/types";
import type { UserSongStatsResult } from "@/lib/stats/get-user-song-stats";

const liveSetlistDetailCache = new Map<number, Promise<LiveSetlist>>();
let recentLiveSetlistsRequest: Promise<RecentLiveSetlist[]> | null = null;
let onThisDayLiveSetlistsRequest: Promise<RecentLiveSetlist[]> | null = null;

export function loadLiveSetlistDetail(eventernoteEventId: number) {
  const cached = liveSetlistDetailCache.get(eventernoteEventId);
  if (cached) {
    return cached;
  }

  const request = fetch(
    `/api/live-setlists?eventernoteEventId=${eventernoteEventId}`,
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Live setlist request failed: ${response.status}`);
      }
      const data = (await response.json()) as LiveSetlistResponse;
      return data.live;
    })
    .catch((error) => {
      liveSetlistDetailCache.delete(eventernoteEventId);
      throw error;
    });

  liveSetlistDetailCache.set(eventernoteEventId, request);
  return request;
}

export function loadRecentLiveSetlists() {
  if (recentLiveSetlistsRequest) {
    return recentLiveSetlistsRequest;
  }

  recentLiveSetlistsRequest = fetch("/api/live-setlists?recent=1")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Recent live setlists request failed: ${response.status}`);
      }
      const data = (await response.json()) as RecentLiveSetlistsResponse;
      return data.events;
    })
    .catch((error) => {
      recentLiveSetlistsRequest = null;
      throw error;
    });

  return recentLiveSetlistsRequest;
}

export function loadOnThisDayLiveSetlists() {
  if (onThisDayLiveSetlistsRequest) {
    return onThisDayLiveSetlistsRequest;
  }

  onThisDayLiveSetlistsRequest = fetch("/api/live-setlists?onThisDay=1")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `On-this-day live setlists request failed: ${response.status}`,
        );
      }
      const data = (await response.json()) as RecentLiveSetlistsResponse;
      return data.events;
    })
    .catch((error) => {
      onThisDayLiveSetlistsRequest = null;
      throw error;
    });

  return onThisDayLiveSetlistsRequest;
}

export function loadDefaultUserStats(signal?: AbortSignal) {
  return fetch("/api/default-user-stats", { signal }).then(
    (res) => res.json() as Promise<UserSongStatsResult>,
  );
}
