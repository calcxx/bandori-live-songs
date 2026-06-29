import { getDefaultUserId, isValidEventernoteUserId } from "@/lib/eventernote/user-id";
import { getUserSongStats } from "@/lib/stats/get-user-song-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const demoUserId = getDefaultUserId();

  if (!demoUserId || !isValidEventernoteUserId(demoUserId)) {
    return Response.json({ error: "Demo user not configured" }, { status: 404 });
  }

  const result = await getUserSongStats(demoUserId);
  return Response.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
