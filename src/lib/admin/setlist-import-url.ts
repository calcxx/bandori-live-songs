export function buildSetlistImportHref(eventernoteEventId: number) {
  const params = new URLSearchParams({
    event: String(eventernoteEventId),
  });

  return `/admin/setlist-import?${params.toString()}`;
}

export function buildGoogleSetlistSearchHref(eventTitle: string) {
  const params = new URLSearchParams({
    q: `${eventTitle} セットリスト`,
  });

  return `https://www.google.com/search?${params.toString()}`;
}

export function parseSetlistImportEventId(input: string) {
  const trimmed = input.trim();
  let rawId = trimmed;
  if (!/^\d+$/u.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if ((url.protocol !== "https:" && url.protocol !== "http:") ||
        (url.hostname !== "eventernote.com" && !url.hostname.endsWith(".eventernote.com")) ||
        url.username || url.password) {
        return null;
      }
      const match = url.pathname.match(/^\/events\/(\d+)\/?$/u);
      if (!match) return null;
      rawId = match[1];
    } catch {
      return null;
    }
  }
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
