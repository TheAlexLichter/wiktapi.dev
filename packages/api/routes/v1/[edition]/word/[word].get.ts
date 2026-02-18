import { defineRouteMeta } from "nitro";
import { defineHandler, getRouterParam, getQuery } from "nitro/h3";
import { fetchWordEntries } from "../../../../utils/queries";

defineRouteMeta({
  openAPI: {
    tags: ["Word"],
    summary: "Full word entry",
    description:
      "Returns the full raw Wiktionary entry for a word. Each item in `entries` is the complete parsed JSON from kaikki.org.",
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
                entries: {
                  type: "array",
                  items: { type: "object" },
                  description: "Full kaikki.org entry objects.",
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

  const entries = fetchWordEntries(edition, word, lang).map((r) => ({
    senses: JSON.parse(r.senses),
    sounds: JSON.parse(r.sounds ?? "[]"),
    translations: JSON.parse(r.translations ?? "[]"),
    forms: JSON.parse(r.forms ?? "[]"),
  }));
  return { word, edition, entries };
});
