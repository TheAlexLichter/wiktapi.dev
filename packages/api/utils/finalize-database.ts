import type Database from "better-sqlite3";
import {
  DATABASE_SCHEMA_VERSION,
  ENTRIES_INDEXES_DDL,
  METADATA_TABLES_DDL,
  OBSOLETE_INDEXES_DDL,
  REBUILD_METADATA_SQL,
} from "./schema.ts";

export interface DatabaseSummary {
  entries: number;
  editions: number;
  languages: number;
}

/** Build all request-time lookup structures before a database is put into service. */
export function finalizeDatabase(db: Database.Database): DatabaseSummary {
  db.exec(ENTRIES_INDEXES_DDL);
  db.exec(OBSOLETE_INDEXES_DDL);

  db.exec(METADATA_TABLES_DDL);
  db.transaction(() => db.exec(REBUILD_METADATA_SQL))();
  db.exec("ANALYZE");

  const { entries } = db.prepare("SELECT COUNT(*) AS entries FROM entries").get() as {
    entries: number;
  };
  const { editions } = db.prepare("SELECT COUNT(*) AS editions FROM editions").get() as {
    editions: number;
  };
  const { languages, representedEntries } = db
    .prepare(
      `SELECT COUNT(*) AS languages, COALESCE(SUM(entry_count), 0) AS representedEntries
       FROM language_stats`,
    )
    .get() as { languages: number; representedEntries: number };

  if (entries === 0 || editions === 0 || languages === 0 || representedEntries !== entries) {
    throw new Error("Database finalization produced inconsistent metadata");
  }

  const integrity = db.pragma("quick_check") as { quick_check: string }[];
  if (integrity.length !== 1 || integrity[0]?.quick_check !== "ok") {
    throw new Error(`Database integrity check failed: ${JSON.stringify(integrity)}`);
  }

  db.pragma(`user_version = ${DATABASE_SCHEMA_VERSION}`);
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
    throw new Error(`Could not finalize database journal: ${String(journalMode)}`);
  }

  return { entries, editions, languages };
}
