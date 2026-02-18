/**
 * Build indexes on the SQLite database.
 *
 * Usage:
 *   vp run @wiktapi/api#index                                    # indexes data/wiktionary.db
 *   vp run @wiktapi/api#index -- --output data/wiktionary.db.new # indexes a staging file
 */

import { Effect, Console } from "effect";
import Database from "better-sqlite3";
import { ENTRIES_INDEXES_DDL } from "../utils/schema.ts";
import { resolve } from "node:path";

const DATA_DIR = resolve("./data");
const DEFAULT_DB_PATH = resolve(DATA_DIR, "wiktionary.db");

function parseArgs(): { dbPath: string } {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf("--output");
  return {
    dbPath: outputIdx !== -1 ? resolve(args[outputIdx + 1] ?? DEFAULT_DB_PATH) : DEFAULT_DB_PATH,
  };
}

const main: Effect.Effect<void, Error> = Effect.gen(function* () {
  const { dbPath } = parseArgs();

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  yield* Console.log(`Building indexes on ${dbPath} …`);
  db.exec(ENTRIES_INDEXES_DDL);

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM entries").get() as {
    count: number;
  };
  yield* Console.log(`Done — ${count.toLocaleString()} total entries indexed`);

  db.close();
});

Effect.runPromise(main).catch((err) => {
  console.error(err);
  process.exit(1);
});
