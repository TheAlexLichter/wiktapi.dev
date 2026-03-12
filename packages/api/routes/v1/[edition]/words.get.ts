import { defineRouteMeta } from "nitro";
import { defineHandler, getRouterParam, getQuery, createError } from "nitro/h3";
import { fetchWordEntriesBatch } from "../../../utils/queries";

defineRouteMeta({
    openAPI: {
        tags: ["Words"],
        summary: "Batch word lookup",
        description:
            "Returns entries for multiple words in a single request. Words not found are included in the response with an error field.",
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
                name: "words",
                required: true,
                schema: { type: "string" },
                description: "Comma-separated list of words to look up.",
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
                                            entries: {
                                                type: "array",
                                                items: { type: "object" },
                                                nullable: true,
                                            },
                                            error: { type: "string", nullable: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            400: { description: "Missing required query param `words`." },
        },
    },
});

export default defineHandler((event) => {
    const edition = getRouterParam(event, "edition")!;
    const { words, lang } = getQuery(event) as { words?: string; lang?: string };

    if (!words) {
        throw createError({ statusCode: 400, message: "Missing required query param: words" });
    }

    const wordList = words
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);

    if (wordList.length === 0) {
        throw createError({ statusCode: 400, message: "No words provided" });
    }

    const results = fetchWordEntriesBatch(edition, wordList, lang);

    return {
        results: results.map((r) => ({
            word: r.word,
            entries:
                r.entries?.map((entry) => ({
                    senses: JSON.parse(entry.senses),
                    sounds: JSON.parse(entry.sounds ?? "[]"),
                    translations: JSON.parse(entry.translations ?? "[]"),
                    forms: JSON.parse(entry.forms ?? "[]"),
                })) ?? null,
            error: r.entries === null ? "Word not found" : undefined,
        })),
    };
});
