---
layout: home
hero:
  name: Wiktapi
  tagline: Multilingual dictionary API
  image:
    src: /favicon.svg
    alt: Wiktapi
  actions:
    - theme: brand
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: API Explorer
      link: https://api.wiktapi.dev/_scalar
features:
  - title: 100+ Languages
    details: Access entries from English, French, German Wiktionary editions and many more. Filter by source language with a single query param.
  - title: Structured JSON
    details: No HTML blobs. Clean, consistent JSON with definitions, translations, pronunciations, and inflected forms.
  - title: Open & Self-Hostable
    details: Run your own instance with a single SQLite file. Including the import scripts to build it from scratch on any Wiktionary edition.
---

## Why Wiktapi?

The only official Wiktionary API ([`en.wiktionary.org/api/rest_v1/`](https://en.wiktionary.org/api/rest_v1/)) has two big problems.

**It's English-only.** There's no equivalent for French, German, Japanese, or any other edition. Wiktionary has millions of entries across dozens of language editions, and none of it is accessible via a stable API.

**It returns HTML.** Definitions come back as rendered HTML fragments. Getting glosses, examples, pronunciations, or translations out of them means parsing HTML. It's fragile and painful.

Wiktapi gives you structured JSON for any Wiktionary edition, any word language, every field. The data comes from [kaikki.org](https://kaikki.org/dictionary/rawdata.html), which pre-processes wiktextract JSONL for every edition. No scraping, no HTML parsing, no Python toolchain.
