import { pathToFileURL } from "node:url";
import { connectDatabase } from "../src/lib/db/core";
import { appSettings } from "../src/lib/db/schema";
import {
  eventVisibilityRulesFilePath,
  readEventVisibilityRulesFromFile,
} from "../src/lib/events/event-visibility-rules-store";

const eventVisibilityRulesSettingKey = "event_visibility_rules";

export async function seedVisibilityRules() {
  const rules = await readEventVisibilityRulesFromFile(eventVisibilityRulesFilePath);
  const { db, sql: connection } = connectDatabase(true);

  try {
    // ponytail: onConflictDoNothing — seed fills empty state only; never clobber admin UI edits.
    await db
      .insert(appSettings)
      .values({
        key: eventVisibilityRulesSettingKey,
        payload: rules,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedVisibilityRules().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
