import { caseFold } from "unicode-case-folding";

/** Build the locale-independent Unicode key stored and queried by prefix search. */
export function normalizeSearchWord(word: string): string {
  return caseFold(word).normalize("NFC");
}

/**
 * Return the exclusive upper bound for all strings starting with `prefix`.
 * SQLite's default BINARY collation orders valid UTF-8 in Unicode code-point
 * order, so incrementing the final scalar produces an indexable prefix range.
 */
export function getPrefixUpperBound(prefix: string): string | null {
  const codePoints = Array.from(prefix);

  while (codePoints.length > 0) {
    const last = codePoints.pop()!;
    const value = last.codePointAt(0)!;

    if (value < 0x10ffff) {
      const next = value + 1 === 0xd800 ? 0xe000 : value + 1;
      return codePoints.join("") + String.fromCodePoint(next);
    }
  }

  return null;
}
