import { describe, expect, it } from "vite-plus/test";
import { describeEditionDifference } from "../utils/editions.ts";

describe("edition manifest comparison", () => {
  it("accepts the same manifest in a different order", () => {
    expect(describeEditionDifference(["fr", "en"], ["en", "fr"])).toBeNull();
  });

  it("reports missing and unexpected editions", () => {
    expect(describeEditionDifference(["en", "de"], ["en", "fr"])).toBe(
      "missing: fr; unexpected: de",
    );
  });

  it("rejects duplicate editions", () => {
    expect(describeEditionDifference(["en", "en", "fr"], ["en", "fr"])).toBe("duplicates: en");
  });
});
