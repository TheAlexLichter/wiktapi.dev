import { describe, expect, it } from "vite-plus/test";
import { getPrefixUpperBound, normalizeSearchWord } from "../utils/search.ts";

describe("search utilities", () => {
  it("matches SQLite's ASCII-only lower function", () => {
    expect(normalizeSearchWord("ÄPFEL")).toBe("Äpfel");
  });

  it.each([
    ["ch", "ci"],
    ["ä", "å"],
    [`a${String.fromCodePoint(0x10ffff)}`, "b"],
  ])("builds the exclusive prefix bound for %s", (prefix, expected) => {
    expect(getPrefixUpperBound(prefix)).toBe(expected);
  });

  it("has no upper bound above the maximum Unicode string", () => {
    expect(getPrefixUpperBound(String.fromCodePoint(0x10ffff))).toBeNull();
  });
});
