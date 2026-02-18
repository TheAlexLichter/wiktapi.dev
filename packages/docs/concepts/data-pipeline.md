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
    id        INTEGER PRIMARY KEY,
    word      TEXT    NOT NULL,
    lang_code TEXT    NOT NULL,   -- BCP47 code of the word's language (fr, de, …)
    lang      TEXT,               -- full language name ("French", "German", …)
    edition   TEXT    NOT NULL,   -- source Wiktionary edition (en, fr, …)
    pos       TEXT,               -- part of speech (noun, verb, adj, …)
    entry     TEXT    NOT NULL    -- full wiktextract object as JSON string
);
```

The `entry` column stores the complete wiktextract JSON object, giving all endpoints access to every field (senses, sounds, translations, forms, etymology, synonyms) without a normalized schema.

## Fields used from wiktextract

| Field                               | Description                  |
| ----------------------------------- | ---------------------------- |
| `word`                              | The headword                 |
| `lang`, `lang_code`                 | Language name and BCP47 code |
| `pos`                               | Part of speech               |
| `senses[].glosses`                  | Definitions                  |
| `senses[].examples`                 | Usage examples               |
| `sounds[].ipa`, `sounds[].audio`    | Pronunciation                |
| `translations[]`                    | Translation table            |
| `forms[]`                           | Inflected forms              |
| `etymology_text`                    | Etymology                    |
| `synonyms`, `antonyms`, `hypernyms` | Related words                |

## Caching

Route-level `Cache-Control` headers are set automatically:

| Route           | `max-age`                               |
| --------------- | --------------------------------------- |
| `/v1/*/word/**` | 24 hours + 7-day stale-while-revalidate |
| `/v1/*/search`  | 1 hour                                  |
| `/v1/editions`  | 24 hours                                |
| `/v1/languages` | 24 hours                                |

Data only changes when a new import runs, so long TTLs are appropriate.
