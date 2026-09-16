import type Database from "better-sqlite3";
import { describeEditionDifference } from "./editions.ts";
import { DATABASE_SCHEMA_VERSION } from "./schema.ts";

const REQUIRED_OBJECTS = [
  ["table", "entries"],
  ["table", "editions"],
  ["table", "edition_stats"],
  ["table", "language_stats"],
  ["index", "idx_edition_word"],
  ["index", "idx_search_prefix"],
  ["index", "idx_search_lang_prefix"],
] as const;

const EXPECTED_COLUMNS: Record<
  string,
  readonly { name: string; type: string; notnull: number; pk: number }[]
> = {
  entries: [
    { name: "id", type: "INTEGER", notnull: 0, pk: 1 },
    { name: "word", type: "TEXT", notnull: 1, pk: 0 },
    { name: "lang_code", type: "TEXT", notnull: 1, pk: 0 },
    { name: "lang", type: "TEXT", notnull: 0, pk: 0 },
    { name: "edition", type: "TEXT", notnull: 1, pk: 0 },
    { name: "pos", type: "TEXT", notnull: 0, pk: 0 },
    { name: "senses", type: "TEXT", notnull: 1, pk: 0 },
    { name: "sounds", type: "TEXT", notnull: 0, pk: 0 },
    { name: "translations", type: "TEXT", notnull: 0, pk: 0 },
    { name: "forms", type: "TEXT", notnull: 0, pk: 0 },
  ],
  editions: [{ name: "edition", type: "TEXT", notnull: 0, pk: 1 }],
  edition_stats: [
    { name: "edition", type: "TEXT", notnull: 0, pk: 1 },
    { name: "entry_count", type: "INTEGER", notnull: 1, pk: 0 },
  ],
  language_stats: [
    { name: "lang_code", type: "TEXT", notnull: 1, pk: 0 },
    { name: "lang", type: "TEXT", notnull: 0, pk: 0 },
    { name: "entry_count", type: "INTEGER", notnull: 1, pk: 0 },
  ],
};

const EXPECTED_INDEX_SQL: Record<string, string> = {
  idx_edition_word: "CREATE INDEX idx_edition_word ON entries (edition, word)",
  idx_search_prefix:
    "CREATE INDEX idx_search_prefix ON entries (edition, lower(word), word, lang_code, lang, pos)",
  idx_search_lang_prefix:
    "CREATE INDEX idx_search_lang_prefix ON entries (edition, lang_code, lower(word), word, lang, pos)",
};

function normalizeSql(sql: string): string {
  return sql
    .replace(/\bIF\s+NOT\s+EXISTS\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .replace(/;$/, "")
    .trim()
    .toLowerCase();
}

export interface DatabaseReadinessOptions {
  expectedEditions?: readonly string[];
}

/**
 * Validate the inexpensive readiness markers checked before serving or
 * swapping a database. The expensive integrity and metadata checks happen in
 * finalization before user_version is advanced.
 */
export function assertDatabaseReady(
  db: Database.Database,
  options: DatabaseReadinessOptions = {},
): void {
  const schemaVersion = db.pragma("user_version", { simple: true }) as number;
  if (schemaVersion !== DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${schemaVersion} is not supported; expected ${DATABASE_SCHEMA_VERSION}. Rebuild or finalize the database before starting the API.`,
    );
  }

  const objects = db
    .prepare("SELECT type, name FROM sqlite_master WHERE type IN ('table', 'index')")
    .all() as { type: string; name: string }[];
  const objectKeys = new Set(objects.map(({ type, name }) => `${type}:${name}`));
  const missingObjects = REQUIRED_OBJECTS.filter(
    ([type, name]) => !objectKeys.has(`${type}:${name}`),
  ).map(([type, name]) => `${type} ${name}`);

  if (missingObjects.length > 0) {
    throw new Error(`Database is marked ready but is missing: ${missingObjects.join(", ")}`);
  }

  for (const [table, expectedColumns] of Object.entries(EXPECTED_COLUMNS)) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }[];
    const actual = columns.map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));
    if (JSON.stringify(actual) !== JSON.stringify(expectedColumns)) {
      throw new Error(
        `Database table ${table} has an unexpected column definition: ${JSON.stringify(actual)}`,
      );
    }
  }

  const indexDefinitions = db
    .prepare(
      `SELECT name, sql FROM sqlite_master
       WHERE type = 'index' AND name IN ('idx_edition_word', 'idx_search_prefix', 'idx_search_lang_prefix')`,
    )
    .all() as { name: string; sql: string }[];
  const indexSql = new Map(indexDefinitions.map(({ name, sql }) => [name, normalizeSql(sql)]));
  for (const [name, expectedSql] of Object.entries(EXPECTED_INDEX_SQL)) {
    if (indexSql.get(name) !== normalizeSql(expectedSql)) {
      throw new Error(`Database index ${name} has an unexpected definition`);
    }
  }

  if (options.expectedEditions) {
    const editions = db
      .prepare("SELECT edition FROM editions ORDER BY edition")
      .pluck()
      .all() as string[];
    const difference = describeEditionDifference(editions, options.expectedEditions);
    if (difference) {
      throw new Error(
        `Database edition manifest does not match the complete dataset (${difference})`,
      );
    }
  }
}
