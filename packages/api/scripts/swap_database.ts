/** Deep-validate and atomically install the complete staging database. */

import Database from "better-sqlite3";
import { stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { acquireDatabaseMaintenanceLock } from "../utils/database-lock.ts";
import {
  fsyncFile,
  installDatabaseGeneration,
  sameFileIdentity,
} from "../utils/database-generations.ts";
import {
  compareEditionCounts,
  type EditionCount,
  MIN_COMPLETE_EDITION_ENTRIES,
  readEditionCounts,
  validateDatabaseDeep,
} from "../utils/database-validation.ts";
import { ALL_EDITIONS } from "../utils/editions.ts";

const args = process.argv.slice(2);
const thresholdIndex = args.indexOf("--max-count-regression");
const maximumRegressionFraction = Number(
  thresholdIndex === -1 ? "0.25" : (args[thresholdIndex + 1] ?? ""),
);
const allowCountRegression = args.includes("--allow-count-regression");
if (
  !Number.isFinite(maximumRegressionFraction) ||
  maximumRegressionFraction < 0 ||
  maximumRegressionFraction >= 1
) {
  throw new Error("--max-count-regression must be at least 0 and less than 1");
}

const stagingPath = resolve("data/wiktionary.db.new");
const livePath = resolve("data/wiktionary.db");
const previousPath = resolve("data/wiktionary.db.previous");
const lock = await acquireDatabaseMaintenanceLock();

try {
  const beforeValidation = await stat(stagingPath);
  const stagingDatabase = new Database(stagingPath, { readonly: true, fileMustExist: true });
  let candidateCounts;
  try {
    candidateCounts = validateDatabaseDeep(stagingDatabase, {
      expectedEditions: ALL_EDITIONS,
      minimumEditionEntries: MIN_COMPLETE_EDITION_ENTRIES,
    }).editionCounts;
  } finally {
    stagingDatabase.close();
  }

  const afterValidation = await stat(stagingPath);
  if (!sameFileIdentity(beforeValidation, afterValidation)) {
    throw new Error("Staging database changed identity or size during validation");
  }
  if (afterValidation.dev !== (await stat(dirname(livePath))).dev) {
    throw new Error("Staging and live database paths are not on the same filesystem");
  }

  let currentCounts: EditionCount[] = [];
  let liveExists = true;
  try {
    await stat(livePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    liveExists = false;
  }
  if (liveExists) {
    const liveDatabase = new Database(livePath, { readonly: true, fileMustExist: true });
    try {
      currentCounts = readEditionCounts(liveDatabase);
    } finally {
      liveDatabase.close();
    }
  }

  const comparison = compareEditionCounts(
    currentCounts,
    candidateCounts,
    maximumRegressionFraction,
  );
  for (const row of comparison) {
    const change =
      row.changeFraction === null ? "new" : `${(row.changeFraction * 100).toFixed(1)}%`;
    console.log(
      `${row.edition}: ${row.previousEntryCount.toLocaleString()} -> ${row.entryCount.toLocaleString()} (${change})`,
    );
  }
  const regressions = comparison.filter(({ regressed }) => regressed);
  if (regressions.length > 0 && !allowCountRegression) {
    throw new Error(
      `Refusing material edition-count regression above ${maximumRegressionFraction * 100}%: ${regressions.map(({ edition }) => edition).join(", ")}. Inspect the data, then pass --allow-count-regression only if intentional.`,
    );
  }
  if (regressions.length > 0) {
    console.warn("WARNING: operator override accepted material edition-count regressions");
  }

  await fsyncFile(stagingPath);
  const beforeInstall = await stat(stagingPath);
  if (!sameFileIdentity(afterValidation, beforeInstall)) {
    throw new Error("Staging database changed after validation");
  }
  await installDatabaseGeneration({ stagingPath, livePath, previousPath });
  console.log(
    `Installed validated ${ALL_EDITIONS.length}-edition database at ${livePath}; previous generation retained at ${previousPath}`,
  );
} finally {
  await lock.release();
}
