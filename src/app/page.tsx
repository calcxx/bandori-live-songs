import { PublicHomePage } from "@/components/public-home-page";
import { permanentRedirect } from "next/navigation";
import { buildLegacyHomeRedirectHref } from "@/lib/legacy-public-url";
import { eventSearchTabValue } from "@/lib/live-setlist/url";

export const runtime = "nodejs";

type PageProps = {
  searchParams: Promise<{
    userId?: string;
    eventId?: string;
    tab?: string;
    refresh?: string;
    awaitFreshAfter?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const legacyRedirectHref = buildLegacyHomeRedirectHref(
    resolvedSearchParams,
  );
  if (legacyRedirectHref) {
    permanentRedirect(legacyRedirectHref);
  }

  const {
    userId = "",
    eventId = "",
    tab = "",
    refresh = "",
    awaitFreshAfter = "",
  } = resolvedSearchParams;

  return (
    <PublicHomePage
      userId={userId}
      eventId={eventId}
      preferredSearchMode={tab === eventSearchTabValue ? "live" : "user"}
      refresh={refresh}
      awaitFreshAfter={awaitFreshAfter}
    />
  );
}
