import { describe, expect, it } from "vite-plus/test";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertDatabaseReady } from "../utils/database-readiness.ts";
import { db } from "../utils/db.ts";
import { finalizeDatabase } from "../utils/finalize-database.ts";
import { validateDatabaseDeep } from "../utils/database-validation.ts";
import { initializeSearchNormalizerMetadata } from "../utils/database-metadata.ts";
import {
  DATABASE_SCHEMA_VERSION,
  ENTRIES_INSERT_SQL,
  ENTRIES_TABLE_DDL,
  METADATA_TABLES_DDL,
} from "../utils/schema.ts";
import { SEARCH_NORMALIZER_ID } from "../utils/search.ts";

describe("database readiness", () => {
  it("accepts a finalized database and an exact expected-edition manifest", () => {
    expect(() => assertDatabaseReady(db)).not.toThrow();
    expect(() => assertDatabaseReady(db, { expectedEditions: ["en", "fr"] })).not.toThrow();
  });

  it("rejects a database that was not finalized", () => {
    const unfinalized = new Database(":memory:");
    try {
      expect(() => assertDatabaseReady(unfinalized)).toThrow(/schema version 0/);
    } finally {
      unfinalized.close();
    }
  });

  it("refuses to finalize a database without materialized Unicode search keys", () => {
    const legacy = new Database(":memory:");
    try {
      legacy.exec("CREATE TABLE entries (id INTEGER PRIMARY KEY, word TEXT NOT NULL)");
      expect(() => finalizeDatabase(legacy)).toThrow(/rebuild it from source data/);
    } finally {
      legacy.close();
    }
  });

  it("refuses to finalize unversioned materialized search keys", () => {
    const unversioned = new Database(":memory:");
    try {
      unversioned.exec(ENTRIES_TABLE_DDL);
      unversioned.exec(METADATA_TABLES_DDL);
      expect(() => finalizeDatabase(unversioned)).toThrow(/search normalizer null/);
    } finally {
      unversioned.close();
    }
  });

  it("rejects a ready version marker without the required request-time objects", () => {
    const incomplete = new Database(":memory:");
    try {
      incomplete.pragma(`user_version = ${DATABASE_SCHEMA_VERSION}`);
      expect(() => assertDatabaseReady(incomplete)).toThrow(/missing/);
    } finally {
      incomplete.close();
    }
  });

  it("rejects a partial database when the complete manifest is required", () => {
    expect(() => assertDatabaseReady(db, { expectedEditions: ["en"] })).toThrow(/unexpected: fr/);
  });

  it("only marks a database ready after the expected manifest finalizes", () => {
    const directory = mkdtempSync(join(tmpdir(), "wiktapi-finalize-"));
    const candidate = new Database(join(directory, "candidate.db"));
    try {
      candidate.pragma("journal_mode = WAL");
      candidate.exec(ENTRIES_TABLE_DDL);
      candidate.exec(METADATA_TABLES_DDL);
      initializeSearchNormalizerMetadata(candidate);
      const insert = candidate.prepare(ENTRIES_INSERT_SQL);
      for (const [word, lang_code, lang] of [
        ["test", "en", "English"],
        ["test-label", "en", "Modern English"],
        ["essai", "fr", "French"],
      ] as const) {
        insert.run({
          word,
          normalized_word: word,
          lang_code,
          lang,
          edition: "en",
          pos: "noun",
          senses: "[]",
          sounds: null,
          translations: null,
          forms: null,
        });
      }

      expect(() => finalizeDatabase(candidate, { expectedEditions: ["en", "fr"] })).toThrow(
        /missing: fr/,
      );
      expect(candidate.pragma("user_version", { simple: true })).toBe(0);

      finalizeDatabase(candidate, { expectedEditions: ["en"] });
      expect(() => assertDatabaseReady(candidate, { expectedEditions: ["en"] })).not.toThrow();
      expect(
        validateDatabaseDeep(candidate, {
          expectedEditions: ["en"],
          minimumEditionEntries: 1,
        }).entries,
      ).toBe(3);

      expect(
        candidate
          .prepare("SELECT lang_code, lang, entry_count FROM language_stats ORDER BY lang_code")
          .all(),
      ).toEqual([
        { lang_code: "en", lang: "Modern English", entry_count: 2 },
        { lang_code: "fr", lang: "French", entry_count: 1 },
      ]);

      candidate.exec(
        `UPDATE language_stats
         SET entry_count = CASE lang_code WHEN 'en' THEN 1 WHEN 'fr' THEN 2 END`,
      );
      expect(() => validateDatabaseDeep(candidate)).toThrow(/Per-language metadata/);
      candidate.exec(
        `UPDATE language_stats
         SET entry_count = CASE lang_code WHEN 'en' THEN 2 WHEN 'fr' THEN 1 END`,
      );

      candidate.exec("UPDATE language_stats SET lang = 'Incorrect' WHERE lang_code = 'fr'");
      expect(() => validateDatabaseDeep(candidate)).toThrow(/Per-language metadata/);
      candidate.exec("UPDATE language_stats SET lang = 'French' WHERE lang_code = 'fr'");

      candidate.exec("UPDATE database_metadata SET value = 'obsolete-normalizer'");
      expect(() => assertDatabaseReady(candidate)).toThrow(/obsolete-normalizer/);
      candidate.prepare("UPDATE database_metadata SET value = ?").run(SEARCH_NORMALIZER_ID);

      candidate.exec("UPDATE edition_stats SET entry_count = 2");
      expect(() => validateDatabaseDeep(candidate)).toThrow(/metadata does not match/);
      candidate.exec("UPDATE edition_stats SET entry_count = 3");

      candidate.exec(
        "DROP INDEX idx_search_prefix; CREATE INDEX idx_search_prefix ON entries(word)",
      );
      expect(() => assertDatabaseReady(candidate)).toThrow(/unexpected definition/);
    } finally {
      candidate.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
