"use client";

import { Fragment, useMemo, useState } from "react";
import { buildSetlistImportHref } from "@/lib/admin/setlist-import-url";
import type { ActorEventRankingEntry } from "@/lib/eventernote/actor-events";
import { filterEventsByVisibilityRules, type EventVisibilityRules } from "@/lib/events/event-visibility";
import { filterEventsByCollectedSetlistStatus } from "@/lib/events/setlist-status-filter";

type SetlistStatus = "missing" | "partial" | "complete" | null;

type BandFilter = {
  slug: string;
  nameJa: string;
};

type EventRankingClientProps = {
  eyebrow: string;
  title: string;
  description: string;
  generatedAtLabel: string;
  scannedEventCount: number;
  mergedEventCount: number;
  events: ActorEventRankingEntry[];
  bands?: BandFilter[];
  statusByEventId: Record<number, SetlistStatus>;
  eventVisibilityRules: EventVisibilityRules;
  enableHideCollectedActivities?: boolean;
  variant?: "default" | "timeline";
};

function getSetlistStatusPresentation(status: SetlistStatus) {
  if (status === "complete" || status === "partial") {
    return {
      marker: "✓",
      title: "已收录歌单",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    };
  }

  return {
    marker: "✗",
    title: "未收录歌单",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };
}

function groupEventsByYear(events: ActorEventRankingEntry[]) {
  const groups = new Map<string, ActorEventRankingEntry[]>();

  for (const event of events) {
    const year = event.eventDate.slice(0, 4);
    const bucket = groups.get(year) ?? [];
    bucket.push(event);
    groups.set(year, bucket);
  }

  return [...groups.entries()]
    .sort(([leftYear], [rightYear]) => leftYear.localeCompare(rightYear))
    .map(([year, yearEvents]) => ({ year, events: yearEvents }));
}

function EventRankingRow({
  event,
  index,
  statusByEventId,
}: {
  event: ActorEventRankingEntry;
  index: number;
  statusByEventId: Record<number, SetlistStatus>;
}) {
  const status = getSetlistStatusPresentation(statusByEventId[event.eventernoteEventId] ?? null);
  const importHref = buildSetlistImportHref(event.eventernoteEventId);

  return (
    <tr className="border-t border-border-soft align-top">
      <td className="px-4 py-4 font-medium text-foreground">{index}</td>
      <td className="px-4 py-4">
        <a
          href={importHref}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground transition hover:text-accent"
          title={`一键导入 Event #${event.eventernoteEventId}`}
        >
          {event.title}
        </a>
        <p className="mt-1 text-xs leading-5 text-ink-soft">Event #{event.eventernoteEventId}</p>
      </td>
      <td className="px-4 py-4 font-semibold text-foreground">{event.attendeeCount}</td>
      <td className="px-4 py-4 text-ink-soft">{event.eventDate}</td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {event.bandNames.map((bandName) => (
            <span
              key={`${event.eventernoteEventId}-${bandName}`}
              className="rounded-full border border-border-soft bg-panel-strong px-3 py-1 text-xs text-foreground"
            >
              {bandName}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${status.className}`}
          aria-label={status.title}
          title={status.title}
        >
          {status.marker}
        </span>
      </td>
    </tr>
  );
}

export function EventRankingClient({
  eyebrow,
  title,
  description,
  generatedAtLabel,
  scannedEventCount,
  mergedEventCount,
  events,
  bands = [],
  statusByEventId,
  eventVisibilityRules,
  enableHideCollectedActivities = false,
  variant = "default",
}: EventRankingClientProps) {
  const [activeBandSlug, setActiveBandSlug] = useState<string>("all");
  const [hideSonglessActivities, setHideSonglessActivities] = useState(true);
  const [hideCollectedActivities, setHideCollectedActivities] = useState(false);
  const isTimeline = variant === "timeline";

  const sourceEvents = useMemo(
    () =>
      isTimeline || activeBandSlug === "all"
        ? events
        : events.filter((event) => event.bandSlugs.includes(activeBandSlug)),
    [activeBandSlug, events, isTimeline],
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

  const timelineGroups = useMemo(() => {
    if (!isTimeline) {
      return [];
    }

    let index = 0;

    return groupEventsByYear(visibleEvents).map(({ year, events: yearEvents }) => ({
      year,
      rows: yearEvents.map((event) => {
        index += 1;
        return { event, index };
      }),
    }));
  }, [isTimeline, visibleEvents]);

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
          <div className="grid gap-3 sm:grid-cols-4">
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
            <div className="rounded-[1.1rem] border border-border-soft bg-panel-strong px-4 py-3">
              <p className="text-xs text-ink-soft">原始活动条目</p>
              <p className="mt-1 text-sm font-medium">{scannedEventCount}</p>
            </div>
            <div className="rounded-[1.1rem] border border-border-soft bg-panel-strong px-4 py-3">
              <p className="text-xs text-ink-soft">去重后活动数</p>
              <p className="mt-1 text-sm font-medium">{mergedEventCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-border-soft bg-panel">
        <div className="space-y-4 border-b border-border-soft px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <p className="text-sm text-ink-soft">筛选范围</p>
            <p className="text-sm text-ink-soft">
              {isTimeline
                ? "按年份分组显示全部活动；年份从早到晚排列，同年内按日期从早到晚排列。"
                : "切换乐队后仅显示该乐队参与的全部活动；多团出演活动会出现在对应各乐队视图里。"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isTimeline ? (
              <>
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
              </>
            ) : null}
            <label
              className={`inline-flex cursor-pointer items-center gap-3 rounded-full border border-border-soft bg-panel-strong px-4 py-2 text-sm ${isTimeline ? "" : "ml-auto"}`}
            >
              <input
                type="checkbox"
                checked={hideSonglessActivities}
                onChange={(event) => setHideSonglessActivities(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {`隐藏无歌曲活动`}
            </label>
            {enableHideCollectedActivities ? (
              <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-border-soft bg-panel-strong px-4 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideCollectedActivities}
                  onChange={(event) => setHideCollectedActivities(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {`隐藏已收录活动`}
              </label>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-panel-strong text-left text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">活动</th>
                <th className="px-4 py-3 font-medium">人数</th>
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">命中乐队</th>
                <th className="px-4 py-3 font-medium">歌单状态</th>
              </tr>
            </thead>
            <tbody>
              {isTimeline
                ? timelineGroups.map(({ year, rows }) => (
                    <Fragment key={year}>
                      <tr className="border-t border-border-soft bg-panel-strong">
                        <td colSpan={6} className="px-4 py-3 font-semibold text-foreground">
                          {year} 年
                          <span className="ml-2 text-xs font-normal text-ink-soft">{rows.length} 场</span>
                        </td>
                      </tr>
                      {rows.map(({ event, index }) => (
                        <EventRankingRow
                          key={event.eventernoteEventId}
                          event={event}
                          index={index}
                          statusByEventId={statusByEventId}
                        />
                      ))}
                    </Fragment>
                  ))
                : visibleEvents.map((event, index) => (
                    <EventRankingRow
                      key={`${activeBandSlug}-${event.eventernoteEventId}`}
                      event={event}
                      index={index + 1}
                      statusByEventId={statusByEventId}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
