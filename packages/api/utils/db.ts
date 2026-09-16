import Database from "better-sqlite3";
import { resolve } from "node:path";
import { DATABASE_SCHEMA_VERSION } from "./schema.ts";

const dbPath = process.env.DATA_PATH ?? resolve("./data/wiktionary.db");

console.log(`Opening database at ${dbPath}...`);

export const db = new Database(dbPath, { readonly: true });

const schemaVersion = db.pragma("user_version", { simple: true }) as number;
if (schemaVersion !== DATABASE_SCHEMA_VERSION) {
  db.close();
  throw new Error(
    `Database schema version ${schemaVersion} is not supported; expected ${DATABASE_SCHEMA_VERSION}. Rebuild or finalize the database before starting the API.`,
  );
}

// Necessary pragma settings for performance; these are safe for read-only access on a server with at least 2GB of RAM
db.pragma("cache_size = -32000"); // 32MB internal cache
db.pragma("mmap_size = 268435456"); // 256MB memory-mapped I/O (safe for 2GB server)
