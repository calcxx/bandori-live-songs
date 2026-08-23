import { cnCopy } from "./cn";
import { enCopy } from "./en";
import { jpCopy } from "./jp";
import { twCopy } from "./tw";

export type { CopyDefinition } from "./types";

export type Locale = "zh-cn" | "zh-tw" | "ja" | "en";

export const defaultLocale = "zh-cn" satisfies Locale;

export function isLocale(value: string | undefined | null): value is Locale {
  return (
    value === "zh-cn" ||
    value === "zh-tw" ||
    value === "ja" ||
    value === "en"
  );
}

export function normalizeStoredLocale(value: string | undefined | null): Locale | null {
  if (isLocale(value)) {
    return value;
  }

  if (value === "cn") {
    return "zh-cn";
  }

  if (value === "jp") {
    return "ja";
  }

  return null;
}

export function resolveLocaleFromLanguage(language: string | undefined | null): Locale {
  const normalized = language?.trim().toLowerCase().replaceAll("_", "-") ?? "";

  if (
    normalized === "zh-tw" ||
    normalized.startsWith("zh-tw-") ||
    normalized === "zh-hant" ||
    normalized.startsWith("zh-hant-")
  ) {
    return "zh-tw";
  }

  if (normalized === "zh-hk" || normalized.startsWith("zh-hk-") || normalized === "zh-mo" || normalized.startsWith("zh-mo-")) {
    return "zh-tw";
  }

  if (normalized === "ja" || normalized.startsWith("ja-")) {
    return "ja";
  }

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  if (
    normalized === "zh" ||
    normalized === "zh-cn" ||
    normalized.startsWith("zh-cn-") ||
    normalized === "zh-sg" ||
    normalized.startsWith("zh-sg-") ||
    normalized === "zh-hans" ||
    normalized.startsWith("zh-hans-")
  ) {
    return "zh-cn";
  }

  return defaultLocale;
}

export function resolveLocaleFromAcceptLanguage(headerValue: string | null | undefined): Locale {
  const firstLanguage = headerValue
    ?.split(",", 1)[0]
    ?.split(";", 1)[0]
    ?.trim();

  return resolveLocaleFromLanguage(firstLanguage);
}

export function getHtmlLang(locale: Locale) {
  if (locale === "zh-tw") {
    return "zh-TW";
  }

  if (locale === "ja") {
    return "ja";
  }

  if (locale === "en") {
    return "en";
  }

  return "zh-CN";
}

const copyByLocale = {
  "zh-cn": cnCopy,
  "zh-tw": twCopy,
  ja: jpCopy,
  en: enCopy,
} as const;

export function getCopy(locale: Locale) {
  return copyByLocale[locale];
}
