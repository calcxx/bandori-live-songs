import { eq, inArray } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getAdminAuthStatus } from "@/lib/admin/server-auth";
import { getDb } from "@/lib/db/core";
import { events, setlistEntries, songs } from "@/lib/db/schema";
import { fetchEventMetaFromEventernote, type EventernoteEventMeta } from "@/lib/eventernote/event-meta";
import { findClosestSongTitle } from "@/lib/music/song-match-suggestions";
import { stripTrackIndex } from "@/lib/music/title-utils";
import { refreshSongLiveState } from "@/lib/stats/refresh-song-live-state";
import { SetlistImportForm } from "./setlist-import-form";
import type { SetlistImportActionState } from "./types";

type ParsedSetlistLine = {
  lineNumber: number;
  rawTitle: string;
};

type EventMeta = EventernoteEventMeta;

const existingEventConflictMessage = "该 Eventernote 活动已存在数据库记录，已拒绝提交以避免覆盖。";

function parseEventernoteEventId(input: string) {
  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) {
    const value = Number(trimmed);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith("eventernote.com")) {
      return null;
    }

    const match = url.pathname.match(/\/events\/(\d+)/);
    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function parseSetlistLines(input: string) {
  return input
    .split(/\r?\n/u)
    .map((line, index) => ({
      lineNumber: index + 1,
      rawTitle: stripTrackIndex(line),
    }))
    .filter((line) => line.rawTitle.length > 0);
}

async function findExistingEventMeta(eventernoteEventId: number) {
  const db = getDb();
  const [existing] = await db
    .select({
      eventernoteEventId: events.eventernoteEventId,
      title: events.title,
      eventDate: events.eventDate,
      venue: events.venue,
    })
    .from(events)
    .where(eq(events.eventernoteEventId, eventernoteEventId))
    .limit(1);

  return existing ?? null;
}

async function findMismatchLines(lines: ParsedSetlistLine[]) {
  const db = getDb();
  const distinctTitles = [...new Set(lines.map((line) => line.rawTitle))];

  const [matchedRows, songRows] = await Promise.all([
    distinctTitles.length > 0
      ? db
          .select({ title: songs.title })
          .from(songs)
          .where(inArray(songs.title, distinctTitles))
      : Promise.resolve([]),
    db.select({ title: songs.title }).from(songs),
  ]);

  const matchedTitleSet = new Set(matchedRows.map((row) => row.title));
  const allSongTitles = songRows.map((row) => row.title);

  return lines
    .filter((line) => !matchedTitleSet.has(line.rawTitle))
    .map((line) => {
      const suggestion = findClosestSongTitle(line.rawTitle, allSongTitles);

      return {
        lineNumber: line.lineNumber,
        value: line.rawTitle,
        suggestedValue: suggestion?.title,
        suggestionScore: suggestion ? Number(suggestion.score.toFixed(3)) : undefined,
      };
    });
}

async function submitSetlistImport(
  _: SetlistImportActionState,
  formData: FormData,
): Promise<SetlistImportActionState> {
  "use server";

  const authStatus = await getAdminAuthStatus();
  if (!authStatus.authenticated) {
    return {
      status: "error",
      message: authStatus.message,
    };
  }

  const eventInput = String(formData.get("eventInput") ?? "").trim();
  const setlistText = String(formData.get("setlistText") ?? "");
  const eventernoteEventId = parseEventernoteEventId(eventInput);

  if (!eventernoteEventId) {
    return {
      status: "error",
      message: "活动输入格式不正确，请填写 Eventernote 链接或纯数字 event 号。",
    };
  }

  const existingEvent = await findExistingEventMeta(eventernoteEventId);
  if (existingEvent) {
    return {
      status: "error",
      eventernoteEventId,
      eventTitle: existingEvent.title,
      eventDate: existingEvent.eventDate,
      venue: existingEvent.venue,
      message: existingEventConflictMessage,
    };
  }

  const parsedLines = parseSetlistLines(setlistText);

  if (parsedLines.length === 0) {
    return {
      status: "error",
      eventernoteEventId,
      message: "歌单不能为空，请至少输入一首歌。",
    };
  }

  let eventMeta: EventMeta;
  try {
    eventMeta = await fetchEventMetaFromEventernote(eventernoteEventId);
  } catch (error) {
    return {
      status: "error",
      eventernoteEventId,
      message: error instanceof Error ? error.message : "获取活动信息失败。",
    };
  }

  const mismatchLines = await findMismatchLines(parsedLines);
  if (mismatchLines.length > 0) {
    return {
      status: "mismatch",
      eventernoteEventId,
      eventTitle: eventMeta.title,
      eventDate: eventMeta.eventDate,
      venue: eventMeta.venue,
      message: `存在 ${mismatchLines.length} 行未匹配。可直接采用建议替换后重新提交。`,
      mismatchLines,
    };
  }

  const db = getDb();
  const createdEvent = await db.transaction(async (tx) => {
    const [eventRecord] = await tx
      .insert(events)
      .values({
        eventernoteEventId,
        title: eventMeta.title,
        eventDate: eventMeta.eventDate,
        venue: eventMeta.venue,
        setlistStatus: "complete",
      })
      .onConflictDoNothing({
        target: events.eventernoteEventId,
      })
      .returning({ id: events.id });

    if (!eventRecord) {
      return null;
    }

    await tx.insert(setlistEntries).values(
      parsedLines.map((line, index) => ({
        eventId: eventRecord.id,
        orderIndex: index + 1,
        rawTitle: line.rawTitle,
      })),
    );

    return eventRecord;
  });

  if (!createdEvent) {
    return {
      status: "error",
      eventernoteEventId,
      eventTitle: eventMeta.title,
      eventDate: eventMeta.eventDate,
      venue: eventMeta.venue,
      message: existingEventConflictMessage,
    };
  }

  await refreshSongLiveState(db);
  updateTag("song-catalog");
  updateTag("song-events");

  return {
    status: "success",
    eventernoteEventId,
    eventTitle: eventMeta.title,
    eventDate: eventMeta.eventDate,
    venue: eventMeta.venue,
    submittedCount: parsedLines.length,
    message: `校验通过并已导入 ${parsedLines.length} 首歌。`,
  };
}

type SetlistImportPageProps = {
  searchParams: Promise<{
    event?: string;
    eventInput?: string;
  }>;
};

export default async function SetlistImportPage({ searchParams }: SetlistImportPageProps) {
  const { event = "", eventInput = "" } = await searchParams;
  const queryEventInput = eventInput.trim() || event.trim();
  const defaultEventInput = parseEventernoteEventId(queryEventInput) ? queryEventInput : "";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <SetlistImportForm action={submitSetlistImport} defaultEventInput={defaultEventInput} />
    </main>
  );
}
