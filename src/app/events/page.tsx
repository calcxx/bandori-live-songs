import { PublicHomePage } from "@/components/public-home-page";

export const runtime = "nodejs";

export default function EventsPage() {
  return <PublicHomePage preferredSearchMode="live" />;
}
