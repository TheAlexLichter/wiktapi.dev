import { describe, it, expect } from "vite-plus/test";
import { createTestEvent, call } from "../helpers/event.ts";
import wordsGetHandler from "../../routes/v1/[edition]/words.get";

describe("GET /v1/{edition}/words", () => {
    it("returns entries for multiple words", async () => {
        const event = createTestEvent({ edition: "en" }, { words: "run,chat" });
        const result = wordsGetHandler(event);

        expect(result.results).toHaveLength(2);
        expect(result.results[0].word).toBe("run");
        expect(result.results[0].entries).not.toBeNull();
        expect(result.results[1].word).toBe("chat");
        expect(result.results[1].entries).not.toBeNull();
    });

    it("returns error for not-found words", async () => {
        const event = createTestEvent({ edition: "en" }, { words: "run,xyznotfound" });
        const result = wordsGetHandler(event);

        expect(result.results).toHaveLength(2);
        expect(result.results[0].word).toBe("run");
        expect(result.results[0].entries).not.toBeNull();
        expect(result.results[1].word).toBe("xyznotfound");
        expect(result.results[1].entries).toBeNull();
        expect(result.results[1].error).toBe("Word not found");
    });

    it("filters by lang when ?lang= is provided", async () => {
        const event = createTestEvent({ edition: "en" }, { words: "chat", lang: "fr" });
        const result = wordsGetHandler(event);

        expect(result.results).toHaveLength(1);
        expect(result.results[0].entries).toHaveLength(1);
        expect(result.results[0].entries![0].senses[0].glosses).toContain("cat");
    });

    it("returns 400 when words param is missing", async () => {
        const event = createTestEvent({ edition: "en" }, {});
        await expect(call(wordsGetHandler, event)).rejects.toSatisfy(
            (e: any) => e.statusCode === 400,
        );
    });

    it("handles single word", async () => {
        const event = createTestEvent({ edition: "en" }, { words: "run" });
        const result = wordsGetHandler(event);

        expect(result.results).toHaveLength(1);
        expect(result.results[0].word).toBe("run");
        expect(result.results[0].entries).not.toBeNull();
    });

    it("handles words with whitespace in comma-separated list", async () => {
        const event = createTestEvent({ edition: "en" }, { words: "run , chat " });
        const result = wordsGetHandler(event);

        expect(result.results).toHaveLength(2);
        expect(result.results[0].word).toBe("run");
        expect(result.results[1].word).toBe("chat");
    });
});
