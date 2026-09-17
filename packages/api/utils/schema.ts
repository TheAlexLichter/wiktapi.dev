export const ENTRIES_INSERT_SQL = `
  INSERT INTO entries (
    word, normalized_word, lang_code, lang, edition, pos, senses, sounds, translations, forms
  )
  VALUES (
    @word, @normalized_word, @lang_code, @lang, @edition, @pos,
    @senses, @sounds, @translations, @forms
  )
`;

export const ENTRIES_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS entries (
    id           INTEGER PRIMARY KEY,
    word         TEXT    NOT NULL,
    normalized_word TEXT NOT NULL,
    lang_code    TEXT    NOT NULL,
    lang         TEXT,
    edition      TEXT    NOT NULL,
    pos          TEXT,
    senses       TEXT    NOT NULL,
    sounds       TEXT,
    translations TEXT,
    forms        TEXT
  );
`;

export const ENTRIES_INDEXES_DDL = `
  CREATE INDEX IF NOT EXISTS idx_edition_word ON entries (edition, word);
  CREATE INDEX IF NOT EXISTS idx_search_prefix
    ON entries (edition, normalized_word, word, lang_code, lang, pos);
  CREATE INDEX IF NOT EXISTS idx_search_lang_prefix
    ON entries (edition, lang_code, normalized_word, word, lang, pos);
`;

export const DROP_MANAGED_INDEXES_DDL = `
  DROP INDEX IF EXISTS idx_edition_word;
  DROP INDEX IF EXISTS idx_search_prefix;
  DROP INDEX IF EXISTS idx_search_lang_prefix;
  DROP INDEX IF EXISTS idx_word_lang;
  DROP INDEX IF EXISTS idx_lang;
`;

export const METADATA_TABLES_DDL = `
  CREATE TABLE IF NOT EXISTS editions (
    edition TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS edition_stats (
    edition     TEXT    PRIMARY KEY,
    entry_count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS language_stats (
    lang_code   TEXT    NOT NULL,
    lang        TEXT,
    entry_count INTEGER NOT NULL
  );
`;

export const REBUILD_METADATA_SQL = `
  DELETE FROM edition_stats;
  INSERT INTO edition_stats (edition, entry_count)
    SELECT edition, COUNT(*)
    FROM entries
    GROUP BY edition;

  DELETE FROM editions;
  INSERT INTO editions (edition)
    SELECT edition FROM edition_stats;

  DELETE FROM language_stats;
  INSERT INTO language_stats (lang_code, lang, entry_count)
    SELECT lang_code, lang, COUNT(*)
    FROM entries
    GROUP BY lang_code, lang;
`;

export const DATABASE_SCHEMA_VERSION = 2;
