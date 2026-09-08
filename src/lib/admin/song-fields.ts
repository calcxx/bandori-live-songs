import { isValidIsoDate } from "@/lib/calendar-date";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { isSongCategory, type SongCategory } from "@/lib/music/song-category";

type SongFields = {
  category: SongCategory;
  bandSlug: string | null;
  firstReleaseDate: string | null;
};

export function parseSongFields({
  categoryValue,
  bandSlug,
  releaseDate,
}: {
  categoryValue: string;
  bandSlug: string;
  releaseDate: string;
}): { success: true; data: SongFields } | { success: false; error: string } {
  if (!isSongCategory(categoryValue)) {
    return { success: false, error: "请选择有效的歌曲分类。" };
  }
  if (categoryValue === "original" && !BAND_SEEDS.some(
    (band) => band.groupType === "band" && band.slug === bandSlug,
  )) {
    return { success: false, error: "请选择有效的乐队。" };
  }
  if ((categoryValue === "original" && !releaseDate) ||
    (releaseDate && !isValidIsoDate(releaseDate))) {
    return { success: false, error: "日期不正确，请使用有效的 YYYY-MM-DD 日期。" };
  }
  return {
    success: true,
    data: {
      category: categoryValue,
      bandSlug: categoryValue === "original" ? bandSlug : null,
      firstReleaseDate: releaseDate || null,
    },
  };
}
