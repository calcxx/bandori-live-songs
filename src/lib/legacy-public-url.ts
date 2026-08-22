import { normalizeEventernoteUserId } from "@/lib/eventernote/user-id";
import {
  buildEmptyEventSearchHref,
  buildLiveSetlistHref,
  eventSearchTabValue,
} from "@/lib/live-setlist/url";
import { buildUserHref } from "@/lib/public-url";

export type LegacyHomeSearchParams = {
  userId?: string;
  eventId?: string;
  tab?: string;
  refresh?: string;
  awaitFreshAfter?: string;
};

export function buildLegacyHomeRedirectHref({
  userId = "",
  eventId = "",
  tab = "",
  refresh = "",
  awaitFreshAfter = "",
}: LegacyHomeSearchParams) {
  const normalizedEventId = eventId.trim();
  if (normalizedEventId) {
    if (!/^\d+$/u.test(normalizedEventId)) {
      return null;
    }

    const parsedEventId = Number(normalizedEventId);
    return Number.isSafeInteger(parsedEventId) && parsedEventId > 0
      ? buildLiveSetlistHref(parsedEventId)
      : null;
  }

  const normalizedUserId = normalizeEventernoteUserId(userId);
  if (normalizedUserId) {
    const query = new URLSearchParams();
    if (refresh) {
      query.set("refresh", refresh);
    }
    if (awaitFreshAfter) {
      query.set("awaitFreshAfter", awaitFreshAfter);
    }

    const queryString = query.toString();
    return `${buildUserHref(normalizedUserId)}${
      queryString ? `?${queryString}` : ""
    }`;
  }

  return tab === eventSearchTabValue
    ? buildEmptyEventSearchHref()
    : null;
}
