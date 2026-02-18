import { defineRouteMeta } from "nitro";
import { defineHandler, getRouterParam, getQuery } from "nitro/h3";
import { fetchWordEntries } from "../../../../../utils/queries";

defineRouteMeta({
  openAPI: {
    tags: ["Word"],
    summary: "Word forms",
    description:
      "Returns inflected forms (e.g. plural, genitive, conjugations) for each part-of-speech entry.",
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
                forms: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pos: { type: "string" },
                      lang_code: { type: "string" },
                      forms: { type: "array", items: { type: "object" } },
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

  const forms = fetchWordEntries(edition, word, lang).map((r) => ({
    pos: r.pos,
    lang_code: r.lang_code,
    forms: JSON.parse(r.forms ?? "[]"),
  }));

  return { word, edition, forms };
});
