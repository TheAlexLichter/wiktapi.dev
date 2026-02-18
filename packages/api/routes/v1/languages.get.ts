import { defineRouteMeta } from "nitro";
import { defineHandler } from "nitro/h3";
import { db } from "../../utils/db";

defineRouteMeta({
  openAPI: {
    tags: ["Meta"],
    summary: "List languages",
    description:
      "Returns all languages present in the database with their entry counts, sorted by frequency.",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                languages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lang_code: { type: "string", example: "de" },
                      lang: { type: "string", nullable: true, example: "German" },
                      entry_count: { type: "integer", example: 42000 },
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

export default defineHandler(() => {
  const rows = db
    .prepare(
      `SELECT lang_code, lang, COUNT(*) AS entry_count
       FROM entries
       GROUP BY lang_code, lang
       ORDER BY entry_count DESC`,
    )
    .all() as { lang_code: string; lang: string | null; entry_count: number }[];

  return { languages: rows };
});
