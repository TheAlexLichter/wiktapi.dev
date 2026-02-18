import { defineRouteMeta } from "nitro";
import { defineHandler, getRouterParam, getQuery } from "nitro/h3";
import { fetchWordEntries } from "../../../../../utils/queries";

defineRouteMeta({
  openAPI: {
    tags: ["Word"],
    summary: "Word pronunciations",
    description: "Returns IPA and audio pronunciations for each part-of-speech entry of the word.",
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
                pronunciations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pos: { type: "string" },
                      lang_code: { type: "string" },
                      sounds: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            ipa: { type: "string", nullable: true, example: "/haʊs/" },
                            audio: { type: "string", nullable: true },
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

  const pronunciations = fetchWordEntries(edition, word, lang).map((r) => ({
    pos: r.pos,
    lang_code: r.lang_code,
    sounds: (JSON.parse(r.sounds ?? "[]") as Record<string, unknown>[]).map((s) => ({
      ipa: s.ipa ?? null,
      audio: s.audio ?? null,
      tags: s.tags ?? [],
    })),
  }));

  return { word, edition, pronunciations };
});
