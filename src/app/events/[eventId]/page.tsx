import { PublicHomePage } from "@/components/public-home-page";

export const runtime = "nodejs";

type EventPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { eventId } = await params;

  return (
    <PublicHomePage
      eventId={eventId}
      preferredSearchMode="live"
    />
  );
}
