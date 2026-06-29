import { isValidEventernoteUserId } from "@/lib/eventernote/user-id";
import { formatBdrsongsSummary, resolveBdrsongsOptions } from "@/lib/bdrsongs/summary";
import { waitForBdrsongsResult } from "@/lib/bdrsongs/wait";
import { readEventVisibilityRules } from "@/lib/events/event-visibility-rules-store";
import { aggregateUserSongStats } from "@/lib/stats/aggregate";
import { getUserSongStats } from "@/lib/stats/get-user-song-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const options = resolveBdrsongsOptions(url.searchParams);

  if (!options.userId) {
    return textResponse("用法：/bdrsongs <Eventernote用户ID> [-allsongs] [-allbands]", 400);
  }

  if (!isValidEventernoteUserId(options.userId)) {
    return textResponse("Eventernote 用户 ID 只能包含英文字母、数字和下划线。", 400);
  }

  const result = await waitForBdrsongsResult(
    () =>
      getUserSongStats(options.userId, {
        refreshMode: "inline",
        refreshWaitTimeoutMs: 5_000,
        refreshWaitIntervalMs: 1_000,
      }),
    {
      timeoutMs: 55_000,
      intervalMs: 1_000,
    },
  );

  if (result.state === "warming") {
    return textResponse(`${result.message}\n刷新仍在进行中，请稍后重试 /bdrsongs ${result.userId}`, 202);
  }

  if (result.state === "not-found") {
    return textResponse("Eventernote 用户不存在或不可访问。", 404);
  }

  if (result.state === "config-error") {
    return textResponse(result.message, 500);
  }

  if (result.state === "upstream-error") {
    return textResponse(result.message, 502);
  }

  const eventVisibilityRules = await readEventVisibilityRules();
  const stats = aggregateUserSongStats({
    songs: result.songs,
    matchedEvents: result.matchedEvents,
    hideUnplayed: options.hideUnplayed,
    hideVirtualBands: options.hideVirtualBands,
    hideSonglessActivities: true,
    eventVisibilityRules,
  });

  return textResponse(
    formatBdrsongsSummary({
      userId: result.userId,
      displayName: result.displayName,
      stats,
      includeVirtualBands: options.includeVirtualBands,
      includeUnplayedSongs: options.includeUnplayedSongs,
    }),
  );
}
