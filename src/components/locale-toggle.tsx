"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { navPillOutline } from "@/components/nav-pill";
import {
  getCopy,
  getHtmlLang,
  type Locale,
} from "@/lib/i18n";
import {
  localeCookieMaxAgeSeconds,
  localeCookieName,
} from "@/lib/locale-cookie";

const options = [
  { value: "zh-cn", compactLabel: "简", label: "简体中文" },
  { value: "zh-tw", compactLabel: "繁", label: "繁體中文" },
  { value: "ja", compactLabel: "日", label: "日本語" },
  { value: "en", compactLabel: "EN", label: "English" },
] as const satisfies readonly {
  value: Locale;
  compactLabel: string;
  label: string;
}[];

function applyLocalePreference(locale: Locale) {
  document.cookie = `${localeCookieName}=${locale}; Path=/; Max-Age=${localeCookieMaxAgeSeconds}; SameSite=Lax`;
  document.documentElement.lang = getHtmlLang(locale);
  document.documentElement.dataset.locale = locale;
}

export function LocaleToggle({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const copy = getCopy(locale);
  const currentOption = options.find((option) => option.value === locale) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function selectLocale(nextLocale: Locale) {
    setOpen(false);

    if (nextLocale === locale) {
      return;
    }

    applyLocalePreference(nextLocale);
    onLocaleChange(nextLocale);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${copy.languageToggleAria}: ${currentOption.label}`}
        className={`${navPillOutline} gap-0.5 px-2`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{currentOption.compactLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-36 rounded-xl border border-border-soft bg-panel-strong p-1.5 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === locale}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-background"
              onClick={() => selectLocale(option.value)}
            >
              <span lang={getHtmlLang(option.value)}>{option.label}</span>
              {option.value === locale ? (
                <CheckIcon className="h-4 w-4 text-accent" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
