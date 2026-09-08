import { eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/core";
import { events, setlistEntries } from "@/lib/db/schema";
import { refreshSongLiveState } from "@/lib/stats/refresh-song-live-state";

type SetlistInput = {
  eventernoteEventId: number;
  existingEventId: number | null;
  title: string;
  eventDate: string;
  venue: string | null;
  entries: readonly { rawTitle: string; songId: number }[];
};

/** Commit the setlist and its derived song flags together, or leave both unchanged. */
export async function saveEventSetlist(
  db: Pick<ReturnType<typeof getDb>, "transaction">,
  input: SetlistInput,
) {
  return db.transaction(async (tx) => {
    const eventFields = {
      title: input.title,
      eventDate: input.eventDate,
      venue: input.venue,
      setlistStatus: "complete" as const,
    };
    const overwritten = input.existingEventId !== null;
    const [event] = overwritten
      ? await tx.update(events)
          .set({ ...eventFields, updatedAt: new Date() })
          .where(eq(events.id, input.existingEventId!))
          .returning({ id: events.id })
      : await tx.insert(events)
          .values({ ...eventFields, eventernoteEventId: input.eventernoteEventId })
          .onConflictDoNothing({ target: events.eventernoteEventId })
          .returning({ id: events.id });

    // Another administrator may have inserted or deleted the event since preview.
    if (!event) return null;

    if (overwritten) {
      await tx.delete(setlistEntries).where(eq(setlistEntries.eventId, event.id));
    }
    await tx.insert(setlistEntries).values(
      input.entries.map((entry, index) => ({
        eventId: event.id,
        orderIndex: index + 1,
        rawTitle: entry.rawTitle,
        songId: entry.songId,
      })),
    );
    await refreshSongLiveState(tx);
    return { id: event.id, overwritten };
  });
}
