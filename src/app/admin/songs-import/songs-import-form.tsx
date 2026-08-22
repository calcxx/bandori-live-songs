"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { SongCategory } from "@/lib/music/song-category";
import type {
  EditableSong,
  SongDeleteActionState,
  SongEditActionState,
  SongsImportActionState,
} from "./types";

type SongsImportFormProps = {
  action: (
    state: SongsImportActionState,
    formData: FormData,
  ) => Promise<SongsImportActionState>;
  editAction: (
    state: SongEditActionState,
    formData: FormData,
  ) => Promise<SongEditActionState>;
  deleteAction: (
    state: SongDeleteActionState,
    formData: FormData,
  ) => Promise<SongDeleteActionState>;
  bandOptions: { slug: string; label: string }[];
  existingSongs: EditableSong[];
};

const initialState: SongsImportActionState = {
  status: "idle",
};
const initialEditState: SongEditActionState = {
  status: "idle",
};
const initialDeleteState: SongDeleteActionState = {
  status: "idle",
};

const categoryStorageKey = "admin-songs-import-category";
const bandStorageKey = "admin-songs-import-band";

function categoryLabel(category: SongCategory) {
  if (category === "cover") return "翻唱曲";
  if (category === "project-common") return "企划共通";
  return "乐队原创曲";
}

