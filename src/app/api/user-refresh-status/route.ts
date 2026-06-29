import { sql } from "drizzle-orm";
import { setTimeout as sleep } from "node:timers/promises";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/core";
import { eventernoteUserCache } from "@/lib/db/schema";
import {
  isValidEventernoteUserId,
  normalizeEventernoteUserCacheKey,
  normalizeEventernoteUserId,
} from "@/lib/eventernote/user-id";
import { awaitFreshAfterCookieName, decodeAwaitFreshAfterCookie } from "@/lib/manual-refresh-navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refreshLeaseMs = 1000 * 60 * 5;
const longPollTimeoutMs = 1000 * 20;
const checkIntervalMs = 500;

type RefreshStatus = "warming" | "ready";

function isReadyForRefresh(
  cacheRow: {
    lastFetchedAt: Date;
    refreshingStartedAt: Date | null;
  } | null,
  awaitFreshAfter: number | undefined,
  now = Date.now(),
): boolean {
  if (!cacheRow) {
    return false;
  }

  if (typeof awaitFreshAfter === "number") {
    return new Date(cacheRow.lastFetchedAt).getTime() >= awaitFreshAfter;
  }

  if (!cacheRow.refreshingStartedAt) {
    return true;
  }

  return new Date(cacheRow.refreshingStartedAt).getTime() < now - refreshLeaseMs;
}

async function resolveRefreshStatus(cacheUserId: string, awaitFreshAfter: number | undefined): Promise<RefreshStatus> {
  const db = getDb();
  const deadline = Date.now() + longPollTimeoutMs;

  while (Date.now() < deadline) {
    const cacheRow = await db
      .select({
        lastFetchedAt: eventernoteUserCache.lastFetchedAt,
        refreshingStartedAt: eventernoteUserCache.refreshingStartedAt,
      })
      .from(eventernoteUserCache)
      .where(sql`lower(${eventernoteUserCache.userId}) = ${cacheUserId}`)
      .then((rows) => rows[0] ?? null);

    if (isReadyForRefresh(cacheRow, awaitFreshAfter)) {
      return "ready";
    }

    await sleep(checkIntervalMs);
  }

  return "warming";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = normalizeEventernoteUserId(url.searchParams.get("userId") ?? "");

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  if (!isValidEventernoteUserId(userId)) {
    return Response.json({ error: "Invalid userId" }, { status: 400 });
  }

  const cacheUserId = normalizeEventernoteUserCacheKey(userId);

  const cookieStore = await cookies();
  const awaitFreshAfterFromCookie = decodeAwaitFreshAfterCookie(
    cookieStore.get(awaitFreshAfterCookieName)?.value,
    userId,
  );
  const awaitFreshAfterFromParam = Number(url.searchParams.get("awaitFreshAfter"));
  const awaitFreshAfter =
    awaitFreshAfterFromCookie ??
    (Number.isFinite(awaitFreshAfterFromParam) && awaitFreshAfterFromParam > 0 ? awaitFreshAfterFromParam : undefined);

  const state = await resolveRefreshStatus(cacheUserId, awaitFreshAfter);

  return Response.json(
    { state },
    {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
