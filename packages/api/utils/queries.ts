import { HTTPError } from "nitro/h3";
import { db } from "./db.ts";

export interface EntryRow {
    pos: string | null;
    word: string;
    lang_code: string;
    senses: string;
    sounds: string | null;
    translations: string | null;
    forms: string | null;
}

/**
 * Fetch all entries for a word in a given edition, optionally filtered by language.
 * Throws a 404 if no entries are found.
 */
export function fetchWordEntries(edition: string, word: string, lang?: string): EntryRow[] {
    const rows = (
        lang
            ? db
                  .prepare(
                      `SELECT pos, lang_code, senses, sounds, translations, forms FROM entries
             WHERE edition = ? AND word = ? AND lang_code = ?
             ORDER BY pos`,
                  )
                  .all(edition, word, lang)
            : db
                  .prepare(
                      `SELECT pos, lang_code, senses, sounds, translations, forms FROM entries
             WHERE edition = ? AND word = ?
             ORDER BY lang_code, pos`,
                  )
                  .all(edition, word)
    ) as EntryRow[];

    if (rows.length === 0) {
        throw new HTTPError({ statusCode: 404, message: `No entries found for "${word}"` });
    }

    return rows;
}

export interface BatchEntryResult {
    word: string;
    entries: EntryRow[] | null;
}

/**
 * Fetch entries for multiple words in a given edition.
 * Returns results for all words, including those not found (with empty entries array).
 */
export function fetchWordEntriesBatch(
    edition: string,
    words: string[],
    lang?: string,
): BatchEntryResult[] {
    if (words.length === 0) {
        return [];
    }

    const placeholders = words.map(() => "?").join(",");
    const params: (string | number)[] = [edition, ...words];

    let query: string;
    if (lang) {
        query = `
      SELECT word, pos, lang_code, senses, sounds, translations, forms
      FROM entries
      WHERE edition = ? AND word IN (${placeholders}) AND lang_code = ?
      ORDER BY word, lang_code, pos
    `;
        params.push(lang);
    } else {
        query = `
      SELECT word, pos, lang_code, senses, sounds, translations, forms
      FROM entries
      WHERE edition = ? AND word IN (${placeholders})
      ORDER BY word, lang_code, pos
    `;
    }

    const rows = db.prepare(query).all(...params) as EntryRow[];

    const results: BatchEntryResult[] = words.map((word) => ({
        word,
        entries: null,
    }));

    const foundWords = new Set<string>();
    for (const row of rows) {
        foundWords.add(row.word);
    }

    for (const row of rows) {
        const result = results.find((r) => r.word === row.word);
        if (result) {
            if (!result.entries) {
                result.entries = [];
            }
            result.entries.push(row);
        }
    }

    for (const result of results) {
        if (!foundWords.has(result.word)) {
            result.entries = null;
        }
    }

    return results;
}
