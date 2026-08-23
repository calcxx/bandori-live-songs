"use client";

import Link from "next/link";
import { Loader2Icon, XIcon } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { getBandTextColor } from "@/lib/constants/bands";
import type { CopyDefinition } from "@/lib/i18n";
import type { LiveSetlist } from "@/lib/live-setlist/types";
import { buildLiveSetlistHref } from "@/lib/live-setlist/url";
import {
  formatSongTitleForDisplay,
  normalizeQuotesForDisplay,
} from "@/lib/music/title-utils";
import type { SongEventReference } from "@/lib/stats/aggregate";

function appendCopyText(chunks: string[], value: string) {
  if (value === "\n" && chunks.at(-1)?.endsWith("\n")) {
    return;
  }
  chunks.push(value);
}

function collectSelectedCopyText(node: Node, chunks: string[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    appendCopyText(chunks, node.textContent ?? "");
    return;
  }

  if (!(node instanceof HTMLElement)) {
    for (const child of node.childNodes) {
      collectSelectedCopyText(child, chunks);
    }
    return;
  }

  if (node.dataset.copyExclude !== undefined) {
    return;
  }

  if (node.tagName === "BR") {
    appendCopyText(chunks, "\n");
    return;
  }

  for (const child of node.childNodes) {
    collectSelectedCopyText(child, chunks);
  }

  if (node.dataset.copySuffix) {
    appendCopyText(chunks, node.dataset.copySuffix);
  }
  if (node.dataset.copyBlock !== undefined) {
    appendCopyText(chunks, "\n");
  }
}

function getSelectedCopyText(selection: Selection, container: HTMLElement) {
  const chunks: string[] = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const selectedRange = selection.getRangeAt(index);
    if (!selectedRange.intersectsNode(container)) {
      continue;
    }

    const clippedRange = selectedRange.cloneRange();
    if (!container.contains(clippedRange.startContainer)) {
      clippedRange.setStart(container, 0);
    }
    if (!container.contains(clippedRange.endContainer)) {
      clippedRange.setEnd(container, container.childNodes.length);
    }
    collectSelectedCopyText(clippedRange.cloneContents(), chunks);
  }

  return chunks
    .join("")
    .replaceAll("\u00a0", " ")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{2,}/gu, "\n")
    .trim();
}

