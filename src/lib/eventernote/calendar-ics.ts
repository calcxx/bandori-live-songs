import { isValidIsoDate } from "@/lib/calendar-date";
import type { EventernoteEventSnapshot } from "./parser";

const eventernoteEventUrlPattern = /\/events\/(\d+)/u;

/** RFC 5545 line folding: a continuation line starts with a space or tab. */
function unfoldIcalLines(ics: string) {
  const normalized = ics.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n");
  const lines: string[] = [];

  for (const line of normalized.split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
      continue;
    }

    lines.push(line);
  }

  return lines;
}

function parseProperty(line: string) {
  const separator = line.indexOf(":");
  if (separator <= 0) {
    return null;
  }

  const head = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const name = head.split(";", 1)[0]?.toUpperCase();

  return name ? { name, value } : null;
}

function unescapeIcalText(value: string) {
  return value.replace(/\\([\\,;nN])/gu, (_match, escaped: string) => {
    if (escaped === "n" || escaped === "N") {
      return "\n";
    }

    return escaped;
  });
}

function parseIcalDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/u);
  if (!match) {
    return null;
  }

  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return isValidIsoDate(date) ? date : null;
}

function parseEventernoteEventId(value: string) {
  const match = value.match(eventernoteEventUrlPattern);
  if (!match) {
    return null;
  }

  const eventernoteEventId = Number(match[1]);
  return Number.isSafeInteger(eventernoteEventId) && eventernoteEventId > 0
    ? eventernoteEventId
    : null;
}

function toEventSnapshot(
  properties: Map<string, string>,
): EventernoteEventSnapshot | null {
  if (properties.get("STATUS")?.toUpperCase() === "CANCELLED") {
    return null;
  }

  const rawUrl = properties.get("URL")?.trim();
  const eventernoteEventId = rawUrl
    ? parseEventernoteEventId(rawUrl)
    : null;
  const eventDate = parseIcalDate(properties.get("DTSTART") ?? "");
  const title = unescapeIcalText(properties.get("SUMMARY") ?? "").trim();

  if (!eventernoteEventId || !eventDate || !title) {
    return null;
  }

  const location = unescapeIcalText(properties.get("LOCATION") ?? "").trim();
  const sourceUrl =
    rawUrl && parseEventernoteEventId(rawUrl)
      ? rawUrl
      : `https://www.eventernote.com/events/${eventernoteEventId}`;

  return {
    eventernoteEventId,
    title,
    eventDate,
    venue: location || null,
    actorIds: [],
    actorNames: [],
    sourceUrl,
  };
}

/**
 * Parse the public Eventernote user calendar feed. The feed is capped by the
 * upstream service, so callers must only treat it as complete for users whose
 * total event count is within that cap.
 */
export function parseEventernoteCalendarIcs(ics: string) {
  const events = new Map<number, EventernoteEventSnapshot>();
  let currentProperties: Map<string, string> | null = null;

  for (const line of unfoldIcalLines(ics)) {
    if (line === "BEGIN:VEVENT") {
      currentProperties = new Map();
      continue;
    }

    if (line === "END:VEVENT") {
      if (currentProperties) {
        const event = toEventSnapshot(currentProperties);
        if (event && !events.has(event.eventernoteEventId)) {
          events.set(event.eventernoteEventId, event);
        }
      }
      currentProperties = null;
      continue;
    }

    if (!currentProperties) {
      continue;
    }

    const property = parseProperty(line);
    if (property) {
      currentProperties.set(property.name, property.value);
    }
  }

  return [...events.values()];
}
