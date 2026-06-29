import { pathToFileURL } from "node:url";
import {
  buildEventRankingSnapshot,
  saveEventRankingSnapshotDirect,
} from "../src/lib/eventernote/event-ranking-snapshot";

export async function refreshEventRanking() {
  const payload = await buildEventRankingSnapshot();
  await saveEventRankingSnapshotDirect(payload);
  console.info(
    `[event-ranking] saved ${payload.events.length} events through ${payload.filteredThrough} to database`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  refreshEventRanking().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
