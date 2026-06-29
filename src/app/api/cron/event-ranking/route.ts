import { buildRecentEventRankingSnapshot, saveRecentEventSnapshot } from "@/lib/eventernote/event-ranking-snapshot";

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

  const snapshot = await buildRecentEventRankingSnapshot();
  await saveRecentEventSnapshot(snapshot);

  return Response.json({
    ok: true,
    generatedAt: snapshot.generatedAt,
    filteredFrom: snapshot.filteredFrom,
    filteredThrough: snapshot.filteredThrough,
    eventCount: snapshot.events.length,
    mergedEventCount: snapshot.mergedEventCount,
    scannedEventCount: snapshot.scannedEventCount,
  });
}
