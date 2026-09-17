import { describe, expect, it } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireDatabaseMaintenanceLock } from "../utils/database-lock.ts";

describe("database maintenance lock", () => {
  it("serializes maintenance and becomes reusable after release", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wiktapi-lock-"));
    const lockPath = join(directory, "maintenance.lock");
    try {
      const first = await acquireDatabaseMaintenanceLock(lockPath);
      await expect(acquireDatabaseMaintenanceLock(lockPath)).rejects.toThrow(
        /maintenance is already running/,
      );
      await first.release();

      const second = await acquireDatabaseMaintenanceLock(lockPath);
      await second.release();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
