import { eq } from "drizzle-orm";
import { setTimeout as sleep } from "node:timers/promises";
import { connectDatabase } from "../src/lib/db/core";
import { eventernoteUserCache } from "../src/lib/db/schema";
import { fetchEventernoteUserProfile } from "../src/lib/eventernote/client";

async function main() {
  const { db, sql } = connectDatabase(true);
  const rows = await db
    .select({
      userId: eventernoteUserCache.userId,
    })
    .from(eventernoteUserCache)
    .orderBy(eventernoteUserCache.userId);

  let updatedCount = 0;
  let failedCount = 0;
  let cursor = 0;
  const concurrency = 8;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= rows.length) {
        return;
      }

      const row = rows[index];

      try {
        const remote = await fetchEventernoteUserProfile(row.userId);

        await db
          .update(eventernoteUserCache)
          .set({
            displayId: remote.displayId ?? row.userId,
            displayName: remote.displayName,
          })
          .where(eq(eventernoteUserCache.userId, row.userId));

        updatedCount += 1;
        console.log(
          `[${index + 1}/${rows.length}] updated ${row.userId} -> display_id=${remote.displayId ?? row.userId}, nickname=${remote.displayName ?? "无"}`,
        );
        await sleep(100);
      } catch (error) {
        failedCount += 1;
        console.error(`[${index + 1}/${rows.length}] failed ${row.userId}:`, error);
        await sleep(200);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));

  console.log(JSON.stringify({ total: rows.length, updatedCount, failedCount }, null, 2));
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
