import { eq } from "drizzle-orm";
import { setTimeout as sleep } from "node:timers/promises";
import { connectDatabase } from "../src/lib/db/core";
import { events } from "../src/lib/db/schema";
import { fetchEventMetaFromEventernote } from "../src/lib/eventernote/event-meta";

async function main() {
  const { db, sql } = connectDatabase(true);
  const rows = await db
    .select({
      id: events.id,
      eventernoteEventId: events.eventernoteEventId,
      title: events.title,
      venue: events.venue,
    })
    .from(events)
    .orderBy(events.eventDate);

  let updatedCount = 0;
  let failedCount = 0;

  for (const [index, row] of rows.entries()) {
    try {
      const meta = await fetchEventMetaFromEventernote(row.eventernoteEventId, 10000);

      await db
        .update(events)
        .set({
          title: meta.title,
          eventDate: meta.eventDate,
          venue: meta.venue,
          updatedAt: new Date(),
        })
        .where(eq(events.id, row.id));

      updatedCount += 1;
      console.log(`[${index + 1}/${rows.length}] updated ${row.eventernoteEventId} -> ${meta.title} / ${meta.venue ?? "无场地"}`);
      await sleep(250);
    } catch (error) {
      failedCount += 1;
      console.error(`[${index + 1}/${rows.length}] failed ${row.eventernoteEventId}:`, error);
      await sleep(500);
    }
  }

  console.log(JSON.stringify({ total: rows.length, updatedCount, failedCount }, null, 2));
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
