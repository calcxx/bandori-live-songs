export const eventSearchTabValue = "event";

export function buildLiveSetlistHref(eventernoteEventId: number) {
  return `/events/${eventernoteEventId}`;
}

export function buildEmptyEventSearchHref() {
  return "/events";
}
