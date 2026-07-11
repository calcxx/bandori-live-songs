"use client";

import { useMemo, useState } from "react";
import { AdminEventTable, type AdminEventSetlistStatus } from "@/components/admin-event-table";
import {
  collectEventYears,
  filterEventsByYearAndBand,
  toggleSelection,
} from "@/lib/admin/list-event-filters";
import type { ActorEventRankingEntry } from "@/lib/eventernote/actor-events";
import { filterEventsByVisibilityRules, type EventVisibilityRules } from "@/lib/events/event-visibility";
import { filterEventsByCollectedSetlistStatus } from "@/lib/events/setlist-status-filter";

type BandFilter = {
  slug: string;
  nameJa: string;
};

type AdminListClientProps = {
  generatedAtLabel: string;
  events: ActorEventRankingEntry[];
  bands: BandFilter[];
  statusByEventId: Record<number, AdminEventSetlistStatus>;
  eventVisibilityRules: EventVisibilityRules;
};

function filterChipClass(active: boolean) {
  return `rounded-full border px-4 py-2 text-sm transition ${
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border-soft bg-panel-strong text-ink-soft hover:text-foreground"
  }`;
}

export function AdminListClient({
  generatedAtLabel,
  events,
  bands,
  statusByEventId,
  eventVisibilityRules,
}: AdminListClientProps) {
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedBandSlugs, setSelectedBandSlugs] = useState<string[]>([]);
  const [hideSonglessActivities, setHideSonglessActivities] = useState(true);
  const [hideCollectedActivities, setHideCollectedActivities] = useState(false);

  const years = useMemo(() => collectEventYears(events), [events]);

  const filteredByTabs = useMemo(
    () => filterEventsByYearAndBand(events, selectedYears, selectedBandSlugs),
    [events, selectedBandSlugs, selectedYears],
  );

  const visibleEvents = useMemo(
    () =>
      filterEventsByCollectedSetlistStatus(
        filterEventsByVisibilityRules(filteredByTabs, hideSonglessActivities, eventVisibilityRules),
        statusByEventId,
        hideCollectedActivities,
      ),
    [
      eventVisibilityRules,
      filteredByTabs,
      hideCollectedActivities,
      hideSonglessActivities,
      statusByEventId,
    ],
  );

  const collectedSetlistCount = useMemo(
    () =>
      visibleEvents.filter((event) => {
        const status = statusByEventId[event.eventernoteEventId] ?? null;
        return status === "complete" || status === "partial";
      }).length,
    [statusByEventId, visibleEvents],
  );

  return (
    <>
      <section className="rounded-[1.75rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">List</p>
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em]">活动列表</h1>
            <p className="max-w-3xl text-sm leading-6 text-ink-soft">
              数据来自乐队 Eventernote actor 活动页写入的 bandori_event_index。可按年份与乐队复选筛选；点击活动标题进入歌单导入/编辑页。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.1rem] border border-border-soft bg-panel-strong px-4 py-3">
              <p className="text-xs text-ink-soft">当前已收录歌单</p>
              <p className="mt-1 text-sm font-medium">
                {collectedSetlistCount}/{visibleEvents.length}
              </p>
            </div>
            <div className="rounded-[1.1rem] border border-border-soft bg-panel-strong px-4 py-3">
              <p className="text-xs text-ink-soft">抓取时间</p>
              <p className="mt-1 text-sm font-medium">{generatedAtLabel}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-border-soft bg-panel">
        <div className="space-y-4 border-b border-border-soft px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <p className="text-sm text-ink-soft">筛选范围</p>
            <p className="text-sm text-ink-soft">
              默认不选表示全部。年份与乐队可复选；同维度为并集，两维度同时选择时取交集。列表按年份分组、组内日期升序。
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-soft">年份</span>
              <button
                type="button"
                onClick={() => setSelectedYears([])}
                className={filterChipClass(selectedYears.length === 0)}
              >
                全部
              </button>
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYears((prev) => toggleSelection(prev, year))}
                  className={filterChipClass(selectedYears.includes(year))}
                >
                  {year}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-soft">乐队</span>
              <button
                type="button"
                onClick={() => setSelectedBandSlugs([])}
                className={filterChipClass(selectedBandSlugs.length === 0)}
              >
                全部
              </button>
              {bands.map((band) => (
                <button
                  key={band.slug}
                  type="button"
                  onClick={() => setSelectedBandSlugs((prev) => toggleSelection(prev, band.slug))}
                  className={filterChipClass(selectedBandSlugs.includes(band.slug))}
                >
                  {band.nameJa}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-border-soft bg-panel-strong px-4 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideSonglessActivities}
                  onChange={(event) => setHideSonglessActivities(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                隐藏无歌曲活动
              </label>
              <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-border-soft bg-panel-strong px-4 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideCollectedActivities}
                  onChange={(event) => setHideCollectedActivities(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                隐藏已收录活动
              </label>
            </div>
          </div>
        </div>

        <AdminEventTable events={visibleEvents} statusByEventId={statusByEventId} variant="timeline" />
      </section>
    </>
  );
}
