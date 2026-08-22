const fallbackSiteUrl = "http://localhost:3000";

export function getPublicSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredUrl) return fallbackSiteUrl;

  try {
    const url = new URL(configuredUrl);
    return url.origin;
  } catch {
    return fallbackSiteUrl;
  }
}