export function LiveSetlistResult({
  live,
  copy,
  onNavigateToLive,
  onPrefetchLive,
}: {
  live: LiveSetlist;
  copy: CopyDefinition;
  onNavigateToLive: (eventernoteEventId: number) => Promise<boolean>;
  onPrefetchLive: (eventernoteEventId: number) => void;
}) {
  const [activeEntryKey, setActiveEntryKey] = useState<string | null>(null);
  const [songEventsBySongId, setSongEventsBySongId] = useState<
    Record<number, SongEventReference[]>
  >({});
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [pendingSeriesEventId, setPendingSeriesEventId] = useState<
    number | null
  >(null);
  const setlistRef = useRef<HTMLElement>(null);
  const activeSeriesTabRef = useRef<HTMLAnchorElement>(null);
  const songIds = useMemo(
    () => [
      ...new Set(
        live.entries.flatMap((entry) =>
          entry.songId === null ? [] : [entry.songId],
        ),
      ),
    ],
    [live.entries],
  );
  const solePerformingBand =
    live.performingBands?.length === 1
      ? live.performingBands[0]
      : null;

  useEffect(() => {
    const activeTab = activeSeriesTabRef.current;
    const tabList = activeTab?.parentElement;
    if (!activeTab || !tabList) {
      return;
    }
    tabList.scrollLeft = Math.max(
      0,
      activeTab.offsetLeft -
        (tabList.clientWidth - activeTab.clientWidth) / 2,
    );
  }, [live.eventernoteEventId]);

  useEffect(() => {
    function handleSetlistCopy(event: ClipboardEvent) {
      const selection = window.getSelection();
      const setlist = setlistRef.current;
      if (
        !selection ||
        selection.isCollapsed ||
        !setlist ||
        setlist.getClientRects().length === 0
      ) {
        return;
      }

      const selectedText = getSelectedCopyText(selection, setlist);
      if (!selectedText || !event.clipboardData) {
        return;
      }

      event.preventDefault();
      event.clipboardData.setData("text/plain", selectedText);
    }

    document.addEventListener("copy", handleSetlistCopy);
    return () => document.removeEventListener("copy", handleSetlistCopy);
  }, []);

  async function loadSongEvents() {
    if (eventsLoaded || eventsLoading || songIds.length === 0) {
      return;
    }

    setEventsLoading(true);
    try {
      const response = await fetch(
        `/api/song-events?songIds=${songIds.join(",")}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as {
        songEventsBySongId: Record<string, SongEventReference[]>;
      };
      setSongEventsBySongId(
        Object.fromEntries(
          Object.entries(payload.songEventsBySongId).map(
            ([songId, events]) => [Number(songId), events],
          ),
        ),
      );
      setEventsLoaded(true);
    } catch (error) {
      console.error("Failed to load song events", error);
    } finally {
      setEventsLoading(false);
    }
  }

  function handleSongClick(entryKey: string) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }

    void loadSongEvents();
    setActiveEntryKey((current) =>
      current === entryKey ? null : entryKey,
    );
  }

  async function handleSeriesTabClick(
    event: MouseEvent<HTMLAnchorElement>,
    eventernoteEventId: number,
  ) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (eventernoteEventId === live.eventernoteEventId) {
      return;
    }

    setPendingSeriesEventId(eventernoteEventId);
    const switched = await onNavigateToLive(eventernoteEventId);
    if (!switched) {
      setPendingSeriesEventId((current) =>
        current === eventernoteEventId ? null : current,
      );
    }
  }

  return (
    <section
      ref={setlistRef}
      className="mt-8 select-text rounded-[1.15rem] border border-border-soft bg-panel px-5 py-6 sm:px-6"
    >
      <h2
        data-copy-block
        className="font-heading text-2xl font-semibold tracking-[-0.04em] sm:text-3xl"
      >
        <a
          href={`https://www.eventernote.com/events/${live.eventernoteEventId}`}
          target="_blank"
          rel="noreferrer"
          className="transition hover:text-accent"
        >
          {normalizeQuotesForDisplay(live.title)}
        </a>
      </h2>
      {live.series && live.series.events.length > 1 ? (
        <div data-copy-exclude className="mt-3 min-w-0 select-none">
          <div
            role="tablist"
            aria-label={copy.liveSeriesAria}
            className="flex max-w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {live.series.events.map((event) => {
              const active =
                event.eventernoteEventId === live.eventernoteEventId;
              const pending =
                event.eventernoteEventId === pendingSeriesEventId;
              return (
                <Link
                  key={event.eventernoteEventId}
                  ref={active ? activeSeriesTabRef : undefined}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                  href={buildLiveSetlistHref(event.eventernoteEventId)}
                  prefetch={false}
                  title={normalizeQuotesForDisplay(event.title)}
                  aria-disabled={pending || undefined}
                  onPointerEnter={() =>
                    onPrefetchLive(event.eventernoteEventId)
                  }
                  onFocus={() => onPrefetchLive(event.eventernoteEventId)}
                  onClick={(clickEvent) =>
                    void handleSeriesTabClick(
                      clickEvent,
                      event.eventernoteEventId,
                    )
                  }
                  className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium leading-5 transition ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border-soft bg-panel-strong text-ink-soft hover:border-accent hover:text-foreground"
                  } ${pending ? "cursor-wait opacity-70" : ""}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {pending ? (
                      <Loader2Icon
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    {event.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
      <p data-copy-block className="mt-2 text-sm text-ink-soft">
        {live.eventDate}
        <span className="mx-1.5">·</span>
        {live.venue ?? copy.venueMissing}
      </p>
      {(live.performingBands ?? []).length > 0 ? (
        <p data-copy-block className="mt-2 text-sm text-foreground">
          <span className="inline-flex flex-wrap items-center gap-x-1">
            {(live.performingBands ?? []).map((band, index) => {
              const textColor = getBandTextColor(band.slug);

              return (
                <span
                  key={`${live.eventernoteEventId}-${band.slug}-${index}`}
                >
                  {index > 0 ? (
                    <span className="mx-0.5 text-ink-soft">·</span>
                  ) : null}
                  <span
                    style={textColor ? { color: textColor } : undefined}
                  >
                    {band.name}
                  </span>
                </span>
              );
            })}
          </span>
        </p>
      ) : null}

      <ol className="mt-4 divide-y divide-border-soft border-y border-border-soft">
        {live.entries.map((entry) => {
          const textColor = entry.bandSlug
            ? getBandTextColor(entry.bandSlug)
            : null;
          const currentEventTextColor =
            textColor ??
            (solePerformingBand
              ? getBandTextColor(solePerformingBand.slug)
              : null);
          const entryKey = `${entry.position}-${entry.title}`;
          const isActive = activeEntryKey === entryKey;
          const relatedEvents =
            entry.songId === null
              ? []
              : songEventsBySongId[entry.songId] ?? [];
          const eventsPending = !eventsLoaded || eventsLoading;

          return (
            <li
              key={`${entry.position}-${entry.title}`}
              data-copy-block
              className="relative grid grid-cols-[2.5rem_1fr] gap-1.5 py-1.5 text-sm leading-6 sm:py-2"
              style={textColor ? { color: textColor } : undefined}
            >
              <span
                data-copy-suffix=" "
                className="text-right tabular-nums opacity-70"
              >
                {entry.isFirstPerformance ? "*" : ""}
                {entry.position}.
              </span>
              <button
                type="button"
                disabled={entry.songId === null}
                aria-expanded={entry.songId === null ? undefined : isActive}
                onClick={
                  entry.songId === null
                    ? undefined
                    : () => handleSongClick(entryKey)
                }
                className="flex min-w-0 select-text items-center rounded-md text-left transition enabled:cursor-pointer enabled:hover:bg-panel-strong disabled:cursor-default"
              >
                <span className="min-w-0">
                  {formatSongTitleForDisplay(entry.title)}
                </span>
                {entry.category === "cover" ? (
                  <span
                    data-copy-exclude
                    className="ml-2 inline-flex shrink-0 select-none rounded-full border border-current/20 px-1.5 py-0.5 text-xs font-medium leading-none opacity-75"
                  >
                    {copy.coverSongBadge}
                  </span>
                ) : null}
              </button>
              {isActive ? (
                <div className="absolute left-0 top-full z-20 mt-2 max-w-full rounded-[1rem] border border-border-soft bg-panel px-3 py-3 text-left font-normal text-foreground shadow-lg sm:left-[2.875rem] sm:min-w-[24rem] sm:max-w-[calc(100%-2.875rem)]">
                  {!eventsPending ? (
                    <button
                      type="button"
                      data-copy-exclude
                      aria-label={copy.closeSongEventsAria}
                      onClick={() => setActiveEntryKey(null)}
                      className="absolute right-3 top-3 inline-flex h-7 w-7 select-none items-center justify-center rounded-full border border-border-soft text-ink-soft transition hover:border-foreground hover:text-foreground"
                    >
                      <XIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  {relatedEvents.length > 0 ? (
                    <>
                      {entry.firstReleaseDate ? (
                        <p className="pr-9 text-xs text-ink-soft">
                          {copy.releaseDateLabel(entry.firstReleaseDate)}
                        </p>
                      ) : null}
                      <p
                        className={`pr-9 text-xs text-ink-soft ${
                          entry.firstReleaseDate ? "mt-1.5" : ""
                        }`}
                      >
                        {copy.relatedEventsLabel(relatedEvents.length)}
                      </p>
                      <div className="mt-1.5 space-y-1.5">
                        {relatedEvents.map((event) => (
                          <Link
                            key={`${entry.songId}-${event.eventernoteEventId}`}
                            href={buildLiveSetlistHref(
                              event.eventernoteEventId,
                            )}
                            className="block text-sm leading-5 transition hover:opacity-80"
                            style={
                              event.eventernoteEventId ===
                                live.eventernoteEventId &&
                              currentEventTextColor
                                ? {
                                    color: currentEventTextColor,
                                  }
                                : undefined
                            }
                          >
                            <span className="font-medium">
                              {event.eventDate}
                            </span>
                            <span className="mx-1.5 text-ink-soft">·</span>
                            <span>
                              {normalizeQuotesForDisplay(event.title)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : eventsPending ? (
                    <p className="text-sm text-ink-soft">
                      {copy.loadingEvents}
                    </p>
                  ) : (
                    <p className="pr-9 text-sm text-ink-soft">
                      {copy.noSongEvents}
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
