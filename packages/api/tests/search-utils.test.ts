import { describe, expect, it } from "vite-plus/test";
import { getPrefixUpperBound, normalizeSearchWord } from "../utils/search.ts";

describe("search utilities", () => {
  it.each([
    ["ÄPFEL", "äpfel"],
    ["Straße", "strasse"],
    ["ΟΣ", "οσ"],
    ["ος", "οσ"],
  ])("case-folds %s to %s", (input, expected) => {
    expect(normalizeSearchWord(input)).toBe(expected);
  });

  it("normalizes canonically equivalent keys", () => {
    expect(normalizeSearchWord("A\u030A")).toBe(normalizeSearchWord("Å"));
  });

  it("normalizes canonically equivalent reordered marks before case folding", () => {
    const ypogegrammeniBeforeGrave = "\u0345\u0300";
    const canonicallyReordered = ypogegrammeniBeforeGrave.normalize("NFD");

    expect(normalizeSearchWord(ypogegrammeniBeforeGrave)).toBe(
      normalizeSearchWord(canonicallyReordered),
    );
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
