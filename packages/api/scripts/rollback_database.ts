/** Atomically restore the previous database generation. */

import Database from "better-sqlite3";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { acquireDatabaseMaintenanceLock } from "../utils/database-lock.ts";
import { rollbackDatabaseGeneration, sameFileIdentity } from "../utils/database-generations.ts";
import { readEditionCounts } from "../utils/database-validation.ts";

const previousPath = resolve("data/wiktionary.db.previous");
const livePath = resolve("data/wiktionary.db");
const failedPath = resolve("data/wiktionary.db.failed");
const temporaryPath = resolve("data/wiktionary.db.rollback.tmp");
const lock = await acquireDatabaseMaintenanceLock();

try {
  const beforeValidation = await stat(previousPath);
  const previous = new Database(previousPath, { readonly: true, fileMustExist: true });
  try {
    const integrity = previous.pragma("quick_check") as { quick_check: string }[];
    if (integrity.length !== 1 || integrity[0]?.quick_check !== "ok") {
      throw new Error(`Previous database integrity check failed: ${JSON.stringify(integrity)}`);
    }
    if (readEditionCounts(previous).length === 0) {
      throw new Error("Previous database contains no editions");
    }
  } finally {
    previous.close();
  }
  if (!sameFileIdentity(beforeValidation, await stat(previousPath))) {
    throw new Error("Previous database changed during validation");
  }

  await rollbackDatabaseGeneration({ previousPath, livePath, failedPath, temporaryPath });
  console.log(
    `Restored ${previousPath} to ${livePath}; replaced generation retained at ${failedPath}`,
  );
} finally {
  await lock.release();
}
