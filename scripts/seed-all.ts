import { pathToFileURL } from "node:url";
import { importSongSeed } from "./import-song-seed";
import { seedBands } from "./seed-bands";
import { seedVisibilityRules } from "./seed-visibility-rules";

export async function seedAll() {
  await seedBands();
  await importSongSeed();
  await seedVisibilityRules();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedAll().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
