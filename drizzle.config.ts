import { defineConfig } from "drizzle-kit";

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL is required to run Drizzle migrations.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DIRECT_URL,
  },
});
