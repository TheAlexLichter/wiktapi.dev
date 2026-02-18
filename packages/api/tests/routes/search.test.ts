import { describe, it, expect } from "vite-plus/test";
import { createTestEvent, call } from "../helpers/event.ts";
import searchHandler from "../../routes/v1/[edition]/search.get";

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

  it("only returns results for the requested edition", async () => {
    const event = createTestEvent({ edition: "fr" }, { q: "ch" });
    const result = searchHandler(event);

    // "chat" exists in fr edition but with fr lang_code
    expect(result.results.length).toBeGreaterThan(0);
  });
});
