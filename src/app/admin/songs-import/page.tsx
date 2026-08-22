import { revalidatePath, updateTag } from "next/cache";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/core";
import { songs } from "@/lib/db/schema";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { getAdminAuthStatus } from "@/lib/admin/server-auth";
import { canonicalizeSongTitle } from "@/lib/music/title-utils";
import { isSongCategory } from "@/lib/music/song-category";
import { SongsImportForm } from "./songs-import-form";
import type {
  EditableSong,
  SongDeleteActionState,
  SongEditActionState,
  SongsImportActionState,
} from "./types";

function parseSongLines(input: string) {
  return input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isValidBandSlug(bandSlug: string) {
  return BAND_SEEDS.some(
    (band) => band.groupType === "band" && band.slug === bandSlug,
  );
}

function validateSongFields({
  categoryValue,
  bandSlug,
  releaseDate,
}: {
  categoryValue: string;
  bandSlug: string;
  releaseDate: string;
}) {
  if (!isSongCategory(categoryValue)) {
    return "请选择有效的歌曲分类。";
  }
  if (categoryValue === "original" && !isValidBandSlug(bandSlug)) {
    return "请选择有效的乐队。";
  }
  if (
    (categoryValue === "original" && !releaseDate) ||
    (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate))
  ) {
    return "日期格式不正确，请使用 YYYY-MM-DD。";
  }
  return null;
}

function refreshSongCaches({ includeSongEvents = false } = {}) {
  updateTag("song-catalog");
  updateTag("open-api-v1");
  if (includeSongEvents) {
    updateTag("song-events");
  }
}

async function submitSongsImport(
  _: SongsImportActionState,
  formData: FormData,
): Promise<SongsImportActionState> {
  "use server";

  const authStatus = await getAdminAuthStatus();
  if (!authStatus.authenticated) {
    return {
      status: "error",
      message: authStatus.message,
    };
  }

  const bandSlug = String(formData.get("bandSlug") ?? "").trim();
  const categoryValue = String(formData.get("category") ?? "").trim();
  const releaseDate = String(formData.get("releaseDate") ?? "").trim();
  const songText = String(formData.get("songText") ?? "");

  const validationError = validateSongFields({
    categoryValue,
    bandSlug,
    releaseDate,
  });
  if (validationError) {
    return {
      status: "error",
      message: validationError,
    };
  }
  const category = categoryValue as NonNullable<
    EditableSong["category"]
  >;

  const titles = parseSongLines(songText);
  if (titles.length === 0) {
    return {
      status: "error",
      message: "歌曲列表不能为空，请至少输入一首。",
    };
  }

  const db = getDb();

  // Check for existing titles
  const existingRows = await db.select({ title: songs.title }).from(songs);
  const existingTitles = new Set(existingRows.map((r) => r.title));

  const duplicates: string[] = [];
  const newSongs: Array<{
    bandSlug: string | null;
    category: typeof category;
    title: string;
    firstReleaseDate: string | null;
  }> = [];

  for (const rawTitle of titles) {
    const canonical = canonicalizeSongTitle(rawTitle);
    if (!canonical) continue;

    if (existingTitles.has(canonical)) {
      duplicates.push(canonical);
    } else {
      newSongs.push({
        bandSlug: category === "original" ? bandSlug : null,
        category,
        title: canonical,
        firstReleaseDate: releaseDate || null,
      });
      existingTitles.add(canonical); // prevent duplicates within the same batch
    }
  }

  if (newSongs.length === 0) {
    return {
      status: "error",
      message: duplicates.length > 0 ? `所有 ${duplicates.length} 首歌曲已存在于数据库中。` : "无有效歌曲可导入。",
    };
  }

  await db.insert(songs).values(newSongs);
  refreshSongCaches();
  revalidatePath("/admin/songs-import");

  const parts = [`已导入 ${newSongs.length} 首歌曲`];
  if (duplicates.length > 0) {
    parts.push(`${duplicates.length} 首已存在被跳过`);
  }

  return {
    status: "success",
    message: parts.join("；") + "。",
    insertedCount: newSongs.length,
  };
}

