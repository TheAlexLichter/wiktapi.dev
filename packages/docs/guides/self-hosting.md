# Self-Hosting

Run your own Wiktapi instance with a single SQLite file. No external services required.

## Prerequisites

- Node.js 22+
- pnpm

## 1. Clone and install

```bash
git clone https://github.com/your-org/wiktionary-api
cd wiktionary-api
pnpm install
```

## 2. Download data

Download and decompress JSONL dumps from kaikki.org. The English edition is ~2.3 GB compressed:

```bash
cd packages/api

# English Wiktionary only
pnpm download

# Multiple editions
pnpm download -- --editions en,fr,de

# Re-download even if the file already exists
pnpm download -- --force
```

Files land at `packages/api/data/jsonl/{edition}.jsonl`.

## 3. Import to SQLite

```bash
# Import all downloaded JSONL files
pnpm import

# Import a single edition
pnpm import -- --edition en

# Drop and recreate the table first (clean import)
pnpm import -- --edition en --fresh
```

The database is written to `packages/api/data/wiktionary.db`.

## 4. Start the server

### Node

```bash
# Development (hot reload)
pnpm dev

# Production build
pnpm build
pnpm preview
```

### Docker

Build the image from the repo root:

```bash
docker build -t wiktapi .
```

Run, mounting the directory that contains `wiktionary.db`:

```bash
docker run -p 3000:3000 -v /path/to/data:/data wiktapi
```

The container expects the database at `/data/wiktionary.db`. Override with `-e DATA_PATH=...` if your file is located elsewhere.

::: tip
Complete steps 2–3 first to produce the database, then point the volume at the directory containing `wiktionary.db`.
:::

The server listens on port 3000 by default.

## Configuration

| Variable    | Default                | Description                      |
| ----------- | ---------------------- | -------------------------------- |
| `DATA_PATH` | `./data/wiktionary.db` | Path to the SQLite database file |
| `PORT`      | `3000`                 | HTTP port                        |

Set environment variables before starting the server:

```bash
DATA_PATH=/var/data/wiktionary.db pnpm preview
```

## Adding a new edition

No code changes are needed. Download and import the edition, then it's immediately available:

```bash
pnpm download -- --editions fr
pnpm import -- --edition fr
```

Queries to `/v1/fr/word/…` will work as soon as the import finishes.

## Verifying your instance

```bash
# List loaded editions
curl http://localhost:3000/v1/editions

# List all word languages with entry counts
curl http://localhost:3000/v1/languages

# Look up a word
curl "http://localhost:3000/v1/en/word/chat?lang=fr"

# Prefix search
curl "http://localhost:3000/v1/en/search?q=cha&lang=fr"
```
