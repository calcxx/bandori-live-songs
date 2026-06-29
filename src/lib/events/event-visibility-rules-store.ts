import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  emptyEventVisibilityRules,
  eventVisibilityRulesSchema,
  type EventVisibilityRules,
} from "@/lib/events/event-visibility";

const eventVisibilityRulesSettingKey = "event_visibility_rules";

// ponytail: JSON file is a one-time seed for `scripts/seed-visibility-rules.ts`,
// not a runtime source of truth. Runtime reads only the DB.
export const eventVisibilityRulesFilePath = path.join(
  process.cwd(),
  "src",
  "data",
  "event-visibility-rules.json",
);

export type EventVisibilityRulesFormInput = {
  hiddenTitleKeywordsText: string;
  hiddenEventernoteEventIdsText: string;
};

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

export function parseEventVisibilityRulesForm({
  hiddenTitleKeywordsText,
  hiddenEventernoteEventIdsText,
}: EventVisibilityRulesFormInput): EventVisibilityRules {
  const hiddenTitleKeywords = uniqueValues(
    hiddenTitleKeywordsText
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
  const hiddenEventernoteEventIds = uniqueValues(
    hiddenEventernoteEventIdsText
      .split(/[\s,，]+/u)
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  );

  return eventVisibilityRulesSchema.parse({
    version: 1,
    hiddenTitleKeywords,
    hiddenEventernoteEventIds,
  });
}

export function eventVisibilityRulesToFormText(rules: EventVisibilityRules): EventVisibilityRulesFormInput {
  return {
    hiddenTitleKeywordsText: rules.hiddenTitleKeywords.join("\n"),
    hiddenEventernoteEventIdsText: rules.hiddenEventernoteEventIds.join("\n"),
  };
}

export async function readEventVisibilityRulesFromFile(filePath = eventVisibilityRulesFilePath) {
  const payload = JSON.parse(await readFile(filePath, "utf8"));
  return eventVisibilityRulesSchema.parse(payload);
}

export async function readEventVisibilityRulesFromDb(db?: Awaited<ReturnType<typeof getDb>>) {
  const [{ eq }, { appSettings }] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db/schema"),
  ]);
  const resolvedDb = db ?? (await getDb());
  const [row] = await resolvedDb
    .select({ payload: appSettings.payload })
    .from(appSettings)
    .where(eq(appSettings.key, eventVisibilityRulesSettingKey))
    .limit(1);

  return row ? eventVisibilityRulesSchema.parse(row.payload) : null;
}

export async function readEventVisibilityRules() {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    return emptyEventVisibilityRules;
  }
  // ponytail: DB is the only runtime source. Missing row = empty rules (seed not run yet).
  return (await readEventVisibilityRulesFromDb()) ?? emptyEventVisibilityRules;
}

export async function writeEventVisibilityRules(rules: EventVisibilityRules, db?: Awaited<ReturnType<typeof getDb>>) {
  const { appSettings } = await import("@/lib/db/schema");
  const resolvedDb = db ?? (await getDb());
  const payload = eventVisibilityRulesSchema.parse(rules);
  await resolvedDb
    .insert(appSettings)
    .values({
      key: eventVisibilityRulesSettingKey,
      payload,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        payload,
        updatedAt: new Date(),
      },
    });
}

async function getDb() {
  const { getDb: resolveDb } = await import("@/lib/db/core");
  return resolveDb();
}
