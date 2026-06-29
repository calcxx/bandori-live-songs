const eventernoteUserIdPattern = /^[A-Za-z0-9_]+$/;

export const LAST_SUCCESSFUL_USER_ID_STORAGE_KEY = "bdr-last-successful-user-id";

export function getDefaultUserId() {
  return normalizeEventernoteUserId(process.env.DEMO_USER_ID ?? "");
}

export function clearStoredSuccessfulUserId() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LAST_SUCCESSFUL_USER_ID_STORAGE_KEY);
  } catch {
    // Storage may be disabled by the browser.
  }
}

export function readStoredSuccessfulUserId() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return normalizeEventernoteUserId(
      window.localStorage.getItem(LAST_SUCCESSFUL_USER_ID_STORAGE_KEY) ?? "",
    );
  } catch {
    return "";
  }
}

export function normalizeEventernoteUserId(input: string) {
  return input.trim();
}

export function normalizeEventernoteUserCacheKey(input: string) {
  return normalizeEventernoteUserId(input).toLowerCase();
}

export function isValidEventernoteUserId(input: string) {
  return eventernoteUserIdPattern.test(normalizeEventernoteUserId(input));
}
