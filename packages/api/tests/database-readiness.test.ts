import { describe, expect, it } from "vite-plus/test";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertDatabaseReady } from "../utils/database-readiness.ts";
import { db } from "../utils/db.ts";
import { finalizeDatabase } from "../utils/finalize-database.ts";
import { validateDatabaseDeep } from "../utils/database-validation.ts";
import { ENTRIES_INSERT_SQL, ENTRIES_TABLE_DDL, METADATA_TABLES_DDL } from "../utils/schema.ts";

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

  it("rejects a ready version marker without the required request-time objects", () => {
    const incomplete = new Database(":memory:");
    try {
      incomplete.pragma("user_version = 2");
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
      candidate.prepare(ENTRIES_INSERT_SQL).run({
        word: "test",
        lang_code: "en",
        lang: "English",
        edition: "en",
        pos: "noun",
        senses: "[]",
        sounds: null,
        translations: null,
        forms: null,
      });

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
      ).toBe(1);

      candidate.exec("UPDATE edition_stats SET entry_count = 2");
      expect(() => validateDatabaseDeep(candidate)).toThrow(/metadata does not match/);
      candidate.exec("UPDATE edition_stats SET entry_count = 1");

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
