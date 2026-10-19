/** Usage: npx tsx scripts/sync-recent-songs.ts --since=2026-08-15 [--apply] */
import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";

async function main() {
  loadEnvConfig(process.cwd());
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply" && !arg.startsWith("--since="))) {
    throw new Error("Usage: tsx scripts/sync-recent-songs.ts [--since=YYYY-MM-DD] [--apply]");
  }
  const { syncRecentMusicBrainzSongs } = await import("../src/lib/musicbrainz/recent-songs-sync");
  try {
    const startedAt = Date.now();
    const result = await syncRecentMusicBrainzSongs({
      sinceDate: args.find((arg) => arg.startsWith("--since="))?.slice(8),
      dryRun: !args.includes("--apply"),
      fetchBudgetMs: 15 * 60_000,
      onBand: console.log,
    });
    const reportPath = `/tmp/bdr-songs-sync-${Date.now()}.json`;
    await writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, decisions: undefined, durationMs: Date.now() - startedAt, reportPath }, null, 2));
    if (result.errors.length) process.exitCode = 1;
  } finally {
    await globalThis.__bdrSql?.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
