import { revalidateTag } from "next/cache";
import { syncRecentMusicBrainzSongs } from "@/lib/musicbrainz/recent-songs-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const logs: string[] = [];
  const result = await syncRecentMusicBrainzSongs({
    dryRun,
    onBand: (message) => {
      console.log(`[songs-sync] ${message}`);
      logs.push(message);
    },
  });

  if (!dryRun && (result.inserted > 0 || result.updated > 0)) {
    for (const tag of ["song-catalog", "open-api-v1"]) {
      revalidateTag(tag, { expire: 0 });
    }
  }

  return Response.json({
    ok: result.errors.length === 0,
    ...result,
    logs,
  });
}
