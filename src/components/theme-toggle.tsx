"use client";

import { useSyncExternalStore } from "react";
import { cnCopy } from "@/lib/i18n/cn";

const storageKey = "bdr-theme";

const options = [{ value: "light" }, { value: "system" }, { value: "dark" }] as const;

type ThemePreference = (typeof options)[number]["value"];

const mediaQuery = "(prefers-color-scheme: dark)";
const fallbackTheme: ThemePreference = "system";

const themeListeners = new Set<() => void>();

function isThemePreference(value: string | undefined | null): value is ThemePreference {
  return value === "light" || value === "system" || value === "dark";
}

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const resolved =
    theme === "system" ? (window.matchMedia(mediaQuery).matches ? "dark" : "light") : theme;

  root.dataset.theme = resolved;
  root.dataset.themePreference = theme;

  if (theme === "system") {
    window.localStorage.removeItem(storageKey);
  } else {
    window.localStorage.setItem(storageKey, theme);
  }
}

function getThemePreferenceSnapshot(): ThemePreference {
  if (typeof document === "undefined") {
    return fallbackTheme;
  }

  const datasetTheme = document.documentElement.dataset.themePreference;
  if (isThemePreference(datasetTheme)) {
    return datasetTheme;
  }

  const storedTheme = window.localStorage.getItem(storageKey);
  return isThemePreference(storedTheme) ? storedTheme : fallbackTheme;
}

function notifyThemeListeners() {
  for (const listener of themeListeners) {
    listener();
  }
}

function subscribeThemePreference(listener: () => void) {
  themeListeners.add(listener);

  const media = window.matchMedia(mediaQuery);
  const handleMediaChange = () => {
    if (getThemePreferenceSnapshot() === "system") {
      applyTheme("system");
      notifyThemeListeners();
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) {
      notifyThemeListeners();
    }
  };

  media.addEventListener("change", handleMediaChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    themeListeners.delete(listener);
    media.removeEventListener("change", handleMediaChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreferenceSnapshot,
    () => fallbackTheme,
  );
  const localeCopy = cnCopy;
  const labels: Record<ThemePreference, string> = {
    light: localeCopy.themeLight,
    system: localeCopy.themeSystem,
    dark: localeCopy.themeDark,
  };

  return (
    <div
      className="inline-flex items-center rounded-full border border-border-soft bg-panel-strong p-1"
      role="group"
      aria-label={localeCopy.themeToggleAria}
    >
      {options.map((option) => {
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs sm:text-sm ${
              active ? "bg-foreground text-background shadow-sm" : "text-ink-soft hover:text-foreground"
            }`}
            onClick={() => {
              applyTheme(option.value);
              notifyThemeListeners();
            }}
          >
            {labels[option.value]}
          </button>
        );
      })}
    </div>
  );
}
