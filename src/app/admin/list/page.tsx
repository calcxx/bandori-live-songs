import { inArray } from "drizzle-orm";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { getDb } from "@/lib/db/core";
import { events } from "@/lib/db/schema";
import { listRankingEventsFromIndex } from "@/lib/eventernote/bandori-event-index";
import { readEventVisibilityRules } from "@/lib/events/event-visibility-rules-store";
import { AdminListClient } from "./list-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null) {
  if (!value) {
    return "尚未抓取";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
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

export default async function AdminListPage() {
  const ranking = await listRankingEventsFromIndex();
  const statusByEventId = await getEventSetlistStatuses(ranking.events.map((event) => event.eventernoteEventId));
  const eventVisibilityRules = await readEventVisibilityRules();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <AdminListClient
        generatedAtLabel={formatDateTime(ranking.updatedAt)}
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
