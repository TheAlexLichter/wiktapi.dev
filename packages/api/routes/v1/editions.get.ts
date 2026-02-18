import { defineRouteMeta } from "nitro";
import { defineHandler } from "nitro/h3";
import { db } from "../../utils/db";

defineRouteMeta({
  openAPI: {
    tags: ["Meta"],
    summary: "List editions",
    description:
      "Returns all Wiktionary editions available in the database (e.g. `en`, `fr`, `de`).",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                editions: { type: "array", items: { type: "string" }, example: ["en", "fr", "de"] },
              },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(() => {
  const rows = db.prepare("SELECT DISTINCT edition FROM entries ORDER BY edition").all() as {
    edition: string;
  }[];

  return { editions: rows.map((r) => r.edition) };
});
