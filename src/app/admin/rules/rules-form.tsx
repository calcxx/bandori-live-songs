"use client";

import { useActionState, useState } from "react";

export type RulesActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

type RulesFormProps = {
  action: (state: RulesActionState, formData: FormData) => Promise<RulesActionState>;
  hiddenTitleKeywordsText: string;
  hiddenEventernoteEventIdsText: string;
};

const initialState: RulesActionState = {
  status: "idle",
};

export function RulesForm({
  action,
  hiddenTitleKeywordsText,
  hiddenEventernoteEventIdsText,
}: RulesFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [keywordsText, setKeywordsText] = useState(hiddenTitleKeywordsText);
  const [eventIdsText, setEventIdsText] = useState(hiddenEventernoteEventIdsText);

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-4xl flex-col gap-5 rounded-2xl border border-border-soft bg-panel p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-foreground">
          屏蔽词
          <textarea
            name="hiddenTitleKeywordsText"
            value={keywordsText}
            onChange={(event) => setKeywordsText(event.target.value)}
            rows={20}
            className="rounded-xl border border-border-soft bg-panel-strong px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-foreground">
          Eventernote event ID
          <textarea
            name="hiddenEventernoteEventIdsText"
            value={eventIdsText}
            onChange={(event) => setEventIdsText(event.target.value)}
            rows={20}
            className="rounded-xl border border-border-soft bg-panel-strong px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-5 font-medium text-background transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "保存中..." : "保存规则"}
      </button>
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-sm font-medium text-black dark:text-emerald-100"
              : "rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-3 text-sm font-medium text-black dark:text-amber-100"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
