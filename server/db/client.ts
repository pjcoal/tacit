import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

let dbPromise: Promise<Db> | null = null;

/**
 * Production requires DATABASE_URL. In development (and tests) we fall back to
 * an embedded PGlite database so billing flows can be exercised end-to-end
 * without provisioning Postgres. PGlite migrations are applied automatically;
 * for a real Postgres run `npm run db:migrate`.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL) || process.env.NODE_ENV !== "production";
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("Database not configured (set DATABASE_URL).");
  }
}

export function getDb(): Promise<Db> {
  if (!isDatabaseConfigured()) return Promise.reject(new DatabaseNotConfiguredError());
  dbPromise ??= connect().catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { max: 10, prepare: false });
    return drizzle(client, { schema }) as unknown as Db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite"));
  mkdirSync(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db as unknown as Db;
}

/** Test helper: an isolated in-memory database with migrations applied. */
export async function createMemoryDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db as unknown as Db;
}

export { schema };
