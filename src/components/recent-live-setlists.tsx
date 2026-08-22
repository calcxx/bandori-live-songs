import Link from "next/link";
import type { MouseEvent } from "react";
import { getBandTextColor } from "@/lib/constants/bands";
import type { CopyDefinition } from "@/lib/i18n";
import { markCurrentEventSearchHistoryEntryAsExplicit } from "@/lib/live-setlist/history";
import type { RecentLiveSetlist } from "@/lib/live-setlist/types";
import { buildLiveSetlistHref } from "@/lib/live-setlist/url";
import { normalizeQuotesForDisplay } from "@/lib/music/title-utils";

function markReturnTarget(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  markCurrentEventSearchHistoryEntryAsExplicit();
}

export function RecentLiveSetlists({
  events,
  copy,
  title = copy.recentSetlistsTitle,
}: {
  events: RecentLiveSetlist[];
  copy: CopyDefinition;
  title?: string;
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
      <h2 className="font-heading text-xl font-semibold tracking-[-0.04em] sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {events.map((event) => (
          <Link
            key={event.eventernoteEventId}
            href={buildLiveSetlistHref(event.eventernoteEventId)}
            onClick={markReturnTarget}
            className="rounded-xl border border-border-soft bg-panel-strong px-3.5 py-3 transition hover:border-accent hover:bg-background"
          >
            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
              {normalizeQuotesForDisplay(event.title)}
            </h3>
            <p className="mt-1 text-xs leading-snug text-ink-soft">
              {event.eventDate}
              <span className="mx-1.5">·</span>
              {event.venue ?? copy.venueMissing}
            </p>
            {event.performingBands.length > 0 ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs leading-snug">
                {event.performingBands.map((band, index) => {
                  const color = getBandTextColor(band.slug);
                  return (
                    <span key={`${event.eventernoteEventId}-${band.slug}-${index}`}>
                      {index > 0 ? (
                        <span className="mr-1 text-ink-soft">·</span>
                      ) : null}
                      <span style={color ? { color } : undefined}>
                        {band.name}
                      </span>
                    </span>
                  );
                })}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
