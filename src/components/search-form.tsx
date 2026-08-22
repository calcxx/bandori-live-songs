"use client";

import { XIcon } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isValidEventernoteUserId, normalizeEventernoteUserId } from "@/lib/eventernote/user-id";
import type { CopyDefinition } from "@/lib/i18n";
import { buildAwaitFreshAfterCookie } from "@/lib/manual-refresh-navigation";
import { buildUserHref } from "@/lib/public-url";

type SearchFormProps = {
  defaultUserId?: string;
  copy: CopyDefinition;
};

export function SearchForm({ defaultUserId = "", copy: localeCopy }: SearchFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [userIdValue, setUserIdValue] = useState(defaultUserId);
  const [hasInputChanged, setHasInputChanged] = useState(false);
  const normalizedUserId = normalizeEventernoteUserId(userIdValue);
  const invalidUserId = normalizedUserId.length > 0 && !isValidEventernoteUserId(normalizedUserId);
  const isManualRefresh = defaultUserId.length > 0 && !hasInputChanged;
  const isEmptyInput = normalizedUserId.length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidUserId || isEmptyInput) {
      return;
    }

    const isSameUser =
      defaultUserId.length > 0 &&
      normalizeEventernoteUserId(defaultUserId).toLowerCase() === normalizedUserId.toLowerCase();

    if (isSameUser) {
      document.cookie = buildAwaitFreshAfterCookie(normalizedUserId, Date.now());
      router.push(`${buildUserHref(normalizedUserId)}?refresh=1`, {
        scroll: false,
      });
      return;
    }

    router.push(buildUserHref(normalizedUserId), { scroll: false });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 sm:gap-3">
      <label className="sr-only" htmlFor="userId">
        {localeCopy.searchInputLabel}
      </label>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            id="userId"
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
            className={`min-h-13 w-full rounded-[1.25rem] border bg-panel-strong px-4 pr-12 text-base outline-none placeholder:text-ink-soft focus:ring-2 sm:pr-4 ${
              invalidUserId
                ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/20"
                : "border-border-soft focus:border-accent focus:ring-accent/20"
            }`}
          />
          {userIdValue.length > 0 ? (
            <button
              type="button"
              aria-label={localeCopy.searchClearAria}
              className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft transition hover:bg-background hover:text-foreground sm:hidden"
              onClick={() => {
                setUserIdValue("");
                setHasInputChanged(true);
                inputRef.current?.focus();
              }}
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
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
