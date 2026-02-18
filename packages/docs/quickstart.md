# Quickstart

Get your first response from Wiktapi in under a minute. No API key required.

## Make your first request

Fetch the English Wiktionary entry for the French word _chat_ (cat):

```bash
curl "https://api.wiktapi.dev/v1/en/word/chat?lang=fr"
```

```json
{
  "word": "chat",
  "edition": "en",
  "entries": [
    {
      "word": "chat",
      "lang": "French",
      "lang_code": "fr",
      "pos": "noun",
      "senses": [{ "glosses": ["cat"] }],
      "sounds": [{ "ipa": "/ʃa/" }]
    }
  ]
}
```

## Fetch just the definitions

Use the `/definitions` sub-resource to get only glosses, examples, and tags:

```bash
curl "https://api.wiktapi.dev/v1/en/word/run/definitions"
```

## Search for words

Prefix search returns up to 50 matches:

```bash
curl "https://api.wiktapi.dev/v1/en/search?q=katz&lang=de"
```

## Explore all endpoints

| Endpoint                                       | Description                           |
| ---------------------------------------------- | ------------------------------------- |
| `GET /v1/editions`                             | List available Wiktionary editions    |
| `GET /v1/languages`                            | List word languages with entry counts |
| `GET /v1/{edition}/word/{word}`                | Full entry                            |
| `GET /v1/{edition}/word/{word}/definitions`    | Glosses, examples, tags               |
| `GET /v1/{edition}/word/{word}/translations`   | Translation table                     |
| `GET /v1/{edition}/word/{word}/pronunciations` | IPA and audio                         |
| `GET /v1/{edition}/word/{word}/forms`          | Inflected forms                       |
| `GET /v1/{edition}/search?q=`                  | Prefix search                         |

All word endpoints accept an optional `?lang={code}` query parameter to filter results to a single word language.

## Next steps

- Read about [editions and languages](/concepts/editions) to understand the two language axes
- Browse all endpoints in the [API Explorer](https://api.wiktapi.dev/_scalar)
- [Self-host your own instance](/guides/self-hosting)
