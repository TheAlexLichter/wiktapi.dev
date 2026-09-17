import type Database from "better-sqlite3";
import { assertDatabaseReady } from "./database-readiness.ts";
import { describeEditionDifference } from "./editions.ts";

export const MIN_COMPLETE_EDITION_ENTRIES = 1_000;

export interface EditionCount {
  edition: string;
  entryCount: number;
}

export interface EditionCountComparison extends EditionCount {
  previousEntryCount: number;
  changeFraction: number | null;
  regressed: boolean;
}

export function readEditionCounts(
  db: Database.Database,
  options: { useFinalizedMetadata?: boolean } = {},
): EditionCount[] {
  const hasEditionStats = Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'edition_stats'").get(),
  );
  const rows =
    options.useFinalizedMetadata && hasEditionStats
      ? db.prepare("SELECT edition, entry_count FROM edition_stats ORDER BY edition").all()
      : db
          .prepare(
            "SELECT edition, COUNT(*) AS entry_count FROM entries GROUP BY edition ORDER BY edition",
          )
          .all();

  return (rows as { edition: string; entry_count: number }[]).map(({ edition, entry_count }) => ({
    edition,
    entryCount: entry_count,
  }));
}

export function compareEditionCounts(
  current: readonly EditionCount[],
  candidate: readonly EditionCount[],
  maximumRegressionFraction: number,
): EditionCountComparison[] {
  if (
    !Number.isFinite(maximumRegressionFraction) ||
    maximumRegressionFraction < 0 ||
    maximumRegressionFraction >= 1
  ) {
    throw new Error("Maximum count regression must be at least 0 and less than 1");
  }

  const previousCounts = new Map(current.map(({ edition, entryCount }) => [edition, entryCount]));
  return candidate.map(({ edition, entryCount }) => {
    const previousEntryCount = previousCounts.get(edition) ?? 0;
    const changeFraction =
      previousEntryCount === 0 ? null : (entryCount - previousEntryCount) / previousEntryCount;
    return {
      edition,
      entryCount,
      previousEntryCount,
      changeFraction,
      regressed:
        previousEntryCount > 0 && entryCount < previousEntryCount * (1 - maximumRegressionFraction),
    };
  });
}

export function validateDatabaseDeep(
  db: Database.Database,
  options: { expectedEditions?: readonly string[]; minimumEditionEntries?: number } = {},
): { entries: number; editionCounts: EditionCount[] } {
  assertDatabaseReady(db, { expectedEditions: options.expectedEditions });

  const integrity = db.pragma("quick_check") as { quick_check: string }[];
  if (integrity.length !== 1 || integrity[0]?.quick_check !== "ok") {
    throw new Error(`Database integrity check failed: ${JSON.stringify(integrity)}`);
  }

  const editionCounts = readEditionCounts(db);
  const metadataCounts = readEditionCounts(db, { useFinalizedMetadata: true });
  if (JSON.stringify(editionCounts) !== JSON.stringify(metadataCounts)) {
    throw new Error("Per-edition metadata does not match entries");
  }

  if (options.expectedEditions) {
    const difference = describeEditionDifference(
      editionCounts.map(({ edition }) => edition),
      options.expectedEditions,
    );
    if (difference) {
      throw new Error(
        `Database edition manifest does not match the complete dataset (${difference})`,
      );
    }
  }

  const minimumEditionEntries = options.minimumEditionEntries ?? 1;
  const undersized = editionCounts.filter(({ entryCount }) => entryCount < minimumEditionEntries);
  if (undersized.length > 0) {
    throw new Error(
      `Database contains undersized editions: ${undersized.map(({ edition, entryCount }) => `${edition}=${entryCount}`).join(", ")}`,
    );
  }

  const entries = editionCounts.reduce((sum, { entryCount }) => sum + entryCount, 0);
  if (entries === 0) {
    throw new Error("Database does not contain any entries");
  }

  const languageCounts = db
    .prepare(
      `SELECT lang_code, MAX(lang) AS lang, COUNT(*) AS entry_count
       FROM entries
       GROUP BY lang_code
       ORDER BY lang_code`,
    )
    .all();
  const metadataLanguageCounts = db
    .prepare(
      `SELECT lang_code, lang, entry_count
       FROM language_stats
       ORDER BY lang_code`,
    )
    .all();
  if (JSON.stringify(languageCounts) !== JSON.stringify(metadataLanguageCounts)) {
    throw new Error("Per-language metadata does not match entries");
  }

  return { entries, editionCounts };
}
