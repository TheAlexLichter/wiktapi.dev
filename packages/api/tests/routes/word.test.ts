import { describe, it, expect } from "vite-plus/test";
import { createTestEvent, call } from "../helpers/event.ts";
import wordHandler from "../../routes/v1/[edition]/word/[word].get";
import definitionsHandler from "../../routes/v1/[edition]/word/[word]/definitions.get";
import translationsHandler from "../../routes/v1/[edition]/word/[word]/translations.get";
import pronunciationsHandler from "../../routes/v1/[edition]/word/[word]/pronunciations.get";
import formsHandler from "../../routes/v1/[edition]/word/[word]/forms.get";

// ── /word/{word} ─────────────────────────────────────────────────────────────

describe("GET /v1/{edition}/word/{word}", () => {
  it("returns all entries for a word across languages", async () => {
    const event = createTestEvent({ edition: "en", word: "run" });
    const result = wordHandler(event);

    expect(result.word).toBe("run");
    expect(result.edition).toBe("en");
    expect(result.entries).toHaveLength(2); // noun + verb
  });

  it("filters by lang when ?lang= is provided", async () => {
    const event = createTestEvent({ edition: "en", word: "chat" }, { lang: "fr" });
    const result = wordHandler(event);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.senses[0]?.glosses).toContain("cat");
  });

  it("returns 404 for unknown word", async () => {
    const event = createTestEvent({ edition: "en", word: "xyzunknown" });
    await expect(call(wordHandler, event)).rejects.toSatisfy((e: any) => e.statusCode === 404);
  });

  it("returns 404 for wrong edition", async () => {
    const event = createTestEvent({ edition: "de", word: "chat" });
    await expect(call(wordHandler, event)).rejects.toSatisfy((e: any) => e.statusCode === 404);
  });
});

// ── /word/{word}/definitions ──────────────────────────────────────────────────

describe("GET /v1/{edition}/word/{word}/definitions", () => {
  it("returns senses with glosses", async () => {
    const event = createTestEvent({ edition: "en", word: "Haus" });
    const result = definitionsHandler(event);

    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]?.pos).toBe("noun");
    expect(result.definitions[0]?.senses[0]?.glosses).toContain("house");
  });

  it("returns multiple POS entries for polysemous words", async () => {
    const event = createTestEvent({ edition: "en", word: "run" });
    const result = definitionsHandler(event);

    const posList = result.definitions.map((d) => d.pos).filter(Boolean);
    expect(posList).toContain("noun");
    expect(posList).toContain("verb");
  });
});

// ── /word/{word}/translations ─────────────────────────────────────────────────

describe("GET /v1/{edition}/word/{word}/translations", () => {
  it("returns translations array", async () => {
    const event = createTestEvent({ edition: "en", word: "run" }, { lang: "en" });
    const result = translationsHandler(event);

    const verbEntry = result.translations.find((t) => t.pos === "verb");
    expect(verbEntry?.translations).toHaveLength(1);
    expect(verbEntry?.translations[0].word).toBe("courir");
  });

  it("returns empty translations for entries without them", async () => {
    const event = createTestEvent({ edition: "en", word: "Haus" });
    const result = translationsHandler(event);

    expect(result.translations[0]?.translations).toHaveLength(0);
  });
});

// ── /word/{word}/pronunciations ───────────────────────────────────────────────

describe("GET /v1/{edition}/word/{word}/pronunciations", () => {
  it("returns IPA for French chat", async () => {
    const event = createTestEvent({ edition: "en", word: "chat" }, { lang: "fr" });
    const result = pronunciationsHandler(event);

    expect(result.pronunciations[0]?.sounds[0]?.ipa).toBe("/ʃa/");
  });

  it("returns IPA for German Haus", async () => {
    const event = createTestEvent({ edition: "en", word: "Haus" });
    const result = pronunciationsHandler(event);

    expect(result.pronunciations[0]?.sounds[0]?.ipa).toBe("/haʊ̯s/");
  });
});

// ── /word/{word}/forms ────────────────────────────────────────────────────────

describe("GET /v1/{edition}/word/{word}/forms", () => {
  it("returns inflected forms for German Haus", async () => {
    const event = createTestEvent({ edition: "en", word: "Haus" });
    const result = formsHandler(event);

    const forms = result.forms[0]?.forms;
    expect(forms.some((f: { form: string }) => f.form === "Hauses")).toBe(true);
    expect(forms.some((f: { form: string }) => f.form === "Häuser")).toBe(true);
  });

  it("returns empty forms for uninflected entries", async () => {
    const event = createTestEvent({ edition: "en", word: "run" }, { lang: "en" });
    const result = formsHandler(event);

    const nounForms = result.forms.find((f) => f.pos === "noun");
    expect(nounForms?.forms).toHaveLength(0);
  });
});
