import { describe, expect, it } from "vite-plus/test";
import Database from "better-sqlite3";
import { compareEditionCounts, readEditionCounts } from "../utils/database-validation.ts";
import { ENTRIES_INSERT_SQL, ENTRIES_TABLE_DDL, METADATA_TABLES_DDL } from "../utils/schema.ts";

describe("edition count regression comparison", () => {
  it("flags only regressions beyond the configured threshold", () => {
    const result = compareEditionCounts(
      [
        { edition: "en", entryCount: 1_000 },
        { edition: "fr", entryCount: 1_000 },
      ],
      [
        { edition: "en", entryCount: 750 },
        { edition: "fr", entryCount: 749 },
        { edition: "de", entryCount: 500 },
      ],
      0.25,
    );

    expect(result.map(({ edition, regressed }) => [edition, regressed])).toEqual([
      ["en", false],
      ["fr", true],
      ["de", false],
    ]);
    expect(result[2]?.changeFraction).toBeNull();
  });

  it("rejects invalid regression thresholds", () => {
    expect(() => compareEditionCounts([], [], -0.1)).toThrow();
    expect(() => compareEditionCounts([], [], 1)).toThrow();
    expect(() => compareEditionCounts([], [], Number.NaN)).toThrow();
    expect(() => compareEditionCounts([], [], Number.POSITIVE_INFINITY)).toThrow();
    expect(() => compareEditionCounts([], [], Number.NEGATIVE_INFINITY)).toThrow();
  });

  it("prefers finalized counts and falls back to entries for a legacy database", () => {
    const database = new Database(":memory:");
    try {
      database.exec(ENTRIES_TABLE_DDL);
      database.exec(METADATA_TABLES_DDL);
      const insert = database.prepare(ENTRIES_INSERT_SQL);
      for (const word of ["one", "two"]) {
        insert.run({
          word,
          normalized_word: word,
          lang_code: "en",
          lang: "English",
          edition: "en",
          pos: "noun",
          senses: "[]",
          sounds: null,
          translations: null,
          forms: null,
        });
      }
      database.exec("INSERT INTO edition_stats (edition, entry_count) VALUES ('en', 99)");

      expect(readEditionCounts(database, { useFinalizedMetadata: true })).toEqual([
        { edition: "en", entryCount: 99 },
      ]);

      database.exec("DROP TABLE edition_stats");
      expect(readEditionCounts(database, { useFinalizedMetadata: true })).toEqual([
        { edition: "en", entryCount: 2 },
      ]);
    } finally {
      database.close();
    }
  });
});
