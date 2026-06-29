"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isValidEventernoteUserId, normalizeEventernoteUserId } from "@/lib/eventernote/user-id";
import { cnCopy } from "@/lib/i18n/cn";
import { buildAwaitFreshAfterCookie } from "@/lib/manual-refresh-navigation";

type SearchFormProps = {
  defaultUserId?: string;
};

export function SearchForm({ defaultUserId = "" }: SearchFormProps) {
  const localeCopy = cnCopy;
  const pathname = usePathname();
  const router = useRouter();
  const [userIdValue, setUserIdValue] = useState(defaultUserId);
  const [hasInputChanged, setHasInputChanged] = useState(false);
  const normalizedUserId = normalizeEventernoteUserId(userIdValue);
  const invalidUserId = normalizedUserId.length > 0 && !isValidEventernoteUserId(normalizedUserId);
  const isManualRefresh = defaultUserId.length > 0 && !hasInputChanged;
  const isEmptyInput = normalizedUserId.length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (invalidUserId || isEmptyInput) {
      event.preventDefault();
      return;
    }

    const isSameUser =
      defaultUserId.length > 0 &&
      normalizeEventernoteUserId(defaultUserId).toLowerCase() === normalizedUserId.toLowerCase();

    if (isSameUser) {
      event.preventDefault();
      document.cookie = buildAwaitFreshAfterCookie(normalizedUserId, Date.now());
      const params = new URLSearchParams();
      params.set("userId", normalizedUserId);
      params.set("refresh", "1");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }

  return (
    <form action="/" method="get" onSubmit={handleSubmit} className="flex w-full flex-col gap-2 sm:gap-3">
      <label className="sr-only" htmlFor="userId">
        {localeCopy.searchInputLabel}
      </label>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <input
          id="userId"
          name="userId"
          value={userIdValue}
          onChange={(event) => {
            setUserIdValue(event.target.value);
            setHasInputChanged(true);
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={localeCopy.searchPlaceholder}
          aria-invalid={invalidUserId}
          aria-describedby={invalidUserId ? "userId-validation-message" : undefined}
          className={`min-h-13 flex-1 rounded-[1.25rem] border bg-panel-strong px-4 text-base outline-none placeholder:text-ink-soft focus:ring-2 ${
            invalidUserId
              ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/20"
              : "border-border-soft focus:border-accent focus:ring-accent/20"
          }`}
        />
        <button
          type="submit"
          disabled={isEmptyInput}
          className="inline-flex min-h-13 items-center justify-center rounded-[1.25rem] bg-foreground px-5 font-medium text-background hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isManualRefresh ? localeCopy.manualRefresh : localeCopy.searchSubmit}
        </button>
      </div>
      {invalidUserId ? (
        <p id="userId-validation-message" role="alert" className="text-sm text-red-500">
          {localeCopy.invalidUserIdHint}
        </p>
      ) : null}
    </form>
  );
}
