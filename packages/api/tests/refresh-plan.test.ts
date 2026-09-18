import { describe, expect, it, vi } from "vite-plus/test";
import { runRefreshCompletion, type RefreshScriptRunner } from "../utils/refresh-plan.ts";

const STAGING_PATH = "/data/staging.db";
const TOKEN = "inherited-lock-token";

function options(
  overrides: Partial<Parameters<typeof runRefreshCompletion>[0]> = {},
): Parameters<typeof runRefreshCompletion>[0] {
  return {
    allowCountRegression: false,
    noSwap: false,
    stagingPath: STAGING_PATH,
    threshold: null,
    ...overrides,
  };
}

describe("refresh completion", () => {
  it("delegates normal refresh validation and installation to the swap command", async () => {
    const runner = vi.fn<RefreshScriptRunner>().mockResolvedValue();

    await runRefreshCompletion(options(), runner, TOKEN);

    expect(runner).toHaveBeenCalledExactlyOnceWith("swap_database.ts", [], TOKEN);
  });

  it("deep-validates a no-swap refresh without invoking the swap command", async () => {
    const runner = vi.fn<RefreshScriptRunner>().mockResolvedValue();

    await runRefreshCompletion(options({ noSwap: true }), runner, TOKEN);

    expect(runner).toHaveBeenCalledExactlyOnceWith(
      "validate_database.ts",
      ["--output", STAGING_PATH, "--require-all-editions"],
      TOKEN,
    );
  });

  it.each([
    ["the regression override", { allowCountRegression: true }, ["--allow-count-regression"]],
    ["the regression threshold", { threshold: "0.1" }, ["--max-count-regression", "0.1"]],
    [
      "both regression options",
      { allowCountRegression: true, threshold: "0.1" },
      ["--allow-count-regression", "--max-count-regression", "0.1"],
    ],
  ] as const)("forwards %s to the swap command", async (_, overrides, expectedArgs) => {
    const runner = vi.fn<RefreshScriptRunner>().mockResolvedValue();

    await runRefreshCompletion(options(overrides), runner, TOKEN);

    expect(runner).toHaveBeenCalledExactlyOnceWith("swap_database.ts", expectedArgs, TOKEN);
  });

  it("propagates completion failures and does not retry with another command", async () => {
    const failure = new Error("validation failed");
    const runner = vi.fn<RefreshScriptRunner>().mockRejectedValue(failure);

    await expect(runRefreshCompletion(options(), runner, TOKEN)).rejects.toBe(failure);
    expect(runner).toHaveBeenCalledOnce();
  });
});
