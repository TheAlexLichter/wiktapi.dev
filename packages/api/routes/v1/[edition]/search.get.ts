import { defineRouteMeta } from "nitro";
import { defineHandler, getRouterParam, getQuery, createError } from "nitro/h3";
import { db } from "../../../utils/db";
import { getPrefixUpperBound, normalizeSearchWord } from "../../../utils/search";

defineRouteMeta({
  openAPI: {
    tags: ["Search"],
    summary: "Prefix search",
    description:
      "Returns up to 50 words that start with the given prefix, optionally filtered by language. Matching uses locale-independent Unicode case folding.",
    parameters: [
      {
        in: "path",
        name: "edition",
        required: true,
        schema: { type: "string" },
        description: "Wiktionary edition (e.g. `en`, `fr`, `de`).",
      },
      {
        in: "query",
        name: "q",
        required: true,
        schema: { type: "string" },
        description: "Search prefix (Unicode case-insensitive).",
      },
      {
        in: "query",
        name: "lang",
        required: false,
        schema: { type: "string" },
        description: "Filter by language code (e.g. `de`, `ja`).",
      },
    ],
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      word: { type: "string" },
                      lang_code: { type: "string" },
                      lang: { type: "string", nullable: true },
                      pos: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: { description: "Missing required query param `q`." },
    },
  },
});

export default defineHandler((event) => {
  const edition = getRouterParam(event, "edition")!;
  const { q, lang } = getQuery(event) as { q?: string; lang?: string };

  if (!q) {
    throw createError({ statusCode: 400, message: "Missing required query param: q" });
  }

  const prefix = normalizeSearchWord(q);
  const upperBound = getPrefixUpperBound(prefix);

  type Row = { word: string; lang_code: string; lang: string | null; pos: string | null };

  const upperBoundClause = upperBound === null ? "" : "AND normalized_word < ?";
  const sql = `SELECT DISTINCT normalized_word, word, lang_code, lang, pos
               FROM entries
               WHERE edition = ?
                 AND normalized_word >= ?
                 ${upperBoundClause}
                 ${lang ? "AND lang_code = ?" : ""}
               ORDER BY normalized_word, word, lang_code, lang, pos
               LIMIT 50`;
  const parameters = [
    edition,
    prefix,
    ...(upperBound === null ? [] : [upperBound]),
    ...(lang ? [lang] : []),
  ];
  const rows = db.prepare(sql).all(...parameters) as (Row & { normalized_word: string })[];

  return {
    results: rows.map(({ normalized_word: _, ...row }) => row),
  };
});
