"use client";

import { useActionState } from "react";
import { useState } from "react";
import type { SetlistImportActionState } from "./types";

type SetlistImportFormProps = {
  action: (
    state: SetlistImportActionState,
    formData: FormData,
  ) => Promise<SetlistImportActionState>;
  defaultEventInput?: string;
};

const initialState: SetlistImportActionState = {
  status: "idle",
};

const numberingPrefixPattern = /^(?:(?:M|EN)\s*\.?\s*\d+|\d+)\s*\.?[\t \u3000]+/iu;

export function SetlistImportForm({ action, defaultEventInput = "" }: SetlistImportFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [eventInput, setEventInput] = useState(defaultEventInput);
  const [setlistText, setSetlistText] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyImporting, setSpotifyImporting] = useState(false);
  const [spotifyMessage, setSpotifyMessage] = useState<string | null>(null);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  function handleStripNumbering() {
    setSetlistText((prev) =>
      prev
        .split(/\r?\n/u)
        .map((line) => line.replace(numberingPrefixPattern, "").trim())
        .filter((line) => line.length > 0)
        .join("\n"),
    );
  }

  function replaceLineValue(lineNumber: number, nextValue: string) {
    setSetlistText((prev) => {
      const lines = prev.split(/\r?\n/u);
      const lineIndex = lineNumber - 1;

      if (lineIndex < 0 || lineIndex >= lines.length) {
        return prev;
      }

      lines[lineIndex] = nextValue;
      return lines.join("\n");
    });
  }

  function applyAllSuggestions() {
    if (!state.mismatchLines?.length) {
      return;
    }

    setSetlistText((prev) => {
      const lines = prev.split(/\r?\n/u);

      for (const item of state.mismatchLines ?? []) {
        if (!item.suggestedValue) {
          continue;
        }

        const lineIndex = item.lineNumber - 1;
        if (lineIndex < 0 || lineIndex >= lines.length) {
          continue;
        }

        lines[lineIndex] = item.suggestedValue;
      }

      return lines.join("\n");
    });
  }

  async function handleSpotifyImport() {
    const trimmedSpotifyUrl = spotifyUrl.trim();
    if (!trimmedSpotifyUrl) {
      setSpotifyError("请先粘贴 Spotify 链接。");
      setSpotifyMessage(null);
      return;
    }

    setSpotifyImporting(true);
    setSpotifyError(null);
    setSpotifyMessage(null);

    try {
      const response = await fetch("/admin/spotify-setlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedSpotifyUrl }),
      });
      const payload = await response.json() as {
        error?: string;
        sourceTitle?: string;
        tracks?: string[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Spotify 解析失败。");
      }

      const tracks = payload.tracks ?? [];
      if (tracks.length === 0) {
        throw new Error("没有从 Spotify 链接中解析到歌曲。");
      }

      const nextText = tracks.join("\n");
      setSetlistText((prev) => (prev.trim().length > 0 ? `${prev.trimEnd()}\n${nextText}` : nextText));
      setSpotifyMessage(`已从 ${payload.sourceTitle ?? "Spotify"} 导入 ${tracks.length} 首歌。`);
    } catch (error) {
      setSpotifyError(error instanceof Error ? error.message : "Spotify 解析失败。");
    } finally {
      setSpotifyImporting(false);
    }
  }

  const suggestedCount = state.mismatchLines?.filter((item) => Boolean(item.suggestedValue)).length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-border-soft bg-panel p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">歌单导入</h1>
        <p className="text-sm text-ink-soft">
          填写 Eventernote 链接或数字 event 号；歌单每行一首。点击提交会先校验，全部匹配后自动写入。
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-foreground">
          Eventernote 链接或 event 号
          <input
            required
            name="eventInput"
            value={eventInput}
            onChange={(event) => {
              setEventInput(event.target.value);
            }}
            placeholder="https://www.eventernote.com/events/1142 或 1142"
            className="min-h-11 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>

        <div className="flex flex-col gap-2 text-sm text-foreground">
          Spotify 链接导入
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={spotifyUrl}
              onChange={(event) => {
                setSpotifyUrl(event.target.value);
              }}
              placeholder="https://open.spotify.com/playlist/..."
              className="min-h-11 flex-1 rounded-xl border border-border-soft bg-panel-strong px-4 outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              onClick={handleSpotifyImport}
              disabled={spotifyImporting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-soft bg-panel-strong px-4 text-sm font-medium text-foreground transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {spotifyImporting ? "解析中..." : "解析并填入"}
            </button>
          </div>
          {spotifyMessage ? <p className="text-xs text-emerald-700 dark:text-emerald-200">{spotifyMessage}</p> : null}
          {spotifyError ? <p className="text-xs text-rose-700 dark:text-rose-200">{spotifyError}</p> : null}
        </div>

        <label className="flex flex-col gap-2 text-sm text-foreground">
          歌单（每行一首）
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleStripNumbering}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border-soft bg-panel-strong px-3 text-xs text-ink-soft transition hover:border-accent hover:text-foreground"
            >
              清除标号
            </button>
          </div>
          <textarea
            required
            name="setlistText"
            value={setlistText}
            onChange={(event) => {
              setSetlistText(event.target.value);
            }}
            rows={14}
            placeholder={"STAR BEAT!\nNO GIRL NO CRY\nFreedom"}
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

      {state.eventernoteEventId ? (
        <div className="rounded-xl border border-border-soft bg-panel-strong px-4 py-3 text-sm text-ink-soft">
          <p>
            Event #{state.eventernoteEventId} {state.eventTitle ? `- ${state.eventTitle}` : ""}
          </p>
          <p>
            日期: {state.eventDate ?? "未知"} | 场地: {state.venue ?? "未知"}
          </p>
        </div>
      ) : null}

      {state.mismatchLines && state.mismatchLines.length > 0 ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-3 text-sm font-medium text-black dark:text-rose-100">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">以下行未匹配 songs.title（严格匹配）：</p>
            {suggestedCount > 0 ? (
              <button
                type="button"
                onClick={applyAllSuggestions}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-400/40 bg-rose-400/20 px-3 text-xs text-black transition hover:border-rose-300 hover:bg-rose-400/30 dark:text-rose-50"
              >
                一键替换 {suggestedCount} 条建议
              </button>
            ) : null}
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {state.mismatchLines.map((item) => (
              <li key={`${item.lineNumber}-${item.value}`} className="space-y-2">
                <p>
                  第 {item.lineNumber} 行: {item.value}
                </p>
                {item.suggestedValue ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-black dark:text-rose-50/90">
                    <span>
                      建议改为: {item.suggestedValue}
                      {typeof item.suggestionScore === "number" ? ` · 相似度 ${(item.suggestionScore * 100).toFixed(0)}%` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => replaceLineValue(item.lineNumber, item.suggestedValue!)}
                      className="inline-flex min-h-8 items-center justify-center rounded-lg border border-rose-400/40 bg-rose-400/20 px-3 text-[11px] transition hover:border-rose-300 hover:bg-rose-400/30"
                    >
                      替换为该候选
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-black dark:text-rose-50/70">未找到足够接近的候选，请手动修正。</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
