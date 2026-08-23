import { describe, expect, it } from "vitest";
import {
  defaultLocale,
  getCopy,
  getHtmlLang,
  normalizeStoredLocale,
  resolveLocaleFromAcceptLanguage,
  resolveLocaleFromLanguage,
  type Locale,
} from "@/lib/i18n";

describe("locale resolution", () => {
  it.each([
    ["zh-CN", "zh-cn"],
    ["zh-SG", "zh-cn"],
    ["zh-Hans", "zh-cn"],
    ["zh", "zh-cn"],
    ["zh-TW", "zh-tw"],
    ["zh-TW-u-nu-hanidec", "zh-tw"],
    ["zh-Hant", "zh-tw"],
    ["zh-HK", "zh-tw"],
    ["zh-MO", "zh-tw"],
    ["ja", "ja"],
    ["ja-JP", "ja"],
    ["en", "en"],
    ["en-US", "en"],
    ["en-GB", "en"],
    ["fr", "zh-cn"],
  ] satisfies [string, Locale][])("maps %s to %s", (language, expected) => {
    expect(resolveLocaleFromLanguage(language)).toBe(expected);
  });

  it("only considers the first requested language", () => {
    expect(resolveLocaleFromAcceptLanguage("ja-JP,zh-CN;q=0.9")).toBe("ja");
    expect(resolveLocaleFromAcceptLanguage("en-US,ja-JP;q=0.9")).toBe("en");
    expect(resolveLocaleFromAcceptLanguage(null)).toBe(defaultLocale);
  });

  it("accepts current and legacy saved locale values", () => {
    expect(normalizeStoredLocale("zh-cn")).toBe("zh-cn");
    expect(normalizeStoredLocale("zh-tw")).toBe("zh-tw");
    expect(normalizeStoredLocale("ja")).toBe("ja");
    expect(normalizeStoredLocale("en")).toBe("en");
    expect(normalizeStoredLocale("cn")).toBe("zh-cn");
    expect(normalizeStoredLocale("jp")).toBe("ja");
    expect(normalizeStoredLocale("fr")).toBeNull();
  });

  it("provides the correct document language", () => {
    expect(getHtmlLang("zh-cn")).toBe("zh-CN");
    expect(getHtmlLang("zh-tw")).toBe("zh-TW");
    expect(getHtmlLang("ja")).toBe("ja");
    expect(getHtmlLang("en")).toBe("en");
  });
});

describe("localized copy", () => {
  it("keeps all locale dictionaries structurally aligned", () => {
    const simplifiedChineseKeys = Object.keys(getCopy("zh-cn")).sort();

    expect(Object.keys(getCopy("zh-tw")).sort()).toEqual(simplifiedChineseKeys);
    expect(Object.keys(getCopy("ja")).sort()).toEqual(simplifiedChineseKeys);
    expect(Object.keys(getCopy("en")).sort()).toEqual(simplifiedChineseKeys);
  });
});
