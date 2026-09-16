/**
 * Build indexes on the SQLite database.
 *
 * Usage:
 *   vp run @wiktapi/api#index                                    # indexes data/wiktionary.db
 *   vp run @wiktapi/api#index -- --output data/wiktionary.db.new # indexes a staging file
 */

import { Effect, Console } from "effect";
import Database from "better-sqlite3";
import { finalizeDatabase } from "../utils/finalize-database.ts";
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
  db.pragma("synchronous = OFF");
  db.pragma("cache_size = -65536"); // 64 MB
  db.pragma("temp_store = MEMORY");
  db.pragma("mmap_size = 268435456"); // 256 MB

  yield* Console.log(`Finalizing indexes and metadata on ${dbPath} …`);
  const summary = finalizeDatabase(db);
  yield* Console.log(
    `Done — ${summary.entries.toLocaleString()} entries, ${summary.editions.toLocaleString()} editions, ${summary.languages.toLocaleString()} languages`,
  );

  db.close();
});

Effect.runPromise(main).catch((err) => {
  console.error(err);
  process.exit(1);
});
