import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/core";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { events } from "@/lib/db/schema";
import { getRecentEventSnapshot } from "@/lib/eventernote/event-ranking-snapshot";
import { readEventVisibilityRules } from "@/lib/events/event-visibility-rules-store";
import { EventRankingClient } from "../event-ranking/event-ranking-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

async function getEventSetlistStatuses(eventIds: number[]) {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    return {} as Record<number, "missing" | "partial" | "complete" | null>;
  }

  const db = getDb();
  const rows = await db
    .select({
      eventernoteEventId: events.eventernoteEventId,
      setlistStatus: events.setlistStatus,
    })
    .from(events)
    .where(inArray(events.eventernoteEventId, [...new Set(eventIds)]));

  return Object.fromEntries(rows.map((row) => [row.eventernoteEventId, row.setlistStatus]));
}

export default async function RecentEventPage() {
  const ranking = await getRecentEventSnapshot();
  const statusByEventId = await getEventSetlistStatuses(ranking.events.map((event) => event.eventernoteEventId));
  const eventVisibilityRules = await readEventVisibilityRules();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <EventRankingClient
        eyebrow="Recent"
        title="近期活动列表"
        description={`数据来自 12 支乐队的 Eventernote actor 活动页，一次性抓取后去重保存到本地。页面仅显示 ${ranking.filteredFrom} 至 ${ranking.filteredThrough} 的活动，列表按日期倒序显示，同日按参加人数倒序排列，歌单收录状态实时读取数据库。`}
        generatedAtLabel={formatDateTime(ranking.generatedAt)}
        scannedEventCount={ranking.scannedEventCount}
        mergedEventCount={ranking.mergedEventCount}
        events={ranking.events}
        bands={BAND_SEEDS.filter((band) => band.groupType === "band").map((band) => ({
          slug: band.slug,
          nameJa: band.nameJa,
        }))}
        statusByEventId={statusByEventId}
        eventVisibilityRules={eventVisibilityRules}
      />
    </main>
  );
}
