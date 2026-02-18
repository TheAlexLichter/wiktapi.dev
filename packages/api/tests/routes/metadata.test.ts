import { describe, it, expect } from "vite-plus/test";
import { createTestEvent } from "../helpers/event.ts";
import editionsHandler from "../../routes/v1/editions.get";
import languagesHandler from "../../routes/v1/languages.get";

describe("GET /v1/editions", () => {
  it("returns all distinct editions", () => {
    const result = editionsHandler(createTestEvent());
    expect(result).toEqual({ editions: ["en", "fr"] });
  });
});

describe("GET /v1/languages", () => {
  it("returns all languages with entry counts", () => {
    const result = languagesHandler(createTestEvent());
    expect(result.languages.length).toBeGreaterThan(0);

    const codes = result.languages.map((l: { lang_code: string }) => l.lang_code);
    expect(codes).toContain("fr");
    expect(codes).toContain("de");
    expect(codes).toContain("en");
  });

  it("includes entry_count for each language", () => {
    const result = languagesHandler(createTestEvent());
    for (const lang of result.languages) {
      expect(lang.entry_count).toBeGreaterThan(0);
    }
  });

  it("is sorted by entry count descending", () => {
    const result = languagesHandler(createTestEvent());
    const counts = result.languages.map((l: { entry_count: number }) => l.entry_count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]!);
    }
  });
});
