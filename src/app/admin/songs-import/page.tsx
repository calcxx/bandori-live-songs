import { updateTag } from "next/cache";
import { getDb } from "@/lib/db/core";
import { songs } from "@/lib/db/schema";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { getAdminAuthStatus } from "@/lib/admin/server-auth";
import { canonicalizeSongTitle } from "@/lib/music/title-utils";
import { SongsImportForm } from "./songs-import-form";
import type { SongsImportActionState } from "./types";

function parseSongLines(input: string) {
  return input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
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
  const releaseDate = String(formData.get("releaseDate") ?? "").trim();
  const songText = String(formData.get("songText") ?? "");

  if (!bandSlug || !BAND_SEEDS.some((b) => b.slug === bandSlug)) {
    return {
      status: "error",
      message: "请选择有效的乐队。",
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return {
      status: "error",
      message: "日期格式不正确，请使用 YYYY-MM-DD。",
    };
  }

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
  const newSongs: { bandSlug: string; title: string; firstReleaseDate: string }[] = [];

  for (const rawTitle of titles) {
    const canonical = canonicalizeSongTitle(rawTitle);
    if (!canonical) continue;

    if (existingTitles.has(canonical)) {
      duplicates.push(canonical);
    } else {
      newSongs.push({
        bandSlug,
        title: canonical,
        firstReleaseDate: releaseDate,
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
  updateTag("song-catalog");

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

export default function SongsImportPage() {
  const bandOptions = BAND_SEEDS.filter((b) => b.groupType === "band").map((b) => ({
    slug: b.slug,
    label: `${b.nameJa} (${b.nameEn})`,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <SongsImportForm action={submitSongsImport} bandOptions={bandOptions} />
    </main>
  );
}
