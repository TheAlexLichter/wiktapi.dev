import { defineRouteMeta } from "nitro";
import { defineHandler, getRouterParam, getQuery } from "nitro/h3";
import { fetchWordEntries } from "../../../../../utils/queries";

defineRouteMeta({
  openAPI: {
    tags: ["Word"],
    summary: "Word definitions",
    description:
      "Returns senses (glosses, examples, tags) for each part-of-speech entry of the word.",
    parameters: [
      {
        in: "path",
        name: "edition",
        required: true,
        schema: { type: "string" },
        description: "Wiktionary edition (e.g. `en`, `fr`, `de`).",
      },
      {
        in: "path",
        name: "word",
        required: true,
        schema: { type: "string" },
        description: "The word to look up.",
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
                word: { type: "string" },
                edition: { type: "string" },
                definitions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pos: { type: "string", example: "noun" },
                      lang_code: { type: "string", example: "de" },
                      senses: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            glosses: { type: "array", items: { type: "string" } },
                            examples: { type: "array", items: { type: "object" } },
                            tags: { type: "array", items: { type: "string" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

export default defineHandler((event) => {
  const edition = getRouterParam(event, "edition")!;
  const word = getRouterParam(event, "word")!;
  const { lang } = getQuery(event) as { lang?: string };

  const definitions = fetchWordEntries(edition, word, lang).map((r) => ({
    pos: r.pos,
    lang_code: r.lang_code,
    senses: (JSON.parse(r.senses) as Record<string, unknown>[]).map((s) => ({
      glosses: s.glosses ?? [],
      examples: s.examples ?? [],
      tags: s.tags ?? [],
    })),
  }));

  return { word, edition, definitions };
});
