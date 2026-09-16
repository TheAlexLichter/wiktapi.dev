import type Database from "better-sqlite3";
import { assertDatabaseReady } from "./database-readiness.ts";
import { describeEditionDifference } from "./editions.ts";
import {
  DATABASE_SCHEMA_VERSION,
  DROP_MANAGED_INDEXES_DDL,
  ENTRIES_INDEXES_DDL,
  METADATA_TABLES_DDL,
  REBUILD_METADATA_SQL,
} from "./schema.ts";

export interface DatabaseSummary {
  entries: number;
  editions: number;
  languages: number;
  freePages: number;
}

export interface FinalizeDatabaseOptions {
  expectedEditions?: readonly string[];
}

/** Build all request-time lookup structures before a database is put into service. */
export function finalizeDatabase(
  db: Database.Database,
  options: FinalizeDatabaseOptions = {},
): DatabaseSummary {
  // A failed or interrupted finalization must never retain a ready marker.
  db.pragma("user_version = 0");

  // Finalization is offline. Truncate the import WAL before index creation so
  // a large covering index is not duplicated in both the database and WAL.
  const [checkpoint] = db.pragma("wal_checkpoint(TRUNCATE)") as {
    busy: number;
    log: number;
    checkpointed: number;
  }[];
  if (!checkpoint || checkpoint.busy !== 0) {
    throw new Error(`Database WAL checkpoint failed: ${JSON.stringify(checkpoint)}`);
  }

  const journalMode = db.pragma("journal_mode = DELETE", { simple: true });
  if (journalMode !== "delete") {
    throw new Error(`Could not prepare database journal for finalization: ${String(journalMode)}`);
  }
  db.pragma("synchronous = NORMAL");

  // Dropped index pages go on SQLite's freelist and can be reused by the new
  // indexes without a VACUUM or additional file growth.
  db.exec(DROP_MANAGED_INDEXES_DDL);
  db.exec(ENTRIES_INDEXES_DDL);

  db.exec(METADATA_TABLES_DDL);
  db.transaction(() => db.exec(REBUILD_METADATA_SQL))();
  db.exec("ANALYZE");

  const { entries } = db.prepare("SELECT COUNT(*) AS entries FROM entries").get() as {
    entries: number;
  };
  const { editions } = db.prepare("SELECT COUNT(*) AS editions FROM editions").get() as {
    editions: number;
  };
  const { representedEditionEntries } = db
    .prepare("SELECT COALESCE(SUM(entry_count), 0) AS representedEditionEntries FROM edition_stats")
    .get() as { representedEditionEntries: number };
  const { languages, representedEntries } = db
    .prepare(
      `SELECT COUNT(*) AS languages, COALESCE(SUM(entry_count), 0) AS representedEntries
       FROM language_stats`,
    )
    .get() as { languages: number; representedEntries: number };

  if (
    entries === 0 ||
    editions === 0 ||
    languages === 0 ||
    representedEditionEntries !== entries ||
    representedEntries !== entries
  ) {
    throw new Error("Database finalization produced inconsistent metadata");
  }

  const loadedEditions = db
    .prepare("SELECT edition FROM editions ORDER BY edition")
    .pluck()
    .all() as string[];
  if (options.expectedEditions) {
    const difference = describeEditionDifference(loadedEditions, options.expectedEditions);
    if (difference) {
      throw new Error(
        `Database edition manifest does not match the complete dataset (${difference})`,
      );
    }
  }

  const integrity = db.pragma("quick_check") as { quick_check: string }[];
  if (integrity.length !== 1 || integrity[0]?.quick_check !== "ok") {
    throw new Error(`Database integrity check failed: ${JSON.stringify(integrity)}`);
  }

  db.pragma(`user_version = ${DATABASE_SCHEMA_VERSION}`);
  assertDatabaseReady(db, { expectedEditions: options.expectedEditions });

  const freePages = db.pragma("freelist_count", { simple: true }) as number;
  return { entries, editions, languages, freePages };
}
