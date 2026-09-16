import { describe, expect, it } from "vite-plus/test";
import { compareEditionCounts } from "../utils/database-validation.ts";

describe("edition count regression comparison", () => {
  it("flags only regressions beyond the configured threshold", () => {
    const result = compareEditionCounts(
      [
        { edition: "en", entryCount: 1_000 },
        { edition: "fr", entryCount: 1_000 },
      ],
      [
        { edition: "en", entryCount: 750 },
        { edition: "fr", entryCount: 749 },
        { edition: "de", entryCount: 500 },
      ],
      0.25,
    );

    expect(result.map(({ edition, regressed }) => [edition, regressed])).toEqual([
      ["en", false],
      ["fr", true],
      ["de", false],
    ]);
    expect(result[2]?.changeFraction).toBeNull();
  });

  it("rejects invalid regression thresholds", () => {
    expect(() => compareEditionCounts([], [], -0.1)).toThrow();
    expect(() => compareEditionCounts([], [], 1)).toThrow();
  });
});
