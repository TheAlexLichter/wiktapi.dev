<img src="packages/docs/public/favicon.svg" width="48" alt="Wiktapi logo">

# WiktAPI.dev

A multilingual REST API for structured dictionary data, built on [kaikki.org](https://kaikki.org/dictionary/rawdata.html)'s pre-processed Wiktionary JSONL exports.

The existing `en.wiktionary.org/api/rest_v1/` is English-only and returns HTML blobs. This API serves clean JSON for words across 100+ languages, with support for multiple Wiktionary editions (en, fr, de, …).

**Stack:** Nitro v3 · SQLite (`better-sqlite3`) · TypeScript · VitePress docs

---

## Monorepo structure

```
packages/
├── api/    # Nitro server — api.wiktapi.dev
└── docs/   # VitePress docs site — wiktapi.dev
```

---

## Getting started

```bash
vp install
```

### API

```bash
vp run @wiktapi/api#dev      # http://localhost:3000
vp run @wiktapi/api#build
```

Interactive API explorer (Scalar) and raw OpenAPI spec are available at `/_scalar` and `/_openapi.json` in dev and production.

### Docs

```bash
vp run @wiktapi/docs#dev     # http://localhost:5173
vp run @wiktapi/docs#build
```

---

## Data pipeline

Data is downloaded from kaikki.org (~monthly) and imported into a local SQLite database.

```bash
# 1. Download pre-processed JSONL from kaikki.org
vp run @wiktapi/api#download                          # English Wiktionary (~2.3 GB compressed)
vp run @wiktapi/api#download -- --editions en,fr,de   # multiple editions

# 2. Import into SQLite
vp run @wiktapi/api#import                            # all data/jsonl/*.jsonl files
vp run @wiktapi/api#import -- --edition en            # single edition
vp run @wiktapi/api#import -- --edition en --fresh    # drop and recreate table first
```

The database is written to `packages/api/data/wiktionary.db`. Override with the `DATA_PATH` env var.

---

## API overview

All routes are under `/v1/`. See the [interactive explorer](https://api.wiktapi.dev/_scalar) for full request/response documentation.

### Editions & languages

```
GET /v1/editions
GET /v1/languages
```

### Word lookup

```
GET /v1/{edition}/word/{word}
GET /v1/{edition}/word/{word}?lang={code}
GET /v1/{edition}/word/{word}/definitions
GET /v1/{edition}/word/{word}/translations
GET /v1/{edition}/word/{word}/pronunciations
GET /v1/{edition}/word/{word}/forms
```

### Search

```
GET /v1/{edition}/search?q={prefix}
GET /v1/{edition}/search?q={prefix}&lang={code}
```

### Two language axes

| Parameter   | Position    | Meaning                                                             |
| ----------- | ----------- | ------------------------------------------------------------------- |
| `{edition}` | URL prefix  | Which Wiktionary (en, fr, de …). Determines the **gloss language**. |
| `?lang=`    | Query param | Filters to words belonging to a specific language. Optional.        |

**Example:** `GET /v1/en/word/Haus` returns every language that has a word spelled "Haus", all with English definitions.
`GET /v1/en/word/Haus?lang=de` narrows to the German entry only.

---

## Deployment

### Manual

```bash
cd packages/api
vp run build
DATA_PATH=/var/data/wiktionary.db node .output/server/index.mjs
```

### Docker

Build the image (from the repo root):

```bash
docker build -t wiktapi .
```

Run, mounting a directory that contains `wiktionary.db`:

```bash
docker run -p 3000:3000 -v /path/to/data:/data wiktapi
```

The container expects the database at `/data/wiktionary.db` by default. Override with `-e DATA_PATH=...` if your file is named or located differently.

To populate the database before the first run, use the data pipeline commands from the [Data pipeline](#data-pipeline) section, then point the volume at the directory containing the resulting `wiktionary.db`.
