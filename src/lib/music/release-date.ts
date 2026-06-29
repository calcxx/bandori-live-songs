const defaultReleaseDateTimeZone = "Asia/Tokyo";

export function getCurrentReleaseDate(now = new Date(), timeZone = defaultReleaseDateTimeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format current release date.");
  }

  return `${year}-${month}-${day}`;
}

export function isReleasedByDate(firstReleaseDate: string, releasedThroughDate = getCurrentReleaseDate()) {
  return firstReleaseDate <= releasedThroughDate;
}
