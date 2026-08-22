import { NextResponse } from "next/server";
import {
  getLiveSetlist,
  getOnThisDayLiveSetlists,
  getRecentLiveSetlists,
  searchLiveSetlistCandidates,
} from "@/lib/live-setlist/search";
import { parseLiveSetlistSearch } from "@/lib/live-setlist/date";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventernoteEventIdValue = url.searchParams.get("eventernoteEventId");

  if (eventernoteEventIdValue !== null) {
    const eventernoteEventId = Number.parseInt(eventernoteEventIdValue, 10);
    if (
      !Number.isSafeInteger(eventernoteEventId) ||
      eventernoteEventId <= 0 ||
      String(eventernoteEventId) !== eventernoteEventIdValue
    ) {
      return NextResponse.json(
        { error: "Eventernote 活动 ID 格式不正确。" },
        { status: 400 },
      );
    }

    const live = await getLiveSetlist(eventernoteEventId);
    if (!live) {
      return NextResponse.json(
        { error: "没有找到该 Live 的歌单。" },
        { status: 404 },
      );
    }

    return NextResponse.json({ live });
  }

  if (url.searchParams.get("recent") === "1") {
    const events = await getRecentLiveSetlists();
    return NextResponse.json({ events });
  }

  if (url.searchParams.get("onThisDay") === "1") {
    const events = await getOnThisDayLiveSetlists();
    return NextResponse.json({ events });
  }

  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json(
      { error: "搜索内容须为 2 至 100 个字符。" },
      { status: 400 },
    );
  }

  const parsedQuery = parseLiveSetlistSearch(query);
  if (parsedQuery.invalidDateToken) {
    return NextResponse.json(
      {
        error:
          "日期格式不正确，请使用 YYYY、YYYY-M、YYYY-MM 或 YYYY-M-D，分隔符可使用 -、. 或 /。",
      },
      { status: 400 },
    );
  }

  if (parsedQuery.title.length === 1) {
    return NextResponse.json(
      { error: "活动标题部分须至少为 2 个字符。" },
      { status: 400 },
    );
  }

  const candidates = await searchLiveSetlistCandidates(query);
  return NextResponse.json({ candidates });
}