export function SongsImportForm({
  action,
  editAction,
  deleteAction,
  bandOptions,
  existingSongs,
}: SongsImportFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [editState, editFormAction, editPending] = useActionState(
    editAction,
    initialEditState,
  );
  const [category, setCategory] = useState<SongCategory>("original");
  const [bandSlug, setBandSlug] = useState(bandOptions[0]?.slug ?? "");
  const [releaseDate, setReleaseDate] = useState("");
  const [songText, setSongText] = useState("");
  const [songFilter, setSongFilter] = useState("");
  const [selectedSongId, setSelectedSongId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] =
    useState<SongCategory>("original");
  const [editBandSlug, setEditBandSlug] = useState(
    bandOptions[0]?.slug ?? "",
  );
  const [editReleaseDate, setEditReleaseDate] = useState("");
  const [showDeleteConfirmation, setShowDeleteConfirmation] =
    useState(false);
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    async (
      previousState: SongDeleteActionState,
      formData: FormData,
    ) => {
      const nextState = await deleteAction(previousState, formData);
      if (nextState.status === "success") {
        setSelectedSongId("");
        setEditTitle("");
        setEditCategory("original");
        setEditBandSlug(bandOptions[0]?.slug ?? "");
        setEditReleaseDate("");
        setShowDeleteConfirmation(false);
      }
      return nextState;
    },
    initialDeleteState,
  );
  const bandLabelBySlug = useMemo(
    () => new Map(bandOptions.map((band) => [band.slug, band.label])),
    [bandOptions],
  );
  const selectedSongTitle = useMemo(
    () =>
      existingSongs.find(
        (song) => String(song.id) === selectedSongId,
      )?.title ?? editTitle,
    [editTitle, existingSongs, selectedSongId],
  );
  const filteredSongs = useMemo(() => {
    const normalizedFilter = songFilter.trim().toLocaleLowerCase();
    if (!normalizedFilter) return existingSongs;

    return existingSongs.filter((song) => {
      if (String(song.id) === selectedSongId) return true;
      const bandLabel = song.bandSlug
        ? bandLabelBySlug.get(song.bandSlug) ?? song.bandSlug
        : "";
      return `${song.title} ${categoryLabel(song.category)} ${bandLabel}`
        .toLocaleLowerCase()
        .includes(normalizedFilter);
    });
  }, [
    bandLabelBySlug,
    existingSongs,
    selectedSongId,
    songFilter,
  ]);

  useEffect(() => {
    const storedCategory = window.sessionStorage.getItem(
      categoryStorageKey,
    );
    const storedBand = window.sessionStorage.getItem(bandStorageKey);
    const frame = window.requestAnimationFrame(() => {
      if (
        storedCategory === "original" ||
        storedCategory === "cover" ||
        storedCategory === "project-common"
      ) {
        setCategory(storedCategory);
      }
      if (bandOptions.some((band) => band.slug === storedBand)) {
        setBandSlug(storedBand ?? "");
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [bandOptions]);

  function selectSong(songIdValue: string) {
    setShowDeleteConfirmation(false);
    setSelectedSongId(songIdValue);
    const selectedSong = existingSongs.find(
      (song) => song.id === Number(songIdValue),
    );
    if (!selectedSong) {
      setEditTitle("");
      setEditCategory("original");
      setEditBandSlug(bandOptions[0]?.slug ?? "");
      setEditReleaseDate("");
      return;
    }

    setEditTitle(selectedSong.title);
    setEditCategory(selectedSong.category);
    setEditBandSlug(
      selectedSong.bandSlug ?? bandOptions[0]?.slug ?? "",
    );
    setEditReleaseDate(selectedSong.firstReleaseDate ?? "");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-[1.75rem] border border-border-soft bg-panel p-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-[-0.04em] text-foreground">歌曲导入</h1>
        <p className="text-sm text-ink-soft">
          选择乐队和发行日期，每行输入一首歌曲名。点击提交后自动写入数据库。
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-foreground">
          歌曲分类
          <select
            name="category"
            value={category}
            onChange={(event) => {
              const nextCategory = event.target.value as SongCategory;
              setCategory(nextCategory);
              window.sessionStorage.setItem(
                categoryStorageKey,
                nextCategory,
              );
            }}
            className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="original">乐队原创曲</option>
            <option value="cover">翻唱曲</option>
            <option value="project-common">企划共通</option>
          </select>
        </label>

        {category === "original" ? (
        <label className="flex flex-col gap-2 text-sm text-foreground">
          乐队
          <select
            name="bandSlug"
            value={bandSlug}
            onChange={(event) => {
              setBandSlug(event.target.value);
              window.sessionStorage.setItem(
                bandStorageKey,
                event.target.value,
              );
            }}
            className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {bandOptions.map((band) => (
              <option key={band.slug} value={band.slug}>
                {band.label}
              </option>
            ))}
          </select>
        </label>
        ) : null}

        <label className="flex flex-col gap-2 text-sm text-foreground">
          发行日期{category === "original" ? "" : "（可选）"}
          <input
            required={category === "original"}
            type="date"
            name="releaseDate"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-foreground">
          歌曲列表（每行一首）
          <textarea
            required
            name="songText"
            value={songText}
            onChange={(e) => setSongText(e.target.value)}
            rows={14}
            placeholder={"STAR BEAT!～ホシノコドウ～\nティアドロップス\nYes! BanG_Dream!"}
            className="rounded-xl border border-border-soft bg-panel-strong px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-5 font-medium text-background transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "提交中..." : "提交"}
        </button>
      </form>

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-sm font-medium text-black dark:text-emerald-100"
              : "rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-3 text-sm font-medium text-black dark:text-amber-100"
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="border-t border-border-soft pt-6">
        <div className="space-y-2">
          <h2 className="font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">
            编辑已有歌曲
          </h2>
          <p className="text-sm text-ink-soft">
            选择歌曲后可修改曲名、分类、所属乐队和发行日期。已有歌单的歌曲关联不会改变。
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm text-foreground">
            筛选歌曲
            <input
              type="search"
              value={songFilter}
              onChange={(event) => setSongFilter(event.target.value)}
              placeholder="输入曲名、分类或乐队"
              className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-foreground">
            选择歌曲
            <select
              value={selectedSongId}
              onChange={(event) => selectSong(event.target.value)}
              className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">请选择歌曲</option>
              {filteredSongs.map((song) => {
                const bandLabel = song.bandSlug
                  ? bandLabelBySlug.get(song.bandSlug) ?? song.bandSlug
                  : categoryLabel(song.category);
                return (
                  <option key={song.id} value={song.id}>
                    {song.title} · {bandLabel}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <form action={editFormAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="songId" value={selectedSongId} />

          <label className="flex flex-col gap-2 text-sm text-foreground">
            曲名
            <input
              required
              disabled={!selectedSongId}
              name="title"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-foreground">
            歌曲分类
            <select
              disabled={!selectedSongId}
              name="category"
              value={editCategory}
              onChange={(event) =>
                setEditCategory(event.target.value as SongCategory)
              }
              className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="original">乐队原创曲</option>
              <option value="cover">翻唱曲</option>
              <option value="project-common">企划共通</option>
            </select>
          </label>

          {editCategory === "original" ? (
            <label className="flex flex-col gap-2 text-sm text-foreground">
              乐队
              <select
                disabled={!selectedSongId}
                name="bandSlug"
                value={editBandSlug}
                onChange={(event) =>
                  setEditBandSlug(event.target.value)
                }
                className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {bandOptions.map((band) => (
                  <option key={band.slug} value={band.slug}>
                    {band.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-2 text-sm text-foreground">
            发行日期{editCategory === "original" ? "" : "（可选）"}
            <input
              required={editCategory === "original"}
              disabled={!selectedSongId}
              type="date"
              name="releaseDate"
              value={editReleaseDate}
              onChange={(event) =>
                setEditReleaseDate(event.target.value)
              }
              className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <button
            type="submit"
            disabled={!selectedSongId || editPending}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-5 font-medium text-background transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editPending ? "保存中..." : "保存修改"}
          </button>
        </form>

        <div className="mt-3">
          {showDeleteConfirmation ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-foreground">
                确认删除「{selectedSongTitle}」？
              </p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">
                删除后，歌单中的原始曲名仍会保留，但不再关联这首歌曲。此操作无法撤销。
              </p>
              <form
                action={deleteFormAction}
                className="mt-3 flex flex-wrap gap-2"
              >
                <input
                  type="hidden"
                  name="songId"
                  value={selectedSongId}
                />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletePending ? "删除中..." : "确认删除"}
                </button>
                <button
                  type="button"
                  disabled={deletePending}
                  onClick={() => setShowDeleteConfirmation(false)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border-soft px-4 text-sm font-medium text-foreground transition hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  取消
                </button>
              </form>
            </div>
          ) : (
            <button
              type="button"
              disabled={!selectedSongId || editPending}
              onClick={() => setShowDeleteConfirmation(true)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-500/50 px-4 text-sm font-medium text-red-600 transition hover:border-red-600 hover:bg-red-500/10 dark:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              删除歌曲
            </button>
          )}
        </div>

        {editState.message ? (
          <div
            className={`mt-4 ${
              editState.status === "success"
                ? "rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-sm font-medium text-black dark:text-emerald-100"
                : "rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-3 text-sm font-medium text-black dark:text-amber-100"
            }`}
          >
            {editState.message}
          </div>
        ) : null}

        {deleteState.message ? (
          <div
            className={`mt-4 ${
              deleteState.status === "success"
                ? "rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-sm font-medium text-black dark:text-emerald-100"
                : "rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-3 text-sm font-medium text-black dark:text-amber-100"
            }`}
          >
            {deleteState.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
