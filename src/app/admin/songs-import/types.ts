import type { SongCategory } from "@/lib/music/song-category";

export type SongsImportActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  insertedCount?: number;
};

export type EditableSong = {
  id: number;
  title: string;
  category: SongCategory;
  bandSlug: string | null;
  firstReleaseDate: string | null;
};

export type SongEditActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export type SongDeleteActionState = SongEditActionState;
