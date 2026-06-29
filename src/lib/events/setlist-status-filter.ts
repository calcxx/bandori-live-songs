type SetlistStatus = "missing" | "partial" | "complete" | null;

type SetlistStatusCandidate = {
  eventernoteEventId: number;
};

export function filterEventsByCollectedSetlistStatus<T extends SetlistStatusCandidate>(
  events: T[],
  statusByEventId: Record<number, SetlistStatus>,
  enabled: boolean,
) {
  if (!enabled) {
    return events;
  }

  return events.filter((event) => {
    const status = statusByEventId[event.eventernoteEventId] ?? null;
    return status !== "partial" && status !== "complete";
  });
}
