/** Validate a finalized database without changing it. */

import Database from "better-sqlite3";
import { resolve } from "node:path";
import {
  MIN_COMPLETE_EDITION_ENTRIES,
  validateDatabaseDeep,
} from "../utils/database-validation.ts";
import { ALL_EDITIONS } from "../utils/editions.ts";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const dbPath = resolve(
  outputIndex === -1 ? "data/wiktionary.db.new" : (args[outputIndex + 1] ?? ""),
);
const requireAllEditions = args.includes("--require-all-editions");

const db = new Database(dbPath, { readonly: true, fileMustExist: true });

try {
  const validation = validateDatabaseDeep(db, {
    expectedEditions: requireAllEditions ? ALL_EDITIONS : undefined,
    minimumEditionEntries: requireAllEditions ? MIN_COMPLETE_EDITION_ENTRIES : 1,
  });

  console.log(
    `Deep-validated ${dbPath}: ${validation.entries.toLocaleString()} entries; editions: ${validation.editionCounts.map(({ edition }) => edition).join(", ")}`,
  );
} finally {
  db.close();
}
