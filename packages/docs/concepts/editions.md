# Editions & Languages

There are two independent language axes in Wiktapi. Knowing the difference matters.

## Editions

An **edition** is the Wiktionary source you're querying, identified by its language code (`en`, `fr`, `de`, ...). It's the first segment of every URL:

```
/v1/{edition}/word/{word}
```

The edition controls two things:

1. **Which dictionary is queried**: `en` is English Wiktionary, `de` is German Wiktionary, etc.
2. **The language definitions are written in**: the `en` edition writes glosses in English, `de` in German.

To see which editions are available:

```bash
curl https://api.wiktapi.dev/v1/editions
# { "editions": ["de", "en", "fr"] }
```

## Word language (`?lang=`)

The `?lang=` parameter filters entries to a specific **word language**: the language the word itself belongs to.

This is independent of the edition. Both `en` and `fr` editions contain entries for German words; they just define them in English or French respectively.

```bash
# German word "Haus", English definitions
GET /v1/en/word/Haus?lang=de

# German word "Haus", French definitions
GET /v1/fr/word/Haus?lang=de
```

Without `?lang=`, you get every language that has a word with that spelling:

```bash
# French "chat", English "chat", and any other language that spells it the same way
GET /v1/en/word/chat
```

## Summary

|              | Edition                 | `?lang=`                         |
| ------------ | ----------------------- | -------------------------------- |
| **Controls** | Which Wiktionary source | Which word language to filter to |
| **Affects**  | Definition language     | Entries returned                 |
| **Required** | Yes (URL path)          | No                               |
| **Example**  | `en`, `fr`, `de`        | `de`, `ja`, `zh`                 |

To see all word languages in a given instance:

```bash
curl https://api.wiktapi.dev/v1/languages
```

Returns each language code, its full name, and entry count.
