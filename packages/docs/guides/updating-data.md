# Updating Data

kaikki.org publishes updated wiktextract dumps roughly monthly. Here's how to refresh your local database.

## Zero-downtime updates (recommended)

Because the API server opens the SQLite file once at startup and holds the connection, writing directly to the live database while the server is running risks corrupting in-flight reads. The safe approach is to build a staging database and atomically swap it into place.

```bash
cd /srv/wiktionary-api

# Step 1 — check out the new code and install its scripts without restarting.
#          The old API code remains loaded in the running process.
git pull --ff-only
vp install
cd packages/api

# Step 2 — under one maintenance lock, sequentially download/import all 21
#          editions, finalize, deep-validate, compare counts, and atomically swap.
vp run refresh

# Step 3 — only now restart to activate the NEW API code and database.
systemctl restart wiktionary-api   # or however you manage the process

# Step 4 — after the new process is healthy, purge the Cloudflare cache.
```

`refresh` holds one maintenance lock across the full pipeline. It downloads and
imports one edition at a time and deletes that JSONL immediately, avoiding a
second ~46 GB retained copy of all source files. It finalizes
`data/wiktionary.db.new`, checks table columns, exact index definitions,
metadata totals, `quick_check`, the exact edition manifest, and a minimum of
1,000 entries per edition. It then prints per-edition count deltas against the
live database and rejects any edition that shrank by more than 25%.

The swap fsyncs and rechecks the staging inode, hard-links the live inode to
`data/wiktionary.db.previous`, and atomically renames staging over the live
pathname. There is no interval where `data/wiktionary.db` is absent. The old
server continues reading its open inode; after restart it opens the new file.
The prior generation remains available for rollback.

The ordering is a compatibility boundary: the old API can read both the old
schema and the additive schema-v2 database, but the new API deliberately
refuses an old or unfinished database. Therefore install the finalized database
first and activate the new API code second. The checkout containing the new
import, validation, and swap scripts must already be present for step 2;
this does not affect the old code already loaded by the running API process.
Step 3 is the restart that activates the new checkout. Do not restart the API
while `refresh` is running.

The finalization step builds covering prefix-search indexes and precomputes the
editions and language statistics used by the metadata endpoints. Existing
databases can be upgraded offline with the `index` command; do not build the
indexes against the database being served by the single-process API.

### Disk-space guard

A complete staging import uses the larger of the live database and retained
JSONL sizes, requires 50% index headroom plus a fixed 5 GiB safety margin, and
counts an existing staging file as reusable space. `refresh` also checks free
space before every streamed download/decompression (25 GiB for English and 8
GiB for each other edition). A uniquely allocated older `.previous` generation
is counted as reclaimable during preflight and removed only after the preflight
succeeds; a hard link to the current live inode is not double-counted. The swap
creates a new `.previous` generation. If a check fails, expand the filesystem
before continuing. The downloader additionally rechecks the 5 GiB
reserve while decompressing and removes its temporary file on failure.

Finalization checkpoints and leaves WAL mode before creating the large indexes.
When upgrading an existing database, it drops obsolete indexes first so their
pages can be reused. It intentionally does **not** run `VACUUM`: a vacuum needs
substantial temporary disk space and is unsafe to introduce automatically on a
large database. Dropped pages may remain in the file even though SQLite can
reuse them.

`--skip-disk-check` exists for an operator who has already measured peak usage
on an equivalent dataset. It is not appropriate as a trial-and-error response
to a failed production preflight.

Download, import, finalization, refresh, swap, and rollback share
`data/database-maintenance.lock`. A crash deliberately leaves the lock in place
because an orphaned child import may still be writing. Verify that no refresh,
download/import child, index build, swap, or rollback process remains before
manually removing a stale lock.

### Count-regression override and rollback

The default 25% per-edition regression threshold is configurable:

```bash
vp run refresh -- --max-count-regression 0.15
```

If a large reduction is confirmed upstream and intentional, rerun with
`--allow-count-regression`. The override is explicit and logged. A failed new
generation can be rolled back atomically:

```bash
vp run rollback
systemctl restart wiktionary-api
```

Rollback retains the rejected live generation as `wiktionary.db.failed`. On the
first schema-v2 deployment, `.previous` may still be schema v0; in that case,
roll back the application checkout as well before restarting because the new
API deliberately rejects v0.

## Simple re-import (downtime)

If you don't mind a brief restart window, or are updating a development instance:

```bash
cd packages/api

vp run refresh
systemctl restart wiktionary-api
```

`refresh` always rebuilds the staging entries table from scratch, so no stale
rows from previous imports are carried into the new generation.

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
  && vp run refresh \
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
            vp run refresh
            systemctl restart wiktionary-api
```

## Checking what's loaded

```bash
# See which editions are in the database
curl http://localhost:3000/v1/editions

# See entry counts per language
curl http://localhost:3000/v1/languages
```

## Production-size load validation

Run the API directly against the finalized staging-size dataset and bypass
Cloudflare. The benchmark covers broad and rare prefixes, the language-filtered
index, an exact-lookup baseline, and exact lookups mixed with broad-prefix load
to expose event-loop blocking:

```bash
vp run benchmark -- \
  --base-url http://127.0.0.1:3000 \
  --edition en \
  --broad-prefixes a,co,re \
  --rare-prefixes xyzxyz,qzxqzx \
  --language en \
  --exact-words test,house,water,run \
  --warmup 500 \
  --requests 5000 \
  --concurrency 25
```

Choose prefixes and known exact words representative of the loaded dump. Any
non-2xx response fails the benchmark, so an invalid corpus cannot silently
produce attractive latency numbers. The warmup phase runs before measurements.
Record the printed throughput and p50/p95/p99 values; do not infer
production-scale performance from the small automated query-plan tests. While
the benchmark runs, also record CPU, memory, event-loop symptoms, and disk I/O
with the host's normal monitoring tools. Compare `exact` with
`exact-under-search-load`. A Node restart does not clear the operating system's
page cache; if cold-cache data is required, use an isolated disposable host or
an explicitly controlled cache procedure.
