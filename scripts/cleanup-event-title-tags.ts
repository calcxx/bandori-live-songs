import { eq } from "drizzle-orm";
import { connectDatabase } from "../src/lib/db/core";
import { events } from "../src/lib/db/schema";
import { sanitizeEventernoteEventTitle } from "../src/lib/eventernote/event-meta";

async function main() {
  const { db, sql } = connectDatabase(true);
  const rows = await db
    .select({
      id: events.id,
      eventernoteEventId: events.eventernoteEventId,
      title: events.title,
    })
    .from(events);

  let updatedCount = 0;

  for (const row of rows) {
    const sanitizedTitle = sanitizeEventernoteEventTitle(row.title);

    if (sanitizedTitle === row.title) {
      continue;
    }

    await db
      .update(events)
      .set({
        title: sanitizedTitle,
        updatedAt: new Date(),
      })
      .where(eq(events.id, row.id));

    updatedCount += 1;
    console.log(`updated ${row.eventernoteEventId}: ${row.title} -> ${sanitizedTitle}`);
  }

  console.log(JSON.stringify({ total: rows.length, updatedCount }, null, 2));
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