async function submitSongEdit(
  _: SongEditActionState,
  formData: FormData,
): Promise<SongEditActionState> {
  "use server";

  const authStatus = await getAdminAuthStatus();
  if (!authStatus.authenticated) {
    return {
      status: "error",
      message: authStatus.message,
    };
  }

  const songId = Number(formData.get("songId"));
  const rawTitle = String(formData.get("title") ?? "");
  const categoryValue = String(formData.get("category") ?? "").trim();
  const bandSlug = String(formData.get("bandSlug") ?? "").trim();
  const releaseDate = String(formData.get("releaseDate") ?? "").trim();

  if (!Number.isSafeInteger(songId) || songId <= 0) {
    return {
      status: "error",
      message: "请选择要编辑的歌曲。",
    };
  }

  const title = canonicalizeSongTitle(rawTitle);
  if (!title) {
    return {
      status: "error",
      message: "歌曲名不能为空。",
    };
  }

  const validationError = validateSongFields({
    categoryValue,
    bandSlug,
    releaseDate,
  });
  if (validationError) {
    return {
      status: "error",
      message: validationError,
    };
  }
  const category = categoryValue as EditableSong["category"];
  const db = getDb();
  const [existingSong] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);
  if (!existingSong) {
    return {
      status: "error",
      message: "歌曲不存在，可能已被其他管理员删除。",
    };
  }

  const [duplicateSong] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.title, title), ne(songs.id, songId)))
    .limit(1);
  if (duplicateSong) {
    return {
      status: "error",
      message: "该歌曲名已被其他歌曲使用。",
    };
  }

  const updatedSong = {
    id: songId,
    title,
    category,
    bandSlug: category === "original" ? bandSlug : null,
    firstReleaseDate: releaseDate || null,
  } satisfies EditableSong;

  await db
    .update(songs)
    .set({
      title: updatedSong.title,
      category: updatedSong.category,
      bandSlug: updatedSong.bandSlug,
      firstReleaseDate: updatedSong.firstReleaseDate,
      updatedAt: new Date(),
    })
    .where(eq(songs.id, songId));

  refreshSongCaches({ includeSongEvents: true });
  revalidatePath("/admin/songs-import");
  revalidatePath("/songs");

  return {
    status: "success",
    message: "歌曲信息已更新。",
  };
}

async function submitSongDelete(
  _: SongDeleteActionState,
  formData: FormData,
): Promise<SongDeleteActionState> {
  "use server";

  const authStatus = await getAdminAuthStatus();
  if (!authStatus.authenticated) {
    return {
      status: "error",
      message: authStatus.message,
    };
  }

  const songId = Number(formData.get("songId"));
  if (!Number.isSafeInteger(songId) || songId <= 0) {
    return {
      status: "error",
      message: "请选择要删除的歌曲。",
    };
  }

  const deletedSongs = await getDb()
    .delete(songs)
    .where(eq(songs.id, songId))
    .returning({ title: songs.title });
  const deletedSong = deletedSongs[0];
  if (!deletedSong) {
    return {
      status: "error",
      message: "歌曲不存在，可能已被其他管理员删除。",
    };
  }

  refreshSongCaches({ includeSongEvents: true });
  revalidatePath("/admin/songs-import");
  revalidatePath("/songs");

  return {
    status: "success",
    message: `已删除歌曲「${deletedSong.title}」。歌单中的原始曲名仍然保留。`,
  };
}

export default async function SongsImportPage() {
  const bandOptions = BAND_SEEDS.filter((band) => band.groupType === "band").map(
    (band) => ({
      slug: band.slug,
      label: `${band.nameJa} (${band.nameEn})`,
    }),
  );
  const existingSongs = await getDb()
    .select({
      id: songs.id,
      title: songs.title,
      category: songs.category,
      bandSlug: songs.bandSlug,
      firstReleaseDate: songs.firstReleaseDate,
    })
    .from(songs)
    .orderBy(asc(songs.title));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <SongsImportForm
        action={submitSongsImport}
        editAction={submitSongEdit}
        deleteAction={submitSongDelete}
        bandOptions={bandOptions}
        existingSongs={existingSongs}
      />
    </main>
  );
}
