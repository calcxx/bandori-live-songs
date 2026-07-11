"use client";

import { Fragment } from "react";
import { buildSetlistImportHref } from "@/lib/admin/setlist-import-url";
import type { ActorEventRankingEntry } from "@/lib/eventernote/actor-events";
import { groupEventsByYear } from "@/lib/admin/list-event-filters";

export type AdminEventSetlistStatus = "missing" | "partial" | "complete" | null;

function getSetlistStatusPresentation(status: AdminEventSetlistStatus) {
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

function AdminEventRow({
  event,
  index,
  statusByEventId,
}: {
  event: ActorEventRankingEntry;
  index: number;
  statusByEventId: Record<number, AdminEventSetlistStatus>;
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
          title={`编辑 / 导入 Event #${event.eventernoteEventId}`}
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

type AdminEventTableProps = {
  events: ActorEventRankingEntry[];
  statusByEventId: Record<number, AdminEventSetlistStatus>;
  variant?: "flat" | "timeline";
  rowKeyPrefix?: string;
};

export function AdminEventTable({
  events,
  statusByEventId,
  variant = "flat",
  rowKeyPrefix = "",
}: AdminEventTableProps) {
  const timelineGroups =
    variant === "timeline"
      ? (() => {
          let index = 0;
          return groupEventsByYear(events).map(({ year, events: yearEvents }) => ({
            year,
            rows: yearEvents.map((event) => {
              index += 1;
              return { event, index };
            }),
          }));
        })()
      : [];

  return (
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
          {variant === "timeline"
            ? timelineGroups.map(({ year, rows }) => (
                <Fragment key={year}>
                  <tr className="border-t border-border-soft bg-panel-strong">
                    <td colSpan={6} className="px-4 py-3 font-semibold text-foreground">
                      {year} 年
                      <span className="ml-2 text-xs font-normal text-ink-soft">{rows.length} 场</span>
                    </td>
                  </tr>
                  {rows.map(({ event, index }) => (
                    <AdminEventRow
                      key={event.eventernoteEventId}
                      event={event}
                      index={index}
                      statusByEventId={statusByEventId}
                    />
                  ))}
                </Fragment>
              ))
            : events.map((event, index) => (
                <AdminEventRow
                  key={`${rowKeyPrefix}${event.eventernoteEventId}`}
                  event={event}
                  index={index + 1}
                  statusByEventId={statusByEventId}
                />
              ))}
        </tbody>
      </table>
    </div>
  );
}
