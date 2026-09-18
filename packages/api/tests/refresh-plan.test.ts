import { describe, expect, it } from "vite-plus/test";
import { getRefreshCompletionScript } from "../utils/refresh-plan.ts";

describe("refresh completion plan", () => {
  it("delegates normal refresh validation to the swap command", () => {
    expect(
      getRefreshCompletionScript({
        allowCountRegression: false,
        noSwap: false,
        stagingPath: "/data/staging.db",
        threshold: null,
      }),
    ).toEqual({ script: "swap_database.ts", args: [] });
  });

  it("deep-validates a no-swap refresh without installing it", () => {
    expect(
      getRefreshCompletionScript({
        allowCountRegression: false,
        noSwap: true,
        stagingPath: "/data/staging.db",
        threshold: null,
      }),
    ).toEqual({
      script: "validate_database.ts",
      args: ["--output", "/data/staging.db", "--require-all-editions"],
    });
  });

  it("forwards count-regression options to the swap command", () => {
    expect(
      getRefreshCompletionScript({
        allowCountRegression: true,
        noSwap: false,
        stagingPath: "/data/staging.db",
        threshold: "0.1",
      }),
    ).toEqual({
      script: "swap_database.ts",
      args: ["--allow-count-regression", "--max-count-regression", "0.1"],
    });
  });
});
