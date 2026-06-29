import { normalizeEventernoteUserCacheKey } from "@/lib/eventernote/user-id";

export const awaitFreshAfterCookieName = "bdr-await-fresh-after";

type AwaitFreshAfterPayload = {
  userId: string;
  timestamp: number;
};

export function encodeAwaitFreshAfterCookie(payload: AwaitFreshAfterPayload) {
  return encodeURIComponent(JSON.stringify(payload));
}

export function decodeAwaitFreshAfterCookie(value: string | undefined, userId: string) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<AwaitFreshAfterPayload>;
    const expectedUserKey = normalizeEventernoteUserCacheKey(userId);
    const actualUserKey =
      typeof parsed.userId === "string" ? normalizeEventernoteUserCacheKey(parsed.userId) : "";

    if (actualUserKey !== expectedUserKey || typeof parsed.timestamp !== "number" || !Number.isFinite(parsed.timestamp)) {
      return undefined;
    }

    return parsed.timestamp > 0 ? parsed.timestamp : undefined;
  } catch {
    return undefined;
  }
}

export function buildAwaitFreshAfterCookie(userId: string, timestamp: number) {
  return `${awaitFreshAfterCookieName}=${encodeAwaitFreshAfterCookie({
    userId,
    timestamp,
  })}; path=/; max-age=600; samesite=lax`;
}

export function clearAwaitFreshAfterCookie() {
  return `${awaitFreshAfterCookieName}=; path=/; max-age=0; samesite=lax`;
}
