export interface RefreshCompletionOptions {
  allowCountRegression: boolean;
  noSwap: boolean;
  stagingPath: string;
  threshold: string | null;
}

export type RefreshScriptRunner = (script: string, args: string[], token: string) => Promise<void>;

export async function runRefreshCompletion(
  { allowCountRegression, noSwap, stagingPath, threshold }: RefreshCompletionOptions,
  runScript: RefreshScriptRunner,
  token: string,
): Promise<void> {
  if (noSwap) {
    await runScript(
      "validate_database.ts",
      ["--output", stagingPath, "--require-all-editions"],
      token,
    );
    return;
  }

  await runScript(
    "swap_database.ts",
    [
      ...(allowCountRegression ? ["--allow-count-regression"] : []),
      ...(threshold ? ["--max-count-regression", threshold] : []),
    ],
    token,
  );
}
