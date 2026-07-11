import { NextResponse } from "next/server";
import { searchEventSetlistForExport } from "@/lib/setlist-export/search-event-setlist";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://bandori.fans",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title")?.trim() ?? "";
  const eventDate = url.searchParams.get("eventDate")?.trim() ?? "";
  const eventernoteEventIdRaw = url.searchParams.get("eventernoteEventId");
  const eventernoteEventId = eventernoteEventIdRaw
    ? Number.parseInt(eventernoteEventIdRaw, 10)
    : undefined;

  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return NextResponse.json(
      { error: "eventDate 须为 YYYY-MM-DD 格式。" },
      { status: 400, headers: corsHeaders },
    );
  }

  if (!title && (!eventernoteEventId || !Number.isSafeInteger(eventernoteEventId) || eventernoteEventId <= 0)) {
    return NextResponse.json(
      { error: "请提供 title 或 eventernoteEventId。" },
      { status: 400, headers: corsHeaders },
    );
  }

  const result = await searchEventSetlistForExport({
    title: title || undefined,
    eventDate: eventDate || undefined,
    eventernoteEventId,
  });

  return NextResponse.json(result, { headers: corsHeaders });
}
