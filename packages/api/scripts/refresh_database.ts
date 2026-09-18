/**
 * Lock-safe complete refresh: download and import one edition at a time,
 * finalize once, deep-validate, and atomically swap by default.
 */

import { spawn } from "node:child_process";
import { stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { acquireDatabaseMaintenanceLock, DATABASE_LOCK_TOKEN_ENV } from "../utils/database-lock.ts";
import { fsyncDirectory } from "../utils/database-generations.ts";
import {
  assertFreeDiskSpace,
  assertStagingDiskSpace,
  assertStagingTargetIsIndependent,
} from "../utils/disk-space.ts";
import { ALL_EDITIONS } from "../utils/editions.ts";
import { runRefreshCompletion } from "../utils/refresh-plan.ts";

const GIBIBYTE = 1024 ** 3;
// Used only on the first refresh, before either a live database or retained
// JSONL files exist. Subsequent refreshes use measured on-disk sizes.
const INITIAL_BUILD_REFERENCE_SIZE = 35 * GIBIBYTE;
const ENGLISH_DOWNLOAD_MARGIN = 25 * GIBIBYTE;
const OTHER_DOWNLOAD_MARGIN = 8 * GIBIBYTE;
const dataDirectory = resolve("data");
const stagingPath = resolve(dataDirectory, "wiktionary.db.new");
const livePath = resolve(dataDirectory, "wiktionary.db");
const previousPath = resolve(dataDirectory, "wiktionary.db.previous");
const args = process.argv.slice(2);
const skipDiskCheck = args.includes("--skip-disk-check");
const noSwap = args.includes("--no-swap");
const allowCountRegression = args.includes("--allow-count-regression");
const thresholdIndex = args.indexOf("--max-count-regression");
const threshold = thresholdIndex === -1 ? null : (args[thresholdIndex + 1] ?? null);

async function runScript(script: string, scriptArgs: string[], token: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve("scripts", script), ...scriptArgs], {
      stdio: "inherit",
      env: { ...process.env, [DATABASE_LOCK_TOKEN_ENV]: token },
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${script} failed (${signal ? `signal ${signal}` : `exit ${code}`})`));
    });
  });
}

const lock = await acquireDatabaseMaintenanceLock();
try {
  await assertStagingTargetIsIndependent(stagingPath, livePath);
  if (skipDiskCheck) {
    console.warn("WARNING: skipping staging and download temporary-space guards");
  } else {
    await assertStagingDiskSpace({
      targetPath: stagingPath,
      liveDatabasePath: livePath,
      jsonlPaths: [],
      reclaimablePaths: [previousPath],
      fallbackReferenceBytes: INITIAL_BUILD_REFERENCE_SIZE,
    });
  }

  try {
    await stat(previousPath);
    await unlink(previousPath);
    await fsyncDirectory(dataDirectory);
    console.log(`Removed superseded rollback generation at ${previousPath} before staging`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  for (const [index, edition] of ALL_EDITIONS.entries()) {
    if (!skipDiskCheck) {
      await assertFreeDiskSpace(
        dataDirectory,
        edition === "en" ? ENGLISH_DOWNLOAD_MARGIN : OTHER_DOWNLOAD_MARGIN,
        `${edition} download/decompression temporary file`,
      );
    }
    await runScript("download_kaikki.ts", ["--editions", edition, "--force"], lock.token);
    await runScript(
      "import_data.ts",
      [
        "--edition",
        edition,
        "--output",
        stagingPath,
        "--skip-indexes",
        ...(index === 0 ? ["--fresh"] : []),
      ],
      lock.token,
    );
  }

  await runScript(
    "build_indexes.ts",
    ["--output", stagingPath, "--require-all-editions"],
    lock.token,
  );
  await runRefreshCompletion(
    { allowCountRegression, noSwap, stagingPath, threshold },
    runScript,
    lock.token,
  );

  if (noSwap) {
    console.log(`Staging refresh complete at ${stagingPath}; --no-swap left it uninstalled`);
  }
} finally {
  await lock.release();
}
