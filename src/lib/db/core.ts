import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DatabaseHandle = ReturnType<typeof drizzle<typeof schema>>;
type SqlHandle = postgres.Sql<Record<string, never>>;

declare global {
  var __bdrSql: SqlHandle | undefined;
  var __bdrDb: DatabaseHandle | undefined;
}

function getConnectionString(preferDirect = false) {
  const envKey = preferDirect ? "DIRECT_URL" : "DATABASE_URL";
  const connectionString = process.env[envKey] ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL must be configured.");
  }

  return connectionString;
}

function getPoolMax() {
  const rawValue = process.env.DATABASE_POOL_MAX;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed;
  }

  return 5;
}

export function connectDatabase(preferDirect = false) {
  const connectionString = getConnectionString(preferDirect);
  const sql = postgres(connectionString, {
    max: getPoolMax(),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
  });

  return {
    sql,
    db: drizzle(sql, { schema }),
  };
}

export function getDb() {
  if (!globalThis.__bdrSql || !globalThis.__bdrDb) {
    const { sql, db } = connectDatabase(false);
    globalThis.__bdrSql = sql;
    globalThis.__bdrDb = db;
  }

  return globalThis.__bdrDb;
}
