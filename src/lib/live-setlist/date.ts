const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DATE_TOKEN_PATTERN =
  /(^|\s)(\d{4})(?:([-/.])(\d{1,2})(?:\3(\d{1,2}))?)?(?=\s|$)/u;
const INVALID_DATE_TOKEN_PATTERN = /(^|\s)\d{4}(?:[-/.]\S*)?(?=\s|$)/u;

export type LiveSetlistDateFilter =
  | { kind: "year"; value: string }
  | { kind: "month"; value: string }
  | { kind: "day"; value: string };

export type ParsedLiveSetlistSearch = {
  title: string;
  dateFilter: LiveSetlistDateFilter | null;
  invalidDateToken: boolean;
};

function daysInMonth(year: number, month: number) {
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1] ?? 0;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

export function isValidLiveSetlistDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  return isValidCalendarDate(year, month, day);
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export function parseLiveSetlistSearch(rawQuery: string): ParsedLiveSetlistSearch {
  const query = normalizeWhitespace(rawQuery);
  const match = DATE_TOKEN_PATTERN.exec(query);
  if (!match) {
    return {
      title: query,
      dateFilter: null,
      invalidDateToken: INVALID_DATE_TOKEN_PATTERN.test(query),
    };
  }

  const year = Number(match[2]);
  const month = match[4] ? Number(match[4]) : null;
  const day = match[5] ? Number(match[5]) : null;
  const dateIsValid =
    month === null
      ? year >= 1
      : day === null
        ? year >= 1 && month >= 1 && month <= 12
        : isValidCalendarDate(year, month, day);

  if (!dateIsValid) {
    return {
      title: query,
      dateFilter: null,
      invalidDateToken: true,
    };
  }

  const dateFilter =
    month === null
      ? { kind: "year" as const, value: String(year) }
      : day === null
        ? {
            kind: "month" as const,
            value: `${year}-${String(month).padStart(2, "0")}`,
          }
        : {
            kind: "day" as const,
            value: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          };
  const tokenStart = match.index + match[1].length;
  const tokenEnd = match.index + match[0].length;
  const title = normalizeWhitespace(
    `${query.slice(0, tokenStart)} ${query.slice(tokenEnd)}`,
  );

  return {
    title,
    dateFilter,
    invalidDateToken: false,
  };
}
