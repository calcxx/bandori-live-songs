import { revalidateTag } from "next/cache";
import { refreshBandoriActorEvents } from "@/lib/eventernote/event-ranking-snapshot";

export const runtime = "nodejs";

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

  const result = await refreshBandoriActorEvents();
  for (const tag of ["open-api-v1", "song-events", "live-setlist-search"]) {
    revalidateTag(tag, { expire: 0 });
  }

  return Response.json({
    ok: true,
    indexedEventCount: result.indexedEventCount,
    removedEventCount: result.removedEventCount,
    updatedAt: result.updatedAt,
  });
}
