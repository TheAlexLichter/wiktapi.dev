/**
 * Import wiktextract JSONL files into the SQLite database.
 *
 * Usage:
 *   vp run @wiktapi/api#import                                                  # imports all data/jsonl/*.jsonl
 *   vp run @wiktapi/api#import -- --edition en                                  # imports only data/jsonl/en.jsonl
 *   vp run @wiktapi/api#import -- --edition en --fresh                          # drops and recreates the table first
 *   vp run @wiktapi/api#import -- --output data/wiktionary.db.new               # write to a staging file
 *   vp run @wiktapi/api#import -- --output data/wiktionary.db.new --skip-indexes # skip index build (run separately)
 */

import { Effect, Console } from "effect";
import Database from "better-sqlite3";
import { ENTRIES_TABLE_DDL, ENTRIES_INDEXES_DDL, ENTRIES_INSERT_SQL } from "../utils/schema.ts";
import { createReadStream } from "node:fs";
import { readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const DATA_DIR = resolve("./data");
const JSONL_DIR = resolve(DATA_DIR, "jsonl");
const DEFAULT_DB_PATH = resolve(DATA_DIR, "wiktionary.db");
const BATCH_SIZE = 5000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntryRow {
  word: string;
  lang_code: string;
  lang: string | null;
  edition: string;
  pos: string | null;
  senses: string;
  sounds: string | null;
  translations: string | null;
  forms: string | null;
}

// ── Database setup ───────────────────────────────────────────────────────────

const makeDatabase = (dbPath: string, fresh: boolean) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => {
        const db = new Database(dbPath);
        db.pragma("journal_mode = WAL");
        db.pragma("synchronous = OFF");
        db.pragma("cache_size = -65536"); // 64 MB
        db.pragma("temp_store = MEMORY");
        db.pragma("mmap_size = 268435456"); // 256 MB

        if (fresh) db.exec("DROP TABLE IF EXISTS entries");

        db.exec(ENTRIES_TABLE_DDL);

        return db;
      },
      catch: (e) => new Error(`Failed to open database: ${String(e)}`),
    }),
    (db) => Effect.sync(() => db.close()),
  );

// ── Parsing ───────────────────────────────────────────────────────────────────

function parseEntry(line: string, edition: string): EntryRow | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  const word = parsed.word as string | undefined;
  const lang_code = parsed.lang_code as string | undefined;
  if (!word || !lang_code) return null;

  const toJsonOrNull = (val: unknown) => {
    const arr = (val as unknown[]) ?? [];
    return arr.length ? JSON.stringify(arr) : null;
  };

  return {
    word,
    lang_code,
    lang: (parsed.lang as string | null) ?? null,
    edition,
    pos: (parsed.pos as string | null) ?? null,
    senses: JSON.stringify(parsed.senses ?? []),
    sounds: toJsonOrNull(parsed.sounds),
    translations: toJsonOrNull(parsed.translations),
    forms: toJsonOrNull(parsed.forms),
  };
}

// ── Import ───────────────────────────────────────────────────────────────────

const importJsonl = (
  db: Database.Database,
  filePath: string,
  edition: string,
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    yield* Console.log(`[${edition}] Importing ${filePath} …`);

    const insert = db.prepare(ENTRIES_INSERT_SQL);

    const insertMany = db.transaction((rows: EntryRow[]) => {
      for (const row of rows) insert.run(row);
    });

    const { count, skipped } = yield* Effect.tryPromise({
      try: async () => {
        const rl = createInterface({
          input: createReadStream(filePath, { encoding: "utf-8" }),
          crlfDelay: Infinity,
        });

        let count = 0;
        let skipped = 0;
        const batch: EntryRow[] = [];

        try {
          for await (const line of rl) {
            if (!line.trim()) continue;

            const row = parseEntry(line, edition);
            if (!row) {
              skipped++;
              continue;
            }

            batch.push(row);

            if (batch.length >= BATCH_SIZE) {
              insertMany(batch);
              count += batch.length;
              batch.length = 0;
              if (count % 50_000 === 0) {
                process.stdout.write(`  ${count.toLocaleString()} rows inserted …\r`);
              }
            }
          }
        } finally {
          rl.close();
        }

        if (batch.length > 0) {
          insertMany(batch);
          count += batch.length;
        }

        return { count, skipped };
      },
      catch: (e) => new Error(`Failed to import ${filePath}: ${String(e)}`),
    });

    yield* Console.log(
      `[${edition}] Done — ${count.toLocaleString()} rows inserted, ${skipped} skipped`,
    );
  });

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(): {
  targetEdition: string | null;
  fresh: boolean;
  dbPath: string;
  skipIndexes: boolean;
} {
  const args = process.argv.slice(2);
  const editionIdx = args.indexOf("--edition");
  const outputIdx = args.indexOf("--output");
  return {
    targetEdition: editionIdx !== -1 ? (args[editionIdx + 1] ?? null) : null,
    fresh: args.includes("--fresh"),
    skipIndexes: args.includes("--skip-indexes"),
    dbPath: outputIdx !== -1 ? resolve(args[outputIdx + 1] ?? DEFAULT_DB_PATH) : DEFAULT_DB_PATH,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const main: Effect.Effect<void, Error> = Effect.scoped(
  Effect.gen(function* () {
    const { targetEdition, fresh, dbPath, skipIndexes } = parseArgs();

    if (fresh) yield* Console.log("--fresh: dropping existing entries table …");

    const db = yield* makeDatabase(dbPath, fresh);

    let files: { path: string; edition: string }[];

    if (targetEdition) {
      files = [{ path: resolve(JSONL_DIR, `${targetEdition}.jsonl`), edition: targetEdition }];
    } else {
      const entries = yield* Effect.tryPromise({
        try: () => readdir(JSONL_DIR),
        catch: (e) => new Error(`Failed to read JSONL directory: ${String(e)}`),
      });
      files = entries
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => ({ path: resolve(JSONL_DIR, f), edition: f.replace(/\.jsonl$/, "") }));
    }

    if (files.length === 0) {
      yield* Effect.fail(
        new Error("No JSONL files found. Run `vp run @wiktapi/api#download` first."),
      );
    }

    yield* Effect.forEach(
      files,
      ({ path, edition }) =>
        Effect.gen(function* () {
          yield* importJsonl(db, path, edition);
          yield* Effect.tryPromise({
            try: () => unlink(path),
            catch: (e) => new Error(`Failed to delete ${path}: ${String(e)}`),
          });
          yield* Console.log(`[${edition}] Deleted ${path}`);
        }),
      { concurrency: 1 },
    );

    if (skipIndexes) {
      yield* Console.log("\nSkipping indexes (run `vp run @wiktapi/api#index` separately).");
    } else {
      yield* Console.log("\nBuilding indexes …");
      db.exec(ENTRIES_INDEXES_DDL);
    }

    const { count } = db.prepare("SELECT COUNT(*) AS count FROM entries").get() as {
      count: number;
    };
    yield* Console.log(`\nDatabase ready at ${dbPath} — ${count.toLocaleString()} total entries`);
    yield* Console.log(
      "\nReminder: purge the Cloudflare cache so clients get fresh data (dashboard → Caching → Purge Everything).",
    );
  }),
);

Effect.runPromise(main).catch((err) => {
  console.error(err);
  process.exit(1);
});
