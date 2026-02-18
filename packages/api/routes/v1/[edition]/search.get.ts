import { defineRouteMeta } from "nitro";
import { defineHandler, getRouterParam, getQuery, createError } from "nitro/h3";
import { db } from "../../../utils/db";

defineRouteMeta({
  openAPI: {
    tags: ["Search"],
    summary: "Prefix search",
    description:
      "Returns up to 50 words that start with the given prefix, optionally filtered by language.",
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
        description: "Search prefix.",
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

  const prefix = q.toLowerCase().replace(/[%_]/g, "\\$&") + "%";

  type Row = { word: string; lang_code: string; lang: string | null; pos: string | null };

  const rows = (
    lang
      ? db
          .prepare(
            `SELECT DISTINCT word, lang_code, lang, pos
             FROM entries
             WHERE edition = ? AND lower(word) LIKE ? ESCAPE '\\' AND lang_code = ?
             ORDER BY word
             LIMIT 50`,
          )
          .all(edition, prefix, lang)
      : db
          .prepare(
            `SELECT DISTINCT word, lang_code, lang, pos
             FROM entries
             WHERE edition = ? AND lower(word) LIKE ? ESCAPE '\\'
             ORDER BY word
             LIMIT 50`,
          )
          .all(edition, prefix)
  ) as Row[];

  return { results: rows };
});
