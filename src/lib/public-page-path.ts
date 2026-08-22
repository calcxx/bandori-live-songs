export type PublicPagePath =
  | { kind: "events" }
  | { kind: "event"; eventernoteEventId: number }
  | { kind: "user"; userId: string }
  | { kind: "home" };

export function parsePublicPagePath(pathname: string): PublicPagePath | null {
  if (/^\/events\/?$/u.test(pathname)) {
    return { kind: "events" };
  }

  const eventMatch = pathname.match(/^\/events\/(\d+)\/?$/u);
  if (eventMatch) {
    const eventernoteEventId = Number(eventMatch[1]);
    if (
      Number.isSafeInteger(eventernoteEventId) &&
      eventernoteEventId > 0
    ) {
      return { kind: "event", eventernoteEventId };
    }
    return null;
  }

  const userMatch = pathname.match(/^\/users\/([^/]+)\/?$/u);
  if (userMatch) {
    try {
      return {
        kind: "user",
        userId: decodeURIComponent(userMatch[1] ?? ""),
      };
    } catch {
      return null;
    }
  }

  if (/^\/?$/u.test(pathname)) {
    return { kind: "home" };
  }

  return null;
}
