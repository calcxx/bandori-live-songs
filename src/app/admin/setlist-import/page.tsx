import { asc, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { getAdminAuthStatus } from "@/lib/admin/server-auth";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { getDb } from "@/lib/db/core";
import { bands, events, setlistEntries, songs } from "@/lib/db/schema";
import { fetchEventMetaFromEventernote, type EventernoteEventMeta } from "@/lib/eventernote/event-meta";
import { isSongCategory } from "@/lib/music/song-category";
import { createSongResolver } from "@/lib/music/song-resolution";
import { canonicalizeSongTitle, stripTrackIndex } from "@/lib/music/title-utils";
import { refreshSongLiveState } from "@/lib/stats/refresh-song-live-state";
import { SetlistImportForm } from "./setlist-import-form";
import { formatSetlistEntriesText, type SetlistImportActionState } from "./types";

type ParsedSetlistLine = {
  lineNumber: number;
  rawTitle: string;
};

type EventMeta = EventernoteEventMeta;

const overwriteConfirmRequiredMessage = "该活动已有 setlist，请确认后整场替换。";

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

function parseQuickAddLineNumber(intent: string) {
  const match = intent.match(/^quick-add:(\d+)$/u);
  if (!match) {
    return null;
  }
  const lineNumber = Number(match[1]);
  return Number.isSafeInteger(lineNumber) && lineNumber > 0
    ? lineNumber
    : null;
}

async function addMissingSong(
  line: ParsedSetlistLine,
  formData: FormData,
) {
  const categoryValue = String(
    formData.get(`quickAddCategory:${line.lineNumber}`) ?? "",
  );
  const bandSlug = String(
    formData.get(`quickAddBandSlug:${line.lineNumber}`) ?? "",
  ).trim();
  const releaseDate = String(
    formData.get(`quickAddReleaseDate:${line.lineNumber}`) ?? "",
  ).trim();

  if (!isSongCategory(categoryValue)) {
    throw new Error("请选择有效的歌曲分类。");
  }
  if (
    categoryValue === "original" &&
    !BAND_SEEDS.some(
      (band) => band.groupType === "band" && band.slug === bandSlug,
    )
  ) {
    throw new Error("原创曲必须选择有效的乐队。");
  }
  if (
    categoryValue === "original" &&
    !/^\d{4}-\d{2}-\d{2}$/u.test(releaseDate)
  ) {
    throw new Error("原创曲必须填写有效的发行日期。");
  }

  const title = canonicalizeSongTitle(line.rawTitle);
  if (!title) {
    throw new Error("歌曲标题不能为空。");
  }

  const db = getDb();
  await db
    .insert(songs)
    .values({
      title,
      category: categoryValue,
      bandSlug: categoryValue === "original" ? bandSlug : null,
      firstReleaseDate:
        categoryValue === "original" ? releaseDate : null,
    })
    .onConflictDoNothing({ target: songs.title });
  updateTag("song-catalog");
  updateTag("open-api-v1");

  return title;
}

async function findExistingEvent(eventernoteEventId: number) {
  const db = getDb();
  const [existing] = await db
    .select({
      id: events.id,
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

async function loadExistingSetlistText(eventId: number) {
  const db = getDb();
  const rows = await db
    .select({
      rawTitle: setlistEntries.rawTitle,
    })
    .from(setlistEntries)
    .where(eq(setlistEntries.eventId, eventId))
    .orderBy(asc(setlistEntries.orderIndex));

  return formatSetlistEntriesText(rows.map((row) => row.rawTitle));
}

async function resolveSetlistLines(
  lines: ParsedSetlistLine[],
  formData: FormData,
) {
  const db = getDb();
  const songRows = await db
    .select({
      id: songs.id,
      title: songs.title,
      category: songs.category,
      bandNameJa: bands.nameJa,
    })
    .from(songs)
    .leftJoin(bands, eq(songs.bandSlug, bands.slug));
  const resolveSong = createSongResolver(songRows);

  const resolved: Array<ParsedSetlistLine & { songId: number }> = [];
  const resolutionLines: NonNullable<
    SetlistImportActionState["resolutionLines"]
  > = [];

  for (const line of lines) {
    const selectedId = Number(
      String(formData.get(`songResolution:${line.lineNumber}`) ?? ""),
    );
    const resolution = resolveSong(
      line.rawTitle,
      Number.isSafeInteger(selectedId) && selectedId > 0
        ? selectedId
        : undefined,
    );

    if (resolution.status === "resolved") {
      resolved.push({
        ...line,
        rawTitle: resolution.title,
        songId: resolution.songId,
      });
      continue;
    }

    resolutionLines.push({
      lineNumber: line.lineNumber,
      value: line.rawTitle,
      candidates: resolution.candidates,
    });
  }

  return { resolved, resolutionLines };
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
  const confirmOverwrite = String(formData.get("confirmOverwrite") ?? "") === "1";
  const quickAddLineNumber = parseQuickAddLineNumber(
    String(formData.get("intent") ?? ""),
  );
  const eventernoteEventId = parseEventernoteEventId(eventInput);

  if (!eventernoteEventId) {
    return {
      status: "error",
      message: "活动输入格式不正确，请填写 Eventernote 链接或纯数字 event 号。",
    };
  }

  const existingEvent = await findExistingEvent(eventernoteEventId);
  if (existingEvent && !confirmOverwrite) {
    return {
      status: "error",
      eventernoteEventId,
      eventTitle: existingEvent.title,
      eventDate: existingEvent.eventDate,
      venue: existingEvent.venue,
      existingRecord: true,
      message: overwriteConfirmRequiredMessage,
    };
  }

  const parsedLines = parseSetlistLines(setlistText);

  if (parsedLines.length === 0) {
    return {
      status: "error",
      eventernoteEventId,
      existingRecord: Boolean(existingEvent),
      message: "歌单不能为空，请至少输入一首歌。",
    };
  }

  let quickAddedTitle: string | null = null;
  if (quickAddLineNumber !== null) {
    const line = parsedLines.find(
      (item) => item.lineNumber === quickAddLineNumber,
    );
    if (!line) {
      return {
        status: "error",
        eventernoteEventId,
        existingRecord: Boolean(existingEvent),
        message: "无法找到需要添加的歌单行，请重新提交。",
      };
    }
    try {
      quickAddedTitle = await addMissingSong(line, formData);
    } catch (error) {
      return {
        status: "error",
        eventernoteEventId,
        existingRecord: Boolean(existingEvent),
        message:
          error instanceof Error ? error.message : "新增歌曲失败。",
      };
    }
  }

  let eventMeta: EventMeta;
  try {
    eventMeta = await fetchEventMetaFromEventernote(eventernoteEventId);
  } catch (error) {
    return {
      status: "error",
      eventernoteEventId,
      existingRecord: Boolean(existingEvent),
      message: error instanceof Error ? error.message : "获取活动信息失败。",
    };
  }

  const { resolved, resolutionLines } = await resolveSetlistLines(
    parsedLines,
    formData,
  );
  if (resolutionLines.length > 0) {
    return {
      status: "resolution-required",
      eventernoteEventId,
      eventTitle: eventMeta.title,
      eventDate: eventMeta.eventDate,
      venue: eventMeta.venue,
      existingRecord: Boolean(existingEvent),
      message: `${quickAddedTitle ? `已新增“${quickAddedTitle}”；` : ""}存在 ${resolutionLines.length} 行需要选择曲库记录。请选择后重新提交。`,
      resolutionLines,
    };
  }

  const db = getDb();
  const saved = await db.transaction(async (tx) => {
    if (existingEvent) {
      await tx
        .update(events)
        .set({
          title: eventMeta.title,
          eventDate: eventMeta.eventDate,
          venue: eventMeta.venue,
          setlistStatus: "complete",
          updatedAt: new Date(),
        })
        .where(eq(events.id, existingEvent.id));

      await tx.delete(setlistEntries).where(eq(setlistEntries.eventId, existingEvent.id));

      await tx.insert(setlistEntries).values(
        resolved.map((line, index) => ({
          eventId: existingEvent.id,
          orderIndex: index + 1,
          rawTitle: line.rawTitle,
          songId: line.songId,
        })),
      );

      return { id: existingEvent.id, overwritten: true as const };
    }

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
      resolved.map((line, index) => ({
        eventId: eventRecord.id,
        orderIndex: index + 1,
        rawTitle: line.rawTitle,
        songId: line.songId,
      })),
    );

    return { id: eventRecord.id, overwritten: false as const };
  });

  if (!saved) {
    return {
      status: "error",
      eventernoteEventId,
      eventTitle: eventMeta.title,
      eventDate: eventMeta.eventDate,
      venue: eventMeta.venue,
      existingRecord: true,
      message: overwriteConfirmRequiredMessage,
    };
  }

  await refreshSongLiveState(db);
  updateTag("song-catalog");
  updateTag("open-api-v1");
  updateTag("song-events");
  updateTag("sitemap-events");
  revalidatePath("/sitemap.xml");

  return {
    status: "success",
    eventernoteEventId,
    eventTitle: eventMeta.title,
    eventDate: eventMeta.eventDate,
    venue: eventMeta.venue,
    submittedCount: parsedLines.length,
    existingRecord: saved.overwritten,
    message: `${quickAddedTitle ? `已新增“${quickAddedTitle}”；` : ""}${
      saved.overwritten
        ? `已整场替换并写入 ${parsedLines.length} 首歌。`
        : `校验通过并已导入 ${parsedLines.length} 首歌。`
    }`,
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
  const parsedEventId = parseEventernoteEventId(queryEventInput);
  const defaultEventInput = parsedEventId ? queryEventInput : "";

  let defaultSetlistText = "";
  let existingRecord = false;
  let existingEventTitle: string | null = null;
  const bandOptions = BAND_SEEDS.filter(
    (band) => band.groupType === "band",
  ).map((band) => ({
    slug: band.slug,
    label: `${band.nameJa} (${band.nameEn})`,
  }));

  if (parsedEventId) {
    const existingEvent = await findExistingEvent(parsedEventId);
    if (existingEvent) {
      existingRecord = true;
      existingEventTitle = existingEvent.title;
      defaultSetlistText = await loadExistingSetlistText(existingEvent.id);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <SetlistImportForm
        action={submitSetlistImport}
        defaultEventInput={defaultEventInput}
        defaultSetlistText={defaultSetlistText}
        existingRecord={existingRecord}
        existingEventTitle={existingEventTitle}
        bandOptions={bandOptions}
      />
    </main>
  );
}
