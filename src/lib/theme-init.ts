/**
 * Inline script that runs before React hydration to prevent FOUC
 * for theme (light/dark/system). Locale is fixed to Chinese.
 *
 * Also installs a MutationObserver to restore `data-theme` if React
 * strips it during RSC reconciliation (e.g. after `router.refresh()`).
 */
export function buildThemeInitScript() {
  return `
(() => {
  const themeKey = "bdr-theme";

  function readTheme() {
    const stored = window.localStorage.getItem(themeKey) ?? "system";
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = stored === "system" ? (systemDark ? "dark" : "light") : stored;
    return { resolved, stored };
  }

  function applyTheme() {
    const { resolved, stored } = readTheme();
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = stored;
  }

  applyTheme();

  document.documentElement.lang = "zh-CN";
  document.documentElement.dataset.locale = "cn";
  document.documentElement.dataset.localePreference = "cn";

  // Restore data-theme if React strips it during RSC reconciliation
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "data-theme") {
        if (!document.documentElement.dataset.theme) {
          applyTheme();
        }
      }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
`;
}
