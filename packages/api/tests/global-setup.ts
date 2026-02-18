import Database from "better-sqlite3";
import { mkdirSync, rmSync } from "node:fs";
import { ENTRIES_TABLE_DDL, ENTRIES_INDEXES_DDL, ENTRIES_INSERT_SQL } from "../utils/schema.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
export const TEST_DB_PATH = resolve(dir, "../data/test.db");

const SAMPLE_ENTRIES = [
  {
    word: "chat",
    lang_code: "fr",
    lang: "French",
    edition: "en",
    pos: "noun",
    senses: JSON.stringify([{ glosses: ["cat"], examples: [{ text: "Le chat dort." }], tags: [] }]),
    sounds: JSON.stringify([{ ipa: "/ʃa/", audio: null, tags: [] }]),
    translations: null,
    forms: JSON.stringify([{ form: "chats", tags: ["plural"] }]),
  },
  {
    word: "Haus",
    lang_code: "de",
    lang: "German",
    edition: "en",
    pos: "noun",
    senses: JSON.stringify([{ glosses: ["house", "building"], examples: [], tags: [] }]),
    sounds: JSON.stringify([{ ipa: "/haʊ̯s/", audio: null, tags: [] }]),
    translations: null,
    forms: JSON.stringify([
      { form: "Hauses", tags: ["genitive", "singular"] },
      { form: "Häuser", tags: ["plural"] },
    ]),
  },
  {
    word: "run",
    lang_code: "en",
    lang: "English",
    edition: "en",
    pos: "noun",
    senses: JSON.stringify([{ glosses: ["act of running"], examples: [], tags: [] }]),
    sounds: JSON.stringify([{ ipa: "/ɹʌn/", audio: null, tags: [] }]),
    translations: null,
    forms: null,
  },
  {
    word: "run",
    lang_code: "en",
    lang: "English",
    edition: "en",
    pos: "verb",
    senses: JSON.stringify([
      {
        glosses: ["to move quickly on foot"],
        examples: [{ text: "I run every day." }],
        tags: [],
      },
    ]),
    sounds: JSON.stringify([{ ipa: "/ɹʌn/", audio: null, tags: [] }]),
    translations: JSON.stringify([{ lang: "French", lang_code: "fr", word: "courir" }]),
    forms: JSON.stringify([{ form: "ran", tags: ["past"] }]),
  },
  {
    word: "chat",
    lang_code: "fr",
    lang: "French",
    edition: "fr",
    pos: "noun",
    senses: JSON.stringify([{ glosses: ["chat domestique"], examples: [], tags: [] }]),
    sounds: JSON.stringify([{ ipa: "/ʃa/", audio: null, tags: [] }]),
    translations: JSON.stringify([{ lang: "English", lang_code: "en", word: "cat" }]),
    forms: JSON.stringify([{ form: "chats", tags: ["plural"] }]),
  },
];

export function setup() {
  mkdirSync(resolve(dir, "../data"), { recursive: true });

  const db = new Database(TEST_DB_PATH);
  db.exec(ENTRIES_TABLE_DDL);
  db.exec(ENTRIES_INDEXES_DDL);

  const insert = db.prepare(ENTRIES_INSERT_SQL);
  const insertMany = db.transaction((rows: typeof SAMPLE_ENTRIES) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(SAMPLE_ENTRIES);
  db.close();
}

export function teardown() {
  rmSync(TEST_DB_PATH, { force: true });
}
