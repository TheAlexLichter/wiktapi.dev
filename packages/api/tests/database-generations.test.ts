import { describe, expect, it } from "vite-plus/test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  installDatabaseGeneration,
  rollbackDatabaseGeneration,
  sameFileIdentity,
} from "../utils/database-generations.ts";

describe("database generations", () => {
  it("installs and rolls back without removing the live pathname", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wiktapi-generations-"));
    const livePath = join(directory, "wiktionary.db");
    const stagingPath = join(directory, "wiktionary.db.new");
    const previousPath = join(directory, "wiktionary.db.previous");
    const failedPath = join(directory, "wiktionary.db.failed");
    const temporaryPath = join(directory, "wiktionary.db.rollback.tmp");
    try {
      await writeFile(livePath, "old");
      await writeFile(stagingPath, "new");
      const stagingIdentity = await stat(stagingPath);

      await installDatabaseGeneration({ stagingPath, livePath, previousPath });
      expect(await readFile(livePath, "utf8")).toBe("new");
      expect(await readFile(previousPath, "utf8")).toBe("old");
      expect(sameFileIdentity(stagingIdentity, await stat(livePath))).toBe(true);

      await rollbackDatabaseGeneration({ previousPath, livePath, failedPath, temporaryPath });
      expect(await readFile(livePath, "utf8")).toBe("old");
      expect(await readFile(previousPath, "utf8")).toBe("old");
      expect(await readFile(failedPath, "utf8")).toBe("new");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
