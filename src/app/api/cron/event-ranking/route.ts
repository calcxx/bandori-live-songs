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

  return Response.json({
    ok: true,
    indexedEventCount: result.indexedEventCount,
    updatedAt: result.updatedAt,
  });
}
