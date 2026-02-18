export const ENTRIES_INSERT_SQL = `
  INSERT INTO entries (word, lang_code, lang, edition, pos, senses, sounds, translations, forms)
  VALUES (@word, @lang_code, @lang, @edition, @pos, @senses, @sounds, @translations, @forms)
`;

export const ENTRIES_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS entries (
    id           INTEGER PRIMARY KEY,
    word         TEXT    NOT NULL,
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
  CREATE INDEX IF NOT EXISTS idx_word_lang    ON entries (word, lang_code);
  CREATE INDEX IF NOT EXISTS idx_word         ON entries (word);
  CREATE INDEX IF NOT EXISTS idx_lang         ON entries (lang_code);
  CREATE INDEX IF NOT EXISTS idx_edition      ON entries (edition);
`;
