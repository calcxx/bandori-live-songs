import { pathToFileURL } from "node:url";
import { refreshBandoriActorEventsDirect } from "../src/lib/eventernote/event-ranking-snapshot";

export async function refreshRecentEventSnapshot() {
  const result = await refreshBandoriActorEventsDirect();
  console.info(`[event-recent] indexed ${result.indexedEventCount} events at ${result.updatedAt}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  refreshRecentEventSnapshot().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
