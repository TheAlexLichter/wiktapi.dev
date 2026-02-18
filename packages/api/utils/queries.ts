import { HTTPError } from "nitro/h3";
import { db } from "./db.ts";

export interface EntryRow {
  pos: string | null;
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
