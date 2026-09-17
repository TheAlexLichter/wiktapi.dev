import { describe, it, expect } from "vite-plus/test";
import { createTestEvent, call } from "../helpers/event.ts";
import searchHandler from "../../routes/v1/[edition]/search.get";
import { db } from "../../utils/db.ts";

const SEARCH_PLAN_SQL = `EXPLAIN QUERY PLAN
  SELECT DISTINCT normalized_word, word, lang_code, lang, pos
  FROM entries
  WHERE edition = ?
    AND normalized_word >= ?
    AND normalized_word < ?
  ORDER BY normalized_word, word, lang_code, lang, pos
  LIMIT 50`;

const SEARCH_BY_LANGUAGE_PLAN_SQL = `EXPLAIN QUERY PLAN
  SELECT DISTINCT normalized_word, word, lang_code, lang, pos
  FROM entries
  WHERE edition = ?
    AND normalized_word >= ?
    AND normalized_word < ?
    AND lang_code = ?
  ORDER BY normalized_word, word, lang_code, lang, pos
  LIMIT 50`;

describe("GET /v1/{edition}/search", () => {
  it("returns prefix matches", async () => {
    const event = createTestEvent({ edition: "en" }, { q: "ch" });
    const result = searchHandler(event);

    const words = result.results.map((r: { word: string }) => r.word);
    expect(words).toContain("chat");
  });

  it("filters by lang when ?lang= is provided", async () => {
    const event = createTestEvent({ edition: "en" }, { q: "ch", lang: "fr" });
    const result = searchHandler(event);

    expect(result.results.every((r: { lang_code: string }) => r.lang_code === "fr")).toBe(true);
  });

  it("returns 400 when q is missing", async () => {
    const event = createTestEvent({ edition: "en" });
    await expect(call(searchHandler, event)).rejects.toSatisfy((e: any) => e.statusCode === 400);
  });

  it("returns empty results for no match", async () => {
    const event = createTestEvent({ edition: "en" }, { q: "xyzxyz" });
    const result = searchHandler(event);

    expect(result.results).toHaveLength(0);
  });

  it("is case-insensitive", async () => {
    const event = createTestEvent({ edition: "en" }, { q: "CHAT" });
    const result = searchHandler(event);

    const words = result.results.map((r: { word: string }) => r.word);
    expect(words).toContain("chat");
  });

  it("folds non-ASCII case", () => {
    const event = createTestEvent({ edition: "en" }, { q: "äP" });
    const result = searchHandler(event);

    expect(result.results.map((r: { word: string }) => r.word)).toContain("Äpfel");
  });

  it("uses full Unicode folding for expanding and contextual mappings", () => {
    const sharpS = searchHandler(createTestEvent({ edition: "en" }, { q: "STRASS" }));
    const sigma = searchHandler(createTestEvent({ edition: "en" }, { q: "ος" }));

    expect(sharpS.results.map((r: { word: string }) => r.word)).toContain("Straße");
    expect(sigma.results.map((r: { word: string }) => r.word)).toContain("ΟΣΑ");
  });

  it.each(["%", "_"])("treats %s as a literal prefix", (prefix) => {
    const event = createTestEvent({ edition: "en" }, { q: prefix });
    const result = searchHandler(event);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.word).toBe(`${prefix}literal`);
  });

  it("only returns results for the requested edition", async () => {
    const event = createTestEvent({ edition: "fr" }, { q: "ch" });
    const result = searchHandler(event);

    // "chat" exists in fr edition but with fr lang_code
    expect(result.results.length).toBeGreaterThan(0);
  });

  it.each([
    ["unfiltered", SEARCH_PLAN_SQL, ["en", "ch", "ci"], "idx_search_prefix"],
    [
      "language-filtered",
      SEARCH_BY_LANGUAGE_PLAN_SQL,
      ["en", "ch", "ci", "fr"],
      "idx_search_lang_prefix",
    ],
  ])("uses the covering prefix index for %s searches", (_, sql, parameters, indexName) => {
    const plan = db.prepare(sql).all(...parameters) as { detail: string }[];
    const details = plan.map(({ detail }) => detail).join("\n");

    expect(details).toContain(`USING COVERING INDEX ${indexName}`);
    expect(details).not.toContain("USE TEMP B-TREE");
  });
});
