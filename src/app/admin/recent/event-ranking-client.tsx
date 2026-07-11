"use client";

import { useMemo, useState } from "react";
import { AdminEventTable, type AdminEventSetlistStatus } from "@/components/admin-event-table";
import type { ActorEventRankingEntry } from "@/lib/eventernote/actor-events";
import { filterEventsByVisibilityRules, type EventVisibilityRules } from "@/lib/events/event-visibility";
import { filterEventsByCollectedSetlistStatus } from "@/lib/events/setlist-status-filter";

type BandFilter = {
  slug: string;
  nameJa: string;
};

type EventRankingClientProps = {
  eyebrow: string;
  title: string;
  description: string;
  generatedAtLabel: string;
  events: ActorEventRankingEntry[];
  bands?: BandFilter[];
  statusByEventId: Record<number, AdminEventSetlistStatus>;
  eventVisibilityRules: EventVisibilityRules;
  enableHideCollectedActivities?: boolean;
};

export function EventRankingClient({
  eyebrow,
  title,
  description,
  generatedAtLabel,
  events,
  bands = [],
  statusByEventId,
  eventVisibilityRules,
  enableHideCollectedActivities = false,
}: EventRankingClientProps) {
  const [activeBandSlug, setActiveBandSlug] = useState<string>("all");
  const [hideSonglessActivities, setHideSonglessActivities] = useState(true);
  const [hideCollectedActivities, setHideCollectedActivities] = useState(false);

  const sourceEvents = useMemo(
    () =>
      activeBandSlug === "all"
        ? events
        : events.filter((event) => event.bandSlugs.includes(activeBandSlug)),
    [activeBandSlug, events],
  );

  const visibleEvents = useMemo(
    () =>
      filterEventsByCollectedSetlistStatus(
        filterEventsByVisibilityRules(sourceEvents, hideSonglessActivities, eventVisibilityRules),
        statusByEventId,
        enableHideCollectedActivities && hideCollectedActivities,
      ),
    [
      enableHideCollectedActivities,
      eventVisibilityRules,
      hideCollectedActivities,
      hideSonglessActivities,
      sourceEvents,
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
            <p className="text-sm text-ink-soft">{eyebrow}</p>
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-ink-soft">{description}</p>
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
              切换乐队后仅显示该乐队参与的全部活动；多团出演活动会出现在对应各乐队视图里。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveBandSlug("all")}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeBandSlug === "all"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border-soft bg-panel-strong text-ink-soft hover:text-foreground"
              }`}
            >
              全部
            </button>
            {bands.map((band) => (
              <button
                key={band.slug}
                type="button"
                onClick={() => setActiveBandSlug(band.slug)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  activeBandSlug === band.slug
                    ? "border-foreground bg-foreground text-background"
                    : "border-border-soft bg-panel-strong text-ink-soft hover:text-foreground"
                }`}
              >
                {band.nameJa}
              </button>
            ))}
            <label className="ml-auto inline-flex cursor-pointer items-center gap-3 rounded-full border border-border-soft bg-panel-strong px-4 py-2 text-sm">
              <input
                type="checkbox"
                checked={hideSonglessActivities}
                onChange={(event) => setHideSonglessActivities(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              隐藏无歌曲活动
            </label>
            {enableHideCollectedActivities ? (
              <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-border-soft bg-panel-strong px-4 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideCollectedActivities}
                  onChange={(event) => setHideCollectedActivities(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                隐藏已收录活动
              </label>
            ) : null}
          </div>
        </div>

        <AdminEventTable
          events={visibleEvents}
          statusByEventId={statusByEventId}
          variant="flat"
          rowKeyPrefix={`${activeBandSlug}-`}
        />
      </section>
    </>
  );
}
