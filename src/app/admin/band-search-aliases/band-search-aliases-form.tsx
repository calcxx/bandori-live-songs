"use client";

import { useActionState } from "react";
import type { BandSearchAliasRow } from "@/lib/admin/band-search-aliases";

export type BandSearchAliasesActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

type BandSearchAliasesFormProps = {
  action: (
    state: BandSearchAliasesActionState,
    formData: FormData,
  ) => Promise<BandSearchAliasesActionState>;
  bands: BandSearchAliasRow[];
};

const initialState: BandSearchAliasesActionState = {
  status: "idle",
};

export function BandSearchAliasesForm({
  action,
  bands,
}: BandSearchAliasesFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {bands.map((band) => (
          <label
            key={band.slug}
            className="flex min-w-0 flex-col gap-3 rounded-[1.5rem] border border-border-soft bg-panel p-5"
          >
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-foreground">
                {band.nameJa}
              </span>
              <span className="mt-1 block truncate font-mono text-xs text-ink-soft">
                {band.slug}
              </span>
            </span>
            <textarea
              key={`${band.slug}:${JSON.stringify(band.searchAliases)}`}
              name={`aliases:${band.slug}`}
              defaultValue={band.searchAliases.join("\n")}
              rows={3}
              maxLength={3000}
              spellCheck={false}
              placeholder="每行一个等效关键词"
              className="min-h-24 resize-y rounded-xl border border-border-soft bg-panel-strong px-4 py-3 font-mono text-base leading-6 outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        ))}
      </div>

      <div className="sticky bottom-4 z-10 rounded-[1.5rem] border border-border-soft bg-background/90 p-3 shadow-lg backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:gap-4">
        {state.message ? (
          <p
            className={
              state.status === "success"
                ? "px-2 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                : "px-2 py-2 text-sm font-medium text-amber-700 dark:text-amber-300"
            }
          >
            {state.message}
          </p>
        ) : (
          <p className="px-2 py-2 text-sm text-ink-soft">
            空白表示不设置额外关键词。
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-foreground px-6 font-medium text-background transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {pending ? "保存中..." : "保存检索词"}
        </button>
      </div>
    </form>
  );
}
