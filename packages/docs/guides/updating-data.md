# Updating Data

kaikki.org publishes updated wiktextract dumps roughly monthly. Here's how to refresh your local database.

## Zero-downtime updates (recommended)

Because the API server opens the SQLite file once at startup and holds the connection, writing directly to the live database while the server is running risks corrupting in-flight reads. The safe approach is to build a staging database and atomically swap it into place.

```bash
cd packages/api

# Step 1 — download the latest dump
vp run download -- --force

# Step 2 — import and finalize a staging file (server keeps serving the old DB)
vp run import:staging

# Step 3 — atomic swap (single syscall on POSIX; existing connections keep the old inode)
vp run swap

# Step 4 — restart the server to open a fresh connection to the new file
#           (Cloudflare's cache covers the ~1 s cold-start gap)
systemctl restart wiktionary-api   # or however you manage the process
```

`import:staging` writes to `data/wiktionary.db.new`. `swap` runs `mv data/wiktionary.db.new data/wiktionary.db`, which is an atomic rename on the same filesystem. The live server continues reading its open file descriptor pointing at the old inode; after you restart it opens the new file.

The finalization step builds covering prefix-search indexes and precomputes the
editions and language statistics used by the metadata endpoints. Existing
databases can be upgraded offline with the `index` command; do not build the
indexes against the database being served by the single-process API.

## Simple re-import (downtime)

If you don't mind a brief restart window, or are updating a development instance:

```bash
cd packages/api

vp run download -- --force
vp run import -- --fresh
```

The `--fresh` flag drops the existing `entries` table before importing, so no stale rows from previous imports are left behind.

## Partial updates

Using `--edition` together with `--fresh` creates a database containing only
that edition; `--fresh` always drops the complete entries table. In-place
partial replacement is not currently supported. To build a single-edition
database:

```bash
vp run download -- --editions en --force
vp run import -- --edition en --fresh
```

For zero-downtime updates of a multi-edition database, use the complete staging
workflow above.

## Automating updates

The database is too large to store as a GitHub Actions artifact (the English edition alone exceeds the 2 GB per-file limit). Run the pipeline on the server itself — either via a cron job or by SSHing in from CI.

### Cron job on the server

```bash
# /etc/cron.d/wiktapi — runs at 03:00 on the first of each month
0 3 1 * * deploy  cd /srv/wiktionary-api/packages/api \
  && vp run download -- --force \
  && vp run import:staging \
  && vp run swap \
  && systemctl restart wiktionary-api
```

### GitHub Actions — deploy via SSH

```yaml
name: Update data

on:
  schedule:
    - cron: "0 3 1 * *" # first of each month at 03:00 UTC

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Run pipeline on server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /srv/wiktionary-api/packages/api
            vp run download -- --force
            vp run import:staging
            vp run swap
            systemctl restart wiktionary-api
```

## Checking what's loaded

```bash
# See which editions are in the database
curl http://localhost:3000/v1/editions

# See entry counts per language
curl http://localhost:3000/v1/languages
```
