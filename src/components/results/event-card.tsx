"use client";

import { getBandSupportColor, getBandTextColor } from "@/lib/constants/bands";
import type { cnCopy } from "@/lib/i18n/cn";
import { formatSongTitleForDisplay } from "@/lib/music/title-utils";
import type { MatchedEventEntry } from "@/lib/stats/aggregate";
import type { useResultsState } from "./use-results-state";
import { withAlpha } from "./utils";

type EventSong = {
  id: number;
  title: string;
  bandSlug: string;
};

type EventCardProps = {
  event: MatchedEventEntry;
  localeCopy: typeof cnCopy;
  isExpanded: boolean;
  newlyHeardSongs: EventSong[];
  performedSongs: EventSong[];
  toggleEventUnlocks: ReturnType<typeof useResultsState>["toggleEventUnlocks"];
};

function SongChips({
  eventernoteEventId,
  songs,
  newlyHeardSongIds,
}: {
  eventernoteEventId: number;
  songs: EventSong[];
  newlyHeardSongIds: Set<number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {songs.map((song) => {
        const supportColor = getBandSupportColor(song.bandSlug) ?? "var(--accent)";
        const textColor = getBandTextColor(song.bandSlug) ?? supportColor;
        const emphasized = newlyHeardSongIds.has(song.id);

        return (
          <span
            key={`${eventernoteEventId}-${song.id}`}
            className="rounded-[1rem] border px-3 py-2 text-sm"
            style={{
              borderColor: emphasized ? supportColor : "var(--border)",
              backgroundColor: emphasized ? withAlpha(supportColor, "12") : "var(--panel-strong)",
              color: textColor,
            }}
          >
            {formatSongTitleForDisplay(song.title)}
          </span>
        );
      })}
    </div>
  );
}

export function EventCard({
  event,
  localeCopy,
  isExpanded,
  newlyHeardSongs,
  performedSongs,
  toggleEventUnlocks,
}: EventCardProps) {
  const hasCollectedSetlist = event.setlistStatus === "complete" || event.setlistStatus === "partial";
  const newlyHeardSongIds = new Set(newlyHeardSongs.map((song) => song.id));

  return (
    <article
      key={event.eventernoteEventId}
      className="rounded-[1.15rem] border border-border-soft bg-panel px-4 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className={`min-w-0 flex-1 space-y-1 ${hasCollectedSetlist ? "cursor-pointer" : ""}`}
          role={hasCollectedSetlist ? "button" : undefined}
          tabIndex={hasCollectedSetlist ? 0 : undefined}
          onClick={hasCollectedSetlist ? () => toggleEventUnlocks(event.eventernoteEventId) : undefined}
          onKeyDown={
            hasCollectedSetlist
              ? (keyboardEvent) => {
                  if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                    keyboardEvent.preventDefault();
                    toggleEventUnlocks(event.eventernoteEventId);
                  }
                }
              : undefined
          }
          aria-expanded={hasCollectedSetlist ? isExpanded : undefined}
          aria-label={
            hasCollectedSetlist
              ? isExpanded
                ? localeCopy.collapseEventUnlocksAria
                : localeCopy.expandEventUnlocksAria
              : undefined
          }
        >
          <div className="font-heading text-lg font-semibold sm:text-xl">
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent"
              onClick={(mouseEvent) => {
                mouseEvent.stopPropagation();
              }}
            >
              {event.title}
            </a>
            <span
              className={`ml-2 inline-flex align-middle rounded-full px-2 py-0.5 text-[11px] font-normal sm:hidden ${
                hasCollectedSetlist
                  ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                  : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
              }`}
            >
              {hasCollectedSetlist
                ? localeCopy.collectedSetlistBadge
                : localeCopy.missingSetlistBadge}
            </span>
          </div>
          <p className="text-sm text-ink-soft">
            {event.eventDate}
            <span className="mx-1.5">·</span>
            {event.venue ?? localeCopy.venueMissing}
          </p>
          <p className="text-sm text-foreground">
            <span className="inline-flex flex-wrap items-center gap-x-1">
              {event.matchedBandNames.map((bandName, index) => {
                const bandSlug = event.matchedBandSlugs[index] ?? null;
                const textColor = bandSlug ? getBandTextColor(bandSlug) : null;

                return (
                  <span key={`${event.eventernoteEventId}-${bandSlug ?? bandName}-${index}`}>
                    {index > 0 ? <span className="mx-0.5 text-ink-soft">·</span> : null}
                    <span style={textColor ? { color: textColor } : undefined}>{bandName}</span>
                  </span>
                );
              })}
            </span>
          </p>
          {hasCollectedSetlist && newlyHeardSongs.length > 0 ? (
            <p className="text-sm text-ink-soft">
              {localeCopy.eventUnlockSongsLabel} {newlyHeardSongs.length} {localeCopy.eventUnlockSongsSuffix}
            </p>
          ) : null}
        </div>
        <div className="flex items-start gap-2">
          <div
            className={`hidden shrink-0 rounded-full px-2.5 py-1 text-sm sm:block ${
              hasCollectedSetlist
                ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
            }`}
          >
            {hasCollectedSetlist
              ? localeCopy.collectedSetlistBadge
              : localeCopy.missingSetlistBadge}
          </div>
          {hasCollectedSetlist ? (
            <button
              type="button"
              onClick={() => toggleEventUnlocks(event.eventernoteEventId)}
              aria-label={isExpanded ? localeCopy.collapseEventUnlocksAria : localeCopy.expandEventUnlocksAria}
              aria-expanded={isExpanded}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-soft bg-panel-strong text-ink-soft transition hover:border-accent hover:text-foreground"
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
          ) : null}
        </div>
      </div>
      {isExpanded ? (
        <div className="mt-3 space-y-2 border-t border-border-soft pt-3">
          <p className="text-xs text-ink-soft">{localeCopy.eventSetlistLabel}</p>
          <SongChips
            eventernoteEventId={event.eventernoteEventId}
            songs={performedSongs}
            newlyHeardSongIds={newlyHeardSongIds}
          />
        </div>
      ) : null}
    </article>
  );
}
