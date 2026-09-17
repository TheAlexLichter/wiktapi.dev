# Data Pipeline

Wiktapi is powered by [kaikki.org](https://kaikki.org/dictionary/rawdata.html), which publishes pre-processed JSONL dumps of every Wiktionary edition. No Python toolchain or wikitext parsing required.

## Overview

```
kaikki.org (JSONL.gz, ~2 GB compressed)
        ↓  scripts/download_kaikki.ts
data/jsonl/{edition}.jsonl
        ↓  scripts/import_data.ts
data/wiktionary.db  (indexed SQLite)
        ↓  runtime
Nitro API server
```

The pipeline runs out-of-band (manually or in CI) whenever kaikki.org publishes updated extracts, roughly monthly. The API server is read-only and stateless at runtime.

## Database schema

All entries are stored in a single `entries` table:

```sql
CREATE TABLE entries (
    id              INTEGER PRIMARY KEY,
    word            TEXT NOT NULL,
    normalized_word TEXT NOT NULL,
    lang_code       TEXT NOT NULL,
    lang            TEXT,
    edition         TEXT NOT NULL,
    pos             TEXT,
    senses          TEXT NOT NULL,
    sounds          TEXT,
    translations    TEXT,
    forms           TEXT
);
```

`normalized_word` stores an NFD-normalized, Unicode-case-folded, then
NFC-normalized search key. Prefix searches use bounded range scans over two
covering indexes: one for general searches and one beginning with `lang_code`
for language-filtered searches. The database records the normalizer version in
`database_metadata`; incompatible databases are rejected instead of silently
serving stale search keys.

The structured payload fields are retained as JSON text in `senses`, `sounds`,
`translations`, and `forms`. Small `editions`, `edition_stats`, and
`language_stats` tables are rebuilt during finalization so metadata endpoints do
not scan the complete entries table at request time.

## Fields used from wiktextract

| Field                            | Description                  |
| -------------------------------- | ---------------------------- |
| `word`                           | The headword                 |
| `lang`, `lang_code`              | Language name and BCP47 code |
| `pos`                            | Part of speech               |
| `senses[].glosses`               | Definitions                  |
| `senses[].examples`              | Usage examples               |
| `sounds[].ipa`, `sounds[].audio` | Pronunciation                |
| `translations[]`                 | Translation table            |
| `forms[]`                        | Inflected forms              |

## Caching

Route-level `Cache-Control` headers are set automatically:

| Route           | `max-age`                               |
| --------------- | --------------------------------------- |
| `/v1/*/word/**` | 24 hours + 7-day stale-while-revalidate |
| `/v1/*/search`  | 1 hour                                  |
| `/v1/editions`  | 24 hours                                |
| `/v1/languages` | 24 hours                                |

Data only changes when a new import runs, so long TTLs are appropriate.
