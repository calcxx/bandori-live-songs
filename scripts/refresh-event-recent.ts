import { pathToFileURL } from "node:url";
import {
  buildRecentEventRankingSnapshot,
  saveRecentEventSnapshotDirect,
} from "../src/lib/eventernote/event-ranking-snapshot";

export async function refreshRecentEventSnapshot() {
  const payload = await buildRecentEventRankingSnapshot();
  await saveRecentEventSnapshotDirect(payload);
  console.info(
    `[event-recent] saved ${payload.events.length} events for ${payload.filteredFrom} to ${payload.filteredThrough} to database`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  refreshRecentEventSnapshot().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
