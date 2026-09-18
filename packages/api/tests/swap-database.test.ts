import { describe, expect, it } from "vite-plus/test";
import Database from "better-sqlite3";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATABASE_LOCK_TOKEN_ENV } from "../utils/database-lock.ts";

const SWAP_SCRIPT = fileURLToPath(new URL("../scripts/swap_database.ts", import.meta.url));

async function runSwap(cwd: string): Promise<{ code: number | null; output: string }> {
  const env = { ...process.env };
  delete env[DATABASE_LOCK_TOKEN_ENV];

  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SWAP_SCRIPT], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += String(chunk)));
    child.stderr.on("data", (chunk) => (output += String(chunk)));
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}

describe("database swap", () => {
  it("does not install invalid staging before deep validation passes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wiktapi-swap-"));
    const dataDirectory = join(directory, "data");
    const livePath = join(dataDirectory, "wiktionary.db");
    const stagingPath = join(dataDirectory, "wiktionary.db.new");
    const previousPath = join(dataDirectory, "wiktionary.db.previous");
    const lockPath = join(dataDirectory, "database-maintenance.lock");
    try {
      await mkdir(dataDirectory);
      await writeFile(livePath, "live-generation");
      new Database(stagingPath).close();

      const result = await runSwap(directory);

      expect(result.code).not.toBe(0);
      expect(result.output).toMatch(/schema version 0/);
      expect(await readFile(livePath, "utf8")).toBe("live-generation");
      await expect(access(stagingPath)).resolves.toBeUndefined();
      await expect(access(previousPath)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(access(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
