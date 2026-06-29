export function buildSetlistImportHref(eventernoteEventId: number) {
  const params = new URLSearchParams({
    event: String(eventernoteEventId),
  });

  return `/admin/setlist-import?${params.toString()}`;
}
