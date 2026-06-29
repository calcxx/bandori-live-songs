"use client";

import type { CSSProperties } from "react";
import { getBandSupportColor, getBandTextColor } from "@/lib/constants/bands";
import { filterEventsByVisibilityRules, type EventVisibilityRules } from "@/lib/events/event-visibility";
import type { cnCopy } from "@/lib/i18n/cn";
import { formatSongTitleForDisplay } from "@/lib/music/title-utils";
import type { SongEventReference } from "@/lib/stats/aggregate";
import type { useResultsState } from "./use-results-state";
import { percentLabel, withAlpha } from "./utils";

type BandSummaryCardProps = {
  summary: { slug: string; nameJa: string; heardCount: number; totalCount: number; percentage: number; songs: { id: number; title: string; heard: boolean }[] };
  localeCopy: typeof cnCopy;
  activeSongId: number | null;
  expandedBands: Record<string, boolean>;
  songEventsBySongId: Record<number, SongEventReference[]>;
  loadedBands: Record<string, boolean>;
  loadingBands: Record<string, boolean>;
  attendedEventIds: Set<number>;
  hideSonglessActivities: boolean;
  eventVisibilityRules: EventVisibilityRules;
  toggleBandSongs: ReturnType<typeof useResultsState>["toggleBandSongs"];
  toggleSongEvents: ReturnType<typeof useResultsState>["toggleSongEvents"];
  handleSongPointerEnter: ReturnType<typeof useResultsState>["handleSongPointerEnter"];
  handleSongPointerLeave: ReturnType<typeof useResultsState>["handleSongPointerLeave"];
};

export function BandSummaryCard({
  summary,
  localeCopy,
  activeSongId,
  expandedBands,
  songEventsBySongId,
  loadedBands,
  loadingBands,
  attendedEventIds,
  hideSonglessActivities,
  eventVisibilityRules,
  toggleBandSongs,
  toggleSongEvents,
  handleSongPointerEnter,
  handleSongPointerLeave,
}: BandSummaryCardProps) {
  const supportColor = getBandSupportColor(summary.slug) ?? "var(--accent)";
  const textColor = getBandTextColor(summary.slug) ?? supportColor;
  const displayBandName =
    summary.slug === "hello-happy-world" ? "Hello, Happy World!" : summary.nameJa;
  const isExpanded = expandedBands[summary.slug] ?? false;
  const songIds = summary.songs.map((song) => song.id);
  const cardStyle = {
    borderColor: withAlpha(supportColor, "40"),
    backgroundImage: `linear-gradient(180deg, ${withAlpha(supportColor, "12")} 0%, transparent 38%)`,
  } satisfies CSSProperties;

  return (
    <article
      key={summary.slug}
      className="rounded-[1.15rem] border bg-panel px-4 py-3"
      style={cardStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
           <h3
            className="truncate font-heading text-xl font-semibold sm:text-2xl"
            style={{ color: supportColor }}
            title={displayBandName}
          >
            {displayBandName}
          </h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {localeCopy.heardProgress(summary.heardCount, summary.totalCount)}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <p className="font-heading text-2xl font-semibold leading-none sm:text-3xl" style={{ color: supportColor }}>
            {percentLabel(summary.percentage)}
          </p>
          <button
            type="button"
            onClick={() => toggleBandSongs(summary.slug, songIds)}
            aria-label={isExpanded ? localeCopy.collapseSongsAria : localeCopy.expandSongsAria}
            aria-expanded={isExpanded}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-panel-strong text-ink-soft transition hover:border-accent hover:text-foreground"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            >
              <path
                d="M5 8l5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border-soft">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(summary.percentage * 100, 100)}%`, backgroundColor: supportColor }}
        />
      </div>
      {isExpanded ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {summary.songs.map((song) => {
            const isActive = activeSongId === song.id;
            const relatedEvents = filterEventsByVisibilityRules(
              songEventsBySongId[song.id] ?? [],
              hideSonglessActivities,
              eventVisibilityRules,
            ).sort((left, right) => {
              const attendedDelta =
                Number(attendedEventIds.has(right.eventernoteEventId)) -
                Number(attendedEventIds.has(left.eventernoteEventId));

              if (attendedDelta !== 0) {
                return attendedDelta;
              }

              const dateCompare = right.eventDate.localeCompare(left.eventDate);
              if (dateCompare !== 0) {
                return dateCompare;
              }

              return right.eventernoteEventId - left.eventernoteEventId;
            });
            const isBandLoading = loadingBands[summary.slug] ?? false;
            const bandLoaded = loadedBands[summary.slug] ?? false;

            return (
              <div
                key={song.id}
                className="relative"
                onPointerEnter={(event) => handleSongPointerEnter(event, summary.slug, song.id, songIds)}
                onPointerLeave={(event) => handleSongPointerLeave(event, song.id)}
              >
                <button
                  type="button"
                  onClick={() => toggleSongEvents(summary.slug, song.id, songIds)}
                  className={`w-full rounded-[1rem] border px-3 py-2 text-left text-sm ${
                    song.heard
                      ? "text-foreground"
                      : "border-border-soft bg-panel text-ink-soft"
                  }`}
                  style={
                    song.heard
                      ? {
                          borderColor: withAlpha(supportColor, "55"),
                          backgroundColor: withAlpha(supportColor, "12"),
                        }
                      : undefined
                  }
                >
                  {formatSongTitleForDisplay(song.title)}
                </button>

                {isActive ? (
                  <div className="absolute left-0 top-full z-20 mt-2 w-full min-w-0 rounded-[1rem] border border-border-soft bg-panel px-3 py-3 sm:min-w-[22rem]">
                    <p className="text-xs text-ink-soft">{localeCopy.relatedEventsLabel}</p>
                    {relatedEvents.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {relatedEvents.map((event) => (
                          <a
                            key={`${song.id}-${event.eventernoteEventId}`}
                            href={event.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-sm transition hover:opacity-80"
                            style={
                              attendedEventIds.has(event.eventernoteEventId)
                                ? {
                                    color: textColor,
                                  }
                                : undefined
                            }
                          >
                            <span className="font-medium">{event.eventDate}</span>
                            <span className="mx-1.5 text-ink-soft">·</span>
                            <span>{event.title}</span>
                          </a>
                        ))}
                      </div>
                    ) : !bandLoaded || isBandLoading ? (
                      <p className="mt-2 text-sm text-ink-soft">{localeCopy.loadingEvents}</p>
                    ) : (
                      <p className="mt-2 text-sm text-ink-soft">{localeCopy.noSongEvents}</p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
