import { NextResponse } from "next/server";
import { getSongEventsForSongIds } from "@/lib/stats/song-events-cache";

export const runtime = "nodejs";

function parseSongIds(rawValue: string | null) {
  if (!rawValue) {
    return [];
  }

  return [...new Set(
    rawValue
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  )];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const songIds = parseSongIds(url.searchParams.get("songIds"));

  if (songIds.length === 0) {
    return NextResponse.json({ songEventsBySongId: {} });
  }

  const songEventsBySongId = await getSongEventsForSongIds(songIds);
  return NextResponse.json({ songEventsBySongId });
}
