"use client";

import { SaveImageButton } from "@/components/save-image-button";
import type { EventVisibilityRules } from "@/lib/events/event-visibility";
import type { CopyDefinition } from "@/lib/i18n";
import {
  type MatchedEventEntry,
  type SongPoolItem,
} from "@/lib/stats/aggregate";
import { useResultsState } from "./results/use-results-state";
import { percentLabel } from "./results/utils";
import { BandSummaryCard } from "./results/band-summary-card";
import { EventCard } from "./results/event-card";

type ResultsClientProps = {
  userId: string;
  displayName: string | null;
  songs: SongPoolItem[];
  matchedEvents: MatchedEventEntry[];
  defaultHideUnplayed: boolean;
  defaultHideVirtualBands: boolean;
  defaultHideSonglessActivities: boolean;
  eventVisibilityRules: EventVisibilityRules;
  copy: CopyDefinition;
};

export function ResultsClient({
  userId,
  displayName,
  songs,
  matchedEvents,
  defaultHideUnplayed,
  defaultHideVirtualBands,
  defaultHideSonglessActivities,
  eventVisibilityRules,
  copy: localeCopy,
}: ResultsClientProps) {
  const state = useResultsState({
    songs,
    matchedEvents,
    defaultHideUnplayed,
    defaultHideVirtualBands,
    defaultHideSonglessActivities,
    eventVisibilityRules,
  });
  const songById = new Map(songs.map((song) => [song.id, song]));

  return (
    <div className="space-y-8">
      <div id="export-capture" className="space-y-8">
        {/* Summary section */}
        <section id="summary" className="grid gap-2.5 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="flex flex-col rounded-[1.15rem] border border-border-soft bg-panel px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-heading text-2xl font-semibold sm:text-3xl" title={displayName ?? userId}>
                  {displayName ?? userId}
                </h2>
                {displayName ? (
                  <p className="truncate text-sm text-ink-soft" title={userId}>{userId}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-soft bg-panel-strong px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={state.hideVirtualBands}
                    onChange={(event) => state.setHideVirtualBands(event.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {localeCopy.hideVirtualBands}
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-soft bg-panel-strong px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={state.hideUnplayed}
                    onChange={(event) => state.setHideUnplayed(event.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {localeCopy.hideUnplayedSongs}
                </label>
              </div>
            </div>

            <div className="mt-auto pt-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm text-ink-soft">
                  {localeCopy.heardProgress(state.stats.totalSummary.heardCount, state.stats.totalSummary.totalCount)}
                </p>
                <p className="font-heading text-3xl font-semibold leading-none">
                  {percentLabel(state.stats.totalSummary.percentage)}
                </p>
              </div>

              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-border-soft">
                {state.totalProgressSegments.map((segment) => (
                  <div
                    key={segment.slug}
                    className="h-full"
                    title={`${segment.label} ${percentLabel(segment.width / 100)}`}
                    style={{
                      width: `${segment.width}%`,
                      backgroundColor: segment.supportColor,
                    }}
                  />
                ))}
              </div>

              <p className="mt-3 text-sm leading-6 text-ink-soft">{localeCopy.catalogSummaryNote}</p>
            </div>
          </article>

          <article className="flex flex-col rounded-[1.15rem] border border-border-soft bg-panel px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink-soft">{localeCopy.matchedEventsLabel}</p>
                <p className="mt-1 font-heading text-3xl font-semibold leading-none">{state.stats.matchedEvents.length}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-soft bg-panel-strong px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={state.hideSonglessActivities}
                  onChange={(event) => state.setHideSonglessActivities(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {localeCopy.hideSonglessActivities}
              </label>
            </div>
            {state.bandEventShareSegments.length > 0 ? (
              <div className="mt-auto pt-4">
                <p className="text-sm text-ink-soft">{localeCopy.bandEventShareLabel}</p>
                <div
                  className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-border-soft"
                  aria-label={localeCopy.bandEventShareLabel}
                >
                  {state.bandEventShareSegments.map((segment) => {
                    const percentage = percentLabel(segment.width / 100);

                    return (
                      <div
                        key={segment.slug}
                        className="h-full"
                        title={localeCopy.bandEventShareTooltip(segment.label, segment.count, percentage)}
                        style={{
                          width: `${segment.width}%`,
                          backgroundColor: segment.supportColor,
                        }}
                      />
                    );
                  })}
                </div>
                <div aria-hidden className="mt-3 hidden h-6 lg:block" />
              </div>
            ) : null}
          </article>
        </section>

        {/* Bands section */}
        <section id="bands" className="space-y-5">
          <div data-export-hidden className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
                {localeCopy.bandProgressTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                <span className="sm:hidden">{localeCopy.bandProgressHintMobile}</span>
                <span className="hidden sm:inline">{localeCopy.bandProgressHintDesktop}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2.5 lg:hidden">
            {state.bandSummaries.map((summary) => (
              <BandSummaryCard
                key={summary.slug}
                summary={summary}
                localeCopy={localeCopy}
                activeSongId={state.activeSongId}
                expandedBands={state.expandedBands}
                songEventsBySongId={state.songEventsBySongId}
                loadedBands={state.loadedBands}
                loadingBands={state.loadingBands}
                attendedEventIds={state.attendedEventIds}
                hideSonglessActivities={state.hideSonglessActivities}
                eventVisibilityRules={eventVisibilityRules}
                toggleBandSongs={state.toggleBandSongs}
                toggleSongEvents={state.toggleSongEvents}
                handleSongPointerEnter={state.handleSongPointerEnter}
                handleSongPointerLeave={state.handleSongPointerLeave}
              />
            ))}
          </div>

          <div className="hidden gap-2.5 lg:grid lg:grid-cols-2 lg:items-start">
            {state.bandSummaryColumns.map((column, columnIndex) => (
              <div key={columnIndex} className="space-y-2.5">
                {column.map((summary) => (
                  <BandSummaryCard
                    key={summary.slug}
                    summary={summary}
                    localeCopy={localeCopy}
                    activeSongId={state.activeSongId}
                    expandedBands={state.expandedBands}
                    songEventsBySongId={state.songEventsBySongId}
                    loadedBands={state.loadedBands}
                    loadingBands={state.loadingBands}
                    attendedEventIds={state.attendedEventIds}
                    hideSonglessActivities={state.hideSonglessActivities}
                    eventVisibilityRules={eventVisibilityRules}
                    toggleBandSongs={state.toggleBandSongs}
                    toggleSongEvents={state.toggleSongEvents}
                    handleSongPointerEnter={state.handleSongPointerEnter}
                    handleSongPointerLeave={state.handleSongPointerLeave}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="pt-2">
        <SaveImageButton targetId="export-capture" fileLabel={userId} copy={localeCopy} />
      </div>

      {/* Events section */}
      <section id="events" className="space-y-5">
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
            {localeCopy.eventCoverageTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{localeCopy.eventCoverageNote}</p>
        </div>
        <div className="grid gap-2.5">
          {state.stats.matchedEvents.map((event) => (
            <EventCard
              key={event.eventernoteEventId}
              event={event}
              localeCopy={localeCopy}
              isExpanded={state.expandedEvents[event.eventernoteEventId] ?? false}
              newlyHeardSongs={state.stats.newlyHeardSongsByEventId[event.eventernoteEventId] ?? []}
              performedSongs={
                event.setlistEntries ??
                event.heardSongIds.flatMap((songId, index) => {
                  const song = songById.get(songId);
                  return song
                    ? [{
                        position: index + 1,
                        title: song.title,
                        songId: song.id,
                        category: song.category,
                        bandSlug: song.category === "original" ? song.bandSlug : null,
                      }]
                    : [];
                })
              }
              toggleEventUnlocks={state.toggleEventUnlocks}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
