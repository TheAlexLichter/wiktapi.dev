import type Database from "better-sqlite3";
import { SEARCH_NORMALIZER_ID } from "./search.ts";
import { SEARCH_NORMALIZER_METADATA_KEY } from "./schema.ts";

export function readSearchNormalizerId(db: Database.Database): string | null {
  const hasMetadataTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'database_metadata'")
    .get();
  if (!hasMetadataTable) return null;

  return (
    (db
      .prepare("SELECT value FROM database_metadata WHERE key = ?")
      .pluck()
      .get(SEARCH_NORMALIZER_METADATA_KEY) as string | undefined) ?? null
  );
}

export function initializeSearchNormalizerMetadata(db: Database.Database): void {
  db.prepare("INSERT INTO database_metadata (key, value) VALUES (?, ?)").run(
    SEARCH_NORMALIZER_METADATA_KEY,
    SEARCH_NORMALIZER_ID,
  );
}

export function assertSearchNormalizerCompatible(db: Database.Database): void {
  const actual = readSearchNormalizerId(db);
  if (actual !== SEARCH_NORMALIZER_ID) {
    throw new Error(
      `Database search normalizer ${JSON.stringify(actual)} is not supported; expected ${JSON.stringify(SEARCH_NORMALIZER_ID)}. Rebuild the database from source data.`,
    );
  }
}
