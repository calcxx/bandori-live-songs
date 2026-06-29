"use client";

import { useActionState } from "react";
import { useState } from "react";
import type { SongsImportActionState } from "./types";

type SongsImportFormProps = {
  action: (
    state: SongsImportActionState,
    formData: FormData,
  ) => Promise<SongsImportActionState>;
  bandOptions: { slug: string; label: string }[];
};

const initialState: SongsImportActionState = {
  status: "idle",
};

export function SongsImportForm({ action, bandOptions }: SongsImportFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [bandSlug, setBandSlug] = useState(bandOptions[0]?.slug ?? "");
  const [releaseDate, setReleaseDate] = useState("");
  const [songText, setSongText] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-border-soft bg-panel p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">歌曲导入</h1>
        <p className="text-sm text-ink-soft">
          选择乐队和发行日期，每行输入一首歌曲名。点击提交后自动写入数据库。
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-foreground">
          乐队
          <select
            name="bandSlug"
            value={bandSlug}
            onChange={(e) => setBandSlug(e.target.value)}
            className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {bandOptions.map((band) => (
              <option key={band.slug} value={band.slug}>
                {band.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-foreground">
          发行日期
          <input
            required
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
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-5 font-medium text-background transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  );
}
