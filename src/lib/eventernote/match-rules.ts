const JST_TIME_ZONE = "Asia/Tokyo";

type EventDateSnapshot = {
  eventDate: string;
};

function getCurrentDateInJst(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve current date in JST.");
  }

  return `${year}-${month}-${day}`;
}

export function shouldIncludeEventInSongStats(snapshot: EventDateSnapshot, now = new Date()) {
  const todayInJst = getCurrentDateInJst(now);

  if (snapshot.eventDate > todayInJst) {
    return false;
  }

  return true;
}
