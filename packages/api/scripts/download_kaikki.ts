/**
 * Download pre-processed Wiktionary JSONL data from kaikki.org.
 *
 * Data is already wiktextract-processed — no local dump download or Python needed.
 * Source: https://kaikki.org/dictionary/rawdata.html
 *
 * Usage:
 *   vp run @wiktapi/api#download                          # downloads en (English Wiktionary, all languages)
 *   vp run @wiktapi/api#download -- --all                 # downloads all available editions (~20)
 *   vp run @wiktapi/api#download -- --editions en,fr,de
 *   vp run @wiktapi/api#download -- --all --force         # re-download even if already present
 */

import { Effect, Console } from "effect";
import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink, access } from "node:fs/promises";
import { resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const JSONL_DIR = resolve("./data/jsonl");

// All editions available on kaikki.org/dictionary/rawdata.html
const ALL_EDITIONS = [
  "en",
  "zh",
  "cs",
  "nl",
  "fr",
  "de",
  "el",
  "id",
  "it",
  "ja",
  "ko",
  "ku",
  "ms",
  "pl",
  "pt",
  "ru",
  "simple",
  "es",
  "th",
  "tr",
  "vi",
];

function kaikkiUrl(edition: string): string {
  if (edition === "en") {
    return "https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz";
  }
  return `https://kaikki.org/dictionary/downloads/${edition}/${edition}-extract.jsonl.gz`;
}

function parseArgs(): { editions: string[]; force: boolean } {
  const args = process.argv.slice(2);
  if (args.includes("--all")) {
    return { editions: ALL_EDITIONS, force: args.includes("--force") };
  }
  const idx = args.indexOf("--editions");
  const editionsList = idx !== -1 ? (args[idx + 1] ?? "en") : "en";
  return {
    editions: editionsList
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
    force: args.includes("--force"),
  };
}

const fileExists = (path: string): Effect.Effect<boolean> =>
  Effect.promise(() =>
    access(path).then(
      () => true,
      () => false,
    ),
  );

const downloadEdition = (edition: string, force: boolean): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const dest = resolve(JSONL_DIR, `${edition}.jsonl`);
    const tmp = `${dest}.tmp`;

    if (!force && (yield* fileExists(dest))) {
      yield* Console.log(`[${edition}] Already downloaded: ${dest}  (use --force to re-download)`);
      return;
    }

    const url = kaikkiUrl(edition);
    yield* Console.log(`[${edition}] Downloading ${url} …`);

    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: (e) => new Error(`Fetch failed: ${String(e)}`),
    });

    if (!response.ok || !response.body) {
      return yield* Effect.fail(
        new Error(`HTTP ${response.status} ${response.statusText} — ${url}`),
      );
    }

    const total = Number(response.headers.get("content-length") ?? 0);
    let downloaded = 0;

    const progress = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        downloaded += chunk.byteLength;
        if (total) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          const mb = (downloaded / 1_000_000).toFixed(0);
          process.stdout.write(`\r  ${pct}%  (${mb} MB compressed)`);
        }
        controller.enqueue(chunk);
      },
    });

    yield* Effect.tryPromise({
      try: () =>
        pipeline(
          Readable.fromWeb(response.body!.pipeThrough(progress) as any),
          createGunzip(),
          createWriteStream(tmp),
        ),
      catch: (e) => new Error(`Download pipeline failed: ${String(e)}`),
    }).pipe(Effect.tapError(() => Effect.promise(() => unlink(tmp).catch(() => {}))));

    process.stdout.write("\n");

    yield* Effect.tryPromise({
      try: () => rename(tmp, dest),
      catch: (e) => new Error(`Failed to rename temp file: ${String(e)}`),
    });

    yield* Console.log(`[${edition}] Saved to ${dest}`);
  });

const main: Effect.Effect<void, Error> = Effect.gen(function* () {
  const { editions, force } = parseArgs();

  yield* Effect.tryPromise({
    try: () => mkdir(JSONL_DIR, { recursive: true }),
    catch: (e) => new Error(`Failed to create directory: ${String(e)}`),
  });

  yield* Effect.forEach(editions, (edition) => downloadEdition(edition, force), {
    concurrency: 1,
  });
});

Effect.runPromise(main).catch((err) => {
  console.error(err);
  process.exit(1);
});
