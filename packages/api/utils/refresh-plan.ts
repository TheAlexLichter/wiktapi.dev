export interface RefreshCompletionOptions {
  allowCountRegression: boolean;
  noSwap: boolean;
  stagingPath: string;
  threshold: string | null;
}

export interface RefreshScriptInvocation {
  args: string[];
  script: string;
}

export function getRefreshCompletionScript({
  allowCountRegression,
  noSwap,
  stagingPath,
  threshold,
}: RefreshCompletionOptions): RefreshScriptInvocation {
  if (noSwap) {
    return {
      script: "validate_database.ts",
      args: ["--output", stagingPath, "--require-all-editions"],
    };
  }

  return {
    script: "swap_database.ts",
    args: [
      ...(allowCountRegression ? ["--allow-count-regression"] : []),
      ...(threshold ? ["--max-count-regression", threshold] : []),
    ],
  };
}
