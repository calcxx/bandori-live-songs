"use client";

import { useActionState } from "react";

export type AdminLoginActionState = {
  status: "idle" | "error";
  message?: string;
};

type AdminLoginFormProps = {
  action: (state: AdminLoginActionState, formData: FormData) => Promise<AdminLoginActionState>;
  nextPath: string;
};

const initialState: AdminLoginActionState = {
  status: "idle",
};

export function AdminLoginForm({ action, nextPath }: AdminLoginFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <label className="min-w-0 flex-1">
          <span className="sr-only">管理 key</span>
          <input
            required
            type="password"
            name="adminKey"
            autoComplete="current-password"
            placeholder="管理 key"
            className="h-11 w-full rounded-xl border border-border-soft bg-panel-strong px-4 outline-none placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-foreground px-5 font-medium text-background transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "验证中..." : "进入管理页"}
        </button>
      </div>
      {state.message ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-3 text-sm font-medium text-black dark:text-amber-100">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
