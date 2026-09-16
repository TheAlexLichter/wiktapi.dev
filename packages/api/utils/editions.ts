/**
 * Editions that make up the complete public Wiktapi dataset.
 *
 * Keep this manifest explicit: staging imports and swaps use it to prevent a
 * partial download from replacing the complete production database.
 */
export const ALL_EDITIONS = [
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
] as const;

export function describeEditionDifference(
  actualEditions: readonly string[],
  expectedEditions: readonly string[],
): string | null {
  const actual = new Set(actualEditions);
  const expected = new Set(expectedEditions);
  const missing = [...expected].filter((edition) => !actual.has(edition)).sort();
  const unexpected = [...actual].filter((edition) => !expected.has(edition)).sort();
  const duplicates = [...actual]
    .filter((edition) => actualEditions.filter((candidate) => candidate === edition).length > 1)
    .sort();

  if (missing.length === 0 && unexpected.length === 0 && duplicates.length === 0) {
    return null;
  }

  return [
    missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
    unexpected.length > 0 ? `unexpected: ${unexpected.join(", ")}` : null,
    duplicates.length > 0 ? `duplicates: ${duplicates.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}
